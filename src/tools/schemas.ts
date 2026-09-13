/**
 * Tool input schemas as zod raw shapes. Every field carries a description so
 * the generated JSON Schema documents itself to the calling agent.
 */

import { z } from 'zod';

export const SEARCH_MODELS = [
  'card',
  'dashboard',
  'table',
  'dataset',
  'segment',
  'collection',
  'database',
  'action',
  'indexed-entity',
  'metric',
] as const;

export const RETRIEVE_MODELS = [
  'card',
  'dashboard',
  'table',
  'database',
  'collection',
  'field',
] as const;

export const LIST_MODELS = ['cards', 'dashboards', 'tables', 'databases', 'collections'] as const;

export const EXPORT_FORMATS = ['csv', 'json', 'xlsx'] as const;

export const CACHE_TYPES = [
  'all',
  'cards',
  'dashboards',
  'tables',
  'databases',
  'collections',
  'fields',
  'cards-list',
  'dashboards-list',
  'tables-list',
  'databases-list',
  'collections-list',
  'all-lists',
  'all-individual',
] as const;

const parameterList = z.array(z.record(z.unknown()));

export const searchShape = {
  query: z.string().optional().describe('Search across names, descriptions, and metadata.'),
  models: z
    .array(z.enum(SEARCH_MODELS))
    .optional()
    .describe(
      'Model types to search (default: ["card", "dashboard"]). RESTRICTION: "database" model cannot be mixed with others and must be used exclusively.'
    ),
  max_results: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe('Maximum number of results to return (default: 50)'),
  search_native_query: z
    .boolean()
    .optional()
    .describe(
      'Search within SQL query content of cards (default: false). RESTRICTION: Only works when models=["card"] exclusively.'
    ),
  include_dashboard_questions: z
    .boolean()
    .optional()
    .describe(
      'Include questions within dashboards in results (default: false). RESTRICTION: Only works when "dashboard" is included in models.'
    ),
  ids: z
    .array(z.number())
    .optional()
    .describe(
      'Search for specific IDs. RESTRICTIONS: Only works with single model type, cannot be used with "table" or "database" models.'
    ),
  archived: z.boolean().optional().describe('Search archived items only (default: false)'),
  database_id: z
    .number()
    .optional()
    .describe(
      'Search items from specific database ID. RESTRICTION: Cannot be used when searching for databases (models=["database"]).'
    ),
  verified: z
    .boolean()
    .optional()
    .describe('Search verified items only (requires premium features)'),
};

export const retrieveShape = {
  model: z
    .enum(RETRIEVE_MODELS)
    .describe('Type of model to retrieve. Only one model type allowed per request.'),
  ids: z
    .array(z.number())
    .min(1)
    .max(50)
    .describe(
      'Array of IDs to retrieve (1-50 IDs per request). All IDs must be positive integers. For larger datasets, make multiple requests.'
    ),
  table_offset: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Starting offset for table pagination (database model only). Use with table_limit for paginating through large databases that exceed token limits.'
    ),
  table_limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Maximum number of tables to return per page (database model only). Maximum 100 tables per page. Use with table_offset for pagination.'
    ),
};

export const listShape = {
  model: z
    .enum(LIST_MODELS)
    .describe(
      'Model type to list ALL records for. Supported models: cards (all questions/queries), dashboards (all dashboards), tables (all database tables), databases (all connected databases), collections (all folders/collections). Only one model type allowed per request for optimal performance.'
    ),
  offset: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Starting offset for pagination. Use with limit for paginating through large datasets that exceed token limits.'
    ),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe(
      'Maximum number of items to return per page. Maximum 1000 items per page. Use with offset for pagination.'
    ),
};

export const executeShape = {
  database_id: z
    .number()
    .optional()
    .describe('Database ID to execute query against (SQL mode only)'),
  query: z.string().optional().describe('SQL query to execute (SQL mode only)'),
  card_id: z.number().optional().describe('ID of saved card to execute (card mode only)'),
  native_parameters: parameterList
    .optional()
    .describe('Parameters for SQL template variables like {{variable_name}} (SQL mode only)'),
  card_parameters: parameterList
    .optional()
    .describe(
      'Parameters for filtering card results (card mode only). Each parameter must follow Metabase format: {id: "uuid", slug: "param_name", target: ["dimension", ["template-tag", "param_name"]], type: "param_type", value: "param_value"}'
    ),
  row_limit: z
    .number()
    .min(1)
    .max(2000)
    .optional()
    .describe('Maximum number of rows to return (default: 500, max: 2000)'),
};

export const exportShape = {
  database_id: z.number().optional().describe('Database ID to export query from (SQL mode only)'),
  query: z.string().optional().describe('SQL query to execute and export (SQL mode only)'),
  card_id: z.number().optional().describe('ID of saved card to export (card mode only)'),
  native_parameters: parameterList
    .optional()
    .describe('Parameters for SQL template variables like {{variable_name}} (SQL mode only)'),
  card_parameters: parameterList
    .optional()
    .describe(
      'Parameters for filtering card results before export (card mode only). Each parameter must follow Metabase format: {id: "uuid", slug: "param_name", target: ["dimension", ["template-tag", "param_name"]], type: "param_type", value: "param_value"}'
    ),
  format: z
    .enum(EXPORT_FORMATS)
    .optional()
    .describe(
      'Export format: csv (text), json (structured data), or xlsx (Excel file). Default: csv'
    ),
  filename: z
    .string()
    .optional()
    .describe(
      'Custom filename (without extension) for the saved file. If not provided, a timestamp-based name will be used.'
    ),
};

export const clearCacheShape = {
  cache_type: z
    .enum(CACHE_TYPES)
    .optional()
    .describe(
      'Type of cache to clear: "all" (default - clears all cache types), individual item caches ("cards", "dashboards", "tables", "databases", "collections", "fields"), list caches ("cards-list", "dashboards-list", "tables-list", "databases-list", "collections-list"), or bulk operations ("all-lists", "all-individual")'
    ),
};

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
}

/**
 * Tool catalogue in the order it is advertised to clients.
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'search',
    title: 'Search Metabase content',
    description:
      'Search across all Metabase items using native search API. Supports cards, dashboards, tables, collections, databases, and more. Use this first for finding any Metabase content. Returns search metrics, recommendations, and clean results organized by model type.',
    inputSchema: searchShape,
  },
  {
    name: 'retrieve',
    title: 'Retrieve item details',
    description:
      'Fetch additional details for supported models (Cards, Dashboards, Tables, Databases, Collections, Fields). Supports multiple IDs (max 50 per request) with intelligent concurrent processing and optimized caching. Includes table pagination for large databases exceeding token limits.',
    inputSchema: retrieveShape,
  },
  {
    name: 'list',
    title: 'List all records of one type',
    description:
      'Fetch all records for a single Metabase resource type with highly optimized responses for overview purposes. Retrieves complete lists of cards, dashboards, tables, databases, or collections. Returns only essential identifier fields for efficient browsing and includes intelligent caching for performance. Supports pagination for large datasets exceeding token limits.',
    inputSchema: listShape,
  },
  {
    name: 'execute',
    title: 'Execute SQL or a saved card',
    description:
      'Unified command to execute SQL queries or run saved cards against Metabase databases. Use Card mode when existing cards have the needed filters. Use SQL mode for custom queries or when cards lack required filters. Returns up to 2000 rows per request.',
    inputSchema: executeShape,
  },
  {
    name: 'export',
    title: 'Export query or card results',
    description:
      'Unified command to export large SQL query results or saved cards using Metabase export endpoints (supports up to 1M rows). Returns data in specified format (CSV, JSON, or XLSX) and automatically saves to the configured export directory.',
    inputSchema: exportShape,
  },
  {
    name: 'clear_cache',
    title: 'Clear the internal cache',
    description:
      'Clear the internal cache for stored data. Useful for debugging or when you know the data has changed. Supports granular cache clearing for both individual items and list caches.',
    inputSchema: clearCacheShape,
  },
];

export const TOOL_NAMES = TOOL_DEFINITIONS.map(tool => tool.name);
