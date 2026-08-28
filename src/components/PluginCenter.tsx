import { useEffect, useState } from 'react';
import { loadMarketplace, installSpec } from '../lib/harness/marketplace';
import type { MarketplacePlugin } from '../types';
import { useAppStore } from '../store';
import { IconClose, IconSearch } from './Icons';

export function PluginCenter({ onClose }: { onClose: () => void }) {
  const installed = useAppStore((s) => s.installedPlugins);
  const toggle = useAppStore((s) => s.togglePlugin);
  const install = useAppStore((s) => s.installPlugin);
  const uninstall = useAppStore((s) => s.uninstallPlugin);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);

  const refresh = async (query = q) => {
    setLoading(true);
    setError('');
    try {
      const res = await loadMarketplace(query);
      setPlugins(res.plugins);
      setSource(res.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-title">插件中心</div>
          <div className="muted tiny">GitHub topic:dsh-plugin · {source || '加载中'}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconClose />
        </button>
      </header>
      <div className="page-body">
        <section className="card">
          <div className="card-title">已安装 / 内置</div>
          {installed.map((p) => (
            <label key={p.id} className="row-line">
              <div>
                <div>{p.name}</div>
                <div className="muted tiny">{p.description}</div>
              </div>
              <input type="checkbox" checked={p.enabled} onChange={(e) => toggle(p.id, e.target.checked)} />
              {p.source !== 'builtin' && (
                <button className="ghost-btn" onClick={() => uninstall(p.id)}>
                  卸载
                </button>
              )}
            </label>
          ))}
        </section>

        <section className="card">
          <div className="card-title">市场</div>
          <form
            className="search-row"
            onSubmit={(e) => {
              e.preventDefault();
              void refresh(q);
            }}
          >
            <IconSearch size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索 dsh-plugin" />
            <button className="ghost-btn" type="submit">
              搜索
            </button>
          </form>
          {loading && <div className="muted">正在拉取目录…</div>}
          {error && <div className="voice-err">{error}</div>}
          {plugins.map((p) => {
            const already = installed.some((i) => i.id === p.id);
            return (
              <div key={p.id} className="plugin-card">
                <div>
                  <div className="plugin-name">{p.name}</div>
                  <div className="muted tiny">
                    {p.fullName} · ★ {p.stars}
                    {p.verifiedAgainst ? ` · dsh ${p.verifiedAgainst}` : ''}
                  </div>
                  <p>{p.description}</p>
                </div>
                <div className="plugin-actions">
                  <a className="ghost-btn" href={p.url} target="_blank" rel="noreferrer">
                    仓库
                  </a>
                  <button
                    className="primary-btn sm"
                    disabled={already}
                    onClick={() =>
                      install({
                        id: p.id,
                        name: p.name,
                        spec: installSpec(p),
                        description: `${p.description}\n安装规格：${installSpec(p)}`,
                        source: 'marketplace',
                      })
                    }
                  >
                    {already ? '已添加' : '安装'}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
