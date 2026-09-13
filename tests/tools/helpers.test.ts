import { describe, it, expect, vi } from 'vitest';
import { text, json, fail, guard, mcpErrorResult, toCallToolRequest } from '../../src/tools/helpers.js';
import { ErrorCode, McpError } from '../../src/types/core.js';

describe('tool helpers', () => {
  it('builds text, json, and fail results', () => {
    expect(text('hi')).toEqual({ content: [{ type: 'text', text: 'hi' }] });
    expect(json({ a: 1 }).content[0]).toMatchObject({ type: 'text', text: '{\n  "a": 1\n}' });
    expect(fail('nope')).toEqual({ content: [{ type: 'text', text: 'nope' }], isError: true });
  });

  it('rebuilds the tools/call request the handlers consume', () => {
    expect(toCallToolRequest('list', { model: 'cards' })).toEqual({
      method: 'tools/call',
      params: { name: 'list', arguments: { model: 'cards' } },
    });
  });

  it('renders McpError details including guidance and troubleshooting steps', () => {
    const error = new McpError(ErrorCode.InvalidParams, 'Bad input', {
      agentGuidance: 'Fix the input',
      troubleshootingSteps: ['Check the id', 'Retry'],
      retryAfterMs: 1500,
    });
    const result = mcpErrorResult(error);
    expect(result.isError).toBe(true);
    const [first, second] = result.content as Array<{ type: string; text: string }>;
    expect(first.text).toContain('Error: Bad input');
    expect(first.text).toContain('Guidance: Fix the input');
    expect(first.text).toContain('Recovery Action:');
    expect(first.text).toContain('Retry After: 1500ms');
    expect(second.text).toContain('1. Check the id');
    expect(second.text).toContain('2. Retry');
  });

  it('omits guidance when it repeats the message', () => {
    const error = new McpError(ErrorCode.InternalError, 'Same', { agentGuidance: 'Same' });
    const [first] = mcpErrorResult(error).content as Array<{ type: string; text: string }>;
    expect(first.text).not.toContain('Guidance:');
  });

  it('guard passes results through and converts thrown errors', async () => {
    const ok = guard(async () => text('fine'));
    expect(await ok({})).toEqual(text('fine'));

    const mcp = guard(async () => {
      throw new McpError(ErrorCode.InvalidParams, 'Structured');
    });
    const structured = await mcp({});
    expect(structured.isError).toBe(true);
    expect((structured.content[0] as { text: string }).text).toContain('Error: Structured');

    const onError = vi.fn();
    const generic = guard(async () => {
      throw new Error('Plain');
    }, onError);
    const plain = await generic({});
    expect(plain).toEqual(fail('Error: Tool execution failed: Plain'));
    expect(onError).toHaveBeenCalledTimes(1);

    const withData = guard(async () => {
      throw { data: { message: 'From API' } };
    });
    expect(await withData({})).toEqual(fail('Error: Tool execution failed: From API'));
  });
});
