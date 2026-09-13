import type { TextResourceContents } from '@modelcontextprotocol/sdk/types.js';

// Request types come straight from the MCP SDK
export type {
  ListResourcesRequest,
  ReadResourceRequest,
  ListResourceTemplatesRequest,
} from '@modelcontextprotocol/sdk/types.js';

// Resource template definition
export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  mimeType: string;
  description: string;
}

// Resource content definition (text resources only)
export type ResourceContent = TextResourceContents;

// Resource definition
export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Query template categories
export type QueryTemplateCategory = 'joins' | 'aggregations' | 'filters' | 'time-series' | 'cohort';

// Logging function type
export type LogFunction = (message: string, data?: unknown, error?: Error) => void;
