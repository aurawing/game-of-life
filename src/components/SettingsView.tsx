import { useState } from 'react';
import { THINKING_LABELS, type ThemeMode } from '../types';
import { useAppStore } from '../store';
import { IconClose, IconPlus, IconTrash } from './Icons';
import {
  availableThinkingLevels,
  catalogModels,
  formatTokenCount,
  resolveModelConfig,
  supportsReasoning,
  supportsVision,
  thinkingLabel,
} from '../lib/pi-catalog';
import { THEME_LABELS } from '../lib/theme';
import { isOpenCodeGoUrl } from '../lib/provider-urls';
import { normalizeApiKey, probeProviderAuth } from '../lib/harness/request';

const THEMES: ThemeMode[] = ['dark', 'light', 'system'];

export function SettingsView({ onClose }: { onClose: () => void }) {
  const providers = useAppStore((s) => s.providers);
  const catalog = useAppStore((s) => s.catalog);
  const activeProviderId = useAppStore((s) => s.activeProviderId);
  const activeModel = useAppStore((s) => s.activeModel);
  const effort = useAppStore((s) => s.thinkingEffort);
  const prompt = useAppStore((s) => s.systemPrompt);
  const themeMode = useAppStore((s) => s.themeMode);
  const setProviderField = useAppStore((s) => s.setProviderField);
  const addProvider = useAppStore((s) => s.addProvider);
  const removeProvider = useAppStore((s) => s.removeProvider);
  const setActiveProvider = useAppStore((s) => s.setActiveProvider);
  const setActiveModel = useAppStore((s) => s.setActiveModel);
  const setThinkingEffort = useAppStore((s) => s.setThinkingEffort);
  const setSystemPrompt = useAppStore((s) => s.setSystemPrompt);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const refreshCatalog = useAppStore((s) => s.refreshCatalog);
  const active = providers.find((p) => p.id === activeProviderId);
  const custom = active?.kind === 'custom';
  const catalogList = custom ? [] : catalogModels(catalog, activeProviderId);
  const modelConfig = resolveModelConfig(catalog, active, activeModel);
  const levels = availableThinkingLevels(modelConfig);
  const reasoning = supportsReasoning(modelConfig);
  const vision = supportsVision(modelConfig);
  const [showKey, setShowKey] = useState(true);
  const [probe, setProbe] = useState('');
  const keyLen = normalizeApiKey(active?.apiKey).length;

  const testAuth = async () => {
    if (!active) return;
    setProbe('正在测试…');
    try {
      const result = await probeProviderAuth(active);
      setProbe(result.detail);
    } catch (err) {
      setProbe(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">设置</div>
        <button className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconClose />
        </button>
      </header>
      <div className="page-body">
        <section className="card">
          <div className="card-title">外观</div>
          <div className="effort" role="group" aria-label="主题">
            {THEMES.map((mode) => (
              <button key={mode} className={mode === themeMode ? 'on' : ''} onClick={() => setThemeMode(mode)}>
                {THEME_LABELS[mode]}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-title">模型提供商</div>
          <div className="form">
            <label>
              提供商
              <select
                aria-label="设置提供商"
                value={activeProviderId}
                onChange={(e) => setActiveProvider(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.kind === 'custom' ? '（自定义）' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
            <button className="chip btn" onClick={addProvider}>
              <IconPlus size={14} /> 新增
            </button>
            <button className="chip btn" onClick={() => void refreshCatalog()}>
              刷新目录
            </button>
          </div>
          {active && (
            <div className="form">
              <label>
                名称
                <input
                  value={active.name}
                  onChange={(e) => setProviderField(active.id, { name: e.target.value })}
                  disabled={!custom}
                />
              </label>
              <label>
                Base URL
                <input
                  value={active.baseUrl}
                  onChange={(e) => setProviderField(active.id, { baseUrl: e.target.value })}
                />
              </label>
              <label>
                API Key
                <input
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={active.apiKey}
                  placeholder="完整 sk- 密钥，不要带省略号"
                  className={showKey ? undefined : 'key-masked'}
                  onChange={(e) => setProviderField(active.id, { apiKey: e.target.value })}
                  onBlur={() => setProviderField(active.id, { apiKey: normalizeApiKey(active.apiKey) })}
                />
              </label>
              <div className="chips" style={{ marginTop: 8 }}>
                <button type="button" className="chip btn" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? '隐藏' : '显示'}
                </button>
                <button type="button" className="chip btn" onClick={() => void testAuth()}>
                  测试连接
                </button>
                {keyLen > 0 && <span className="muted tiny">已输入 {keyLen} 位</span>}
              </div>
              {isOpenCodeGoUrl(active.baseUrl) && (
                <p className="muted tiny">OpenCode 完整 Key 约 67 位。列表里带 … 的是掩码，请新建后在弹窗里复制。</p>
              )}
              {probe && <p className={probe.includes('有效') ? 'muted tiny' : 'assistant-error'}>{probe}</p>}
              {custom ? (
                <>
                  <label>
                    模型列表（逗号分隔）
                    <input
                      value={active.models.join(', ')}
                      onChange={(e) =>
                        setProviderField(active.id, {
                          models: e.target.value
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <div className="toggle-row">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={active.reasoning !== false}
                        onChange={(e) => setProviderField(active.id, { reasoning: e.target.checked })}
                      />
                      支持推理
                    </label>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={active.vision !== false}
                        onChange={(e) => setProviderField(active.id, { vision: e.target.checked })}
                      />
                      支持视觉
                    </label>
                  </div>
                  <label>
                    上下文上限
                    <input
                      type="number"
                      value={active.contextWindow ?? 128000}
                      onChange={(e) =>
                        setProviderField(active.id, { contextWindow: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                </>
              ) : null}
              <label>
                当前模型
                <select aria-label="当前模型" value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
                  {(custom ? active.models.map((id) => ({ id, name: id })) : catalogList).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cap-grid">
                <div className={`cap ${reasoning ? 'on' : ''}`}>推理 {reasoning ? '支持' : '不支持'}</div>
                <div className={`cap ${vision ? 'on' : ''}`}>视觉 {vision ? '支持' : '不支持'}</div>
                <div className="cap">上下文 {formatTokenCount(modelConfig?.contextWindow)}</div>
                <div className="cap">输出 {formatTokenCount(modelConfig?.maxTokens)}</div>
              </div>
              {custom && (
                <button className="ghost-btn danger" onClick={() => removeProvider(active.id)}>
                  <IconTrash size={16} /> 删除此提供商
                </button>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title">思维强度</div>
          {levels.length ? (
            <div className="effort">
              {levels.map((e) => (
                <button key={e} className={e === effort ? 'on' : ''} onClick={() => setThinkingEffort(e)}>
                  {THINKING_LABELS[e] ?? thinkingLabel(e)}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted tiny">
              {reasoning ? '该接口不接受思维强度参数，按服务端默认推理。' : '当前模型不支持推理，已隐藏思维强度。'}
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-title">全局系统提示词</div>
          <textarea className="prompt" rows={7} value={prompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </section>
      </div>
    </div>
  );
}
