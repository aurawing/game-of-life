import { describe, expect, it } from 'vitest';
import {
  availableThinkingLevels,
  bundledCatalog,
  clampEffort,
  formatTokenCount,
  getModelConfig,
  isCatalog,
  mergeSavedProviders,
  modelPageUrl,
  providerDisplayName,
  resolveModelConfig,
  supportsReasoning,
  supportsVision,
} from './pi-catalog';
import type { Provider } from '../types';

describe('pi catalog', () => {
  it('loads bundled providers from pi.dev snapshot', () => {
    expect(isCatalog(bundledCatalog)).toBe(true);
    expect(bundledCatalog.deepseek['deepseek-v4-flash']).toMatchObject({
      reasoning: true,
      contextWindow: 1000000,
    });
    expect(providerDisplayName('deepseek')).toBe('DeepSeek');
  });

  it('reads SHOW CONFIGURATION fields for flash and gpt-4o', () => {
    const flash = getModelConfig(bundledCatalog, 'deepseek', 'deepseek-v4-flash');
    expect(flash?.reasoning).toBe(true);
    expect(supportsVision(flash)).toBe(false);
    expect(availableThinkingLevels(flash)).toEqual(['none', 'low', 'high', 'max']);
    expect(formatTokenCount(flash?.contextWindow)).toBe('1M');

    const gpt = getModelConfig(bundledCatalog, 'openai', 'gpt-4o');
    expect(supportsReasoning(gpt)).toBe(false);
    expect(supportsVision(gpt)).toBe(true);
    expect(availableThinkingLevels(gpt)).toEqual([]);
    expect(modelPageUrl('openai', 'gpt-4o')).toBe('https://pi.dev/models/openai/gpt-4o');
  });

  it('clamps stored effort to the selected model map', () => {
    const flash = getModelConfig(bundledCatalog, 'deepseek', 'deepseek-v4-flash');
    expect(clampEffort('medium', flash)).toBe('high');
    expect(clampEffort('low', flash)).toBe('low');
  });

  it('keeps custom providers when merging catalog stubs', () => {
    const saved: Provider[] = [
      { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: 'sk-keep', models: ['old'] },
      {
        id: 'openai-compatible',
        name: '本地 Ollama',
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: 'ollama',
        models: ['llama3'],
      },
    ];
    const merged = mergeSavedProviders(saved, bundledCatalog);
    const deepseek = merged.find((p) => p.id === 'deepseek');
    const custom = merged.find((p) => p.id === 'openai-compatible');
    expect(deepseek?.kind).toBe('catalog');
    expect(deepseek?.apiKey).toBe('sk-keep');
    expect(deepseek?.models).toContain('deepseek-v4-flash');
    expect(custom).toMatchObject({
      kind: 'custom',
      name: '本地 Ollama',
      models: ['llama3'],
    });
    expect(merged.some((p) => p.id === 'anthropic')).toBe(true);
  });

  it('synthesizes config for a custom provider', () => {
    const provider: Provider = {
      id: 'prov_1',
      name: '自定义',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'x',
      models: ['llama3'],
      kind: 'custom',
      reasoning: true,
      vision: false,
    };
    const config = resolveModelConfig({}, provider, 'llama3');
    expect(config?.reasoning).toBe(true);
    expect(supportsVision(config)).toBe(false);
    expect(availableThinkingLevels(config)).toEqual(['none', 'low', 'medium', 'high', 'max']);
  });
});
