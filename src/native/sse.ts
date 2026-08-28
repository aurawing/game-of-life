import { registerPlugin } from '@capacitor/core';
import {
  eventsFromPayloads,
  iterateSse,
  payloadsFromChunk,
  polishErrorMessage,
  formatHttpError,
  type StreamEvent,
} from '../lib/harness/stream';

export interface NativeSsePlugin {
  start(options: {
    id?: string;
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

type Session = {
  queue: StreamEvent[];
  finished: boolean;
  notify: (() => void) | null;
};

const sessions = new Map<string, Session>();
let busReady: Promise<void> | null = null;

function wake(session: Session) {
  session.notify?.();
  session.notify = null;
}

function sessionOf(id: string): Session {
  let session = sessions.get(id);
  if (!session) {
    session = { queue: [], finished: false, notify: null };
    sessions.set(id, session);
  }
  return session;
}

function ensureBus(): Promise<void> {
  if (!busReady) {
    busReady = (async () => {
      await NativeSse.addListener('chunk', (ev) => {
        const session = sessions.get(ev.id);
        if (!session || !ev.data) return;
        const { events, done } = eventsFromPayloads(payloadsFromChunk(ev.data));
        session.queue.push(...events);
        if (done) {
          session.queue.push({ type: 'done' });
          session.finished = true;
        }
        wake(session);
      });
      await NativeSse.addListener('done', (ev) => {
        const session = sessions.get(ev.id);
        if (!session) return;
        session.queue.push({ type: 'done' });
        session.finished = true;
        wake(session);
      });
      await NativeSse.addListener('error', (ev) => {
        const session = sessions.get(ev.id);
        if (!session) return;
        session.queue.push({ type: 'error', message: polishErrorMessage(ev.message ?? 'native sse error') });
        session.queue.push({ type: 'done' });
        session.finished = true;
        wake(session);
      });
    })();
  }
  return busReady;
}

function newStreamId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sse_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

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
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    yield { type: 'error', message: formatHttpError(res.status, text) };
    yield { type: 'done' };
    return;
  }
  if (/event-stream/i.test(contentType) && res.body) {
    yield* iterateSse(res.body, options.signal);
    return;
  }
  const text = await res.text().catch(() => '');
  if (!text.trim()) {
    yield { type: 'error', message: formatHttpError(res.status, 'empty body') };
    yield { type: 'done' };
    return;
  }
  const { events } = eventsFromPayloads(payloadsFromChunk(text));
  for (const ev of events) yield ev;
  yield { type: 'done' };
}

async function* streamViaNative(
  url: string,
  headers: Record<string, string>,
  body: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  await ensureBus();
  const id = newStreamId();
  const session = sessionOf(id);
  const abort = () => {
    void NativeSse.stop({ id });
    session.finished = true;
    wake(session);
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await NativeSse.start({ id, url, method: 'POST', headers, body });
    while (!session.finished || session.queue.length) {
      if (!session.queue.length) {
        await new Promise<void>((resolve) => {
          session.notify = resolve;
        });
      }
      const ev = session.queue.shift();
      if (ev) yield ev;
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    sessions.delete(id);
    await NativeSse.stop({ id }).catch(() => undefined);
  }
}
