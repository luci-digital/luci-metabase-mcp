/**
 * Tool result helpers shared by every registered tool.
 *
 * Pattern shared with the LuciVerse aifam-mcp server
 * (lucia_tooling_omzsh/aifam-mcp/src/tools/helpers.ts), extended so that a
 * thrown McpError keeps its agent guidance, recovery action, and
 * troubleshooting steps in the returned error text.
 */

import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ApiError } from '../types/core.js';

export function text(value: string): CallToolResult {
  return { content: [{ type: 'text', text: value }] };
}

export function json(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Rebuild the tools/call request object that the handler layer consumes.
 */
export function toCallToolRequest(name: string, args: Record<string, unknown>): CallToolRequest {
  return { method: 'tools/call', params: { name, arguments: args } };
}

/**
 * Render a structured McpError as an error result with agent guidance.
 */
export function mcpErrorResult(error: McpError): CallToolResult {
  const parts = [`Error: ${error.message}`];

  if (error.details.agentGuidance && error.details.agentGuidance !== error.message) {
    parts.push(`\n\nGuidance: ${error.details.agentGuidance}`);
  }
  parts.push(`\n\nRecovery Action: ${error.details.recoveryAction}`);
  parts.push(`\n\nRetryable: ${error.details.retryable}`);
  if (error.details.retryAfterMs) {
    parts.push(`\n\nRetry After: ${error.details.retryAfterMs}ms`);
  }

  const result: CallToolResult = {
    content: [{ type: 'text', text: parts.join('') }],
    isError: true,
  };

  if (error.details.troubleshootingSteps && error.details.troubleshootingSteps.length > 0) {
    result.content.push({
      type: 'text',
      text: `\nTroubleshooting Steps:\n${error.details.troubleshootingSteps
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n')}`,
    });
  }

  return result;
}

/**
 * Wrap a tool handler so thrown errors become clean MCP error results.
 */
export function guard<A>(
  fn: (args: A) => Promise<CallToolResult>,
  onError?: (error: unknown) => void
): (args: A) => Promise<CallToolResult> {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (error: unknown) {
      if (error instanceof McpError) {
        return mcpErrorResult(error);
      }
      const apiError = error as ApiError;
      const message = apiError?.data?.message || apiError?.message || String(error);
      if (onError) {
        onError(error);
      }
      return fail(`Error: Tool execution failed: ${message}`);
    }
  };
}
