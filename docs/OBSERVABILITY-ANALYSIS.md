# Observability and Monitoring Analysis

## Executive Summary

This document provides a comprehensive analysis of the current observability capabilities in the Metabase MCP server and identifies enhancement opportunities for performance monitoring, health checks, metrics tracking, and error debugging. The analysis focuses on opportunities within the TypeScript/Node.js stack without external dependencies.

**Key Findings:**
- Basic structured logging infrastructure exists but lacks centralized aggregation
- Performance metrics are scattered across handlers without unified collection
- No health check endpoint or service status monitoring
- Error handling is robust but monitoring is passive
- Caching system has no introspection capabilities
- Missing distributed tracing and request correlation

**Total Codebase Size:** 2,322 lines of TypeScript

---

## 1. Current Handler Architecture

### 1.1 Handler Organization

The project uses a modular handler architecture with 6 primary tools:

```
src/handlers/
├── index.ts                 # Handler exports
├── search.ts               # Search functionality
├── clearCache.ts           # Cache management
├── list/                   # List all items (optimized)
├── retrieve/               # Fetch detailed information
├── execute/                # Execute queries (SQL or cards)
└── export/                 # Export large datasets
```

### 1.2 Handler Pattern

Each handler follows a consistent pattern:

```typescript
async function handle<Action>(
  request: z.infer<typeof CallToolRequestSchema>,
  requestId: string,
  apiClient: MetabaseApiClient,
  logDebug: (message: string, data?: unknown) => void,
  logInfo: (message: string, data?: unknown) => void,
  logWarn: (message: string, data?: unknown, error?: Error) => void,
  logError: (message: string, error: unknown) => void
): Promise<Response>
```

**Strengths:**
- Consistent logging function injection
- RequestId tracking across lifecycle
- Separation of concerns (validation, execution, formatting)
- Response optimization applied

**Gaps:**
- No centralized metrics collection
- No request correlation beyond requestId
- No explicit timing instrumentation
- No performance budgets or SLAs

### 1.3 Current Response Metrics

Several handlers include performance metrics in responses:

**List Handler Example:**
```typescript
response.performance_metrics = {
  total_time_ms: totalTime,
  api_fetch_time_ms: fetchTime,
  optimization_time_ms: totalTime - fetchTime,
  average_time_per_item_ms: totalItems > 0 ? Math.round((totalTime - fetchTime) / totalItems) : 0,
};

response.data_source = {
  source: dataSource,
  fetch_time_ms: fetchTime,
  cache_status: dataSource === 'cache' ? 'hit' : 'miss',
};
```

**Retrieve Handler Example:**
```typescript
response.performance_metrics = {
  total_time_ms: totalTime,
  average_time_per_item_ms: averageTimePerItem,
  concurrency_used: concurrencyUsed,
};

response.data_source = {
  cache_hits: cacheHits,
  api_calls: apiHits,
  total_successful: successCount,
  primary_source: cacheHits > apiHits ? 'cache' : apiHits > cacheHits ? 'api' : 'mixed',
};
```

---

## 2. Current Observability Capabilities

### 2.1 Logging Infrastructure

**Location:** `src/server.ts`, `src/api.ts`

**Features:**
- Structured JSON logging to stderr
- Five log levels: DEBUG, INFO, WARN, ERROR, FATAL
- Timestamp inclusion on every log
- Context data support
- Dual format output (JSON + human-readable)

**Configuration:**
```typescript
// From config.ts
LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info')
```

**Example Log Output:**
```json
{
  "timestamp": "2024-11-11T12:34:56.789Z",
  "level": "info",
  "message": "Successfully fetched card 123 in 45ms",
  "data": { "cardId": 123, "fetchTime": 45 }
}
```

**Limitations:**
- No log aggregation
- No log indexing
- No centralized log collection point
- No performance threshold alerts

### 2.2 Request ID Tracking

**Implementation:**
```typescript
import { generateRequestId } from './utils/index.js';

const requestId = generateRequestId();
```

**Usage:**
- Passed to all handler functions
- Included in log entries
- Available for request correlation
- Enables request tracing through system

**Potential Enhancement:**
- No distributed tracing context propagation
- No request timeline visualization

### 2.3 Error Handling and Categorization

**Error Categories Defined:**
```typescript
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  DATABASE = 'database',
  QUERY_EXECUTION = 'query_execution',
  EXPORT_PROCESSING = 'export_processing',
  CACHE = 'cache',
  CONFIGURATION = 'configuration',
  INTERNAL_SERVER = 'internal_server',
  EXTERNAL_SERVICE = 'external_service',
}
```

**Error Factory Classes:**
- `AuthenticationErrorFactory`
- `AuthorizationErrorFactory`
- `ResourceNotFoundErrorFactory`
- `ValidationErrorFactory`
- `NetworkErrorFactory`
- `TimeoutErrorFactory`
- `QueryExecutionErrorFactory`
- `ExportProcessingErrorFactory`
- `RateLimitErrorFactory`

**Error Details Include:**
```typescript
interface ErrorDetails {
  category: ErrorCategory;
  httpStatus?: number;
  metabaseCode?: string;
  userMessage: string;
  agentGuidance: string;
  recoveryAction: RecoveryAction;
  retryable: boolean;
  retryAfterMs?: number;
  additionalContext?: Record<string, unknown>;
  troubleshootingSteps?: string[];
}
```

**Current Monitoring:** Errors are logged but not aggregated for analytics

### 2.4 Caching System

**Cache Implementation:**
```typescript
// Individual item caches
private cardCache: Map<number, { data: any; timestamp: number }> = new Map();
private dashboardCache: Map<number, { data: any; timestamp: number }> = new Map();
private tableCache: Map<number, { data: any; timestamp: number }> = new Map();
private databaseCache: Map<number, { data: any; timestamp: number }> = new Map();
private collectionCache: Map<number, { data: any; timestamp: number }> = new Map();
private fieldCache: Map<number, { data: any; timestamp: number }> = new Map();

// List caches
private listCardsCache: { data: any[]; timestamp: number } | null = null;
private listDashboardsCache: { data: any[]; timestamp: number } | null = null;
private listTablesCache: { data: any[]; timestamp: number } | null = null;
private listDatabasesCache: { data: any[]; timestamp: number } | null = null;
private listCollectionsCache: { data: any[]; timestamp: number } | null = null;
```

**Cache Features:**
- Configurable TTL (default: 10 minutes)
- Fallback to stale cache on API errors
- Separate list and item caches
- Manual cache clearing via `clear_cache` tool

**Monitoring Gaps:**
- No cache statistics collection
- No hit rate tracking
- No memory usage monitoring
- No eviction policy introspection
- No cache effectiveness analysis

### 2.5 Performance Timing

**Current Timing Collection:**
```typescript
const startTime = Date.now();
// ... operation ...
const totalTime = Date.now() - startTime;
const fetchTime = Date.now() - startTime;
const averageTimePerItem = Math.round(totalTime / numericIds.length);
```

**Where Timing is Tracked:**
- API request duration (api.ts)
- List operations (list/index.ts)
- Retrieve operations (retrieve/index.ts)
- Search operations (search.ts)
- Execute operations (execute/index.ts)
- Export operations (export/index.ts)

**Timing Response Example:**
```typescript
{
  "request_id": "uuid-here",
  "model": "card",
  "performance_metrics": {
    "total_time_ms": 234,
    "average_time_per_item_ms": 12,
    "concurrency_used": 8
  },
  "data_source": {
    "cache_hits": 3,
    "api_calls": 5,
    "total_successful": 8,
    "primary_source": "api"
  }
}
```

**Limitations:**
- No latency histograms
- No percentile tracking (P50, P95, P99)
- No performance regression detection
- No SLA enforcement
- No alert thresholds

---

## 3. Patterns from Observability Standards

### 3.1 Prometheus/Grafana Patterns Applicable

**Metric Types Not Yet Implemented:**

1. **Counter Metrics** (monotonically increasing)
   - Total requests processed by tool
   - Total errors encountered by category
   - Total API calls made
   - Total cache hits/misses

2. **Gauge Metrics** (point-in-time values)
   - Current cache size (bytes)
   - Cache entries count
   - Active concurrent requests
   - Memory usage

3. **Histogram Metrics** (value distributions)
   - Request latency distribution
   - Response size distribution
   - Query execution time distribution

4. **Summary Metrics** (percentiles)
   - P50 request latency
   - P95 request latency
   - P99 request latency
   - API response time SLAs

### 3.2 Observability MCP Server Patterns

**Standard Health Check Pattern:**
```typescript
// Not yet implemented
GET /health
Response: {
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2024-11-11T...",
  "checks": {
    "metabase_api": "healthy",
    "cache_system": "healthy",
    "memory": "healthy"
  }
}
```

**Standard Metrics Endpoint Pattern:**
```typescript
// Not yet implemented
GET /metrics
Response: Prometheus text format or JSON
```

**Standard Status Endpoint Pattern:**
```typescript
// Not yet implemented
GET /status
Response: {
  "version": "1.0.0",
  "uptime_ms": 3600000,
  "cache_stats": {...},
  "request_stats": {...}
}
```

### 3.3 Distributed Tracing Patterns

**Not Yet Implemented:**
- OpenTelemetry-compatible trace context
- Trace ID propagation through requests
- Span creation for operations
- Trace exporters (console, file, etc.)

---

## 4. Existing Error Handling and Debugging

### 4.1 Error Factory System

**Comprehensive Error Creation:**
The system has factory classes for creating specific error types with full context:

```typescript
// Example: Authentication Error
AuthenticationErrorFactory.invalidApiKey(): McpError

// Example: Authorization Error
AuthorizationErrorFactory.insufficientPermissions('card', 'retrieve'): McpError

// Example: Resource Not Found
ResourceNotFoundErrorFactory.resource('card', 123): McpError

// Example: Timeout Error
NetworkErrorFactory.timeout(`API request to /api/card/123`, 600000): McpError
```

### 4.2 Error Context Enhancement

**Response with Full Error Details:**
```typescript
{
  "content": [
    {
      "type": "text",
      "text": "Error: Insufficient permissions for card\n\nGuidance: Your user account lacks the necessary permissions to retrieve card 123.\n\nRecovery Action: verify_permissions\n\nRetryable: false\n\nTroubleshooting Steps:\n1. Check your user permissions in Metabase Admin > People\n2. Verify you have access to the required collections/databases"
    }
  ],
  "isError": true
}
```

### 4.3 Debugging Capabilities

**Current Debugging Tools:**
- MCP Inspector: `npm run inspector` - Browser-based MCP communication viewer
- Verbose logging: Set `LOG_LEVEL=debug` for detailed operation traces
- Structured error responses with guidance

**Missing:**
- No query logging/playback
- No request/response replay mechanism
- No performance profiler integration
- No memory leak detection
- No debugging dashboard

---

## 5. Performance Monitoring Opportunities

### 5.1 Handler-Level Enhancements

**Opportunity 1: Unified Metrics Context**
```typescript
// Create a metrics collector passed to each handler
interface MetricsCollector {
  recordRequest(tool: string, metadata: Record<string, unknown>): void;
  recordError(tool: string, error: McpError): void;
  recordTiming(operation: string, durationMs: number): void;
  recordCacheHit(type: string): void;
  recordCacheMiss(type: string): void;
  recordApiCall(endpoint: string, durationMs: number, statusCode: number): void;
}
```

**Opportunity 2: Timing Wrapper**
```typescript
// Create timing wrapper for operations
async function withTiming<T>(
  operationName: string,
  fn: () => Promise<T>,
  metricsCollector: MetricsCollector
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    metricsCollector.recordTiming(operationName, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.recordTiming(`${operationName}_error`, duration);
    throw error;
  }
}
```

**Opportunity 3: Request Metrics Middleware**
```typescript
// Track metrics for each request handler
interface RequestMetrics {
  toolName: string;
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorCategory?: string;
  resultSize?: number;
  cacheHits?: number;
  apiCalls?: number;
}
```

### 5.2 API Client Monitoring

**Opportunity 1: Request Tracing**
```typescript
// Track all API requests
interface ApiRequestMetric {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  cached: boolean;
  retried: boolean;
  timestamp: Date;
}
```

**Opportunity 2: Cache Statistics**
```typescript
interface CacheStatistics {
  type: string; // 'cards', 'dashboards', etc.
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  averageAge: number;
  memoryUsage: number;
}
```

**Opportunity 3: Connection Pooling Metrics** (if implemented)
```typescript
interface ConnectionMetrics {
  active: number;
  idle: number;
  pending: number;
  timeouts: number;
  errors: number;
}
```

### 5.3 Concurrency Monitoring

**Current Concurrency Control:**
```typescript
// From retrieve/types.ts
export const CONCURRENCY_LIMITS = {
  SMALL_REQUEST_THRESHOLD: 3,
  MEDIUM_REQUEST_THRESHOLD: 20,
  MEDIUM_BATCH_SIZE: 8,
  LARGE_BATCH_SIZE: 5,
};
```

**Opportunity: Track Concurrency Metrics**
```typescript
interface ConcurrencyMetrics {
  requestSize: number;
  batchCount: number;
  concurrencyLevel: number;
  parallelEfficiency: number; // Actual speedup vs theoretical max
  totalTime: number;
  estimatedSequentialTime: number;
}
```

---

## 6. Health Check and Service Status

### 6.1 Recommended Health Check Implementation

**Multi-Level Health Checks:**

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    metabase_connectivity: {
      status: 'healthy' | 'error';
      lastCheck: string;
      responseTime?: number;
      error?: string;
    };
    cache_system: {
      status: 'healthy' | 'warning';
      entries: number;
      hitRate: number;
      size: number;
    };
    memory: {
      status: 'healthy' | 'warning';
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    request_processing: {
      status: 'healthy' | 'warning';
      activeRequests: number;
      errorRate: number;
      averageLatency: number;
    };
  };
}
```

**Recommended Endpoint:**
```
GET /health

Returns HTTP 200 if healthy, 503 if degraded/unhealthy
```

### 6.2 Service Status Tracking

**Fields to Track:**
- Server start time
- Total requests processed
- Current active requests
- Error count by category
- Last API call time
- Cache state

---

## 7. Metrics Aggregation Framework

### 7.1 In-Memory Metrics Store

**No External Dependencies Approach:**

```typescript
class MetricsStore {
  private metrics: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();
  private timestamps: Map<string, Date[]> = new Map();
  
  recordMetric(name: string, value: number): void;
  incrementCounter(name: string, amount?: number): void;
  getMetricStats(name: string): HistogramStats;
  getCounterValue(name: string): number;
  clearMetrics(olderThan?: Date): void;
  exportMetrics(): MetricsSnapshot;
}
```

### 7.2 Time-Series Data Collection

**Lightweight Approach (no external database):**

```typescript
interface MetricsSnapshot {
  timestamp: Date;
  counters: Record<string, number>;
  histograms: Record<string, HistogramStats>;
  gauges: Record<string, number>;
}

interface HistogramStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}
```

---

## 8. Request Correlation and Tracing

### 8.1 Current Request Tracking

**What Exists:**
- RequestId generation
- RequestId logging in all handlers
- RequestId in error responses

**What's Missing:**
- Request lifecycle tracking
- Cross-handler correlation
- Parent-child request relationships
- Request flow visualization

### 8.2 Enhanced Tracing Proposal

```typescript
interface RequestTrace {
  traceId: string;         // Unique across entire request
  requestId: string;       // Current request
  parentRequestId?: string; // For nested calls
  tool: string;            // Tool being called
  startTime: Date;
  endTime?: Date;
  events: TraceEvent[];
  metadata: Record<string, unknown>;
}

interface TraceEvent {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}
```

---

## 9. Error Analysis and Debugging

### 9.1 Error Aggregation

**Metrics to Collect:**
- Error frequency by category
- Error frequency by tool
- Error frequency by resource type
- Error recovery success rate
- Average time to error
- Errors by error code

### 9.2 Error Patterns Detection

**Opportunities:**
- Detect cascading failures
- Identify timeout patterns
- Track authentication failures over time
- Monitor resource not found rates
- Identify permission issues

### 9.3 Debugging Information Export

```typescript
interface DebugExport {
  serverVersion: string;
  nodeVersion: string;
  environment: Record<string, string>;
  recentErrors: McpError[];
  recentMetrics: MetricsSnapshot;
  cacheStats: CacheStatistics[];
  uptime: number;
  timestamp: Date;
}
```

---

## 10. Integration Points for Observability

### 10.1 Where to Add Metrics

**Priority 1 (High Impact):**
1. `src/server.ts` - Add metrics collection to request handlers
2. `src/api.ts` - Add API call metrics
3. `src/handlers/retrieve/index.ts` - Track concurrency metrics
4. `src/handlers/list/index.ts` - Track optimization metrics

**Priority 2 (Medium Impact):**
5. Cache system - Add statistics tracking
6. Error handling - Add error aggregation
7. Search handler - Track search performance

**Priority 3 (Nice to Have):**
8. Export handler - Track export performance
9. Execute handler - Track query performance
10. Clear cache handler - Track cache management

### 10.2 Configuration Hooks

**Existing Configuration in `src/config.ts`:**
```typescript
LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
CACHE_TTL_MS: z.string().default('600000'),
REQUEST_TIMEOUT_MS: z.string().default('600000'),
```

**Recommended Additions:**
```typescript
ENABLE_METRICS: z.boolean().default(false),
METRICS_RETENTION_MS: z.number().default(3600000), // 1 hour
HEALTH_CHECK_INTERVAL_MS: z.number().default(30000), // 30 seconds
ENABLE_TRACING: z.boolean().default(false),
```

---

## 11. Testing Observability

### 11.1 Current Test Coverage

**Test Structure:**
- Tests located in `tests/handlers/`
- Vitest framework
- Mock API client
- Mock logger functions
- Coverage threshold: 80%

**Test Files:**
- `tests/handlers/execute.test.ts`
- `tests/handlers/retrieve.test.ts`
- `tests/handlers/search.test.ts`
- `tests/handlers/export.test.ts`
- `tests/handlers/list.test.ts`
- `tests/handlers/clearCache.test.ts`
- `tests/handlers/resources.test.ts`
- `tests/utils/errorFactory.test.ts`
- `tests/utils/apiErrorExtraction.test.ts`

### 11.2 Metrics Testing Opportunities

**What to Test:**
- Metrics are recorded correctly
- Metrics are cumulative
- Metrics reset properly
- Percentile calculations are accurate
- Health check responds correctly
- Cache statistics are accurate

---

## 12. Monitoring Dashboard Capabilities

### 12.1 What Could Be Monitored

**Metrics Dashboard:**
- Requests per second (RPS)
- Error rate
- Latency (P50, P95, P99)
- Cache hit rate
- API call count
- Database resource usage

**Health Dashboard:**
- Service health status
- Component health (API, cache, memory)
- Recent errors
- Active requests
- Uptime

**Performance Dashboard:**
- Tool-specific latencies
- Concurrency efficiency
- Optimization effectiveness
- Token usage trends

### 12.2 Tools That Could Consume Metrics

**Standard Formats:**
- Prometheus text format (industry standard)
- JSON format (for custom dashboards)
- CSV export (for analysis)

**Integration Points:**
- Prometheus scraper
- Grafana datasource
- Datadog agent
- CloudWatch agent
- Custom monitoring tools

---

## 13. Enhancement Recommendations (Prioritized)

### Phase 1: Foundation (Weeks 1-2)
**Without external dependencies:**

1. **Metrics Collection Framework**
   - Create `src/observability/metrics.ts`
   - Implement MetricsCollector class
   - Add counter, gauge, histogram types
   - Store in-memory with time-series support

2. **Health Check Endpoint**
   - Add `/health` endpoint to server
   - Check Metabase connectivity
   - Monitor cache health
   - Track memory usage

3. **Request Metrics Tracking**
   - Add metrics to all handler entry points
   - Track: tool name, duration, errors, result size
   - Inject MetricsCollector into handlers

4. **Cache Statistics**
   - Add tracking to cache operations
   - Calculate hit rate
   - Monitor memory usage
   - Export statistics

**Estimated Effort:** 40-60 hours

### Phase 2: Observability Dashboard (Weeks 3-4)

1. **Metrics Endpoints**
   - `/metrics` - Prometheus format
   - `/metrics/json` - JSON format
   - `/status` - Service status

2. **Enhanced Logging**
   - Structured trace context
   - Request lifecycle tracking
   - Error correlation

3. **Performance Profiling**
   - Latency percentiles (P50, P95, P99)
   - Throughput tracking
   - Resource utilization

**Estimated Effort:** 30-40 hours

### Phase 3: Advanced Features (Weeks 5+)

1. **Distributed Tracing**
   - OpenTelemetry-compatible traces
   - Span creation for operations
   - Trace context propagation

2. **Error Analytics**
   - Error pattern detection
   - Root cause analysis
   - Remediation suggestions

3. **Performance Optimization**
   - Identify bottlenecks
   - SLA enforcement
   - Automatic scaling hints

**Estimated Effort:** 40-60 hours

---

## 14. Code Location Reference

### Core Files to Modify

| File | Purpose | Enhancement Opportunity |
|------|---------|------------------------|
| `src/server.ts` | Server setup & request handling | Add metrics middleware |
| `src/api.ts` | Metabase API client | Track API call metrics |
| `src/handlers/*/index.ts` | Individual handlers | Add performance tracking |
| `src/config.ts` | Configuration | Add observability settings |
| `src/types/core.ts` | Error types | Add metrics structures |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/observability/metrics.ts` | Metrics collection framework |
| `src/observability/health.ts` | Health check logic |
| `src/observability/tracing.ts` | Request tracing |
| `src/observability/types.ts` | Observability type definitions |

---

## 15. Implementation Examples

### 15.1 Adding Metrics to Retrieve Handler

**Current Code Pattern:**
```typescript
const startTime = Date.now();
// ... operation ...
const totalTime = Date.now() - startTime;
logInfo(`Retrieved ${successCount} items`);
```

**Enhanced Pattern:**
```typescript
const startTime = Date.now();
const operation = `retrieve_${validatedModel}`;

try {
  // ... operation ...
  const totalTime = Date.now() - startTime;
  
  metricsCollector.recordTiming(operation, totalTime);
  metricsCollector.recordMetric(`retrieve_success_${validatedModel}`, 1);
  metricsCollector.recordMetric(`retrieve_items_${validatedModel}`, successCount);
  
  logInfo(`Retrieved ${successCount} items`, {
    duration: totalTime,
    cacheHits,
    apiCalls
  });
} catch (error) {
  const totalTime = Date.now() - startTime;
  metricsCollector.recordTiming(`${operation}_error`, totalTime);
  throw error;
}
```

### 15.2 Health Check Implementation

```typescript
async function getHealthStatus(apiClient: MetabaseApiClient): Promise<HealthStatus> {
  const startTime = Date.now();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime() * 1000,
    checks: {
      metabase_connectivity: await checkMetabaseConnectivity(apiClient),
      cache_system: getCacheHealth(apiClient),
      memory: getMemoryHealth(),
      request_processing: getRequestMetrics(),
    }
  };
}
```

### 15.3 Metrics Export

```typescript
function exportMetricsAsPrometheus(): string {
  const metrics = metricsStore.getMetrics();
  let output = '';
  
  // Counters
  for (const [name, value] of Object.entries(metrics.counters)) {
    output += `# HELP ${name}\n`;
    output += `# TYPE ${name} counter\n`;
    output += `${name} ${value}\n`;
  }
  
  // Histograms
  for (const [name, stats] of Object.entries(metrics.histograms)) {
    output += `${name}_count ${stats.count}\n`;
    output += `${name}_sum ${stats.sum}\n`;
    output += `${name}_bucket{le="0.5"} ${stats.p50}\n`;
    output += `${name}_bucket{le="0.95"} ${stats.p95}\n`;
    output += `${name}_bucket{le="0.99"} ${stats.p99}\n`;
  }
  
  return output;
}
```

---

## 16. Conclusion

The Metabase MCP server has a solid foundation with structured logging and error handling, but lacks centralized observability infrastructure. The recommendations in this document provide a roadmap to add:

1. **Metrics Collection** - In-memory storage of performance metrics
2. **Health Monitoring** - Service status and component health checks
3. **Request Tracing** - Full request lifecycle visibility
4. **Error Analytics** - Error pattern detection and aggregation
5. **Performance Profiling** - Latency and throughput tracking

These enhancements can be implemented entirely within the Node.js/TypeScript stack without external dependencies, following the existing code patterns and maintaining consistency with the project's architecture.

The phased approach allows for incremental value delivery, starting with high-impact foundational work before moving to advanced features.

---

## Appendix: Reference Materials

**MCP Specification:** https://modelcontextprotocol.io/

**Prometheus Metrics:** https://prometheus.io/docs/concepts/data_model/

**OpenTelemetry:** https://opentelemetry.io/

**Related CLAUDE.md Sections:**
- Performance Optimizations
- Response Optimization
- Error Handling
- Testing Architecture

