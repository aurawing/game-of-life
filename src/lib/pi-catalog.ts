import bundled from '../data/pi-models.json';
import { opencodeGoCatalog, OPENCODE_GO_PROVIDER_ID } from '../data/opencode-go';
import { httpJson } from './http';
import type { Provider, ThinkingEffort } from '../types';
import { isDeepSeekOfficialUrl, isOpenCodeGoUrl, normalizeChatBaseUrl } from './provider-urls';

export const PI_MODELS_API = 'https://pi.dev/api/models';
export const PI_MODELS_PAGE = 'https://pi.dev/models';

export interface PiModelCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface PiModelCompat {
  thinkingFormat?: string;
  maxTokensField?: string;
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  requiresReasoningContentOnAssistantMessages?: boolean;
  [key: string]: unknown;
}

export interface PiModelConfig {
  id: string;
  name: string;
  api: string;
  baseUrl: string;
  provider: string;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
  cost?: PiModelCost;
  headers?: Record<string, string>;
  compat?: PiModelCompat;
  thinkingLevelMap?: Record<string, string | null>;
}

export type PiCatalog = Record<string, Record<string, PiModelConfig>>;

export const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  [OPENCODE_GO_PROVIDER_ID]: 'OpenCode Go',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  groq: 'Groq',
  xai: 'xAI',
  mistral: 'Mistral',
  moonshotai: 'Moonshot',
  together: 'Together',
  fireworks: 'Fireworks',
  minimax: 'MiniMax',
  zai: 'Z.AI',
  nvidia: 'NVIDIA',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face',
  cerebras: 'Cerebras',
  baseten: 'Baseten',
};

const PROVIDER_ORDER = [
  'deepseek',
  OPENCODE_GO_PROVIDER_ID,
  'openai',
  'anthropic',
  'google',
  'moonshotai',
  'groq',
  'xai',
  'mistral',
  'zai',
  'minimax',
  'together',
  'fireworks',
  'openrouter',
  'huggingface',
  'nvidia',
  'cerebras',
  'baseten',
];

const DEFAULT_LEVELS: ThinkingEffort[] = ['none', 'low', 'medium', 'high', 'max'];

export function withExtraCatalog(catalog: PiCatalog): PiCatalog {
  return { ...catalog, ...opencodeGoCatalog };
}

export const bundledCatalog = withExtraCatalog(bundled as PiCatalog);

export function isCatalog(value: unknown): value is PiCatalog {
  if (!value || typeof value !== 'object') return false;
  const root = value as Record<string, unknown>;
  const first = Object.values(root)[0];
  if (!first || typeof first !== 'object') return false;
  const model = Object.values(first as Record<string, unknown>)[0];
  return Boolean(model && typeof model === 'object' && 'id' in (model as object));
}

export function providerDisplayName(id: string): string {
  if (PROVIDER_NAMES[id]) return PROVIDER_NAMES[id];
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function catalogProviderIds(catalog: PiCatalog): string[] {
  const ids = Object.keys(catalog);
  const known = PROVIDER_ORDER.filter((id) => ids.includes(id));
  const extra = ids.filter((id) => !PROVIDER_ORDER.includes(id)).sort();
  return [...known, ...extra];
}

export function catalogModels(catalog: PiCatalog, providerId: string): PiModelConfig[] {
  const group = catalog[providerId] ?? {};
  return Object.values(group).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export function getModelConfig(
  catalog: PiCatalog,
  providerId: string,
  modelId: string,
): PiModelConfig | undefined {
  return catalog[providerId]?.[modelId];
}

export function supportsVision(config?: PiModelConfig | null): boolean {
  return Boolean(config?.input?.includes('image'));
}

export function supportsReasoning(config?: PiModelConfig | null): boolean {
  return Boolean(config?.reasoning);
}

export function formatTokenCount(n?: number): string {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function modelPageUrl(providerId: string, modelId: string): string {
  return `${PI_MODELS_PAGE}/${encodeURIComponent(providerId)}/${encodeURIComponent(modelId)}`;
}

export function thinkingLabel(effort: string): string {
  const labels: Record<string, string> = {
    none: '不思考',
    off: '不思考',
    minimal: '最轻',
    low: '低',
    medium: '中',
    high: '高',
    xhigh: '极高',
    max: '最强',
  };
  return labels[effort] ?? effort;
}

export function availableThinkingLevels(config?: PiModelConfig | null): ThinkingEffort[] {
  if (config && !config.reasoning) return [];
  if (config?.compat?.thinkingFormat === 'none') return [];
  const map = config?.thinkingLevelMap;
  if (!map) return [...DEFAULT_LEVELS];
  const levels = Object.entries(map)
    .filter(([, value]) => value != null)
    .map(([key]) => key);
  const format = config?.compat?.thinkingFormat;
  const hasOff = levels.includes('off') || levels.includes('none');
  const canDisable = hasOff || format === 'deepseek' || format === 'zai';
  if (canDisable && !hasOff) return ['none', ...levels];
  return levels.length ? levels : [...DEFAULT_LEVELS];
}

export function clampEffort(effort: string, config?: PiModelConfig | null): ThinkingEffort {
  const levels = availableThinkingLevels(config);
  if (!levels.length) return 'none';
  if (levels.includes(effort)) return effort;
  if (levels.includes('high')) return 'high';
  return levels[0];
}

export function customModelConfig(provider: Provider, model: string): PiModelConfig {
  const official = isDeepSeekOfficialUrl(provider.baseUrl);
  const go = isOpenCodeGoUrl(provider.baseUrl);
  const reasoning = provider.reasoning ?? official;
  return {
    id: model,
    name: model,
    api: 'openai-completions',
    baseUrl: provider.baseUrl,
    provider: provider.id,
    reasoning,
    input: provider.vision === false ? ['text'] : ['text', 'image'],
    contextWindow: provider.contextWindow ?? 128000,
    maxTokens: provider.maxTokens ?? 8192,
    compat: official
      ? { thinkingFormat: 'deepseek', maxTokensField: 'max_tokens' }
      : { thinkingFormat: 'none', maxTokensField: go ? undefined : 'max_tokens' },
    thinkingLevelMap: official
      ? {
          none: 'none',
          low: 'low',
          medium: 'medium',
          high: 'high',
          max: 'max',
        }
      : undefined,
  };
}

export function resolveModelConfig(
  catalog: PiCatalog,
  provider: Provider | undefined,
  model: string,
): PiModelConfig | undefined {
  if (!provider) return undefined;
  if (provider.kind === 'custom' || !catalog[provider.id]) {
    return customModelConfig(provider, model);
  }
  return getModelConfig(catalog, provider.id, model) ?? customModelConfig(provider, model);
}

export function providerUrls(catalog: PiCatalog, providerId: string): Set<string> {
  return new Set(catalogModels(catalog, providerId).map((m) => m.baseUrl).filter(Boolean));
}

export function resolveRequestBaseUrl(
  catalog: PiCatalog,
  provider: Provider,
  config?: PiModelConfig | null,
): string {
  if (provider.kind === 'custom' || !config?.baseUrl) return normalizeChatBaseUrl(provider.baseUrl);
  const urls = providerUrls(catalog, provider.id);
  if (!provider.baseUrl || urls.has(provider.baseUrl)) return normalizeChatBaseUrl(config.baseUrl);
  return normalizeChatBaseUrl(provider.baseUrl);
}

export function stubCatalogProvider(id: string, catalog: PiCatalog, prev?: Provider): Provider {
  const models = catalogModels(catalog, id);
  const first = models[0];
  return {
    id,
    name: providerDisplayName(id),
    baseUrl: prev?.baseUrl || first?.baseUrl || '',
    apiKey: prev?.apiKey ?? '',
    models: models.map((m) => m.id),
    kind: 'catalog',
  };
}

export function mergeSavedProviders(saved: Provider[] | undefined, catalog: PiCatalog): Provider[] {
  const catalogIds = new Set(catalogProviderIds(catalog));
  const savedMap = new Map((saved ?? []).map((p) => [p.id, p]));
  const catalogProviders = catalogProviderIds(catalog).map((id) => stubCatalogProvider(id, catalog, savedMap.get(id)));
  const customs = (saved ?? [])
    .filter((p) => p.kind === 'custom' || (!catalogIds.has(p.id) && p.kind !== 'catalog'))
    .map((p) => ({ ...p, kind: 'custom' as const }));
  return [...catalogProviders, ...customs];
}

export async function loadPiCatalog(): Promise<{ catalog: PiCatalog; source: 'live' | 'bundled' }> {
  try {
    const res = await httpJson(PI_MODELS_API, {
      timeout: 8000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 DSH-Agent',
      },
    });
    if (res.status >= 200 && res.status < 300 && isCatalog(res.data)) {
      return { catalog: withExtraCatalog(res.data), source: 'live' };
    }
  } catch {
    // bundled fallback
  }
  return { catalog: bundledCatalog, source: 'bundled' };
}
