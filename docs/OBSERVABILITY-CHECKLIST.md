# Observability Enhancement Checklist

## Current State Assessment

### Logging System
- [x] Structured JSON logging to stderr
- [x] Five log levels (DEBUG, INFO, WARN, ERROR, FATAL)
- [x] Timestamp on all logs
- [x] Human-readable fallback format
- [ ] Centralized log aggregation
- [ ] Log filtering and searching
- [ ] Log export capabilities

### Error Handling
- [x] Custom McpError class
- [x] 14 Error categories defined
- [x] Error factory classes for each category
- [x] Agent guidance field in errors
- [x] Recovery actions enumeration
- [x] Troubleshooting steps array
- [x] HTTP status code tracking
- [ ] Error aggregation system
- [ ] Error pattern detection
- [ ] Error rate monitoring
- [ ] Error recovery tracking

### Request Handling
- [x] Request ID generation
- [x] Request ID in logs
- [x] Request ID in responses
- [ ] Request correlation across handlers
- [ ] Request tracing with parent/child relationships
- [ ] Request timeline visualization
- [ ] Request lifecycle hooks

### Performance Tracking
- [x] Timing measurements (basic Date.now())
- [x] Cache hit/miss tracking in list handler
- [x] Concurrency metrics in retrieve handler
- [x] API fetch time measurement
- [x] Total operation time measurement
- [ ] Latency percentiles (P50, P95, P99)
- [ ] Throughput tracking (requests/sec)
- [ ] Response size tracking
- [ ] Query execution time tracking
- [ ] Resource utilization tracking (memory, CPU)

### Metrics Collection
- [ ] Centralized metrics store
- [ ] Counter metrics
- [ ] Gauge metrics
- [ ] Histogram metrics
- [ ] Summary/percentile metrics
- [ ] Metrics aggregation
- [ ] Metrics export (Prometheus format)
- [ ] Metrics export (JSON format)
- [ ] Time-series data retention

### Health Monitoring
- [ ] Health check endpoint
- [ ] API connectivity check
- [ ] Cache system health
- [ ] Memory usage monitoring
- [ ] Service status page
- [ ] Component health checks
- [ ] Health check scheduling
- [ ] Health alert thresholds

### Caching Observability
- [x] Cache hit/miss tracking (scattered)
- [ ] Unified cache statistics
- [ ] Cache hit rate percentage
- [ ] Cache entry count monitoring
- [ ] Cache memory usage tracking
- [ ] Cache eviction tracking
- [ ] Cache effectiveness analysis
- [ ] Cache performance optimization tips

### Error Analysis
- [ ] Error frequency tracking
- [ ] Errors by category
- [ ] Errors by tool/handler
- [ ] Errors by resource type
- [ ] Error rate trending
- [ ] Error recovery success rate
- [ ] Root cause analysis

### Request Analysis
- [ ] Total requests tracked
- [ ] Requests by tool
- [ ] Requests by model type
- [ ] Success/failure ratio
- [ ] Request duration distribution
- [ ] Request size distribution
- [ ] Request throughput tracking

### API Performance
- [ ] API call count
- [ ] API call duration
- [ ] API timeout tracking
- [ ] API error tracking
- [ ] API response size
- [ ] API endpoint latency
- [ ] Connection pooling metrics (if applicable)

### Debugging Capabilities
- [x] Structured error responses
- [x] MCP Inspector integration
- [ ] Request/response replay
- [ ] Performance profiler
- [ ] Memory leak detection
- [ ] Debugging dashboard
- [ ] Query logging and playback
- [ ] Request timeline visualization

---

## Implementation Roadmap

### Week 1-2: Foundation
- [ ] Create `src/observability/metrics.ts`
  - [ ] MetricsCollector class
  - [ ] Counter implementation
  - [ ] Gauge implementation
  - [ ] Histogram implementation
  - [ ] Percentile calculation
  - [ ] Metrics export (JSON)
  
- [ ] Create `src/observability/health.ts`
  - [ ] Health check types
  - [ ] Metabase connectivity check
  - [ ] Memory check
  - [ ] Cache check
  
- [ ] Create `src/observability/types.ts`
  - [ ] MetricsSnapshot interface
  - [ ] HealthStatus interface
  - [ ] HealthCheck interface

- [ ] Integrate with `src/server.ts`
  - [ ] Initialize MetricsCollector
  - [ ] Add metrics to CallToolRequestSchema handler
  - [ ] Add health check endpoint
  - [ ] Add metrics export endpoint

- [ ] Update `src/api.ts`
  - [ ] Add metrics to cache operations
  - [ ] Add metrics to API calls
  - [ ] Track API response times
  - [ ] Track error rates

### Week 3-4: Handler Integration
- [ ] Update `src/handlers/search.ts`
  - [ ] Record tool invocation metric
  - [ ] Record latency metric
  - [ ] Record error metrics

- [ ] Update `src/handlers/list/index.ts`
  - [ ] Unify performance metrics collection
  - [ ] Record model-specific metrics

- [ ] Update `src/handlers/retrieve/index.ts`
  - [ ] Capture concurrency efficiency
  - [ ] Record batch metrics

- [ ] Update `src/handlers/execute/index.ts`
  - [ ] Record execution time
  - [ ] Record row count

- [ ] Update `src/handlers/export/index.ts`
  - [ ] Record export metrics
  - [ ] Track file size

- [ ] Update `src/handlers/clearCache.ts`
  - [ ] Track cache clearing metrics

### Week 5: Testing & Documentation
- [ ] Create tests for MetricsCollector
  - [ ] Counter tests
  - [ ] Gauge tests
  - [ ] Histogram tests
  - [ ] Percentile calculation tests

- [ ] Create tests for health checks
  - [ ] Health check response format
  - [ ] Health status determination

- [ ] Update CLAUDE.md
  - [ ] Add observability section
  - [ ] Document metrics endpoints
  - [ ] Document health checks

- [ ] Create metrics dashboard guide
  - [ ] Prometheus integration
  - [ ] Grafana configuration examples

---

## Metrics to Implement (Prioritized)

### Critical Metrics (Implement First)
- [ ] `tool_invocation_<toolname>` (counter)
- [ ] `tool_latency_<toolname>_ms` (histogram)
- [ ] `tool_error_<toolname>` (counter)
- [ ] `error_<category>` (counter)
- [ ] `cache_hit_<type>` (counter)
- [ ] `cache_miss_<type>` (counter)
- [ ] `api_latency_<endpoint>_ms` (histogram)
- [ ] `active_requests` (gauge)

### Important Metrics (Implement Second)
- [ ] `request_latency_p50_ms` (gauge)
- [ ] `request_latency_p95_ms` (gauge)
- [ ] `request_latency_p99_ms` (gauge)
- [ ] `cache_hit_rate` (gauge)
- [ ] `memory_usage_bytes` (gauge)
- [ ] `heap_used_bytes` (gauge)
- [ ] `requests_per_second` (gauge)
- [ ] `error_rate_percent` (gauge)

### Nice-to-Have Metrics (Implement Third)
- [ ] `concurrency_efficiency_percent` (gauge)
- [ ] `response_size_bytes` (histogram)
- [ ] `query_execution_time_ms` (histogram)
- [ ] `optimization_effectiveness_percent` (gauge)
- [ ] `token_usage_estimate` (counter)

---

## Code Files Affected

### New Files to Create
```
src/observability/
├── metrics.ts         # MetricsCollector class
├── health.ts          # Health check logic
├── types.ts           # Type definitions
└── utils.ts           # Helper functions (optional)
```

### Files to Modify
```
src/
├── server.ts          # +20-30 lines (initialize collector, add endpoints)
├── api.ts             # +15-20 lines (metrics for cache/API calls)
├── config.ts          # +5 lines (new config options)
├── handlers/
│   ├── search.ts      # +5-8 lines (metrics calls)
│   ├── list/index.ts  # +5-8 lines (metrics calls)
│   ├── retrieve/index.ts # +5-8 lines (metrics calls)
│   ├── execute/index.ts  # +5-8 lines (metrics calls)
│   ├── export/index.ts   # +5-8 lines (metrics calls)
│   └── clearCache.ts     # +3-5 lines (metrics calls)
```

### Files to Reference (No Changes)
```
src/handlers/resources/  # Already has logging
src/handlers/prompts/    # Already has logging
src/types/core.ts        # Error types already defined
src/utils/               # Utilities already in place
```

---

## Configuration Requirements

### New Environment Variables
```
ENABLE_METRICS=true|false (default: true in dev, false in prod)
ENABLE_HEALTH_CHECKS=true|false (default: true)
METRICS_RETENTION_HOURS=<number> (default: 1)
METRICS_HISTOGRAM_BUCKETS=<number> (default: 1000)
HEALTH_CHECK_INTERVAL_MS=<number> (default: 30000)
```

### Configuration Section
Add to `.env.example`:
```
# Observability Settings
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
METRICS_RETENTION_HOURS=1
METRICS_HISTOGRAM_BUCKETS=1000
HEALTH_CHECK_INTERVAL_MS=30000
```

---

## Testing Checklist

### Unit Tests to Add
- [ ] MetricsCollector.recordCounter()
- [ ] MetricsCollector.recordGauge()
- [ ] MetricsCollector.recordHistogram()
- [ ] Percentile calculation accuracy
- [ ] Health check endpoint response
- [ ] Metrics endpoint response format
- [ ] Metrics aggregation correctness

### Integration Tests to Add
- [ ] Metrics collection during tool invocation
- [ ] Error metrics recording
- [ ] Cache metrics tracking
- [ ] API call metrics tracking
- [ ] Health check with real API client
- [ ] Metrics persistence

### Manual Testing Steps
- [ ] Run server with ENABLE_METRICS=true
- [ ] Invoke each tool via MCP Inspector
- [ ] Check `/metrics` endpoint
- [ ] Check `/health` endpoint
- [ ] Verify metric calculations
- [ ] Check memory usage
- [ ] Test with high concurrency

---

## Documentation Updates

### CLAUDE.md Additions
- [ ] Add "Observability and Monitoring" section
- [ ] Document health check endpoint
- [ ] Document metrics endpoint
- [ ] Add metrics configuration options
- [ ] Add debugging techniques

### New Documentation
- [ ] OBSERVABILITY-GUIDE.md (user guide)
- [ ] METRICS-REFERENCE.md (metric definitions)
- [ ] DASHBOARD-SETUP.md (Prometheus/Grafana setup)

### README Updates
- [ ] Add observability section
- [ ] Add health check example
- [ ] Add metrics example
- [ ] Link to observability documentation

---

## Dependencies Check

### Current Dependencies
- [x] @modelcontextprotocol/sdk - for MCP protocol
- [x] zod - for validation
- [x] dotenv - for configuration
- [x] xlsx - for exports
- [x] @types/node - for Node types

### New Dependencies (NONE Required!)
All metrics, health checks, and observability features can be implemented using only:
- Built-in Node.js: `process`, `os`, `util`
- Built-in JS: `Map`, `Date`, `Math`
- Existing packages: zod for types validation

No external observability libraries needed!

---

## Performance Impact Analysis

### Before Implementation
- Average request latency: baseline
- Memory usage: baseline
- CPU usage: baseline

### After Implementation
- Estimated latency overhead: < 1ms per request
- Estimated memory overhead: < 100KB
- Estimated CPU overhead: < 1%

### Optimization Notes
- Use sampling for high-frequency operations
- Keep histogram bucket size reasonable (1000)
- Clean up old metrics periodically
- Make metrics collection optional via config

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Metrics are collected for all tool invocations
- [ ] Health check endpoint returns valid response
- [ ] No external dependencies added
- [ ] < 1ms latency overhead per request
- [ ] Tests pass with > 80% coverage
- [ ] Documentation updated

### Phase 2 Complete When:
- [ ] Metrics available in Prometheus format
- [ ] Latency percentiles calculated correctly
- [ ] Dashboard integration guide documented
- [ ] Performance tests pass
- [ ] No regressions detected

### Final Success Criteria
- [ ] All metrics implemented and tested
- [ ] Health checks fully functional
- [ ] Documentation comprehensive
- [ ] Zero external dependencies
- [ ] Performance overhead < 2%
- [ ] Backward compatible
- [ ] Ready for production

---

## Quick Reference Links

**Analysis Document:** `docs/OBSERVABILITY-ANALYSIS.md`
**Implementation Guide:** `docs/OBSERVABILITY-IMPLEMENTATION-GUIDE.md`
**Current Code:**
- Error Handling: `src/types/core.ts`, `src/utils/errorFactory.ts`
- Logging: `src/server.ts:69-126`, `src/api.ts:91-143`
- Metrics (scattered): `src/handlers/list/index.ts`, `src/handlers/retrieve/index.ts`

---

## Notes and Considerations

1. **No External Dependencies**: All observability features use only built-in Node.js and JavaScript features
2. **Backward Compatible**: All changes are additive; existing functionality unaffected
3. **Zero Breaking Changes**: API and handler signatures remain the same
4. **Optional**: Metrics collection can be disabled via config
5. **Memory Safe**: Histograms have bounded storage (1000 values by default)
6. **Performance Neutral**: Metrics recording is < 1% CPU overhead
7. **Production Ready**: Can be deployed without external services

