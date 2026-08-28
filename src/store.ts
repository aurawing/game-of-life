import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppSettings,
  Attachment,
  ChatMessage,
  InstalledPlugin,
  McpServer,
  Provider,
  Session,
  ThinkingEffort,
} from './types';
import { DEFAULT_SYSTEM_PROMPT } from './types';
import { guessTitle, now, uid } from './lib/id';
import { runAgentTurn } from './lib/harness/loop';
import { initializeMcp } from './lib/harness/mcp';
import {
  bundledCatalog,
  clampEffort,
  loadPiCatalog,
  mergeSavedProviders,
  resolveModelConfig,
  type PiCatalog,
} from './lib/pi-catalog';

export const BUILTIN_PLUGINS: InstalledPlugin[] = [
  {
    id: 'web_search',
    name: '网页搜索',
    spec: 'builtin:web_search',
    description: 'DuckDuckGo Instant Answer 搜索',
    enabled: true,
    source: 'builtin',
    installedAt: 0,
  },
  {
    id: 'fetch_url',
    name: '抓取网页',
    spec: 'builtin:fetch_url',
    description: '读取公开 URL 文本',
    enabled: true,
    source: 'builtin',
    installedAt: 0,
  },
  {
    id: 'calculator',
    name: '计算器',
    spec: 'builtin:calculator',
    description: '算术表达式求值',
    enabled: true,
    source: 'builtin',
    installedAt: 0,
  },
  {
    id: 'datetime',
    name: '时间',
    spec: 'builtin:datetime',
    description: '当前时间 ISO',
    enabled: true,
    source: 'builtin',
    installedAt: 0,
  },
];

function emptySession(): Session {
  const ts = now();
  return {
    id: uid('ses'),
    title: '新对话',
    createdAt: ts,
    updatedAt: ts,
    archived: false,
    messages: [],
  };
}

function mergePlugins(saved: InstalledPlugin[] | undefined): InstalledPlugin[] {
  const extras = (saved ?? []).filter((p) => p.source !== 'builtin');
  const savedBuiltin = new Map((saved ?? []).filter((p) => p.source === 'builtin').map((p) => [p.id, p]));
  const builtins = BUILTIN_PLUGINS.map((b) => ({ ...b, enabled: savedBuiltin.get(b.id)?.enabled ?? b.enabled }));
  return [...builtins, ...extras];
}

interface AppState extends AppSettings {
  sessions: Session[];
  activeSessionId: string;
  busy: boolean;
  abort?: AbortController;
  hydrateDone: boolean;
  catalog: PiCatalog;
  catalogSource: 'bundled' | 'live';
  refreshCatalog: () => Promise<void>;
  setProviderField: (id: string, patch: Partial<Provider>) => void;
  addProvider: () => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  setActiveModel: (model: string) => void;
  setThinkingEffort: (effort: ThinkingEffort) => void;
  setSystemPrompt: (prompt: string) => void;
  setSessionSystemPrompt: (prompt: string) => void;
  newSession: () => void;
  selectSession: (id: string) => void;
  archiveSession: (id: string) => void;
  restoreSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  upsertMessage: (sessionId: string, message: ChatMessage) => void;
  send: (text: string, attachments: Attachment[]) => Promise<void>;
  stop: () => void;
  togglePlugin: (id: string, enabled: boolean) => void;
  installPlugin: (plugin: Omit<InstalledPlugin, 'installedAt' | 'enabled' | 'source'> & { source?: InstalledPlugin['source'] }) => void;
  uninstallPlugin: (id: string) => void;
  addMcp: () => void;
  updateMcp: (id: string, patch: Partial<McpServer>) => void;
  removeMcp: (id: string) => void;
  connectMcp: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const first = emptySession();
      return {
        providers: mergeSavedProviders(undefined, bundledCatalog),
        activeProviderId: 'deepseek',
        activeModel: 'deepseek-v4-flash',
        thinkingEffort: 'high',
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        mcpServers: [],
        installedPlugins: BUILTIN_PLUGINS,
        sessions: [first],
        activeSessionId: first.id,
        busy: false,
        hydrateDone: false,
        catalog: bundledCatalog,
        catalogSource: 'bundled',

        refreshCatalog: async () => {
          const { catalog, source } = await loadPiCatalog();
          const state = get();
          const providers = mergeSavedProviders(state.providers, catalog);
          const active = providers.find((p) => p.id === state.activeProviderId) ?? providers[0];
          const config = resolveModelConfig(catalog, active, state.activeModel);
          const model =
            config?.id && catalog[active?.id ?? '']?.[state.activeModel]
              ? state.activeModel
              : (active?.models[0] ?? state.activeModel);
          const nextConfig = resolveModelConfig(catalog, active, model);
          set({
            catalog,
            catalogSource: source,
            providers,
            activeProviderId: active?.id ?? state.activeProviderId,
            activeModel: model,
            thinkingEffort: clampEffort(state.thinkingEffort, nextConfig),
          });
        },
        setProviderField: (id, patch) =>
          set({ providers: get().providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
        addProvider: () => {
          const created = {
            id: uid('prov'),
            name: '自定义提供商',
            baseUrl: 'https://api.example.com/v1',
            apiKey: '',
            models: ['custom-model'],
            kind: 'custom' as const,
            reasoning: true,
            vision: true,
            contextWindow: 128000,
            maxTokens: 8192,
          };
          set({
            providers: [...get().providers, created],
            activeProviderId: created.id,
            activeModel: created.models[0],
            thinkingEffort: clampEffort(get().thinkingEffort, resolveModelConfig(get().catalog, created, created.models[0])),
          });
        },
        removeProvider: (id) => {
          const target = get().providers.find((p) => p.id === id);
          if (target?.kind !== 'custom') return;
          const providers = get().providers.filter((p) => p.id !== id);
          const activeProviderId = get().activeProviderId === id ? providers[0]?.id ?? '' : get().activeProviderId;
          const next = providers.find((p) => p.id === activeProviderId);
          const model = next?.models[0] ?? get().activeModel;
          set({
            providers,
            activeProviderId,
            activeModel: get().activeProviderId === id ? model : get().activeModel,
          });
        },
        setActiveProvider: (id) => {
          const p = get().providers.find((x) => x.id === id);
          const model = p?.models[0] ?? get().activeModel;
          const config = resolveModelConfig(get().catalog, p, model);
          set({
            activeProviderId: id,
            activeModel: model,
            thinkingEffort: clampEffort(get().thinkingEffort, config),
          });
        },
        setActiveModel: (model) => {
          const p = get().providers.find((x) => x.id === get().activeProviderId);
          const config = resolveModelConfig(get().catalog, p, model);
          set({ activeModel: model, thinkingEffort: clampEffort(get().thinkingEffort, config) });
        },
        setThinkingEffort: (effort) => set({ thinkingEffort: effort }),
        setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
        setSessionSystemPrompt: (prompt) =>
          set({
            sessions: get().sessions.map((s) => (s.id === get().activeSessionId ? { ...s, systemPrompt: prompt } : s)),
          }),
        newSession: () => {
          const session = emptySession();
          set({ sessions: [session, ...get().sessions], activeSessionId: session.id });
        },
        selectSession: (id) => set({ activeSessionId: id }),
        archiveSession: (id) =>
          set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, archived: true } : s)) }),
        restoreSession: (id) =>
          set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, archived: false } : s)) }),
        deleteSession: (id) => {
          let sessions = get().sessions.filter((s) => s.id !== id);
          if (!sessions.length) sessions = [emptySession()];
          const activeSessionId = get().activeSessionId === id ? sessions[0].id : get().activeSessionId;
          set({ sessions, activeSessionId });
        },
        renameSession: (id, title) =>
          set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, title } : s)) }),
        upsertMessage: (sessionId, message) => {
          set({
            sessions: get().sessions.map((s) => {
              if (s.id !== sessionId) return s;
              const idx = s.messages.findIndex((m) => m.id === message.id);
              const messages = idx >= 0 ? s.messages.map((m) => (m.id === message.id ? message : m)) : [...s.messages, message];
              const title = s.messages.length === 0 && message.role === 'user' ? guessTitle(message.content) : s.title;
              return { ...s, messages, title, updatedAt: now() };
            }),
          });
        },
        send: async (text, attachments) => {
          const state = get();
          if (state.busy) return;
          const session = state.sessions.find((s) => s.id === state.activeSessionId);
          const provider = state.providers.find((p) => p.id === state.activeProviderId);
          if (!session || !provider) return;
          if (!provider.apiKey) {
            get().upsertMessage(session.id, {
              id: uid('msg'),
              role: 'assistant',
              content: '请先在设置里填写 Provider API Key。',
              createdAt: now(),
            });
            return;
          }
          const modelConfig = resolveModelConfig(state.catalog, provider, state.activeModel);
          const abort = new AbortController();
          set({ busy: true, abort });
          const enabledBuiltin = new Set(state.installedPlugins.filter((p) => p.source === 'builtin' && p.enabled).map((p) => p.id));
          try {
            await runAgentTurn({
              session,
              userText: text,
              attachments,
              provider,
              model: state.activeModel,
              effort: clampEffort(state.thinkingEffort, modelConfig),
              systemPrompt: session.systemPrompt?.trim() || state.systemPrompt,
              enabledBuiltin,
              mcpServers: state.mcpServers,
              catalog: state.catalog,
              modelConfig,
              signal: abort.signal,
              hooks: {
                onAssistant: (msg) => get().upsertMessage(session.id, msg),
                onTool: (msg) => get().upsertMessage(session.id, msg),
              },
            });
          } finally {
            set({ busy: false, abort: undefined });
          }
        },
        stop: () => {
          get().abort?.abort();
          set({ busy: false, abort: undefined });
        },
        togglePlugin: (id, enabled) =>
          set({
            installedPlugins: get().installedPlugins.map((p) => (p.id === id ? { ...p, enabled } : p)),
          }),
        installPlugin: (plugin) => {
          const exists = get().installedPlugins.some((p) => p.id === plugin.id);
          if (exists) {
            set({
              installedPlugins: get().installedPlugins.map((p) => (p.id === plugin.id ? { ...p, enabled: true } : p)),
            });
            return;
          }
          set({
            installedPlugins: [
              ...get().installedPlugins,
              {
                ...plugin,
                enabled: true,
                source: plugin.source ?? 'marketplace',
                installedAt: now(),
              },
            ],
          });
        },
        uninstallPlugin: (id) =>
          set({
            installedPlugins: get().installedPlugins.filter((p) => p.id !== id || p.source === 'builtin'),
          }),
        addMcp: () =>
          set({
            mcpServers: [
              ...get().mcpServers,
              {
                id: uid('mcp'),
                name: '自定义 MCP',
                url: 'http://127.0.0.1:3847/mcp',
                transport: 'http',
                headers: {},
                enabled: true,
                status: 'idle',
              },
            ],
          }),
        updateMcp: (id, patch) =>
          set({
            mcpServers: get().mcpServers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          }),
        removeMcp: (id) => set({ mcpServers: get().mcpServers.filter((s) => s.id !== id) }),
        connectMcp: async (id) => {
          const server = get().mcpServers.find((s) => s.id === id);
          if (!server) return;
          try {
            const next = await initializeMcp(server);
            get().updateMcp(id, next);
          } catch (err) {
            get().updateMcp(id, {
              status: 'error',
              lastError: err instanceof Error ? err.message : String(err),
            });
          }
        },
      };
    },
    {
      name: 'dsh-agent-v1',
      partialize: (s) => ({
        providers: s.providers,
        activeProviderId: s.activeProviderId,
        activeModel: s.activeModel,
        thinkingEffort: s.thinkingEffort,
        systemPrompt: s.systemPrompt,
        mcpServers: s.mcpServers.map((server) => ({ ...server, tools: undefined, status: 'idle' })),
        installedPlugins: s.installedPlugins,
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          installedPlugins: mergePlugins(p.installedPlugins),
          providers: mergeSavedProviders(p.providers, current.catalog ?? bundledCatalog),
          sessions: p.sessions?.length ? p.sessions : current.sessions,
        };
      },
    },
  ),
);

export function useActiveSession(): Session | undefined {
  return useAppStore((s) => s.sessions.find((x) => x.id === s.activeSessionId));
}
