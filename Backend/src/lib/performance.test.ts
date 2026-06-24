/**
 * Performance tests for the multi-tenant system
 *
 * Validates Requirements 19.3, 19.7, 19.8, 19.9:
 *   - 19.3  API response time < 500ms for typical queries
 *   - 19.7  Connection pool utilization monitoring
 *   - 19.8  Slow query detection (> 1 second threshold)
 *   - 19.9  Performance dashboard metrics
 *
 * NOTE: Full load testing (1000 concurrent users, 50 tenants) requires
 * a dedicated load testing tool (k6, JMeter) and a live environment.
 * These unit tests validate the performance monitoring infrastructure
 * (cache, pool metrics, slow query detection) in isolation.
 */

import {
  getCacheStats,
  cacheSet,
  cacheGet,
  cacheDelete,
  tenantCacheKey,
  TTL,
  cacheClear,
} from '@/lib/cache';
import {
  getPoolMetrics,
  checkPoolHealth,
  recordConnectionRequest,
  recordConnectionRelease,
  recordConnectionError,
  logSlowQuery,
  getSlowQueryLog,
  SLOW_QUERY_THRESHOLD_MS,
  DEFAULT_POOL_CONFIG,
  resetPoolMetrics,
} from '@/lib/connectionPool';

// ---------------------------------------------------------------------------
// Cache performance (Req 19.3 — reduces DB load for repeated queries)
// ---------------------------------------------------------------------------

describe('Cache performance (Req 19.3)', () => {
  afterEach(() => cacheClear());

  it('cache hit is faster than a simulated DB fetch', async () => {
    const key = tenantCacheKey('tenant-perf', 'programs');
    const data = Array.from({ length: 100 }, (_, i) => ({ id: `prog-${i}`, name: `Program ${i}` }));

    // Simulate DB fetch time
    const dbFetchMs = 50;
    const simulateDbFetch = () => new Promise<typeof data>(r => setTimeout(() => r(data), dbFetchMs));

    // First access: DB fetch
    const t1 = Date.now();
    const fetched = await simulateDbFetch();
    cacheSet(key, fetched, TTL.QUERY);
    const dbTime = Date.now() - t1;

    // Second access: cache hit
    const t2 = Date.now();
    const cached = cacheGet<typeof data>(key);
    const cacheTime = Date.now() - t2;

    expect(cached).not.toBeNull();
    expect(cached!.length).toBe(100);
    expect(cacheTime).toBeLessThan(dbTime); // cache is faster
    expect(cacheTime).toBeLessThan(5); // cache hit should be < 5ms
  });

  it('cache hit rate increases with repeated reads', () => {
    cacheClear();
    const key = tenantCacheKey('tenant-perf', 'config');
    cacheSet(key, { color: 'blue' }, TTL.TENANT_CONFIG);

    // Read 10 times
    for (let i = 0; i < 10; i++) cacheGet(key);

    const stats = getCacheStats();
    expect(stats.totalHits).toBeGreaterThanOrEqual(10);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  it('tenant config TTL is 15 minutes (Req 19.5)', () => {
    expect(TTL.TENANT_CONFIG).toBe(15 * 60 * 1000);
  });

  it('aggregated report TTL is 1 hour (Req 19.6)', () => {
    expect(TTL.AGGREGATED_REPORT).toBe(60 * 60 * 1000);
  });

  it('general query TTL is 5 minutes (Req 19.4)', () => {
    expect(TTL.QUERY).toBe(5 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Connection pool monitoring (Req 19.7)
// ---------------------------------------------------------------------------

describe('Connection pool monitoring (Req 19.7)', () => {
  beforeEach(() => resetPoolMetrics());

  it('records connection requests and releases correctly', () => {
    recordConnectionRequest();
    recordConnectionRequest();
    let metrics = getPoolMetrics();
    expect(metrics.activeConnections).toBe(2);
    expect(metrics.totalRequests).toBe(2);

    recordConnectionRelease();
    metrics = getPoolMetrics();
    expect(metrics.activeConnections).toBe(1);
  });

  it('tracks peak connections', () => {
    recordConnectionRequest();
    recordConnectionRequest();
    recordConnectionRequest();
    recordConnectionRelease();

    const metrics = getPoolMetrics();
    expect(metrics.peakConnections).toBe(3);
    expect(metrics.activeConnections).toBe(2);
  });

  it('records connection errors', () => {
    recordConnectionRequest();
    recordConnectionError();

    const metrics = getPoolMetrics();
    expect(metrics.connectionErrors).toBe(1);
    expect(metrics.activeConnections).toBe(0);
  });

  it('pool health is healthy when utilization is low', () => {
    resetPoolMetrics();
    const health = checkPoolHealth();
    expect(health.healthy).toBe(true);
    expect(health.utilizationPercent).toBe(0);
  });

  it('pool config has sensible defaults', () => {
    expect(DEFAULT_POOL_CONFIG.maxConnections).toBeGreaterThan(0);
    expect(DEFAULT_POOL_CONFIG.connectionTimeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_POOL_CONFIG.statementTimeoutMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Slow query detection (Req 19.8)
// ---------------------------------------------------------------------------

describe('Slow query detection (Req 19.8)', () => {
  it('slow query threshold is 1 second by default', () => {
    expect(SLOW_QUERY_THRESHOLD_MS).toBeGreaterThanOrEqual(1000);
  });

  it('logSlowQuery records a slow query entry', () => {
    const initialLog = getSlowQueryLog();
    const initialCount = initialLog.length;

    logSlowQuery({
      query: 'SELECT * FROM programs WHERE tenant_id = $1',
      durationMs: 1500,
      tenantId: 'tenant-slow',
    });

    const log = getSlowQueryLog();
    expect(log.length).toBe(initialCount + 1);
    expect(log[0].query).toBe('SELECT * FROM programs WHERE tenant_id = $1');
    expect(log[0].durationMs).toBe(1500);
    expect(log[0].tenantId).toBe('tenant-slow');
    expect(log[0].timestamp).toBeDefined();
  });

  it('slow query log is ordered most-recent first', () => {
    logSlowQuery({ query: 'query-first', durationMs: 1100 });
    logSlowQuery({ query: 'query-second', durationMs: 1200 });

    const log = getSlowQueryLog();
    expect(log[0].query).toBe('query-second');
    expect(log[1].query).toBe('query-first');
  });
});

// ---------------------------------------------------------------------------
// Performance dashboard metrics (Req 19.9)
// ---------------------------------------------------------------------------

describe('Performance dashboard metrics (Req 19.9)', () => {
  afterEach(() => cacheClear());

  it('getCacheStats returns all required fields', () => {
    const stats = getCacheStats();
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.totalHits).toBe('number');
    expect(typeof stats.totalMisses).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
    expect(Array.isArray(stats.topEntries)).toBe(true);
  });

  it('hitRate is between 0 and 100', () => {
    const stats = getCacheStats();
    expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    expect(stats.hitRate).toBeLessThanOrEqual(100);
  });

  it('getPoolMetrics returns all required fields', () => {
    const metrics = getPoolMetrics();
    expect(typeof metrics.totalRequests).toBe('number');
    expect(typeof metrics.activeConnections).toBe('number');
    expect(typeof metrics.peakConnections).toBe('number');
    expect(typeof metrics.connectionErrors).toBe('number');
    expect(typeof metrics.utilizationPercent).toBe('number');
  });

  it('checkPoolHealth returns health status with message', () => {
    const health = checkPoolHealth();
    expect(typeof health.healthy).toBe('boolean');
    expect(typeof health.message).toBe('string');
    expect(health.message.length).toBeGreaterThan(0);
    expect(typeof health.utilizationPercent).toBe('number');
  });

  it('cache size increases when entries are added', () => {
    cacheClear();
    const before = getCacheStats().size;
    cacheSet(tenantCacheKey('t1', 'k1'), 'v1', TTL.QUERY);
    cacheSet(tenantCacheKey('t1', 'k2'), 'v2', TTL.QUERY);
    const after = getCacheStats().size;
    expect(after).toBe(before + 2);
  });
});
