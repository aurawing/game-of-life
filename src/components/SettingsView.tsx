import { THINKING_LABELS, type ThinkingEffort } from '../types';
import { useActiveSession, useAppStore } from '../store';
import { IconClose, IconPlus, IconTrash } from './Icons';

const EFFORTS: ThinkingEffort[] = ['none', 'low', 'medium', 'high', 'max'];

export function SettingsView({ onClose }: { onClose: () => void }) {
  const providers = useAppStore((s) => s.providers);
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
  const active = providers.find((p) => p.id === activeProviderId);

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
          <p className="muted tiny">OpenAI 兼容接口。DeepSeek V4 使用 reasoning_effort + thinking。</p>
          <div className="chips">
            {providers.map((p) => (
              <button key={p.id} className={`chip btn ${p.id === activeProviderId ? 'on' : ''}`} onClick={() => setActiveProvider(p.id)}>
                {p.name}
              </button>
            ))}
            <button className="chip btn" onClick={addProvider}>
              <IconPlus size={14} /> 新增
            </button>
          </div>
          {active && (
            <div className="form">
              <label>
                名称
                <input value={active.name} onChange={(e) => setProviderField(active.id, { name: e.target.value })} />
              </label>
              <label>
                Base URL
                <input value={active.baseUrl} onChange={(e) => setProviderField(active.id, { baseUrl: e.target.value })} />
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
              <label>
                模型列表（逗号分隔）
                <input
                  value={active.models.join(', ')}
                  onChange={(e) =>
                    setProviderField(active.id, {
                      models: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                当前模型
                <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
                  {active.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              {providers.length > 1 && (
                <button className="ghost-btn danger" onClick={() => removeProvider(active.id)}>
                  <IconTrash size={16} /> 删除此提供商
                </button>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title">思维强度</div>
          <div className="effort">
            {EFFORTS.map((e) => (
              <button key={e} className={e === effort ? 'on' : ''} onClick={() => setThinkingEffort(e)}>
                {THINKING_LABELS[e]}
              </button>
            ))}
          </div>
          <p className="muted tiny">对应 DeepSeek V4 的 reasoning_effort：none / low / high / max（medium 映射为 high）。</p>
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
