import { Capacitor } from '@capacitor/core';
import type { Attachment, ChatMessage, McpServer, Provider, Session, ThinkingEffort, ToolCall } from '../../types';
import type { PiCatalog, PiModelConfig } from '../pi-catalog';
import { resolveRequestBaseUrl, supportsVision } from '../pi-catalog';
import { uid } from '../id';
import { builtinTools, mcpToolToDefinition, parseToolArgs, type ToolDefinition } from './tools';
import { callMcpTool } from './mcp';
import { mergeToolCalls } from './stream';
import { streamChatCompletions } from '../../native/sse';
import { EMPTY_MODEL_REPLY, authHeaders, buildChatBody, chatCompletionsUrl } from './request';

export interface LoopHooks {
  onAssistant: (msg: ChatMessage) => void;
  onTool: (msg: ChatMessage) => void;
}

function contentParts(message: ChatMessage, vision: boolean): unknown {
  const imageAtts = (message.attachments ?? []).filter((a) => a.kind === 'image' && a.dataUrl);
  const images = vision ? imageAtts : [];
  const skippedImages = vision
    ? []
    : imageAtts.map((a) => `\n[图片附件 ${a.name}：当前模型不支持视觉输入]`);
  const texts = [
    message.content,
    ...skippedImages,
    ...(message.attachments ?? [])
      .filter((a) => a.kind !== 'image')
      .map((a) => `\n[附件 ${a.name}]\n${a.text ?? `(binary ${a.mime}, ${a.size} bytes)`}`),
  ]
    .filter(Boolean)
    .join('\n');

  if (!images.length) return texts;
  return [
    { type: 'text', text: texts || '请查看附件。' },
    ...images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
  ];
}

export function deriveMessages(
  systemPrompt: string,
  history: ChatMessage[],
  opts: { vision?: boolean } = {},
): unknown[] {
  const vision = opts.vision !== false;
  const messages: unknown[] = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    if (m.role === 'tool') {
      messages.push({
        role: 'tool',
        tool_call_id: m.toolCalls?.[0]?.id ?? m.id,
        content: m.content,
      });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      messages.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: t.arguments },
        })),
      });
      continue;
    }
    messages.push({ role: m.role, content: contentParts(m, vision) });
  }
  return messages;
}

export async function runAgentTurn(opts: {
  session: Session;
  userText: string;
  attachments: Attachment[];
  provider: Provider;
  model: string;
  effort: ThinkingEffort;
  systemPrompt: string;
  enabledBuiltin: Set<string>;
  mcpServers: McpServer[];
  catalog?: PiCatalog;
  modelConfig?: PiModelConfig | null;
  signal?: AbortSignal;
  hooks: LoopHooks;
}): Promise<ChatMessage[]> {
  const produced: ChatMessage[] = [];
  const userMsg: ChatMessage = {
    id: uid('msg'),
    role: 'user',
    content: opts.userText,
    attachments: opts.attachments,
    createdAt: Date.now(),
  };
  produced.push(userMsg);
  opts.hooks.onAssistant(userMsg);

  const history = [...opts.session.messages, userMsg];
  const mcpTools: ToolDefinition[] = [];
  for (const server of opts.mcpServers.filter((s) => s.enabled)) {
    for (const tool of server.tools ?? []) {
      mcpTools.push(
        mcpToolToDefinition(tool, async (args) => callMcpTool(server, tool.name, args)),
      );
    }
  }
  const tools = [...builtinTools(opts.enabledBuiltin), ...mcpTools];
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const pluginHint = tools.length
    ? `\n\n已启用工具：${tools.map((t) => t.name).join(', ')}。必要时调用它们。`
    : '';
  const system = `${opts.systemPrompt}${pluginHint}`;

  for (let step = 0; step < 8; step += 1) {
    if (opts.signal?.aborted) break;
    const assistant = await streamAssistant({
      provider: opts.provider,
      model: opts.model,
      effort: opts.effort,
      catalog: opts.catalog,
      modelConfig: opts.modelConfig,
      messages: deriveMessages(system, history, { vision: supportsVision(opts.modelConfig) }),
      tools,
      signal: opts.signal,
      onUpdate: opts.hooks.onAssistant,
    });
    produced.push(assistant);
    history.push(assistant);
    const calls = assistant.toolCalls?.filter((t) => t.name) ?? [];
    if (!calls.length) break;

    for (const call of calls) {
      const def = toolMap.get(call.name);
      let result = '';
      let error: string | undefined;
      try {
        if (!def) throw new Error(`unknown tool ${call.name}`);
        result = await def.execute(parseToolArgs(call.arguments));
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        result = error;
      }
      call.result = result;
      call.error = error;
      const toolMsg: ChatMessage = {
        id: uid('msg'),
        role: 'tool',
        content: result,
        toolCalls: [{ ...call, result, error }],
        createdAt: Date.now(),
      };
      produced.push(toolMsg);
      history.push(toolMsg);
      opts.hooks.onTool(toolMsg);
    }
  }

  return produced;
}

async function streamAssistant(opts: {
  provider: Provider;
  model: string;
  effort: ThinkingEffort;
  catalog?: PiCatalog;
  modelConfig?: PiModelConfig | null;
  messages: unknown[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
  onUpdate: (msg: ChatMessage) => void;
}): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: uid('msg'),
    role: 'assistant',
    content: '',
    reasoning: '',
    streaming: true,
    createdAt: Date.now(),
  };
  opts.onUpdate({ ...msg });
  const thinkStarted = Date.now();
  const baseUrl = opts.catalog
    ? resolveRequestBaseUrl(opts.catalog, opts.provider, opts.modelConfig)
    : opts.modelConfig?.baseUrl || opts.provider.baseUrl;
  const url = chatCompletionsUrl(baseUrl);
  const body = buildChatBody({
    model: opts.model,
    messages: opts.messages,
    effort: opts.effort,
    baseUrl,
    modelConfig: opts.modelConfig,
    tools: opts.tools,
  });

  let toolAcc: { id?: string; name?: string; arguments: string }[] = [];
  try {
    for await (const ev of streamChatCompletions({
      url,
      headers: authHeaders(opts.provider, opts.modelConfig),
      body,
      signal: opts.signal,
      preferNative: Capacitor.isNativePlatform(),
    })) {
      if (ev.type === 'reasoning') {
        msg.reasoning = (msg.reasoning ?? '') + ev.text;
        if (!msg.reasoningDurationMs) msg.reasoningDurationMs = Date.now() - thinkStarted;
        opts.onUpdate({ ...msg });
      } else if (ev.type === 'content') {
        if (msg.reasoning && !msg.reasoningDurationMs) {
          msg.reasoningDurationMs = Date.now() - thinkStarted;
        }
        msg.content += ev.text;
        opts.onUpdate({ ...msg });
      } else if (ev.type === 'tool_call') {
        toolAcc = mergeToolCalls(toolAcc, ev);
        msg.toolCalls = toolAcc.map((t, i) => ({
          id: t.id ?? `call_${i}`,
          name: t.name ?? '',
          arguments: t.arguments,
        }));
        opts.onUpdate({ ...msg });
      } else if (ev.type === 'error') {
        msg.content = msg.content || `请求失败：${ev.message}`;
        opts.onUpdate({ ...msg });
      }
    }
  } catch (err) {
    msg.content = msg.content || `网络错误：${err instanceof Error ? err.message : String(err)}`;
  }
  if (msg.reasoning && !msg.reasoningDurationMs) {
    msg.reasoningDurationMs = Date.now() - thinkStarted;
  }
  msg.streaming = false;
  if (toolAcc.length) {
    msg.toolCalls = toolAcc
      .filter((t) => t.name)
      .map((t, i) => ({
        id: t.id ?? `call_${i}`,
        name: t.name ?? '',
        arguments: t.arguments,
      })) as ToolCall[];
  }
  const namedTools = msg.toolCalls?.some((t) => t.name) ?? false;
  if (!msg.content.trim() && msg.reasoning?.trim() && !namedTools) {
    msg.content = msg.reasoning;
  } else if (!opts.signal?.aborted && !msg.content.trim() && !msg.reasoning?.trim() && !namedTools) {
    msg.content = EMPTY_MODEL_REPLY;
  }
  opts.onUpdate({ ...msg });
  return msg;
}
