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
  catalogModels,
  formatTokenCount,
  resolveModelConfig,
  supportsReasoning,
  supportsVision,
  thinkingLabel,
} from './lib/pi-catalog';

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
  const setActiveProvider = useAppStore((s) => s.setActiveProvider);
  const setActiveModel = useAppStore((s) => s.setActiveModel);
  const refreshCatalog = useAppStore((s) => s.refreshCatalog);
  const live = thinking ? session?.messages.find((m) => m.id === thinking.id) ?? thinking : null;
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const models = useMemo(() => {
    if (activeProvider?.kind === 'custom') {
      return (activeProvider.models ?? []).map((id) => ({ id, name: id }));
    }
    const fromCatalog = catalogModels(catalog, activeProviderId);
    if (fromCatalog.length) return fromCatalog.map((m) => ({ id: m.id, name: m.name }));
    return (activeProvider?.models ?? [model]).map((id) => ({ id, name: id }));
  }, [activeProvider, catalog, activeProviderId, model]);
  const modelConfig = useMemo(
    () => resolveModelConfig(catalog, activeProvider, model),
    [catalog, activeProvider, model],
  );
  const vision = supportsVision(modelConfig);
  const reasoning = supportsReasoning(modelConfig);
  const levels = availableThinkingLevels(modelConfig);
  const effortText = reasoning && levels.length ? thinkingLabel(effort) : '无推理';
  const caps = [
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
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setBackgroundColor({ color: '#0a1220' });
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
          <select
            className="provider-select"
            aria-label="提供商"
            value={activeProviderId}
            onChange={(e) => setActiveProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="model-select"
            aria-label="模型"
            value={model}
            onChange={(e) => setActiveModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
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
