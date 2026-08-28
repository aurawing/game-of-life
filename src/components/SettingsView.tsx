import { THINKING_LABELS } from '../types';
import { useActiveSession, useAppStore } from '../store';
import { IconClose, IconPlus, IconTrash } from './Icons';
import {
  availableThinkingLevels,
  catalogModels,
  formatTokenCount,
  modelPageUrl,
  resolveModelConfig,
  supportsReasoning,
  supportsVision,
  thinkingLabel,
} from '../lib/pi-catalog';

export function SettingsView({ onClose }: { onClose: () => void }) {
  const providers = useAppStore((s) => s.providers);
  const catalog = useAppStore((s) => s.catalog);
  const catalogSource = useAppStore((s) => s.catalogSource);
  const activeProviderId = useAppStore((s) => s.activeProviderId);
  const activeModel = useAppStore((s) => s.activeModel);
  const effort = useAppStore((s) => s.thinkingEffort);
  const prompt = useAppStore((s) => s.systemPrompt);
  const session = useActiveSession();
  const setProviderField = useAppStore((s) => s.setProviderField);
  const addProvider = useAppStore((s) => s.addProvider);
  const removeProvider = useAppStore((s) => s.removeProvider);
  const setActiveProvider = useAppStore((s) => s.setActiveProvider);
  const setActiveModel = useAppStore((s) => s.setActiveModel);
  const setThinkingEffort = useAppStore((s) => s.setThinkingEffort);
  const setSystemPrompt = useAppStore((s) => s.setSystemPrompt);
  const setSessionSystemPrompt = useAppStore((s) => s.setSessionSystemPrompt);
  const refreshCatalog = useAppStore((s) => s.refreshCatalog);
  const active = providers.find((p) => p.id === activeProviderId);
  const custom = active?.kind === 'custom';
  const catalogList = custom ? [] : catalogModels(catalog, activeProviderId);
  const modelConfig = resolveModelConfig(catalog, active, activeModel);
  const levels = availableThinkingLevels(modelConfig);
  const reasoning = supportsReasoning(modelConfig);
  const vision = supportsVision(modelConfig);

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
          <div className="card-title">模型提供商</div>
          <p className="muted tiny">
            预置列表来自 pi.dev/models（{catalogSource === 'live' ? '已同步在线目录' : '使用内置目录'}
            ）。先选 Provider，再选模型；必要参数取自 SHOW CONFIGURATION。自定义 Provider 会单独保留。
          </p>
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
                  type="password"
                  value={active.apiKey}
                  placeholder="sk-..."
                  onChange={(e) => setProviderField(active.id, { apiKey: e.target.value })}
                />
              </label>
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
              ) : (
                <p className="muted tiny">
                  预置模型参数来自{' '}
                  <a href={modelPageUrl(active.id, activeModel)} target="_blank" rel="noreferrer">
                    pi.dev/models/{active.id}/{activeModel}
                  </a>{' '}
                  的 SHOW CONFIGURATION，不可手改模型清单。
                </p>
              )}
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
              {modelConfig?.api ? <p className="muted tiny">接口：{modelConfig.api}</p> : null}
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
            <>
              <div className="effort">
                {levels.map((e) => (
                  <button key={e} className={e === effort ? 'on' : ''} onClick={() => setThinkingEffort(e)}>
                    {THINKING_LABELS[e] ?? thinkingLabel(e)}
                  </button>
                ))}
              </div>
              <p className="muted tiny">
                档位来自当前模型的 thinkingLevelMap：{levels.map((l) => thinkingLabel(l)).join(' / ')}
                {modelConfig?.compat?.thinkingFormat
                  ? ` · 格式 ${modelConfig.compat.thinkingFormat}`
                  : ''}
              </p>
            </>
          ) : (
            <p className="muted tiny">当前模型不支持推理，已隐藏思维强度。</p>
          )}
        </section>

        <section className="card">
          <div className="card-title">系统提示词</div>
          <textarea className="prompt" rows={7} value={prompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          <div className="card-title" style={{ marginTop: 12 }}>
            本会话覆盖（可选）
          </div>
          <textarea
            className="prompt"
            rows={4}
            placeholder="留空则使用全局系统提示词"
            value={session?.systemPrompt ?? ''}
            onChange={(e) => setSessionSystemPrompt(e.target.value)}
          />
        </section>
      </div>
    </div>
  );
}
