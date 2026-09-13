/**
 * Metabase MCP server.
 *
 * Tools are registered on an McpServer with zod input schemas (see
 * src/tools). Resources and prompts keep their request handlers on the
 * underlying low-level server. The only transport in use is stdio; the
 * server never listens on a port.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { Logger, type LogLevelName } from './logger.js';
import { MetabaseApiClient } from './api.js';
import { PACKAGE_INFO } from './utils/packageInfo.js';
import { registerTools } from './tools/index.js';
import { TOOL_NAMES } from './tools/schemas.js';
import {
  handleListResources,
  handleListResourceTemplates,
  handleReadResource,
} from './handlers/resources/index.js';
import { handleListPrompts, handleGetPrompt } from './handlers/prompts/index.js';

export const SERVER_INFO = {
  name: 'luci-metabase-mcp',
  version: PACKAGE_INFO.version,
} as const;

export const INSTRUCTIONS = `Metabase analytics MCP server (LuciVerse COMN tier, 528 Hz). Internal, stdio-only.

Tools: ${TOOL_NAMES.join(', ')}. Start with search to find content, retrieve for details of specific items, list for a full overview of one model type, execute for SQL or saved cards (up to 2000 rows), export for large result sets (CSV, JSON, XLSX), and clear_cache when data has changed.
Resources: metabase://collection/{id}, metabase://database/{id}, metabase://table/{id}, metabase://card/{id}, metabase://dashboard/{id}, metabase://metric/{id} and the query templates.
Prompts: execute_card and export_card guide parameterized card workflows.
Every error carries agent guidance, a recovery action, and whether a retry is safe.`;

export interface MetabaseServerOptions {
  apiClient?: MetabaseApiClient;
  logger?: Logger;
}

export class MetabaseServer {
  private readonly server: McpServer;
  private readonly apiClient: MetabaseApiClient;
  private readonly log: Logger;

  constructor(options: MetabaseServerOptions = {}) {
    this.log = options.logger ?? new Logger(config.LOG_LEVEL as LogLevelName);
    this.apiClient = options.apiClient ?? new MetabaseApiClient();

    this.server = new McpServer(SERVER_INFO, {
      capabilities: {
        resources: {},
        prompts: {},
      },
      instructions: INSTRUCTIONS,
    });

    registerTools(this.server, { apiClient: this.apiClient, log: this.log.child('tools') });
    this.setupResourceHandlers();
    this.setupPromptHandlers();

    this.server.server.onerror = (error: Error) => {
      this.log.error('Unexpected server error occurred', error);
    };
  }

  /**
   * Resource handlers stay on the low-level server so the hierarchical
   * listing logic in handlers/resources is unchanged.
   */
  private setupResourceHandlers(): void {
    const { logDebug, logInfo, logWarn, logError } = this.log.child('resources').bound();
    const low = this.server.server;

    low.setRequestHandler(ListResourcesRequestSchema, async request =>
      handleListResources(request, this.apiClient, logInfo, logError)
    );

    low.setRequestHandler(ListResourceTemplatesRequestSchema, async request =>
      handleListResourceTemplates(request, logInfo)
    );

    low.setRequestHandler(ReadResourceRequestSchema, async request =>
      handleReadResource(request, this.apiClient, logInfo, logWarn, logDebug, logError)
    );
  }

  private setupPromptHandlers(): void {
    const { logInfo, logWarn, logError } = this.log.child('prompts').bound();
    const low = this.server.server;

    low.setRequestHandler(ListPromptsRequestSchema, async request =>
      handleListPrompts(request, logInfo)
    );

    low.setRequestHandler(GetPromptRequestSchema, async request =>
      handleGetPrompt(request, this.apiClient, logInfo, logWarn, logError)
    );
  }

  /**
   * Connect the server to a transport. Defaults to stdio.
   */
  async run(transport: Transport = new StdioServerTransport()): Promise<void> {
    try {
      this.log.info(`Starting ${SERVER_INFO.name} v${SERVER_INFO.version}`);
      await this.server.connect(transport);
      this.log.info('Server connected and ready');
    } catch (error) {
      this.log.fatal('Failed to start Metabase MCP server', error);
      throw error;
    }

    if (transport instanceof StdioServerTransport) {
      process.once('SIGINT', async () => {
        this.log.info('Gracefully shutting down server');
        await this.server.close();
        process.exit(0);
      });
    }
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
