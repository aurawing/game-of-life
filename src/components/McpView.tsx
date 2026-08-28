import { useAppStore } from '../store';
import { IconClose, IconPlus, IconTrash } from './Icons';

export function McpView({ onClose }: { onClose: () => void }) {
  const servers = useAppStore((s) => s.mcpServers);
  const add = useAppStore((s) => s.addMcp);
  const update = useAppStore((s) => s.updateMcp);
  const remove = useAppStore((s) => s.removeMcp);
  const connect = useAppStore((s) => s.connectMcp);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-title">自定义 MCP</div>
          <div className="muted tiny">Streamable HTTP / JSON-RPC · tools/list + tools/call</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="关闭">
          <IconClose />
        </button>
      </header>
      <div className="page-body">
        <button className="primary-btn" onClick={add}>
          <IconPlus size={16} /> 添加 MCP 服务器
        </button>
        {servers.length === 0 && <p className="muted">还没有 MCP。添加一个 HTTP 端点后点「连接」拉取工具。</p>}
        {servers.map((s) => (
          <section className="card" key={s.id}>
            <div className="form">
              <label>
                名称
                <input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
              </label>
              <label>
                URL
                <input value={s.url} onChange={(e) => update(s.id, { url: e.target.value })} />
              </label>
              <label>
                传输
                <select value={s.transport} onChange={(e) => update(s.id, { transport: e.target.value as 'http' | 'sse' })}>
                  <option value="http">HTTP JSON-RPC</option>
                  <option value="sse">SSE</option>
                </select>
              </label>
              <label>
                Headers JSON
                <input
                  value={JSON.stringify(s.headers)}
                  onChange={(e) => {
                    try {
                      update(s.id, { headers: JSON.parse(e.target.value) as Record<string, string> });
                    } catch {
                      /* ignore while typing */
                    }
                  }}
                />
              </label>
              <label className="row-line">
                <span>启用</span>
                <input type="checkbox" checked={s.enabled} onChange={(e) => update(s.id, { enabled: e.target.checked })} />
              </label>
              <div className="muted tiny">
                状态：{s.status ?? 'idle'}
                {s.lastError ? ` · ${s.lastError}` : ''}
                {s.tools?.length ? ` · ${s.tools.length} 个工具` : ''}
              </div>
              {s.tools && s.tools.length > 0 && (
                <div className="chips">
                  {s.tools.map((t) => (
                    <span key={t.name} className="chip">
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="row-line">
                <button className="primary-btn sm" onClick={() => void connect(s.id)}>
                  连接
                </button>
                <button className="ghost-btn danger" onClick={() => remove(s.id)}>
                  <IconTrash size={16} /> 删除
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
