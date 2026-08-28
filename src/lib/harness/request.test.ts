import { describe, expect, it } from 'vitest';
import { OPENCODE_GO_BASE_URL } from '../../data/opencode-go';
import { bundledCatalog, getModelConfig, resolveModelConfig } from '../pi-catalog';
import {
  EMPTY_MODEL_REPLY,
  authHeaders,
  buildChatBody,
  chatCompletionsUrl,
  explainAuthFailure,
  isMaskedApiKey,
  normalizeApiKey,
  normalizeChatBaseUrl,
  requestMaxTokens,
  shouldSendThinkingPayload,
} from './request';
import type { Provider } from '../../types';

const flash = getModelConfig(bundledCatalog, 'deepseek', 'deepseek-v4-flash');
const goFlash = getModelConfig(bundledCatalog, 'opencode-go', 'deepseek-v4-flash');

describe('chat request shaping', () => {
  it('normalizes OpenCode Go and DeepSeek base URLs', () => {
    expect(normalizeChatBaseUrl('https://opencode.ai/zen/go')).toBe(OPENCODE_GO_BASE_URL);
    expect(normalizeChatBaseUrl('https://opencode.ai/zen/go/v1/')).toBe(OPENCODE_GO_BASE_URL);
    expect(normalizeChatBaseUrl('https://opencode.ai/zen/go/v1/chat/completions')).toBe(OPENCODE_GO_BASE_URL);
    expect(chatCompletionsUrl('https://opencode.ai/zen/go')).toBe(`${OPENCODE_GO_BASE_URL}/chat/completions`);
    expect(normalizeChatBaseUrl('https://api.deepseek.com/v1')).toBe('https://api.deepseek.com');
  });

  it('does not send DeepSeek thinking fields to OpenCode Go', () => {
    expect(shouldSendThinkingPayload(OPENCODE_GO_BASE_URL, goFlash)).toBe(false);
    expect(shouldSendThinkingPayload(OPENCODE_GO_BASE_URL, flash)).toBe(false);
    expect(shouldSendThinkingPayload('https://api.deepseek.com', flash)).toBe(true);
    const body = buildChatBody({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hi' }],
      effort: 'high',
      baseUrl: OPENCODE_GO_BASE_URL,
      modelConfig: goFlash,
      tools: [
        {
          name: 'datetime',
          description: 'now',
          parameters: {},
          pluginId: 'datetime',
          execute: async () => '',
        },
      ],
    });
    expect(body.thinking).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.max_tokens).toBeUndefined();
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.tools).toBeUndefined();
  });

  it('still sends thinking to official DeepSeek and omits huge max_tokens', () => {
    expect(requestMaxTokens(flash)).toBeUndefined();
    const body = buildChatBody({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hi' }],
      effort: 'high',
      baseUrl: 'https://api.deepseek.com',
      modelConfig: flash,
    });
    expect(body.thinking).toEqual({ type: 'enabled' });
    expect(body.reasoning_effort).toBe('high');
    expect(body.max_tokens).toBeUndefined();
  });

  it('uses bearer auth for OpenCode Go', () => {
    const provider: Provider = {
      id: 'opencode-go',
      name: 'OpenCode Go',
      baseUrl: OPENCODE_GO_BASE_URL,
      apiKey: 'oc-key',
      models: ['deepseek-v4-flash'],
      kind: 'catalog',
    };
    expect(authHeaders(provider, goFlash)).toEqual({ Authorization: 'Bearer oc-key' });
  });

  it('strips bearer/whitespace and explains masked OpenCode keys', () => {
    expect(normalizeApiKey('  Bearer sk-abc\n')).toBe('sk-abc');
    expect(isMaskedApiKey('sk-hSmj...oGil')).toBe(true);
    expect(isMaskedApiKey('sk-' + 'a'.repeat(64))).toBe(false);
    expect(explainAuthFailure('sk-ab…cd', 'HTTP 401: Invalid API key.')).toMatch(/掩码/);
    expect(explainAuthFailure('sk-short', 'HTTP 401: Invalid API key.')).toMatch(/只发出了/);
  });

  it('keeps a visible empty-reply hint', () => {
    expect(EMPTY_MODEL_REPLY).toContain('OpenCode Go');
  });

  it('custom OpenCode Go config does not use deepseek thinking format', () => {
    const provider: Provider = {
      id: 'prov_go',
      name: 'OpenCode Go',
      baseUrl: OPENCODE_GO_BASE_URL,
      apiKey: 'x',
      models: ['deepseek-v4-flash'],
      kind: 'custom',
      reasoning: true,
    };
    const config = resolveModelConfig({}, provider, 'deepseek-v4-flash');
    expect(config?.compat?.thinkingFormat).toBe('none');
    expect(shouldSendThinkingPayload(provider.baseUrl, config)).toBe(false);
  });
});
