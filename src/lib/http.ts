import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface HttpJsonResult {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

export async function httpJson(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
  } = {},
): Promise<HttpJsonResult> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers ?? {}) };
  if (init.body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: init.body,
      connectTimeout: init.timeout ?? 30000,
      readTimeout: init.timeout ?? 30000,
    });
    return { status: res.status, data: res.data, headers: res.headers ?? {} };
  }

  const res = await fetch(url, {
    method,
    headers,
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const outHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    outHeaders[k] = v;
  });
  return { status: res.status, data, headers: outHeaders };
}

export async function httpText(url: string, timeout = 20000): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, readTimeout: timeout, connectTimeout: timeout });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch(url);
  return res.text();
}
