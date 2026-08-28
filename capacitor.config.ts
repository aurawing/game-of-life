import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.dsh.agent',
  appName: 'DSH Agent',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a1220',
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
