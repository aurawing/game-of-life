import { httpJson } from '../http';
import type { McpServer, McpToolDef } from '../../types';
import { uid } from '../id';

interface JsonRpc {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

async function rpc<T>(server: McpServer, method: string, params?: unknown): Promise<T> {
  const body: JsonRpc = { jsonrpc: '2.0', id: uid('rpc'), method, params };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...server.headers,
  };
  const res = await httpJson(server.url, { method: 'POST', headers, body, timeout: 45000 });
  if (res.status >= 400) {
    throw new Error(`MCP HTTP ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
  }
  const data = unwrapSseOrJson(res.data);
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
    throw new Error(JSON.stringify((data as { error: unknown }).error));
  }
  return ((data as { result?: T })?.result ?? data) as T;
}

function unwrapSseOrJson(data: unknown): unknown {
  if (typeof data === 'string' && data.includes('data:')) {
    const lines = data.split(/\r?\n/).filter((l) => l.startsWith('data:'));
    const last = lines.at(-1)?.slice(5).trim();
    if (last) {
      try {
        return JSON.parse(last);
      } catch {
        return data;
      }
    }
  }
  return data;
}

export async function initializeMcp(server: McpServer): Promise<McpServer> {
  await rpc(server, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: { tools: {} },
    clientInfo: { name: 'dsh-agent-android', version: '1.0.0' },
  });
  try {
    await rpc(server, 'notifications/initialized', {});
  } catch {
    /* optional */
  }
  const listed = await rpc<{ tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>(
    server,
    'tools/list',
    {},
  );
  const tools: McpToolDef[] = (listed.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    serverId: server.id,
  }));
  return { ...server, tools, status: 'ok', lastError: undefined };
}

export async function callMcpTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<string> {
  const result = await rpc<{ content?: Array<{ type?: string; text?: string }>; isError?: boolean }>(server, 'tools/call', {
    name,
    arguments: args,
  });
  const text = (result.content ?? [])
    .map((c) => c.text)
    .filter(Boolean)
    .join('\n');
  if (result.isError) throw new Error(text || 'MCP tool error');
  return text || JSON.stringify(result);
}
