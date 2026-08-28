import { describe, expect, it } from 'vitest';
import { extractStreamEvents, mergeToolCalls, parseSseBlock, parseSsePayloads, thinkingPayload } from './stream';

describe('sse parser', () => {
  it('parses done sentinel', () => {
    expect(parseSseBlock('data: [DONE]')).toBe('DONE');
  });

  it('parses json data lines', () => {
    const json = parseSseBlock('event: c\ndata: {"foo":1}');
    expect(json).toEqual({ foo: 1 });
  });

  it('splits reasoning and content', () => {
    const events = extractStreamEvents({
      choices: [{ delta: { reasoning_content: 'think', content: 'hi' } }],
    });
    expect(events).toEqual([
      { type: 'reasoning', text: 'think' },
      { type: 'content', text: 'hi' },
    ]);
  });

  it('merges streamed tool calls', () => {
    let acc: { id?: string; name?: string; arguments: string }[] = [];
    acc = mergeToolCalls(acc, { type: 'tool_call', index: 0, id: '1', name: 'web_search', arguments: '{"q"' });
    acc = mergeToolCalls(acc, { type: 'tool_call', index: 0, arguments: ':"x"}' });
    expect(acc[0]).toEqual({ id: '1', name: 'web_search', arguments: '{"q":"x"}' });
  });
});

describe('thinking payload', () => {
  it('sends nothing without model config', () => {
    expect(thinkingPayload('none')).toEqual({});
    expect(thinkingPayload('medium')).toEqual({});
  });

  it('uses SHOW CONFIGURATION thinkingLevelMap and format', () => {
    const flash = {
      reasoning: true,
      compat: { thinkingFormat: 'deepseek' as const },
      thinkingLevelMap: { minimal: null, low: 'low', medium: null, high: 'high', max: 'max' },
    };
    expect(thinkingPayload('high', flash)).toEqual({ thinking: { type: 'enabled' }, reasoning_effort: 'high' });
    expect(thinkingPayload('none', flash)).toEqual({ thinking: { type: 'disabled' } });
    expect(thinkingPayload('high', { reasoning: false })).toEqual({});
    expect(thinkingPayload('low', { reasoning: true, compat: { thinkingFormat: 'openai' }, thinkingLevelMap: { low: 'low' } })).toEqual({
      reasoning_effort: 'low',
    });
    expect(thinkingPayload('high', { reasoning: true, compat: { thinkingFormat: 'none' } })).toEqual({});
  });

  it('parses json errors and non-stream completions', () => {
    expect(extractStreamEvents({ error: { message: 'Missing API key' } })).toEqual([
      { type: 'error', message: 'Missing API key' },
    ]);
    expect(extractStreamEvents({ choices: [{ message: { content: '你好' } }] })).toEqual([
      { type: 'content', text: '你好' },
    ]);
    expect(parseSseBlock('{"error":{"message":"nope"}}')).toEqual({ error: { message: 'nope' } });
    const payloads = parseSsePayloads('data: {"choices":[{"delta":{"content":"a"}}]}\ndata: {"choices":[{"delta":{"content":"b"}}]}');
    expect(payloads).toHaveLength(2);
  });

  it('parses OpenCode Go auth errors and array content parts', () => {
    expect(
      extractStreamEvents({
        type: 'error',
        error: { type: 'AuthError', message: 'Invalid API key.' },
      }),
    ).toEqual([{ type: 'error', message: 'Invalid API key.' }]);
    expect(
      extractStreamEvents({
        choices: [{ message: { content: [{ type: 'text', text: '你好呀' }] } }],
      }),
    ).toEqual([{ type: 'content', text: '你好呀' }]);
  });
});
