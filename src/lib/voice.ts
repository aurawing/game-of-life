export interface VoiceHandle {
  stop: () => void;
}

export function canUseVoice(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startVoice(opts: {
  lang?: string;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): VoiceHandle {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    opts.onError('当前 WebView 不支持语音识别');
    opts.onEnd();
    return { stop: () => undefined };
  }
  const rec = new Ctor();
  rec.lang = opts.lang ?? 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (ev) => {
    let partial = '';
    let finals = '';
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const res = ev.results[i];
      if (res.isFinal) finals += res[0]?.transcript ?? '';
      else partial += res[0]?.transcript ?? '';
    }
    if (partial) opts.onPartial(partial);
    if (finals) opts.onFinal(finals);
  };
  rec.onerror = (ev) => {
    const anyEv = ev as unknown as { error?: string };
    opts.onError(anyEv.error ?? 'voice error');
  };
  rec.onend = () => opts.onEnd();
  rec.start();
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        rec.abort();
      }
    },
  };
}
