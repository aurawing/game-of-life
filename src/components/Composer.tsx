import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '../types';
import { attachmentFromText, pickFiles, pickImages, takePhoto } from '../lib/attachments';
import { canUseVoice, startVoice, type VoiceHandle } from '../lib/voice';
import { IconCamera, IconClose, IconFile, IconImage, IconMic, IconPaperclip, IconSend, IconStop } from './Icons';

export function Composer(props: {
  busy: boolean;
  vision?: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [voiceErr, setVoiceErr] = useState('');
  const handle = useRef<VoiceHandle | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text, partial]);

  useEffect(() => () => handle.current?.stop(), []);

  const add = (items: Attachment[]) => setAtts((prev) => [...prev, ...items]);

  const toggleVoice = () => {
    if (listening) {
      handle.current?.stop();
      handle.current = null;
      setListening(false);
      setPartial('');
      return;
    }
    if (!canUseVoice()) {
      setVoiceErr('此设备 WebView 暂不支持语音识别，请改用系统输入法语音。');
      return;
    }
    setVoiceErr('');
    setListening(true);
    handle.current = startVoice({
      onPartial: setPartial,
      onFinal: (t) => {
        setText((prev) => `${prev}${t}`);
        setPartial('');
      },
      onError: (m) => {
        setVoiceErr(m);
        setListening(false);
      },
      onEnd: () => {
        setListening(false);
        setPartial('');
      },
    });
  };

  const submit = () => {
    const body = `${text}${partial}`.trim();
    if (!body && atts.length === 0) return;
    props.onSend(body, atts);
    setText('');
    setPartial('');
    setAtts([]);
  };

  return (
    <div className="composer">
      {voiceErr && <div className="voice-err">{voiceErr}</div>}
      {atts.length > 0 && (
        <div className="att-row">
          {atts.map((a) => (
            <span key={a.id} className="chip att-chip">
              {a.kind === 'image' && a.dataUrl ? <img src={a.dataUrl} alt="" /> : null}
              {a.name}
              <button
                className="icon-btn sm"
                onClick={() => setAtts((xs) => xs.filter((x) => x.id !== a.id))}
                aria-label="移除附件"
              >
                <IconClose size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      {menu && (
        <div className="attach-menu">
          {props.vision !== false ? (
            <>
              <button
                onClick={async () => {
                  setMenu(false);
                  const photo = await takePhoto().catch(() => null);
                  if (photo) add([photo]);
                }}
              >
                <IconCamera size={18} /> 拍照
              </button>
              <button
                onClick={async () => {
                  setMenu(false);
                  add(await pickImages().catch(() => []));
                }}
              >
                <IconImage size={18} /> 图片
              </button>
            </>
          ) : (
            <span className="muted tiny">当前模型不支持视觉输入</span>
          )}
          <button
            onClick={async () => {
              setMenu(false);
              add(await pickFiles().catch(() => []));
            }}
          >
            <IconFile size={18} /> 文件
          </button>
          <button
            onClick={async () => {
              setMenu(false);
              const snippet = window.prompt('粘贴或输入要附加的文本');
              if (snippet) add([await attachmentFromText('note.txt', snippet)]);
            }}
          >
            <IconFile size={18} /> 文本片段
          </button>
        </div>
      )}
      <div className="composer-box">
        <button className="icon-btn" onClick={() => setMenu((v) => !v)} aria-label="附件">
          <IconPaperclip />
        </button>
        <textarea
          ref={ta}
          rows={1}
          placeholder={listening ? '正在聆听…' : '发送消息'}
          value={partial ? `${text}${partial}` : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {props.busy ? (
          <button className="send stop" onClick={props.onStop} aria-label="停止">
            <IconStop />
          </button>
        ) : text.trim() || atts.length ? (
          <button className="send" onClick={submit} aria-label="发送">
            <IconSend />
          </button>
        ) : (
          <button className={`send mic ${listening ? 'hot' : ''}`} onClick={toggleVoice} aria-label="语音输入">
            <IconMic />
          </button>
        )}
      </div>
    </div>
  );
}
