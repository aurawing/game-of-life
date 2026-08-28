import type { PiCatalog, PiModelConfig } from '../lib/pi-catalog';

export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';
export const OPENCODE_GO_PROVIDER_ID = 'opencode-go';

function goModel(
  id: string,
  name: string,
  extra: Partial<PiModelConfig> = {},
): PiModelConfig {
  return {
    id,
    name,
    api: 'openai-completions',
    baseUrl: OPENCODE_GO_BASE_URL,
    provider: OPENCODE_GO_PROVIDER_ID,
    reasoning: extra.reasoning ?? true,
    input: extra.input ?? ['text'],
    contextWindow: extra.contextWindow ?? 128000,
    maxTokens: extra.maxTokens ?? 8192,
    compat: { thinkingFormat: 'none', ...(extra.compat ?? {}) },
    ...extra,
  };
}

/** OpenAI-compatible /chat/completions models on OpenCode Go. */
export const opencodeGoCatalog: PiCatalog = {
  [OPENCODE_GO_PROVIDER_ID]: {
    'deepseek-v4-flash': goModel('deepseek-v4-flash', 'DeepSeek V4 Flash', {
      contextWindow: 1_000_000,
      input: ['text'],
    }),
    'deepseek-v4-pro': goModel('deepseek-v4-pro', 'DeepSeek V4 Pro', {
      contextWindow: 1_000_000,
      input: ['text'],
    }),
    'deepseek-v4-flash-vision-exp': goModel(
      'deepseek-v4-flash-vision-exp',
      'DeepSeek V4 Flash Vision Exp',
      { contextWindow: 1_000_000, input: ['text', 'image'] },
    ),
    'glm-5.3-flash': goModel('glm-5.3-flash', 'GLM 5.3 Flash'),
    'glm-5.3': goModel('glm-5.3', 'GLM 5.3'),
    'glm-5.2': goModel('glm-5.2', 'GLM 5.2'),
    'glm-5.1': goModel('glm-5.1', 'GLM 5.1'),
    'kimi-k3': goModel('kimi-k3', 'Kimi K3'),
    'kimi-k2.7-code': goModel('kimi-k2.7-code', 'Kimi K2.7 Code'),
    'kimi-k2.6': goModel('kimi-k2.6', 'Kimi K2.6'),
    'longcat-2.0': goModel('longcat-2.0', 'LongCat 2.0'),
    'mimo-v2.5': goModel('mimo-v2.5', 'MiMo V2.5'),
    'mimo-v2.5-pro': goModel('mimo-v2.5-pro', 'MiMo V2.5 Pro'),
    hy3: goModel('hy3', 'Hy3'),
  },
};
