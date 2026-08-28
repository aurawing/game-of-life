import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../lib/markdown';
import type { ChatMessage } from '../types';
import { IconSpark } from './Icons';

export function MessageList(props: {
  messages: ChatMessage[];
  onOpenThinking: (msg: ChatMessage) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [props.messages, props.messages.at(-1)?.content, props.messages.at(-1)?.reasoning]);

  return (
    <div className="msg-list">
      {props.messages.length === 0 && (
        <div className="hero">
          <div className="hero-mark">🐋</div>
          <h1>有什么可以帮忙的？</h1>
          <p>自定义模型、思维强度、插件中心与 MCP，都在左侧菜单。</p>
        </div>
      )}
      {props.messages.map((m) => (
        <MessageBubble key={m.id} msg={m} onOpenThinking={props.onOpenThinking} />
      ))}
      <div ref={bottom} />
    </div>
  );
}

function MessageBubble({
  msg,
  onOpenThinking,
}: {
  msg: ChatMessage;
  onOpenThinking: (msg: ChatMessage) => void;
}) {
  if (msg.role === 'tool') {
    return (
      <div className="tool-card">
        <div className="tool-name">{msg.toolCalls?.[0]?.name ?? 'tool'}</div>
        <pre>{msg.content.slice(0, 800)}</pre>
      </div>
    );
  }
  if (msg.role === 'user') {
    return (
      <div className="row user">
        <div className="bubble user-bubble">
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="att-preview">
              {msg.attachments.map((a) =>
                a.kind === 'image' && a.dataUrl ? (
                  <img key={a.id} src={a.dataUrl} alt={a.name} />
                ) : (
                  <span key={a.id} className="chip">
                    {a.name}
                  </span>
                ),
              )}
            </div>
          )}
          <div>{msg.content}</div>
        </div>
      </div>
    );
  }
  const secs = msg.reasoningDurationMs ? Math.max(1, Math.round(msg.reasoningDurationMs / 1000)) : 0;
  const thinkingLabel = msg.streaming && msg.reasoning && !msg.content ? '思考中…' : secs ? `已思考 ${secs}s` : msg.reasoning ? '思维链' : '';
  return (
    <div className="row assistant">
      <div className="assistant-col">
        {thinkingLabel && (
          <button className="think-chip" onClick={() => onOpenThinking(msg)}>
            <IconSpark size={14} /> {thinkingLabel}
            {msg.streaming && msg.reasoning && !msg.content ? <span className="dots" /> : null}
          </button>
        )}
        {msg.toolCalls && msg.toolCalls.some((t) => t.name) && (
          <div className="tool-pills">
            {msg.toolCalls.map((t) => (
              <span key={t.id} className="chip">
                {t.name}
              </span>
            ))}
          </div>
        )}
        {msg.content ? (
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        ) : msg.streaming ? (
          <div className="muted">正在输出…</div>
        ) : null}
      </div>
    </div>
  );
}

export function ThinkingSheet(props: { msg: ChatMessage | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!props.msg?.streaming) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [props.msg?.streaming, props.msg?.reasoning]);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [props.msg?.reasoning, tick]);
  if (!props.msg) return null;
  return (
    <>
      <div className="scrim show" onClick={props.onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <div className="sheet-title">思维链</div>
            <div className="muted tiny">{props.msg.streaming ? '实时输出中' : '已完成'} · 默认收起，点此展开</div>
          </div>
          <button className="ghost-btn" onClick={props.onClose}>
            完成
          </button>
        </div>
        <div className="sheet-body" ref={ref}>
          <pre className="think-pre">{props.msg.reasoning || '暂无思维内容'}</pre>
        </div>
      </div>
    </>
  );
}
