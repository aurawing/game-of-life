export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type ThinkingEffort = 'none' | 'low' | 'medium' | 'high' | 'max';

export type AttachmentKind = 'text' | 'image' | 'file';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  text?: string;
  dataUrl?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  streaming?: boolean;
  createdAt: number;
}

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: 'http' | 'sse';
  headers: Record<string, string>;
  enabled: boolean;
  tools?: McpToolDef[];
  status?: 'idle' | 'ok' | 'error';
  lastError?: string;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverId: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  url: string;
  language?: string;
  updatedAt?: string;
  npm?: string;
  verifiedAgainst?: string;
  source: 'github' | 'reef' | 'builtin';
}

export interface InstalledPlugin {
  id: string;
  name: string;
  spec: string;
  description: string;
  enabled: boolean;
  source: 'builtin' | 'marketplace';
  installedAt: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  systemPrompt?: string;
  messages: ChatMessage[];
}

export interface AppSettings {
  providers: Provider[];
  activeProviderId: string;
  activeModel: string;
  thinkingEffort: ThinkingEffort;
  systemPrompt: string;
  mcpServers: McpServer[];
  installedPlugins: InstalledPlugin[];
}

export const THINKING_LABELS: Record<ThinkingEffort, string> = {
  none: '关闭',
  low: '低',
  medium: '中',
  high: '高',
  max: '最强',
};

export const DEFAULT_SYSTEM_PROMPT = `你是 DSH Agent，运行在 Android 上的 DeepSeek Harness 智能体。
用简洁、可执行的中文回答。需要外部信息时主动调用工具。
有附件时先阅读附件再回答。思考过程放在推理通道，最终答案放在正文。`;

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'],
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: ['gpt-4.1', 'gpt-4o'],
  },
];
