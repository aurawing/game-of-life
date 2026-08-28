import type { Provider, ThinkingEffort } from '../../types';
import type { PiModelConfig } from '../pi-catalog';
import { httpJson } from '../http';
import { thinkingPayload, completionFromJson, formatHttpError } from './stream';
import { toOpenAiTools, type ToolDefinition } from './tools';
import { isDeepSeekOfficialUrl, isOpenCodeGoUrl } from '../provider-urls';

export { chatCompletionsUrl, isDeepSeekOfficialUrl, isOpenCodeGoUrl, normalizeChatBaseUrl } from '../provider-urls';

const MAX_REQUEST_TOKENS = 32_768;

export const EMPTY_MODEL_REPLY =
  '请求完成但没有正文。OpenCode Go 与 DeepSeek 官网不能混用密钥：Go 请选「OpenCode Go」并用 Zen/Go Key；DeepSeek 官网请选「DeepSeek」并用 sk- 密钥。';

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
  if (config?.api === 'anthropic-messages') {
    if (provider.apiKey) headers['x-api-key'] = provider.apiKey;
    if (!headers['anthropic-version']) headers['anthropic-version'] = '2023-06-01';
    return headers;
  }
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
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

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
