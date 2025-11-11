# Observability Implementation Quick Reference

## Quick Summary of Opportunities

### What We Have
- Structured JSON logging system
- Request ID tracking
- Comprehensive error categorization
- Performance metrics in handler responses
- Cache hit/miss tracking
- Concurrency metrics in retrieve handler

### What We Need
1. **Centralized metrics collection framework**
2. **Health check endpoint** 
3. **Service status monitoring**
4. **Metrics export endpoints** (Prometheus/JSON format)
5. **Request lifecycle tracing**
6. **Error aggregation and analytics**
7. **Memory and resource monitoring**
8. **Performance SLA enforcement**

---

## Implementation Phases

### Phase 1: Foundation (Best Starting Point)

**1. Create Metrics Collector**
- File: `src/observability/metrics.ts`
- In-memory storage (Map-based)
- Counter, Gauge, Histogram support
- Automatic percentile calculation
- Time-series retention (configurable)

**2. Integrate into MetabaseServer**
- Inject MetricsCollector into handlers
- Record all tool invocations
- Track errors by category
- Record cache operations

**3. Add Health Check**
- File: `src/observability/health.ts`
- Check Metabase API connectivity
- Monitor memory usage
- Track cache statistics
- Return HTTP status

**4. Expose Metrics Endpoint**
- Add `/metrics` endpoint
- Prometheus text format output
- Include counters, histograms, gauges

---

## Implementation Pattern Examples

### Pattern 1: Adding Metrics to a Handler

**Before:**
```typescript
const startTime = Date.now();
// operation
const totalTime = Date.now() - startTime;
logInfo(`Operation completed in ${totalTime}ms`);
```

**After:**
```typescript
const startTime = Date.now();
const operation = 'search_cards';

try {
  // operation
  const totalTime = Date.now() - startTime;
  
  metricsCollector.recordCounter('tool_invocation_search', 1);
  metricsCollector.recordHistogram('tool_latency_search_ms', totalTime);
  metricsCollector.recordGauge('active_requests', -1); // decrement
  
  logInfo(`Operation completed in ${totalTime}ms`, { duration: totalTime });
} catch (error) {
  const totalTime = Date.now() - startTime;
  metricsCollector.recordCounter('tool_error_search', 1);
  metricsCollector.recordCounter(`error_${error.details.category}`, 1);
  throw error;
}
```

### Pattern 2: Cache Metrics

**Current Cache Method:**
```typescript
async getCard(cardId: number): Promise<CachedResponse<any>> {
  const cached = this.cardCache.get(cardId);
  if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
    return { data: cached.data, source: 'cache', fetchTime: 0 };
  }
  // fetch from API
}
```

**With Metrics:**
```typescript
async getCard(cardId: number): Promise<CachedResponse<any>> {
  const cached = this.cardCache.get(cardId);
  if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
    this.metricsCollector.recordCounter('cache_hit_card', 1);
    return { data: cached.data, source: 'cache', fetchTime: 0 };
  }
  
  this.metricsCollector.recordCounter('cache_miss_card', 1);
  // fetch from API
  
  const fetchTime = Date.now() - startTime;
  this.metricsCollector.recordHistogram('api_latency_card_ms', fetchTime);
  this.metricsCollector.recordCounter('api_call_card', 1);
}
```

### Pattern 3: Health Check

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    api: { status: string; lastCheck: Date };
    cache: { hitRate: number; size: number };
    memory: { used: number; total: number };
  };
}

async function checkHealth(): Promise<HealthStatus> {
  const apiHealthy = await checkMetabaseConnection();
  const cacheStats = getCacheStatistics();
  const memUsage = process.memoryUsage();
  
  const status = apiHealthy ? 'healthy' : 'unhealthy';
  
  return {
    status,
    checks: {
      api: { status: apiHealthy ? 'ok' : 'error', lastCheck: new Date() },
      cache: { hitRate: cacheStats.hitRate, size: cacheStats.totalEntries },
      memory: { used: memUsage.heapUsed, total: memUsage.heapTotal },
    }
  };
}
```

---

## Metrics to Track by Priority

### High Priority (Big Impact)
1. **Request Volume**
   - Requests per second
   - Requests by tool
   - Requests by model type

2. **Error Rate**
   - Errors per minute
   - Errors by category
   - Errors by tool
   - Error recovery success rate

3. **Latency**
   - Tool latency (P50, P95, P99)
   - API call latency
   - Cache hit latency vs API latency

4. **Cache Efficiency**
   - Cache hit rate
   - Cache miss rate
   - Cache entry count
   - Memory usage

### Medium Priority
5. **Concurrency**
   - Concurrent requests
   - Batch size distribution
   - Parallelization efficiency

6. **API Performance**
   - API response time
   - API timeout count
   - API error rate

7. **Resource Usage**
   - Memory usage (heap, external)
   - Request processing time distribution
   - Database connection count (if pooled)

### Low Priority
8. **Advanced Metrics**
   - Percentile tracking (beyond P99)
   - Request correlation
   - Trace duration
   - Optimization effectiveness

---

## Quick Start Implementation

### Step 1: Create Metrics Infrastructure

**File: `src/observability/metrics.ts`**
```typescript
interface MetricData {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
  timestamp: Date;
}

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  
  recordCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }
  
  recordGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }
  
  recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    // Keep last 1000 values only
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(name, values);
  }
  
  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => [
          name,
          this.calculateStats(values)
        ])
      ),
      timestamp: new Date().toISOString(),
    };
  }
  
  private calculateStats(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }
}
```

### Step 2: Add Health Check

**File: `src/observability/health.ts`**
```typescript
export async function getHealthStatus(
  apiClient: MetabaseApiClient,
  metricsCollector: MetricsCollector
) {
  const checks = await Promise.all([
    checkMetabaseConnection(apiClient),
    checkMemory(),
    checkMetrics(metricsCollector),
  ]);
  
  const healthy = checks.every(c => c.status === 'healthy');
  
  return {
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: Object.fromEntries(checks.map(c => [c.name, c])),
  };
}
```

### Step 3: Expose Metrics in Server

**File: `src/server.ts` (additions)**
```typescript
// Add health check endpoint handler
this.server.setRequestHandler(/* ... */, async (request) => {
  if (request.uri === 'metabase://health') {
    return { health: await getHealthStatus(this.apiClient, this.metricsCollector) };
  }
});

// Add metrics endpoint
this.server.setRequestHandler(/* ... */, async (request) => {
  if (request.uri === 'metabase://metrics') {
    const metrics = this.metricsCollector.getMetrics();
    return { content: [{ type: 'text', text: JSON.stringify(metrics, null, 2) }] };
  }
});
```

### Step 4: Integrate with Handlers

**Modification Pattern for Handlers:**
```typescript
export async function handleSearch(
  request: z.infer<typeof CallToolRequestSchema>,
  requestId: string,
  apiClient: MetabaseApiClient,
  metricsCollector: MetricsCollector,  // ADD THIS
  logDebug: (message: string, data?: unknown) => void,
  // ... rest of params
) {
  const startTime = Date.now();
  metricsCollector.recordGauge('active_requests', 1);
  
  try {
    // ... existing code ...
    metricsCollector.recordCounter('search_success', 1);
    metricsCollector.recordHistogram('search_latency_ms', Date.now() - startTime);
  } catch (error) {
    metricsCollector.recordCounter('search_error', 1);
    throw error;
  } finally {
    metricsCollector.recordGauge('active_requests', -1);
  }
}
```

---

## Testing the Implementation

### Manual Testing

```bash
# 1. Run the server
npm run dev

# 2. Check health (in another terminal)
curl http://localhost:3000/health

# 3. Check metrics
curl http://localhost:3000/metrics

# 4. Run a test operation
npm run test

# 5. Check metrics again
curl http://localhost:3000/metrics
```

### Test Cases to Add

```typescript
describe('MetricsCollector', () => {
  it('should track counters correctly', () => {
    const collector = new MetricsCollector();
    collector.recordCounter('test_counter', 5);
    collector.recordCounter('test_counter', 3);
    expect(collector.getMetrics().counters['test_counter']).toBe(8);
  });
  
  it('should calculate percentiles', () => {
    const collector = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      collector.recordHistogram('test_latency', i);
    }
    const stats = collector.getMetrics().histograms['test_latency'];
    expect(stats.p50).toBeCloseTo(50, 5);
    expect(stats.p95).toBeCloseTo(95, 5);
    expect(stats.p99).toBeCloseTo(99, 5);
  });
  
  it('should track health status', async () => {
    const health = await getHealthStatus(mockApiClient, mockCollector);
    expect(health.status).toBe('healthy');
    expect(health.checks.api.status).toBe('healthy');
  });
});
```

---

## Configuration Changes

**Add to `src/config.ts`:**
```typescript
ENABLE_METRICS: z.boolean().default(process.env.NODE_ENV === 'development'),
ENABLE_HEALTH_CHECKS: z.boolean().default(true),
METRICS_RETENTION_HOURS: z.number().default(1),
METRICS_HISTOGRAM_BUCKETS: z.number().default(1000),
```

**Add to `.env.example`:**
```
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
METRICS_RETENTION_HOURS=1
```

---

## Integration with Existing Code

### Minimal Changes Required

1. **server.ts**: Add MetricsCollector initialization and injection
2. **All handlers**: Add metricsCollector parameter and a few recording calls
3. **api.ts**: Add metrics for API calls (5-10 lines per method)
4. **config.ts**: Add metrics configuration options (4-5 lines)

### Backward Compatibility

All changes are additive. Existing functionality remains unchanged. Metrics are optional and can be disabled via configuration.

---

## Prometheus Integration Example

**If you want Prometheus scraping in the future:**

```typescript
// Export metrics in Prometheus format
function metricsAsPrometheus(metrics: MetricsSnapshot): string {
  let output = '';
  
  for (const [name, value] of Object.entries(metrics.counters)) {
    output += `# TYPE ${name} counter\n`;
    output += `${name} ${value}\n\n`;
  }
  
  for (const [name, stats] of Object.entries(metrics.histograms)) {
    output += `# TYPE ${name} histogram\n`;
    output += `${name}_count ${stats.count}\n`;
    output += `${name}_sum ${stats.sum}\n`;
    output += `${name}_bucket{le="0.5"} ${stats.p50}\n`;
    output += `${name}_bucket{le="0.95"} ${stats.p95}\n`;
    output += `${name}_bucket{le="0.99"} ${stats.p99}\n`;
    output += `${name}_bucket{le="+Inf"} ${stats.count}\n\n`;
  }
  
  return output;
}
```

---

## Performance Impact Analysis

### Expected Overhead
- **Counters**: O(1) - negligible
- **Gauges**: O(1) - negligible
- **Histograms**: O(1) for recording, O(n) for export where n = 1000
- **Total Per Request**: < 1ms additional overhead

### Memory Usage
- Counter: 8 bytes each
- Gauge: 8 bytes each
- Histogram: ~8KB for 1000 values
- Estimated total: < 100KB for typical operation

### Best Practices
- Only track high-value metrics
- Use sampling for very frequent operations
- Clear old data periodically
- Consider implementing metrics export to external system

---

## Related Documentation

See `OBSERVABILITY-ANALYSIS.md` for:
- Detailed analysis of current capabilities
- Comprehensive list of metrics opportunities
- Error handling patterns
- Long-term vision for observability

