/**
 * Integration tests for the MCP server over an in-memory transport.
 * Proves the SDK handshake, tool registration, schema validation, and the
 * structured error path without touching Metabase.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Logger } from '../src/logger.js';
import { MetabaseServer, SERVER_INFO } from '../src/server.js';
import { TOOL_NAMES } from '../src/tools/schemas.js';
import type { MetabaseApiClient } from '../src/api.js';
import {
  createCachedResponse,
  sampleCard,
  sampleDashboard,
  sampleDatabase,
  sampleTable,
  sampleField,
  sampleCollection,
  sampleCollectionItems,
} from './setup.js';

function mockApiClient(): MetabaseApiClient {
  return {
    getSessionToken: vi.fn().mockResolvedValue('token'),
    getCurrentUser: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    getCollectionsList: vi.fn().mockResolvedValue({ data: [], source: 'api' }),
    getDatabasesList: vi.fn().mockResolvedValue({ data: [], source: 'api' }),
    getCard: vi.fn().mockResolvedValue(createCachedResponse(sampleCard)),
    getDashboard: vi.fn().mockResolvedValue(createCachedResponse(sampleDashboard)),
    getDatabase: vi.fn().mockResolvedValue(createCachedResponse(sampleDatabase)),
    getTable: vi.fn().mockResolvedValue(createCachedResponse(sampleTable)),
    getField: vi.fn().mockResolvedValue(createCachedResponse(sampleField)),
    getCollection: vi.fn().mockResolvedValue(createCachedResponse(sampleCollection)),
    getCollectionItems: vi.fn().mockResolvedValue(createCachedResponse(sampleCollectionItems)),
    clearAllCache: vi.fn(),
    clearCardsCache: vi.fn(),
    clearListCaches: vi.fn(),
  } as unknown as MetabaseApiClient;
}

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const apiClient = mockApiClient();
  const server = new MetabaseServer({ apiClient, logger: new Logger('fatal') });
  await server.run(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, server, apiClient };
}

describe('MetabaseServer', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('advertises the package.json version and name', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    const { client, server } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    expect(SERVER_INFO.version).toBe(pkg.version);
    expect(client.getServerVersion()).toMatchObject({
      name: 'luci-metabase-mcp',
      version: pkg.version,
    });
    expect(client.getInstructions()).toContain('stdio-only');
  });

  it('lists the six tools with object input schemas in catalogue order', async () => {
    const { client, server } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(TOOL_NAMES);
    expect(TOOL_NAMES).toEqual(['search', 'retrieve', 'list', 'execute', 'export', 'clear_cache']);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.description).toBeTruthy();
    }
    const list = tools.find(tool => tool.name === 'list');
    expect(list?.inputSchema.required).toEqual(['model']);
  });

  it('lists prompts and resource templates', async () => {
    const { client, server } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const { prompts } = await client.listPrompts();
    expect(prompts.map(prompt => prompt.name).sort()).toEqual(['execute_card', 'export_card']);

    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.length).toBeGreaterThan(0);
    expect(resourceTemplates.every(template => template.uriTemplate.startsWith('metabase://'))).toBe(
      true
    );
  });

  it('lists resources through the low-level handler', async () => {
    const { client, server, apiClient } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const { resources } = await client.listResources();
    expect(Array.isArray(resources)).toBe(true);
    expect(apiClient.getCollectionsList).toHaveBeenCalled();
  });

  it('rejects arguments that fail the zod schema before the handler runs', async () => {
    const { client, server, apiClient } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const result = await client.callTool({ name: 'list', arguments: { model: 'nope' } });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toMatch(/Invalid arguments for tool list/);
    expect(apiClient.getSessionToken).not.toHaveBeenCalled();
  });

  it('returns a structured error payload when a handler throws McpError', async () => {
    const { client, server } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    // retrieve validates that ids are positive integers inside the handler.
    const result = await client.callTool({
      name: 'retrieve',
      arguments: { model: 'card', ids: [-1] },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toMatch(/^Error: /);
    expect(content[0].text).toContain('Recovery Action:');
    expect(content[0].text).toContain('Retryable:');
  });

  it('runs a tool end to end through the handler layer', async () => {
    const { client, server, apiClient } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const result = await client.callTool({ name: 'clear_cache', arguments: { cache_type: 'all' } });
    expect(result.isError).toBeFalsy();
    expect(apiClient.getSessionToken).toHaveBeenCalled();
    expect(apiClient.clearAllCache).toHaveBeenCalled();
  });

  it.each([
    ['metabase://card/1', 'getCard'],
    ['metabase://dashboard/1', 'getDashboard'],
    ['metabase://database/1', 'getDatabase'],
    ['metabase://table/1', 'getTable'],
    ['metabase://field/1', 'getField'],
    ['metabase://collection/1', 'getCollection'],
  ])('reads %s through the low-level resource handler', async (uri, method) => {
    const { client, server, apiClient } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const result = await client.readResource({ uri });
    expect(result.contents.length).toBeGreaterThan(0);
    expect(result.contents[0].uri).toBe(uri);
    expect(result.contents[0].mimeType).toBe('application/json');
    expect((apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>)[method]).toHaveBeenCalled();
  });

  it('rejects an unknown resource uri', async () => {
    const { client, server } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    await expect(client.readResource({ uri: 'metabase://nothing/1' })).rejects.toThrow();
  });

  it.each(['execute_card', 'export_card'])('renders the %s prompt', async name => {
    const { client, server, apiClient } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    const result = await client.getPrompt({ name, arguments: { card_id: '1' } });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(apiClient.getCard).toHaveBeenCalledWith(1);
  });

  it('rejects an unknown prompt', async () => {
    const { client, server } = await connect();
    cleanup = () => Promise.all([client.close(), server.close()]).then(() => undefined);

    await expect(client.getPrompt({ name: 'missing', arguments: {} })).rejects.toThrow();
  });
});
