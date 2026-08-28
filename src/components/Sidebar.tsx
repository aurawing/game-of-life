import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { formatTime } from '../lib/id';
import {
  IconArchive,
  IconClose,
  IconPlus,
  IconRestore,
  IconSettings,
  IconTrash,
  IconPlug,
  IconSpark,
} from './Icons';

export function Sidebar(props: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenPlugins: () => void;
  onOpenMcp: () => void;
}) {
  const sessions = useAppStore((s) => s.sessions);
  const activeId = useAppStore((s) => s.activeSessionId);
  const select = useAppStore((s) => s.selectSession);
  const create = useAppStore((s) => s.newSession);
  const archive = useAppStore((s) => s.archiveSession);
  const restore = useAppStore((s) => s.restoreSession);
  const remove = useAppStore((s) => s.deleteSession);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const wantArchived = tab === 'archived';
    return sessions
      .filter((s) => s.archived === wantArchived)
      .filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase()));
  }, [sessions, tab, q]);

  return (
    <>
      <div className={`scrim ${props.open ? 'show' : ''}`} onClick={props.onClose} />
      <aside className={`drawer ${props.open ? 'open' : ''}`}>
        <div className="drawer-head">
          <div>
            <div className="brand">DSH Agent</div>
            <div className="muted tiny">DeepSeek Harness · Android</div>
          </div>
          <button className="icon-btn" onClick={props.onClose} aria-label="关闭">
            <IconClose />
          </button>
        </div>
        <button
          className="primary-btn"
          onClick={() => {
            create();
            props.onClose();
          }}
        >
          <IconPlus size={18} /> 新对话
        </button>
        <input className="search" placeholder="搜索会话" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tabs">
          <button className={tab === 'active' ? 'tab on' : 'tab'} onClick={() => setTab('active')}>
            对话
          </button>
          <button className={tab === 'archived' ? 'tab on' : 'tab'} onClick={() => setTab('archived')}>
            归档
          </button>
        </div>
        <div className="session-list">
          {list.length === 0 && <div className="empty-hint">暂无会话</div>}
          {list.map((s) => (
            <div key={s.id} className={`session-row ${s.id === activeId ? 'active' : ''}`}>
              <button
                className="session-main"
                onClick={() => {
                  select(s.id);
                  props.onClose();
                }}
              >
                <div className="session-title">{s.title}</div>
                <div className="muted tiny">{formatTime(s.updatedAt)}</div>
              </button>
              <div className="session-actions">
                {tab === 'active' ? (
                  <button className="icon-btn sm" onClick={() => archive(s.id)} aria-label="归档">
                    <IconArchive size={16} />
                  </button>
                ) : (
                  <button className="icon-btn sm" onClick={() => restore(s.id)} aria-label="恢复">
                    <IconRestore size={16} />
                  </button>
                )}
                <button className="icon-btn sm danger" onClick={() => remove(s.id)} aria-label="删除">
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="drawer-foot">
          <button className="ghost-btn" onClick={props.onOpenPlugins}>
            <IconSpark size={18} /> 插件中心
          </button>
          <button className="ghost-btn" onClick={props.onOpenMcp}>
            <IconPlug size={18} /> MCP
          </button>
          <button className="ghost-btn" onClick={props.onOpenSettings}>
            <IconSettings size={18} /> 设置
          </button>
        </div>
      </aside>
    </>
  );
}
