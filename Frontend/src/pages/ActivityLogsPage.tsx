import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { toast } from 'sonner';
import activityLogService, { type ActivityLog } from '../services/activityLogService';
import logger from '../utils/logger';
import {
  Activity,
  Download,
  Filter,
  Trash2,
  Search,
  User,
  TrendingUp,
  Eye,
  Edit,
  Plus,
  X,
  LogIn,
  LogOut,
  ScanLine,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { StatCardsSkeleton, TableSkeleton } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';

const actionIcons: Record<string, any> = {
  create: Plus,
  update: Edit,
  delete: X,
  view: Eye,
  search: Search,
  filter: Filter,
  export: Download,
  login: LogIn,
  logout: LogOut,
  scan: ScanLine,
  upload: Upload,
  download: Download,
  borrow: ScanLine,
  return: Upload,
};

const actionColors: Record<string, string> = {
  create: 'bg-green-500/10 text-green-500 border-green-500/20',
  update: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-500 border-red-500/20',
  view: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  search: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  filter: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  export: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  login: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  logout: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  scan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  upload: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  download: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  borrow: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  return: 'bg-green-500/10 text-green-500 border-green-500/20',
};

const moduleColors: Record<string, string> = {
  Trainees: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Inventory: 'bg-green-500/10 text-green-700 dark:text-green-300',
  Programs: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  Lendings: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  Authentication: 'bg-red-500/10 text-red-700 dark:text-red-300',
  Users: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
};

export default function ActivityLogsPage() {
  const { hasPermission, user } = useAuth();
  
  if (!hasPermission('canViewActivityLogs')) {
    return <Navigate to="/" state={{ openLogin: true }} replace />;
  }
  
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Fetch logs from API
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const logs = await activityLogService.getActivityLogs({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setAllLogs(logs);
    } catch (error) {
      logger.error('Failed to fetch activity logs', { error });
      toast.error('Failed to load activity logs');
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh logs
  const handleRefresh = () => {
    fetchLogs();
    toast.success('Activity logs refreshed');
  };

  // Calculate stats from fetched logs
  const stats = useMemo(() => {
    const totalActions = allLogs.length;
    const uniqueUsers = new Set(allLogs.map(log => log.userId)).size;
    const actionsByModule: Record<string, number> = {};
    
    allLogs.forEach(log => {
      const module = log.module || 'Unknown';
      actionsByModule[module] = (actionsByModule[module] || 0) + 1;
    });

    return {
      totalActions,
      uniqueUsers,
      actionsByModule,
      recentActivity: allLogs.slice(0, 10),
    };
  }, [allLogs]);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Set(allLogs.map(log => log.userName).filter(Boolean));
    return Array.from(users).sort();
  }, [allLogs]);

  // Get unique actions for filter
  const uniqueActions = useMemo(() => {
    const actions = new Set(allLogs.map(log => log.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [allLogs]);

  // Get unique modules for filter
  const uniqueModules = useMemo(() => {
    const modules = new Set(allLogs.map(log => log.module).filter(Boolean));
    return Array.from(modules).sort();
  }, [allLogs]);

  // Get unique tenants for filter (Super Admin only)
  const uniqueTenants = useMemo(() => {
    if (!isSuperAdmin) return [];
    const tenants = new Set(
      allLogs
        .filter(log => log.tenantName)
        .map(log => ({ id: log.tenantId, name: log.tenantName }))
    );
    return Array.from(tenants)
      .filter((t): t is { id: string; name: string } => !!t.id && !!t.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allLogs, isSuperAdmin]);

  // Filter logs client-side
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = `${log.userName} ${log.action} ${log.module} ${log.description} ${log.tenantName || ''}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      // Action filter
      if (selectedAction !== 'all' && log.action !== selectedAction) {
        return false;
      }

      // Module filter
      if (selectedModule !== 'all' && log.module !== selectedModule) {
        return false;
      }

      // User filter  
      if (selectedUser !== 'all' && log.userName !== selectedUser) {
        return false;
      }

      // Tenant filter (Super Admin only)
      if (isSuperAdmin && selectedTenant !== 'all') {
        if (selectedTenant === 'platform') {
          if (log.scope !== 'platform') return false;
        } else {
          if (log.tenantId !== selectedTenant) return false;
        }
      }

      // Scope filter (Super Admin only)
      if (isSuperAdmin && selectedScope !== 'all') {
        if (log.scope !== selectedScope) return false;
      }

      // Date filters
      if (startDate && new Date(log.createdAt) < new Date(startDate)) {
        return false;
      }

      if (endDate && new Date(log.createdAt) > new Date(endDate + 'T23:59:59')) {
        return false;
      }

      return true;
    });
  }, [allLogs, searchQuery, selectedAction, selectedModule, selectedUser, selectedTenant, selectedScope, startDate, endDate, isSuperAdmin]);

  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedFilteredLogs = filteredLogs.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAction, selectedModule, selectedUser, selectedTenant, selectedScope, startDate, endDate]);

  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported to JSON');
    } catch (error) {
      toast.error('Failed to export logs');
    }
  };

  const handleExportCSV = () => {
    try {
      // Create CSV header
      const headers = ['Timestamp', 'User', 'Action', 'Module', 'Description', 'Entity Type', 'Entity ID'];
      const csvRows = [headers.join(',')];

      // Add data rows
      filteredLogs.forEach(log => {
        const row = [
          log.createdAt,
          log.userName,
          log.action,
          log.module,
          `"${log.description?.replace(/"/g, '""') || ''}"`,
          log.entityType || '',
          log.entityId || '',
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported to CSV');
    } catch (error) {
      toast.error('Failed to export logs');
    }
  };

  const handleClearAllLogs = () => {
    toast.info('Clear all logs feature requires backend implementation');
  };

  const handleClearOldLogs = () => {
    toast.info('Clear old logs feature requires backend implementation');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAction('all');
    setSelectedModule('all');
    setSelectedUser('all');
    setSelectedTenant('all');
    setSelectedScope('all');
    setStartDate('');
    setEndDate('');
  };

  if (loading) {
    return (
      <DashboardLayout title="Activity Logs">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          <StatCardsSkeleton count={4} />

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-52" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          <TableSkeleton rows={7} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Activity Logs">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Activity Logs
              {isSuperAdmin && (
                <Badge className="ml-3 bg-purple-500/10 text-purple-700 dark:text-purple-300">
                  Platform-Wide View
                </Badge>
              )}
            </h2>
            <p className="text-muted-foreground">
              {isSuperAdmin 
                ? 'Monitor all system activities across all tenants and platform-level actions' 
                : 'Monitor all system activities and user actions'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="mr-2 size-4" />
              Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
              <User className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
              <p className="text-xs text-muted-foreground">Active users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
              <Filter className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredLogs.length}</div>
              <p className="text-xs text-muted-foreground">Matching filters</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Module</CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.entries(stats.actionsByModule).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Most active</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Filter activity logs by criteria</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                <X className="mr-2 size-4" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select value={selectedAction} onValueChange={(value: any) => setSelectedAction(value)}>
                  <SelectTrigger id="action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map(action => (
                      <SelectItem key={action} value={action}>
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="module">Module</Label>
                <Select value={selectedModule} onValueChange={(value: any) => setSelectedModule(value)}>
                  <SelectTrigger id="module">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {uniqueModules.map(module => (
                      <SelectItem key={module} value={module}>{module}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user">User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger id="user">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user} value={user}>{user}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSuperAdmin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tenant">Tenant</Label>
                    <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                      <SelectTrigger id="tenant">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tenants</SelectItem>
                        <SelectItem value="platform">Platform-Level Only</SelectItem>
                        {uniqueTenants.map(tenant => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Select value={selectedScope} onValueChange={setSelectedScope}>
                      <SelectTrigger id="scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Scopes</SelectItem>
                        <SelectItem value="platform">Platform-Level</SelectItem>
                        <SelectItem value="tenant">Tenant-Specific</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {stats.totalActions} logs
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="mr-2 size-4" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportJSON}>
                  <Download className="mr-2 size-4" />
                  Export JSON
                </Button>
                {hasPermission('canManageSettings') && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleClearOldLogs}>
                      <Trash2 className="mr-2 size-4" />
                      Clear Old
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClearAllLogs}>
                      <Trash2 className="mr-2 size-4" />
                      Clear All
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>Detailed log of all user activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    {isSuperAdmin && <TableHead>Scope</TableHead>}
                    {isSuperAdmin && <TableHead>Tenant</TableHead>}
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 9 : 7} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Activity className="size-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No activity logs found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedFilteredLogs.map((log) => {
                      const ActionIcon = actionIcons[log.action] || Activity;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={
                                  log.scope === 'platform'
                                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                }
                              >
                                {log.scope === 'platform' ? '🌐 Platform' : '🏢 Tenant'}
                              </Badge>
                            </TableCell>
                          )}
                          {isSuperAdmin && (
                            <TableCell>
                              {log.tenantName ? (
                                <span className="text-sm">{log.tenantName}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Platform-level</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline" className={actionColors[log.action] || 'bg-gray-500/10 text-gray-500'}>
                              <ActionIcon className="mr-1.5 size-3" />
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={moduleColors[log.module] || 'bg-gray-500/10 text-gray-700'}>
                              {log.module}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="size-3 text-muted-foreground" />
                              <span className="text-sm">{log.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{log.entityType || 'N/A'}</span>
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {log.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                              size={undefined}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }

                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }

                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Activity Details</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Timestamp</Label>
                    <p className="font-mono text-sm">
                      {format(new Date(selectedLog.createdAt), 'PPpp')}
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <div>
                      <Label className="text-muted-foreground">Scope</Label>
                      <div className="mt-1">
                        <Badge 
                          variant="outline" 
                          className={
                            selectedLog.scope === 'platform'
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                          }
                        >
                          {selectedLog.scope === 'platform' ? '🌐 Platform-Level' : '🏢 Tenant-Specific'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {isSuperAdmin && (
                    <div>
                      <Label className="text-muted-foreground">Tenant</Label>
                      <p className="text-sm">
                        {selectedLog.tenantName || (
                          <span className="text-muted-foreground italic">Platform-level action</span>
                        )}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Action</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={actionColors[selectedLog.action] || 'bg-gray-500/10'}>
                        {selectedLog.action}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Module</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={moduleColors[selectedLog.module] || 'bg-gray-500/10'}>
                        {selectedLog.module}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User</Label>
                    <p className="text-sm">{selectedLog.userName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <p className="font-mono text-xs">{selectedLog.userId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Entity Type</Label>
                    <p className="text-sm">{selectedLog.entityType || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Entity ID</Label>
                    <p className="font-mono text-xs">{selectedLog.entityId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p className="font-mono text-xs">{selectedLog.ipAddress || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedLog.description}</p>
                </div>

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Metadata</Label>
                    <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <Label className="text-muted-foreground">User Agent</Label>
                    <p className="text-xs font-mono break-all">{selectedLog.userAgent}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}