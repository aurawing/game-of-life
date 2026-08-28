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

export function parseSseBlock(block: string): unknown | 'DONE' | null {
  const dataLines = block
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart());
  if (!dataLines.length) return null;
  const payload = dataLines.join('\n').trim();
  if (!payload) return null;
  if (payload === '[DONE]') return 'DONE';
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

export function extractStreamEvents(json: unknown): StreamEvent[] {
  const events: StreamEvent[] = [];
  if (!json || typeof json !== 'object') return events;
  const obj = json as Record<string, unknown>;

  if (typeof obj.error === 'string') {
    events.push({ type: 'error', message: obj.error });
    return events;
  }
  if (obj.error && typeof obj.error === 'object') {
    const err = obj.error as Record<string, unknown>;
    events.push({ type: 'error', message: String(err.message ?? JSON.stringify(err)) });
    return events;
  }

  const choices = obj.choices as unknown[] | undefined;
  const choice = Array.isArray(choices) ? (choices[0] as Record<string, unknown> | undefined) : undefined;
  const delta = (choice?.delta ?? choice?.message ?? obj.delta) as Record<string, unknown> | undefined;
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
        const parsed = parseSseBlock(part);
        if (parsed === 'DONE') {
          yield { type: 'done' };
          return;
        }
        if (parsed) {
          const events = extractStreamEvents(parsed);
          for (const ev of events) yield ev;
        }
      }
    }
    if (buffer.trim()) {
      const parsed = parseSseBlock(buffer);
      if (parsed && parsed !== 'DONE') {
        for (const ev of extractStreamEvents(parsed)) yield ev;
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
  if (!config) {
    if (effort === 'none' || effort === 'off') {
      return { thinking: { type: 'disabled' } };
    }
    const mapped = effort === 'medium' ? 'high' : effort;
    return { thinking: { type: 'enabled' }, reasoning_effort: mapped };
  }
  if (config.reasoning === false) return {};
  const format = config.compat?.thinkingFormat ?? 'openai';
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
