import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Activity,
  Database,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Server,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import logger from '../utils/logger';

interface CacheStats {
  size: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  topEntries: Array<{ key: string; hits: number; expiresAt: string; createdAt: string }>;
}

interface PoolMetrics {
  totalRequests: number;
  activeConnections: number;
  peakConnections: number;
  connectionErrors: number;
  slowQueries: number;
  utilizationPercent: number;
}

interface PoolHealth {
  healthy: boolean;
  activeConnections: number;
  maxConnections: number;
  utilizationPercent: number;
  message: string;
}

interface SlowQuery {
  query: string;
  durationMs: number;
  tenantId?: string;
  timestamp: string;
}

interface ApiPercentiles { p50: number; p95: number; p99: number }

interface PerformanceData {
  generatedAt: string;
  cache: CacheStats;
  connectionPool: {
    config: { maxConnections: number; connectionTimeoutMs: number; statementTimeoutMs: number };
    metrics: PoolMetrics;
    health: PoolHealth;
  };
  queryPerformance: {
    slowQueryThresholdMs: number;
    slowQueryCount: number;
    recentSlowQueries: SlowQuery[];
  };
  apiResponseTimes: {
    sampleCount: number;
    percentiles: ApiPercentiles;
    recentSamples: Array<{ endpoint: string; method: string; durationMs: number; statusCode: number; timestamp: string }>;
  };
  activeUsersByTenant: Array<{ tenantId: string; requestCount: number }>;
}

export default function PerformanceDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<PerformanceData>('/admin/performance');
      setData(response.data);
    } catch (error) {
      logger.error('Failed to fetch performance data', { error });
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleClearCache = async () => {
    if (!confirm('Clear the entire cache and reset pool metrics? This may temporarily slow down responses.')) return;
    setClearing(true);
    try {
      await api.delete('/admin/performance');
      toast.success('Cache cleared and metrics reset');
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const formatMs = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString();

  if (loading && !data) {
    return (
      <DashboardLayout title="Performance Dashboard">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const poolHealth = data?.connectionPool.health;
  const cacheHitRate = data?.cache.hitRate ?? 0;

  return (
    <DashboardLayout title="Performance Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              <Activity className="size-6" />
              Performance Dashboard
            </h2>
            <p className="text-muted-foreground text-sm">
              {data ? `Last updated: ${formatTime(data.generatedAt)}` : 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(v => !v)}
              className={autoRefresh ? 'border-green-400 text-green-600' : ''}
            >
              <RefreshCw className={`mr-2 size-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto (30s)' : 'Auto Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="mr-2 size-4" />
              Clear Cache
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cache Hit Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Cache Hit Rate</CardDescription>
              <Zap className="size-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{cacheHitRate}%</p>
              <Progress value={cacheHitRate} className="mt-2 h-1.5" />
              <p className="text-xs text-muted-foreground mt-1">
                {data?.cache.totalHits ?? 0} hits / {(data?.cache.totalHits ?? 0) + (data?.cache.totalMisses ?? 0)} total
              </p>
            </CardContent>
          </Card>

          {/* Cache Size */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Cache Entries</CardDescription>
              <Database className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data?.cache.size ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Active cache entries</p>
            </CardContent>
          </Card>

          {/* Pool Health */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Connection Pool</CardDescription>
              {poolHealth?.healthy
                ? <CheckCircle2 className="size-4 text-green-500" />
                : <AlertTriangle className="size-4 text-red-500" />}
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{poolHealth?.utilizationPercent ?? 0}%</p>
              <Progress
                value={poolHealth?.utilizationPercent ?? 0}
                className={`mt-2 h-1.5 ${(poolHealth?.utilizationPercent ?? 0) >= 80 ? '[&>div]:bg-red-500' : ''}`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {poolHealth?.activeConnections ?? 0} / {poolHealth?.maxConnections ?? 0} connections
              </p>
            </CardContent>
          </Card>

          {/* API Response Times */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>API p95 Response</CardDescription>
              <Clock className="size-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {formatMs(data?.apiResponseTimes.percentiles.p95 ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                p50: {formatMs(data?.apiResponseTimes.percentiles.p50 ?? 0)} ·
                p99: {formatMs(data?.apiResponseTimes.percentiles.p99 ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cache Top Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4" />
              Top Cache Entries
            </CardTitle>
            <CardDescription>Most frequently accessed cached items</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.cache.topEntries.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No cache entries yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Hits</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.cache.topEntries.slice(0, 10).map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs max-w-xs truncate">{entry.key}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{entry.hits}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(entry.expiresAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Slow Queries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Slow Queries
              {(data?.queryPerformance.slowQueryCount ?? 0) > 0 && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {data?.queryPerformance.slowQueryCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Queries exceeding {data?.queryPerformance.slowQueryThresholdMs ?? 1000}ms threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.queryPerformance.recentSlowQueries.length ?? 0) === 0 ? (
              <div className="flex items-center gap-2 p-6 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-4" />
                No slow queries detected
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.queryPerformance.recentSlowQueries.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs max-w-xs truncate">{q.query}</TableCell>
                      <TableCell>
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          {formatMs(q.durationMs)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {q.tenantId ? q.tenantId.slice(0, 8) + '...' : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(q.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Connection Pool Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-4" />
                Connection Pool Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ['Max Connections', data?.connectionPool.config.maxConnections ?? '—'],
                ['Active Connections', data?.connectionPool.metrics.activeConnections ?? 0],
                ['Peak Connections', data?.connectionPool.metrics.peakConnections ?? 0],
                ['Total Requests', data?.connectionPool.metrics.totalRequests ?? 0],
                ['Connection Errors', data?.connectionPool.metrics.connectionErrors ?? 0],
                ['Connection Timeout', `${data?.connectionPool.config.connectionTimeoutMs ?? 0}ms`],
                ['Statement Timeout', `${data?.connectionPool.config.statementTimeoutMs ?? 0}ms`],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2">
                  {poolHealth?.healthy
                    ? <CheckCircle2 className="size-4 text-green-500" />
                    : <AlertTriangle className="size-4 text-red-500" />}
                  <span className={poolHealth?.healthy ? 'text-green-600' : 'text-red-600'}>
                    {poolHealth?.message}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Users by Tenant */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" />
                Active Users by Tenant
              </CardTitle>
              <CardDescription>Request count from recent samples</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(data?.activeUsersByTenant.length ?? 0) === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No activity data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant ID</TableHead>
                      <TableHead>Requests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.activeUsersByTenant.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{t.tenantId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.requestCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
