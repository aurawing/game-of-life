import { Capacitor } from '@capacitor/core';
import { NativeVoice } from '../native/voice';

export interface VoiceHandle {
  stop: () => void;
}

const ERROR_ZH: Record<string, string> = {
  'not-allowed': '麦克风权限未授予，请在系统设置中允许录音',
  'not allowed': '麦克风权限未授予，请在系统设置中允许录音',
  'not-allowed-error': '麦克风权限未授予，请在系统设置中允许录音',
  denied: '麦克风权限未授予，请在系统设置中允许录音',
  'permission-denied': '麦克风权限未授予，请在系统设置中允许录音',
  'audio-capture': '无法使用麦克风',
  network: '语音识别需要网络，请检查连接',
  'no-speech': '没有听到语音',
  aborted: '已取消语音输入',
  'service-not-allowed': '当前环境不允许语音识别',
};

export function voiceErrorMessage(raw?: string): string {
  if (!raw) return '语音识别失败';
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (ERROR_ZH[key]) return ERROR_ZH[key];
  if (key.includes('not-allowed') || key.includes('notallowed') || key.includes('denied')) {
    return ERROR_ZH['not-allowed'];
  }
  return raw;
}

export function canUseVoice(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startVoice(opts: {
  lang?: string;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): VoiceHandle {
  if (Capacitor.isNativePlatform()) {
    return startNative(opts);
  }
  return startWeb(opts);
}

function startNative(opts: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): VoiceHandle {
  let removed = false;
  const cleanups: Array<() => void> = [];
  const wrap = (fn: () => void) => {
    if (removed) return;
    fn();
  };
  void (async () => {
    try {
      const partial = await NativeVoice.addListener('partial', (ev) => {
        if (ev.text) opts.onPartial(ev.text);
      });
      const finals = await NativeVoice.addListener('final', (ev) => {
        if (ev.text) opts.onFinal(ev.text);
      });
      const error = await NativeVoice.addListener('error', (ev) => {
        wrap(() => opts.onError(voiceErrorMessage(ev.message)));
      });
      const end = await NativeVoice.addListener('end', () => {
        wrap(() => opts.onEnd());
      });
      cleanups.push(() => void partial.remove(), () => void finals.remove(), () => void error.remove(), () => void end.remove());
      await NativeVoice.start();
    } catch (err) {
      opts.onError(voiceErrorMessage(err instanceof Error ? err.message : String(err)));
      opts.onEnd();
    }
  })();
  return {
    stop: () => {
      removed = true;
      void NativeVoice.stop().catch(() => undefined);
      cleanups.forEach((fn) => fn());
      opts.onEnd();
    },
  };
}

function startWeb(opts: {
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

  let stopped = false;
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
    opts.onError(voiceErrorMessage(anyEv.error));
  };
  rec.onend = () => {
    if (!stopped) opts.onEnd();
  };

  void (async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      rec.start();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      if (name === 'NotAllowedError' || /not allowed|permission/i.test(msg)) {
        opts.onError(voiceErrorMessage('not-allowed'));
      } else {
        opts.onError(voiceErrorMessage(msg));
      }
      opts.onEnd();
    }
  })();

  return {
    stop: () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        rec.abort();
      }
    },
  };
}
