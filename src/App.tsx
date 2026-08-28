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
import type { ChatMessage } from './types';
import {
  availableThinkingLevels,
  formatTokenCount,
  resolveModelConfig,
  supportsReasoning,
  supportsVision,
  thinkingLabel,
} from './lib/pi-catalog';
import { applyTheme } from './lib/theme';

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
  const catalog = useAppStore((s) => s.catalog);
  const activeProviderId = useAppStore((s) => s.activeProviderId);
  const themeMode = useAppStore((s) => s.themeMode);
  const refreshCatalog = useAppStore((s) => s.refreshCatalog);
  const live = thinking ? session?.messages.find((m) => m.id === thinking.id) ?? thinking : null;
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const modelConfig = useMemo(
    () => resolveModelConfig(catalog, activeProvider, model),
    [catalog, activeProvider, model],
  );
  const vision = supportsVision(modelConfig);
  const reasoning = supportsReasoning(modelConfig);
  const levels = availableThinkingLevels(modelConfig);
  const effortText = levels.length ? thinkingLabel(effort) : reasoning ? '默认推理' : '无推理';
  const modelTitle = modelConfig?.name || model;
  const caps = [
    activeProvider?.name,
    reasoning ? '推理' : null,
    vision ? '视觉' : null,
    `上下文 ${formatTokenCount(modelConfig?.contextWindow)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    const resolved = applyTheme(themeMode);
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
    void StatusBar.setBackgroundColor({ color: resolved === 'dark' ? '#0a1220' : '#f3f6fb' });
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themeMode]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
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
          <div className="model-title">{modelTitle}</div>
          <div className="muted tiny top-caps">
            思维 {effortText}
            {caps ? ` · ${caps}` : ''}
          </div>
        </div>
        <button className="icon-btn" onClick={create} aria-label="新对话">
          <IconPlus />
        </button>
      </header>

      <MessageList messages={session?.messages ?? []} onOpenThinking={setThinking} />
      <Composer busy={busy} vision={vision} onSend={(t, a) => void send(t, a)} onStop={stop} />

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
