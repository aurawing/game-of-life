import type { Provider, ThinkingEffort } from '../../types';
import type { PiModelConfig } from '../pi-catalog';
import { httpJson } from '../http';
import { thinkingPayload, completionFromJson, formatHttpError } from './stream';
import { toOpenAiTools, type ToolDefinition } from './tools';
import { isDeepSeekOfficialUrl, isOpenCodeGoUrl, normalizeChatBaseUrl } from '../provider-urls';

export { chatCompletionsUrl, isDeepSeekOfficialUrl, isOpenCodeGoUrl, normalizeChatBaseUrl } from '../provider-urls';

const MAX_REQUEST_TOKENS = 32_768;

export const EMPTY_MODEL_REPLY =
  '请求完成但没有正文。OpenCode Go 与 DeepSeek 官网不能混用密钥：Go 请选「OpenCode Go」并用 Zen/Go Key；DeepSeek 官网请选「DeepSeek」并用 sk- 密钥。';

export function normalizeApiKey(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
}

export function isMaskedApiKey(raw: string | undefined): boolean {
  return /(?:\.{3}|…)/.test(raw ?? '');
}

export function explainAuthFailure(apiKey: string, message: string): string {
  const key = normalizeApiKey(apiKey);
  const base = message.replace(/^请求失败：\s*/, '');
  if (isMaskedApiKey(apiKey) || isMaskedApiKey(key)) {
    return `${base} 当前像是控制台掩码（含省略号），不是完整 Key。请到 OpenCode 新建密钥，在弹窗里复制完整 sk-。`;
  }
  if (key.length > 0 && key.length < 40) {
    return `${base} 这次只发出了 ${key.length} 位。OpenCode 完整 Key 一般是 sk- 加约 64 位；请点「显示」后重新粘贴，不要用列表里带 … 的那一行。`;
  }
  if (key.length >= 40) {
    return `${base} 已发送 ${key.length} 位仍被拒绝。请确认已订阅 OpenCode Go，并用新建时显示的完整密钥。`;
  }
  return base;
}

export function shouldSendThinkingPayload(baseUrl: string, config?: PiModelConfig | null): boolean {
  const format = config?.compat?.thinkingFormat;
  if (!config || config.reasoning === false) return false;
  if (!format || format === 'none') return false;
  if (format === 'deepseek') return isDeepSeekOfficialUrl(baseUrl);
  if (format === 'zai') return /z\.ai|bigmodel\.cn/i.test(baseUrl);
  return !isOpenCodeGoUrl(baseUrl);
}

export function requestMaxTokens(config?: PiModelConfig | null): number | undefined {
  const field = config?.compat?.maxTokensField;
  const n = config?.maxTokens;
  if (!field || !n || n <= 0 || n > MAX_REQUEST_TOKENS) return undefined;
  return n;
}

export function authHeaders(provider: Provider, config?: PiModelConfig | null): Record<string, string> {
  const headers: Record<string, string> = { ...(config?.headers ?? {}) };
  const apiKey = normalizeApiKey(provider.apiKey);
  if (config?.api === 'anthropic-messages') {
    if (apiKey) headers['x-api-key'] = apiKey;
    if (!headers['anthropic-version']) headers['anthropic-version'] = '2023-06-01';
    return headers;
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export function buildChatBody(opts: {
  model: string;
  messages: unknown[];
  effort: ThinkingEffort;
  baseUrl: string;
  modelConfig?: PiModelConfig | null;
  tools?: ToolDefinition[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
  };
  if (shouldSendThinkingPayload(opts.baseUrl, opts.modelConfig)) {
    Object.assign(body, thinkingPayload(opts.effort, opts.modelConfig));
  }
  const maxTokens = requestMaxTokens(opts.modelConfig);
  const maxField = opts.modelConfig?.compat?.maxTokensField;
  if (maxField && maxTokens) body[maxField] = maxTokens;
  if (opts.tools?.length && !isOpenCodeGoUrl(opts.baseUrl)) body.tools = toOpenAiTools(opts.tools);
  return body;
}

export async function fetchJsonCompletion(opts: {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{ content: string; reasoning: string; error?: string }> {
  const fallbackBody: Record<string, unknown> = { ...opts.body, stream: false };
  delete fallbackBody.tools;
  const res = await httpJson(opts.url, {
    method: 'POST',
    headers: { Accept: 'application/json', ...opts.headers },
    body: fallbackBody,
    timeout: 120000,
  });
  const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
  if (res.status >= 400) {
    return { content: '', reasoning: '', error: formatHttpError(res.status, raw) };
  }
  const parsed = typeof res.data === 'string' ? completionFromJson(tryParse(res.data)) : completionFromJson(res.data);
  if (parsed.error) return parsed;
  if (!parsed.content && !parsed.reasoning) {
    const snippet = raw.replace(/\s+/g, ' ').slice(0, 280);
    return { content: '', reasoning: '', error: snippet ? `空响应：${snippet}` : 'HTTP 完成但没有正文' };
  }
  return parsed;
}

export async function probeProviderAuth(provider: Provider): Promise<{ ok: boolean; detail: string }> {
  const apiKey = normalizeApiKey(provider.apiKey);
  if (!apiKey) return { ok: false, detail: '请先填写 API Key' };
  if (isMaskedApiKey(provider.apiKey) || isMaskedApiKey(apiKey)) {
    return { ok: false, detail: '这是带省略号的掩码，请粘贴新建时显示的完整密钥' };
  }
  const url = `${normalizeChatBaseUrl(provider.baseUrl)}/models`;
  const res = await httpJson(url, {
    headers: authHeaders({ ...provider, apiKey }),
    timeout: 15000,
  });
  if (res.status >= 200 && res.status < 300) {
    const data = res.data as { data?: unknown[] } | unknown[] | null;
    const list = Array.isArray(data) ? data : data && typeof data === 'object' ? data.data : undefined;
    const count = Array.isArray(list) ? list.length : undefined;
    return { ok: true, detail: count != null ? `密钥有效，已列出 ${count} 个模型` : '密钥有效' };
  }
  const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
  return { ok: false, detail: explainAuthFailure(apiKey, formatHttpError(res.status, raw)) };
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
