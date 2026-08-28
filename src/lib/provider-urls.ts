import { OPENCODE_GO_BASE_URL } from '../data/opencode-go';

export { OPENCODE_GO_BASE_URL };

export function isDeepSeekOfficialUrl(url: string): boolean {
  return /api\.deepseek\.com/i.test(url);
}

export function isOpenCodeGoUrl(url: string): boolean {
  return /opencode\.ai\/zen\/go/i.test(url);
}

export function normalizeChatBaseUrl(base: string): string {
  let url = (base || '').trim().replace(/\/+$/, '');
  url = url.replace(/\/(chat\/completions|messages|responses)$/i, '');
  if (/^https?:\/\/opencode\.ai\/zen\/go$/i.test(url)) return OPENCODE_GO_BASE_URL;
  if (/^https?:\/\/api\.deepseek\.com\/v1$/i.test(url)) return 'https://api.deepseek.com';
  return url;
}

export function chatCompletionsUrl(base: string): string {
  return `${normalizeChatBaseUrl(base)}/chat/completions`;
}
