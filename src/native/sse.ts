import { registerPlugin } from '@capacitor/core';
import { extractStreamEvents, iterateSse, parseSseBlock, type StreamEvent } from '../lib/harness/stream';

export interface NativeSsePlugin {
  start(options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ id: string }>;
  stop(options: { id: string }): Promise<void>;
  addListener(
    eventName: 'chunk' | 'done' | 'error',
    cb: (ev: { id: string; data?: string; message?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const NativeSse = registerPlugin<NativeSsePlugin>('Sse');

export async function* streamChatCompletions(options: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
  preferNative?: boolean;
}): AsyncGenerator<StreamEvent> {
  const payload = JSON.stringify(options.body);
  if (options.preferNative) {
    try {
      yield* streamViaNative(options.url, options.headers, payload, options.signal);
      return;
    } catch {
      /* fall back to fetch */
    }
  }

  const res = await fetch(options.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...options.headers,
    },
    body: payload,
    signal: options.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    yield { type: 'error', message: `HTTP ${res.status}: ${text.slice(0, 400)}` };
    yield { type: 'done' };
    return;
  }
  yield* iterateSse(res.body, options.signal);
}

async function* streamViaNative(
  url: string,
  headers: Record<string, string>,
  body: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const started = await NativeSse.start({ url, method: 'POST', headers, body });
  const queue: StreamEvent[] = [];
  let notify: (() => void) | null = null;
  let finished = false;

  const wake = () => notify?.();
  const chunkHandle = await NativeSse.addListener('chunk', (ev) => {
    if (ev.id !== started.id || !ev.data) return;
    const parsed = parseSseBlock(`data: ${ev.data}`);
    if (parsed === 'DONE') {
      queue.push({ type: 'done' });
      finished = true;
      wake();
      return;
    }
    if (parsed) queue.push(...extractStreamEvents(parsed));
    wake();
  });
  const doneHandle = await NativeSse.addListener('done', (ev) => {
    if (ev.id !== started.id) return;
    queue.push({ type: 'done' });
    finished = true;
    wake();
  });
  const errHandle = await NativeSse.addListener('error', (ev) => {
    if (ev.id !== started.id) return;
    queue.push({ type: 'error', message: ev.message ?? 'native sse error' });
    queue.push({ type: 'done' });
    finished = true;
    wake();
  });

  const abort = () => {
    void NativeSse.stop({ id: started.id });
    finished = true;
    wake();
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    while (!finished || queue.length) {
      if (!queue.length) {
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
      }
      const ev = queue.shift();
      if (ev) yield ev;
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    await chunkHandle.remove();
    await doneHandle.remove();
    await errHandle.remove();
    await NativeSse.stop({ id: started.id }).catch(() => undefined);
  }
}
