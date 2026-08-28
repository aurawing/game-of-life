import { registerPlugin } from '@capacitor/core';

export interface NativeVoicePlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'partial' | 'final' | 'error' | 'end',
    cb: (ev: { text?: string; message?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const NativeVoice = registerPlugin<NativeVoicePlugin>('Voice');
