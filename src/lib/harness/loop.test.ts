import { describe, expect, it } from 'vitest';
import { parseToolArgs, toOpenAiTools, builtinTools } from './tools';
import { deriveMessages } from './loop';
import type { ChatMessage } from '../../types';

describe('tools', () => {
  it('filters builtins by enabled set', () => {
    const tools = builtinTools(new Set(['calculator']));
    expect(tools.map((t) => t.name)).toEqual(['calculator']);
  });

  it('parses tool args json', () => {
    expect(parseToolArgs('{"a":1}')).toEqual({ a: 1 });
    expect(parseToolArgs('not-json')).toEqual({ raw: 'not-json' });
  });

  it('emits openai tool schemas', () => {
    const spec = toOpenAiTools(builtinTools(new Set(['datetime'])));
    expect(spec[0].type).toBe('function');
    expect(spec[0].function.name).toBe('datetime');
  });
});

describe('deriveMessages', () => {
  it('keeps tool calls in openai history shape', () => {
    const history: ChatMessage[] = [
      { id: 'u', role: 'user', content: 'hi', createdAt: 1 },
      {
        id: 'a',
        role: 'assistant',
        content: '',
        createdAt: 2,
        toolCalls: [{ id: 'c1', name: 'datetime', arguments: '{}' }],
      },
      { id: 't', role: 'tool', content: 'now', createdAt: 3, toolCalls: [{ id: 'c1', name: 'datetime', arguments: '{}' }] },
    ];
    const msgs = deriveMessages('sys', history) as Array<Record<string, unknown>>;
    expect(msgs[0]).toEqual({ role: 'system', content: 'sys' });
    expect(msgs[2]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'c1' }] });
    expect(msgs[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  });
});
