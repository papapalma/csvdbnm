import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Building2,
  Plus,
  Users,
  GraduationCap,
  Package,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  ClipboardList,
  Shield,
  RefreshCw,
  ExternalLink,
  Clock,
  Eye,
  Rocket,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import tenantService, { Tenant, CreateTenantData, PlatformSummary } from '../services/tenantService';
import api from '../services/api';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  user?: { id: string; email: string; username: string; role: string } | null;
}

interface ExtensionRequest {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'under_review' | 'approved' | 'in_development' | 'deployed' | 'rejected';
  created_at: string;
  tenant?: { name: string } | null;
  requested_by_user?: { username: string; email: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_COLOR: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  in_development: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  deployed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  in_development: 'In Development',
  deployed: 'Deployed',
  rejected: 'Rejected',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect non-super_admin users
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // ── Tenants ──────────────────────────────────────────────────────────────
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  // ── Platform summary ─────────────────────────────────────────────────────
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // ── Audit logs ───────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const AUDIT_LIMIT = 20;

  // ── Extension requests ───────────────────────────────────────────────────
  const [extRequests, setExtRequests] = useState<ExtensionRequest[]>([]);
  const [loadingExt, setLoadingExt] = useState(true);
  const [extTotal, setExtTotal] = useState(0);

  // ── Create tenant dialog ─────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateTenantData>({
    name: '', contactEmail: '', contactPhone: '', address: '',
    adminEmail: '', adminUsername: '', adminPassword: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchTenants = useCallback(async () => {
    try {
      setLoadingTenants(true);
      const response = await tenantService.getTenants();
      setTenants(response.data || []);
    } catch (error) {
      logger.error('Failed to fetch tenants', { error });
      toast.error('Failed to load tenants');
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const fetchPlatformSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const summary = await tenantService.getPlatformSummary();
      setPlatformSummary(summary);
    } catch (error) {
      logger.error('Failed to fetch platform summary', { error });
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (offset = 0) => {
    try {
      setLoadingAudit(true);
      const res = await api.get<{ data: AuditLogEntry[]; pagination: { total: number } }>(
        '/admin/audit-logs',
        { limit: AUDIT_LIMIT, offset }
      );
      setAuditLogs(res.data?.data ?? []);
      setAuditTotal(res.data?.pagination?.total ?? 0);
      setAuditOffset(offset);
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error });
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const fetchExtRequests = useCallback(async () => {
    try {
      setLoadingExt(true);
      const res = await api.get<{ data: ExtensionRequest[]; total: number }>(
        '/admin/extension-requests',
        { limit: 10 }
      );
      setExtRequests(res.data?.data ?? []);
      setExtTotal(res.data?.total ?? 0);
    } catch (error) {
      logger.error('Failed to fetch extension requests', { error });
    } finally {
      setLoadingExt(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
    fetchPlatformSummary();
    fetchAuditLogs(0);
    fetchExtRequests();
  }, [fetchTenants, fetchPlatformSummary, fetchAuditLogs, fetchExtRequests]);

  // ── Export handlers ───────────────────────────────────────────────────────

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await api.downloadFile(
        '/admin/reports/platform-summary?format=csv',
        `platform-summary-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast.success('CSV export downloaded');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await api.downloadFile(
        '/admin/reports/platform-summary?format=pdf',
        `platform-summary-${new Date().toISOString().slice(0, 10)}.pdf`
      );
      toast.success('PDF export downloaded');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Tenant actions ────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Tenant name is required';
    if (!formData.contactEmail.trim()) errors.contactEmail = 'Contact email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail))
      errors.contactEmail = 'Invalid email address';
    
    // Admin credential validation
    if (!formData.adminEmail.trim()) errors.adminEmail = 'Admin email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail))
      errors.adminEmail = 'Invalid admin email address';
    
    if (!formData.adminUsername.trim()) errors.adminUsername = 'Admin username is required';
    else if (formData.adminUsername.trim().length < 3)
      errors.adminUsername = 'Admin username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formData.adminUsername))
      errors.adminUsername = 'Admin username can only contain letters, numbers, hyphens, and underscores';
    
    if (!formData.adminPassword.trim()) errors.adminPassword = 'Admin password is required';
    else if (formData.adminPassword.length < 8)
      errors.adminPassword = 'Admin password must be at least 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/.test(formData.adminPassword))
      errors.adminPassword = 'Admin password must contain uppercase, lowercase, number, and special character';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTenant = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await tenantService.createTenant(formData);
      toast.success(`Tenant "${formData.name}" created successfully`);
      setCreateDialogOpen(false);
      resetForm();
      fetchTenants();
      fetchPlatformSummary();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (tenant: Tenant) => {
    try {
      await tenantService.deactivateTenant(tenant.id);
      toast.success(`"${tenant.name}" deactivated`);
      fetchTenants();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to deactivate tenant');
    }
  };

  const handleReactivate = async (tenant: Tenant) => {
    try {
      await tenantService.reactivateTenant(tenant.id);
      toast.success(`"${tenant.name}" reactivated`);
      fetchTenants();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reactivate tenant');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', contactEmail: '', contactPhone: '', address: '', adminEmail: '', adminUsername: '', adminPassword: '' });
    setFormErrors({});
  };

  // ── Summary cards ─────────────────────────────────────────────────────────

  const summaryCards = platformSummary
    ? [
        {
          label: 'Total Tenants',
          value: platformSummary.totalTenants,
          sub: `${platformSummary.activeTenants} active`,
          icon: Building2,
          bg: 'bg-purple-100 dark:bg-purple-950',
          color: 'text-purple-600 dark:text-purple-400',
        },
        {
          label: 'Total Programs',
          value: platformSummary.totalPrograms,
          sub: 'across all LGUs',
          icon: GraduationCap,
          bg: 'bg-blue-100 dark:bg-blue-950',
          color: 'text-blue-600 dark:text-blue-400',
        },
        {
          label: 'Total Trainees',
          value: platformSummary.totalTrainees,
          sub: 'across all LGUs',
          icon: Users,
          bg: 'bg-green-100 dark:bg-green-950',
          color: 'text-green-600 dark:text-green-400',
        },
        {
          label: 'Total Items',
          value: platformSummary.totalItems,
          sub: 'across all LGUs',
          icon: Package,
          bg: 'bg-orange-100 dark:bg-orange-950',
          color: 'text-orange-600 dark:text-orange-400',
        },
      ]
    : [];

  const auditTotalPages = Math.ceil(auditTotal / AUDIT_LIMIT);
  const auditCurrentPage = Math.floor(auditOffset / AUDIT_LIMIT) + 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Super Admin Dashboard">
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              <TrendingUp className="size-6" />
              Platform Overview
            </h2>
            <p className="text-muted-foreground">Manage all LGU tenants and view aggregated statistics</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/super-admin/reports">
                <FileText className="mr-2 size-4" />
                Detailed Reports
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf || loadingSummary}>
              <Download className="mr-2 size-4" />
              {exportingPdf ? 'Exporting…' : 'PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportingCsv || loadingSummary}>
              <Download className="mr-2 size-4" />
              {exportingCsv ? 'Exporting…' : 'CSV'}
            </Button>
            <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
              <Plus className="mr-2 size-4" />
              Add Tenant
            </Button>
          </div>
        </div>

        {/* ── Platform Summary Cards ── */}
        {loadingSummary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{card.label}</CardDescription>
                  <div className={`flex size-10 items-center justify-center rounded-lg ${card.bg}`}>
                    <card.icon className={`size-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Tabbed Sections ── */}
        <Tabs defaultValue="tenants">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="tenants" className="flex items-center gap-1.5">
              <Building2 className="size-4" /> Tenants
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="flex items-center gap-1.5">
              <TrendingUp className="size-4" /> LGU Breakdown
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1.5">
              <Shield className="size-4" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger value="extensions" className="flex items-center gap-1.5">
              <ClipboardList className="size-4" />
              Extension Requests
              {extTotal > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-xs">{extTotal}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tenants Tab ── */}
          <TabsContent value="tenants" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Tenant Management
                </CardTitle>
                <CardDescription>All registered LGU instances on the platform</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTenants ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : tenants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">No tenants yet. Add your first LGU tenant.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Contact Email</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>
                            {tenant.status === 'active' ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle2 className="mr-1 size-3" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="mr-1 size-3" /> Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{tenant.contact_email || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {tenant.status === 'active' ? (
                              <Button
                                variant="outline" size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => handleDeactivate(tenant)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                variant="outline" size="sm"
                                className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20"
                                onClick={() => handleReactivate(tenant)}
                              >
                                Reactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LGU Breakdown Tab ── */}
          <TabsContent value="breakdown" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Breakdown</CardTitle>
                <CardDescription>Individual LGU contributions to platform totals</CardDescription>
              </CardHeader>
              {loadingSummary ? (
                <CardContent className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent>
              ) : !platformSummary?.tenantBreakdowns?.length ? (
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-6">No tenant data yet.</p>
                </CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Programs</TableHead>
                        <TableHead>Trainees</TableHead>
                        <TableHead>Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platformSummary.tenantBreakdowns.map((row) => (
                        <TableRow key={row.tenantId}>
                          <TableCell className="font-medium">{row.tenantName}</TableCell>
                          <TableCell>{row.programs}</TableCell>
                          <TableCell>{row.trainees}</TableCell>
                          <TableCell>{row.items}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* ── Audit Logs Tab ── */}
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="size-5" />
                    Audit Logs
                  </CardTitle>
                  <CardDescription>
                    Platform-wide event history — {auditTotal.toLocaleString()} total entries
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchAuditLogs(0)} disabled={loadingAudit}>
                  <RefreshCw className={`size-4 ${loadingAudit ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingAudit ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">No audit log entries yet.</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(log.created_at)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.user?.username || log.user?.email || log.user_id?.slice(0, 8) || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-mono">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.entity_type}
                              {log.entity_id ? (
                                <span className="ml-1 font-mono text-xs opacity-60">
                                  #{log.entity_id.slice(0, 8)}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {log.ip_address || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {auditTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          Page {auditCurrentPage} of {auditTotalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline" size="sm"
                            disabled={auditOffset === 0 || loadingAudit}
                            onClick={() => fetchAuditLogs(Math.max(0, auditOffset - AUDIT_LIMIT))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            disabled={auditCurrentPage >= auditTotalPages || loadingAudit}
                            onClick={() => fetchAuditLogs(auditOffset + AUDIT_LIMIT)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Extension Requests Tab ── */}
          <TabsContent value="extensions" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="size-5" />
                    Extension Requests
                  </CardTitle>
                  <CardDescription>Feature requests from LGU tenants</CardDescription>
                </div>
                <Link to="/extension-requests">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 size-4" />
                    Manage All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {loadingExt ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : extRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ClipboardList className="mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">No extension requests yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium max-w-xs truncate">{req.title}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {req.tenant?.name ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${PRIORITY_COLOR[req.priority]} border-0 capitalize`}>
                              {req.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${STATUS_COLOR[req.status]} border-0`}>
                              {STATUS_LABEL[req.status] ?? req.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {new Date(req.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Create Tenant Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Add New Tenant
            </DialogTitle>
            <DialogDescription>
              Create a new LGU instance on the platform. A default Local Admin account will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Tenant Name *</Label>
              <Input
                id="tenant-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="e.g., Bongabong MDC"
                className={formErrors.name ? 'border-destructive' : ''}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-email">Contact Email *</Label>
              <Input
                id="tenant-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, contactEmail: e.target.value }));
                  if (formErrors.contactEmail) setFormErrors(prev => ({ ...prev, contactEmail: '' }));
                }}
                placeholder="admin@lgu.gov.ph"
                className={formErrors.contactEmail ? 'border-destructive' : ''}
              />
              {formErrors.contactEmail && <p className="text-xs text-destructive">{formErrors.contactEmail}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-phone">Contact Phone</Label>
              <Input
                id="tenant-phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="09XX-XXX-XXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-address">Address</Label>
              <Input
                id="tenant-address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Municipal Hall, Bongabong, Oriental Mindoro"
              />
            </div>
            
            {/* Admin Credential Fields */}
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@lgu.gov.ph"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                disabled={submitting}
                className={formErrors.adminEmail ? 'border-destructive' : ''}
              />
              {formErrors.adminEmail && (
                <p className="text-sm text-destructive">{formErrors.adminEmail}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Email address for the default Local Admin account
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminUsername">Admin Username *</Label>
              <Input
                id="adminUsername"
                type="text"
                placeholder="admin_username"
                value={formData.adminUsername}
                onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                disabled={submitting}
                className={formErrors.adminUsername ? 'border-destructive' : ''}
              />
              {formErrors.adminUsername && (
                <p className="text-sm text-destructive">{formErrors.adminUsername}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Username for the Local Admin (letters, numbers, hyphens, underscores only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin Password *</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="••••••••"
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                disabled={submitting}
                className={formErrors.adminPassword ? 'border-destructive' : ''}
              />
              {formErrors.adminPassword && (
                <p className="text-sm text-destructive">{formErrors.adminPassword}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Min 8 characters with uppercase, lowercase, number, and special character
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateTenant} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
