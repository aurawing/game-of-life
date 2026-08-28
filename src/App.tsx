import { useEffect, useMemo, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Composer } from './components/Composer';
import { MessageList, ThinkingSheet } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { SettingsView } from './components/SettingsView';
import { PluginCenter } from './components/PluginCenter';
import { McpView } from './components/McpView';
import { IconMenu, IconPlus } from './components/Icons';
import { useActiveSession, useAppStore } from './store';
import { THINKING_LABELS, type ChatMessage } from './types';

type Overlay = 'none' | 'settings' | 'plugins' | 'mcp';

export default function App() {
  const [drawer, setDrawer] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [thinking, setThinking] = useState<ChatMessage | null>(null);
  const session = useActiveSession();
  const busy = useAppStore((s) => s.busy);
  const send = useAppStore((s) => s.send);
  const stop = useAppStore((s) => s.stop);
  const create = useAppStore((s) => s.newSession);
  const model = useAppStore((s) => s.activeModel);
  const effort = useAppStore((s) => s.thinkingEffort);
  const providers = useAppStore((s) => s.providers);
  const activeProviderId = useAppStore((s) => s.activeProviderId);
  const setActiveModel = useAppStore((s) => s.setActiveModel);
  const live = thinking ? session?.messages.find((m) => m.id === thinking.id) ?? thinking : null;
  const models = useMemo(
    () => providers.find((p) => p.id === activeProviderId)?.models ?? [model],
    [providers, activeProviderId, model],
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setBackgroundColor({ color: '#161412' });
    const sub = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (thinking) {
        setThinking(null);
        return;
      }
      if (overlay !== 'none') {
        setOverlay('none');
        return;
      }
      if (drawer) {
        setDrawer(false);
        return;
      }
      if (!canGoBack) {
        void CapApp.exitApp();
      }
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [drawer, overlay, thinking]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="菜单">
          <IconMenu />
        </button>
        <div className="top-center">
          <select className="model-select" value={model} onChange={(e) => setActiveModel(e.target.value)}>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="muted tiny">思维 {THINKING_LABELS[effort]}</div>
        </div>
        <button className="icon-btn" onClick={create} aria-label="新对话">
          <IconPlus />
        </button>
      </header>

      <MessageList messages={session?.messages ?? []} onOpenThinking={setThinking} />
      <Composer busy={busy} onSend={(t, a) => void send(t, a)} onStop={stop} />

      <Sidebar
        open={drawer}
        onClose={() => setDrawer(false)}
        onOpenSettings={() => {
          setDrawer(false);
          setOverlay('settings');
        }}
        onOpenPlugins={() => {
          setDrawer(false);
          setOverlay('plugins');
        }}
        onOpenMcp={() => {
          setDrawer(false);
          setOverlay('mcp');
        }}
      />
      {overlay === 'settings' && <SettingsView onClose={() => setOverlay('none')} />}
      {overlay === 'plugins' && <PluginCenter onClose={() => setOverlay('none')} />}
      {overlay === 'mcp' && <McpView onClose={() => setOverlay('none')} />}
      <ThinkingSheet msg={live} onClose={() => setThinking(null)} />
    </div>
  );
}
