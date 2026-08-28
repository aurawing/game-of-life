export type StreamEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'content'; text: string }
  | { type: 'tool_call'; index: number; id?: string; name?: string; arguments?: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

interface ToolAcc {
  id?: string;
  name?: string;
  arguments: string;
}

function tryJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function extractErrorMessage(json: unknown): string | null {
  if (typeof json === 'string' && json.trim()) return json.trim();
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
  if (obj.error && typeof obj.error === 'object') {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return 'error';
    }
  }
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
  return null;
}

export function formatHttpError(status: number | undefined, body: string): string {
  const trimmed = (body || '').trim();
  const parsed = trimmed ? tryJson(trimmed) : undefined;
  const detail = extractErrorMessage(parsed) ?? trimmed.slice(0, 400) ?? '';
  if (status != null && status > 0) {
    return detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
  }
  return detail || '请求失败';
}

export function polishErrorMessage(message: string): string {
  const match = message.match(/^HTTP\s+(\d+)\s*:\s*([\s\S]*)$/i);
  if (match) return formatHttpError(Number(match[1]), match[2]);
  const parsed = tryJson(message);
  const extracted = extractErrorMessage(parsed);
  return extracted || message;
}

export function parseSsePayloads(block: string): Array<unknown | 'DONE'> {
  const dataLines = block
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart());
  const payload = (dataLines.length ? dataLines.join('\n') : block).trim();
  if (!payload) return [];
  if (payload === '[DONE]') return ['DONE'];
  const json = tryJson(payload);
  if (json !== undefined) return [json];
  const items: Array<unknown | 'DONE'> = [];
  for (const line of payload.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t === '[DONE]') {
      items.push('DONE');
      continue;
    }
    const row = tryJson(t);
    if (row !== undefined) items.push(row);
  }
  return items;
}

export function parseSseBlock(block: string): unknown | 'DONE' | null {
  const items = parseSsePayloads(block);
  if (!items.length) return null;
  return items[0];
}

export function payloadsFromChunk(data: string): Array<unknown | 'DONE'> {
  const trimmed = data.trim();
  if (!trimmed) return [];
  if (trimmed === '[DONE]') return ['DONE'];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const json = tryJson(trimmed);
    if (json !== undefined) return [json];
  }
  return parseSsePayloads(trimmed.includes('data:') ? trimmed : `data: ${trimmed}`);
}

export function extractStreamEvents(json: unknown): StreamEvent[] {
  const events: StreamEvent[] = [];
  if (!json || typeof json !== 'object') return events;
  const obj = json as Record<string, unknown>;

  const err = extractErrorMessage(obj);
  if (err && (obj.error != null || (typeof obj.message === 'string' && !obj.choices))) {
    events.push({ type: 'error', message: err });
    return events;
  }

  const choices = obj.choices as unknown[] | undefined;
  const choice = Array.isArray(choices) ? (choices[0] as Record<string, unknown> | undefined) : undefined;
  const delta = (choice?.delta ?? choice?.message ?? obj.delta ?? obj.message) as Record<string, unknown> | undefined;
  if (delta) {
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoning === 'string' && reasoning) {
      events.push({ type: 'reasoning', text: reasoning });
    }
    if (typeof delta.content === 'string' && delta.content) {
      events.push({ type: 'content', text: delta.content });
    }
    const toolCalls = delta.tool_calls as unknown[] | undefined;
    if (Array.isArray(toolCalls)) {
      for (const raw of toolCalls) {
        const tc = raw as Record<string, unknown>;
        const fn = (tc.function ?? {}) as Record<string, unknown>;
        events.push({
          type: 'tool_call',
          index: typeof tc.index === 'number' ? tc.index : 0,
          id: typeof tc.id === 'string' ? tc.id : undefined,
          name: typeof fn.name === 'string' ? fn.name : undefined,
          arguments: typeof fn.arguments === 'string' ? fn.arguments : undefined,
        });
      }
    }
  }
  return events;
}

export function eventsFromPayloads(payloads: Array<unknown | 'DONE'>): { events: StreamEvent[]; done: boolean } {
  const events: StreamEvent[] = [];
  let done = false;
  for (const parsed of payloads) {
    if (parsed === 'DONE') {
      done = true;
      break;
    }
    events.push(...extractStreamEvents(parsed));
  }
  return { events, done };
}

export function mergeToolCalls(acc: ToolAcc[], ev: Extract<StreamEvent, { type: 'tool_call' }>): ToolAcc[] {
  const next = acc.slice();
  const cur = next[ev.index] ?? { arguments: '' };
  next[ev.index] = {
    id: ev.id ?? cur.id,
    name: ev.name ?? cur.name,
    arguments: cur.arguments + (ev.arguments ?? ''),
  };
  return next;
}

export async function* iterateSse(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const { events, done: finished } = eventsFromPayloads(parseSsePayloads(part));
        for (const ev of events) yield ev;
        if (finished) {
          yield { type: 'done' };
          return;
        }
      }
    }
    if (buffer.trim()) {
      const payloads = buffer.includes('data:') ? parseSsePayloads(buffer) : payloadsFromChunk(buffer);
      const { events, done } = eventsFromPayloads(payloads);
      for (const ev of events) yield ev;
      if (done) {
        yield { type: 'done' };
        return;
      }
    }
    yield { type: 'done' };
  } finally {
    reader.releaseLock();
  }
}

export function thinkingPayload(
  effort: string,
  config?: {
    reasoning?: boolean;
    compat?: { thinkingFormat?: string };
    thinkingLevelMap?: Record<string, string | null>;
  } | null,
): Record<string, unknown> {
  if (!config) return {};
  if (config.reasoning === false) return {};
  const format = config.compat?.thinkingFormat ?? 'openai';
  if (format === 'none') return {};
  const map = config.thinkingLevelMap;
  const off = effort === 'none' || effort === 'off';
  if (off) {
    if (format === 'deepseek' || format === 'zai') return { thinking: { type: 'disabled' } };
    const mappedOff = map?.off ?? map?.none;
    return mappedOff ? { reasoning_effort: mappedOff } : {};
  }
  const mapped = map?.[effort] ?? (effort === 'medium' ? map?.high : undefined) ?? effort;
  if (mapped == null) {
    return format === 'deepseek' || format === 'zai' ? { thinking: { type: 'disabled' } } : {};
  }
  if (format === 'deepseek' || format === 'zai') {
    return { thinking: { type: 'enabled' }, reasoning_effort: String(mapped) };
  }
  return { reasoning_effort: String(mapped) };
}
