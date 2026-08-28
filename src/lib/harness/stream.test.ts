import { describe, expect, it } from 'vitest';
import { extractStreamEvents, mergeToolCalls, parseSseBlock, thinkingPayload } from './stream';

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
  it('disables thinking for none', () => {
    expect(thinkingPayload('none')).toEqual({ thinking: { type: 'disabled' } });
  });

  it('maps medium to high effort', () => {
    expect(thinkingPayload('medium')).toEqual({ thinking: { type: 'enabled' }, reasoning_effort: 'high' });
  });
});
