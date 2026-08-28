import { httpJson, httpText } from '../http';
import type { McpToolDef } from '../../types';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  pluginId: string;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

function num(expr: string): number {
  const trimmed = expr.replace(/[^0-9+\-*/().%\s]/g, '');
  if (!trimmed) throw new Error('empty expression');
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict"; return (${trimmed})`)();
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error('not a number');
  return value;
}

export function builtinTools(enabledIds: Set<string>): ToolDefinition[] {
  const all: ToolDefinition[] = [
    {
      pluginId: 'web_search',
      name: 'web_search',
      description: 'Search the public web. Returns titles, URLs and snippets.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      execute: async (args) => {
        const query = String(args.query ?? '');
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const res = await httpJson(url);
        const data = res.data as Record<string, unknown>;
        const related = (data.RelatedTopics as unknown[]) ?? [];
        const items = related
          .slice(0, 8)
          .map((raw) => {
            const t = raw as Record<string, unknown>;
            if (typeof t.Text === 'string') {
              return `- ${t.Text}${typeof t.FirstURL === 'string' ? ` (${t.FirstURL})` : ''}`;
            }
            return '';
          })
          .filter(Boolean);
        const heading = typeof data.Heading === 'string' ? data.Heading : query;
        const abstract = typeof data.AbstractText === 'string' ? data.AbstractText : '';
        return [`# ${heading}`, abstract, ...items].filter(Boolean).join('\n') || 'No results.';
      },
    },
    {
      pluginId: 'fetch_url',
      name: 'fetch_url',
      description: 'Fetch a public URL and return extracted text (truncated).',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
      execute: async (args) => {
        const url = String(args.url ?? '');
        if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
        const text = await httpText(url);
        const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return stripped.slice(0, 8000);
      },
    },
    {
      pluginId: 'calculator',
      name: 'calculator',
      description: 'Evaluate a basic arithmetic expression.',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string' } },
        required: ['expression'],
      },
      execute: async (args) => {
        const expression = String(args.expression ?? '');
        return String(num(expression));
      },
    },
    {
      pluginId: 'datetime',
      name: 'datetime',
      description: 'Return the current local datetime ISO string.',
      parameters: { type: 'object', properties: {} },
      execute: async () => new Date().toISOString(),
    },
  ];
  return all.filter((t) => enabledIds.has(t.pluginId));
}

export function mcpToolToDefinition(tool: McpToolDef, execute: ToolDefinition['execute']): ToolDefinition {
  return {
    pluginId: `mcp:${tool.serverId}`,
    name: tool.name,
    description: tool.description || `MCP tool ${tool.name}`,
    parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    execute,
  };
}

export function toOpenAiTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function parseToolArgs(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : { value: v };
  } catch {
    return { raw };
  }
}
