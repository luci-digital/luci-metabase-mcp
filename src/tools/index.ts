/**
 * Register the Metabase tools on an McpServer. Each tool validates its
 * arguments with the zod shape from schemas.ts, then delegates to the
 * existing handler through the tools/call request shape it expects.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MetabaseApiClient } from '../api.js';
import type { Logger } from '../logger.js';
import { generateRequestId } from '../utils/index.js';
import {
  handleList,
  handleExecute,
  handleExport,
  handleSearch,
  handleClearCache,
  handleRetrieve,
} from '../handlers/index.js';
import { guard, toCallToolRequest } from './helpers.js';
import { TOOL_DEFINITIONS } from './schemas.js';

export interface ToolContext {
  apiClient: MetabaseApiClient;
  log: Logger;
}

type ToolArgs = Record<string, unknown>;
// Handlers return structurally compatible results; the cast happens once in registerTools.
type ToolRunner = (args: ToolArgs, requestId: string) => Promise<unknown>;

function buildRunners(ctx: ToolContext): Record<string, ToolRunner> {
  const { apiClient } = ctx;
  const { logDebug, logInfo, logWarn, logError } = ctx.log.bound();

  return {
    search: (args, requestId) =>
      handleSearch(
        toCallToolRequest('search', args),
        requestId,
        apiClient,
        logDebug,
        logInfo,
        logWarn,
        logError
      ),
    retrieve: (args, requestId) =>
      handleRetrieve(
        toCallToolRequest('retrieve', args),
        requestId,
        apiClient,
        logDebug,
        logInfo,
        logWarn,
        logError
      ),
    list: (args, requestId) =>
      handleList(
        toCallToolRequest('list', args),
        requestId,
        apiClient,
        logDebug,
        logInfo,
        logWarn,
        logError
      ),
    execute: (args, requestId) =>
      handleExecute(
        toCallToolRequest('execute', args),
        requestId,
        apiClient,
        logDebug,
        logInfo,
        logWarn,
        logError
      ),
    export: (args, requestId) =>
      handleExport(
        toCallToolRequest('export', args),
        requestId,
        apiClient,
        logDebug,
        logInfo,
        logWarn,
        logError
      ),
    clear_cache: async args =>
      handleClearCache(
        toCallToolRequest('clear_cache', args),
        apiClient,
        logInfo,
        logWarn,
        logError
      ),
  };
}

export function registerTools(server: McpServer, ctx: ToolContext): void {
  const runners = buildRunners(ctx);

  for (const tool of TOOL_DEFINITIONS) {
    const run = runners[tool.name];
    if (!run) {
      throw new Error(`No handler registered for tool ${tool.name}`);
    }

    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      guard<ToolArgs>(
        async args => {
          const requestId = generateRequestId();
          ctx.log.info(`Processing tool execution request: ${tool.name}`, {
            requestId,
            arguments: args,
          });
          await ctx.apiClient.getSessionToken();
          return (await run(args ?? {}, requestId)) as CallToolResult;
        },
        error => ctx.log.error(`Tool execution failed: ${tool.name}`, error)
      )
    );
  }
}
