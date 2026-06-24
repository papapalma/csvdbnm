import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
  Plus,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Rocket,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import extensionRequestService, {
  ExtensionRequest,
  ExtensionRequestPriority,
  ExtensionRequestStatus,
} from '../services/extensionRequestService';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<ExtensionRequestPriority, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_CONFIG: Record<ExtensionRequestStatus, { label: string; icon: React.ElementType; color: string }> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  under_review: { label: 'Under Review', icon: Eye, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  in_development: { label: 'In Development', icon: Rocket, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  deployed: { label: 'Deployed', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

function StatusBadge({ status }: { status: ExtensionRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} border-0 gap-1`}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: ExtensionRequestPriority }) {
  return (
    <Badge className={`${PRIORITY_COLORS[priority]} border-0 capitalize`}>
      {priority}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExtensionRequestsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isLocalAdmin = user?.role === 'local_admin';

  // ── My requests (Local Admin) ──────────────────────────────────────────
  const [myRequests, setMyRequests] = useState<ExtensionRequest[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);

  // ── All requests (Super Admin) ─────────────────────────────────────────
  const [allRequests, setAllRequests] = useState<ExtensionRequest[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // ── Submit dialog ──────────────────────────────────────────────────────
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    business_justification: '',
    priority: 'medium' as ExtensionRequestPriority,
    affected_users_count: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Review dialog (Super Admin) ────────────────────────────────────────
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExtensionRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ExtensionRequestStatus>('under_review');
  const [reviewNotes, setReviewNotes] = useState('');

  // ── Detail view dialog ─────────────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<ExtensionRequest | null>(null);

  const fetchMyRequests = useCallback(async () => {
    try {
      setLoadingMy(true);
      const result = await extensionRequestService.getMyRequests();
      setMyRequests(result.data ?? []);
    } catch (error) {
      logger.error('Failed to fetch my extension requests', { error });
      toast.error('Failed to load your requests');
    } finally {
      setLoadingMy(false);
    }
  }, []);

  const fetchAllRequests = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setLoadingAll(true);
      const result = await extensionRequestService.getAllRequests({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        priority: filterPriority !== 'all' ? filterPriority : undefined,
      });
      setAllRequests(result.data ?? []);
    } catch (error) {
      logger.error('Failed to fetch all extension requests', { error });
      toast.error('Failed to load requests');
    } finally {
      setLoadingAll(false);
    }
  }, [isSuperAdmin, filterStatus, filterPriority]);

  useEffect(() => {
    if (isLocalAdmin || isSuperAdmin) fetchMyRequests();
    if (isSuperAdmin) fetchAllRequests();
  }, [fetchMyRequests, fetchAllRequests, isLocalAdmin, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) fetchAllRequests();
  }, [filterStatus, filterPriority, fetchAllRequests, isSuperAdmin]);

  // ── Submit handler ─────────────────────────────────────────────────────
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    else if (form.title.length > 255) errors.title = 'Title must not exceed 255 characters';
    if (!form.description.trim()) errors.description = 'Description is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await extensionRequestService.createRequest({
        title: form.title.trim(),
        description: form.description.trim(),
        business_justification: form.business_justification.trim() || undefined,
        priority: form.priority,
        affected_users_count: form.affected_users_count
          ? parseInt(form.affected_users_count, 10)
          : undefined,
      });
      toast.success('Extension request submitted successfully');
      setSubmitOpen(false);
      setForm({ title: '', description: '', business_justification: '', priority: 'medium', affected_users_count: '' });
      fetchMyRequests();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Review handler ─────────────────────────────────────────────────────
  const handleReview = async () => {
    if (!selectedRequest) return;
    setReviewing(true);
    try {
      await extensionRequestService.reviewRequest(selectedRequest.id, {
        status: reviewStatus,
        review_notes: reviewNotes.trim() || undefined,
      });
      toast.success(`Request marked as "${STATUS_CONFIG[reviewStatus].label}"`);
      setReviewOpen(false);
      setSelectedRequest(null);
      setReviewNotes('');
      fetchAllRequests();
      if (isLocalAdmin) fetchMyRequests();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update request');
    } finally {
      setReviewing(false);
    }
  };

  const openReview = (req: ExtensionRequest) => {
    setSelectedRequest(req);
    setReviewStatus(req.status);
    setReviewNotes(req.review_notes ?? '');
    setReviewOpen(true);
  };

  const openDetail = (req: ExtensionRequest) => {
    setDetailRequest(req);
    setDetailOpen(true);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Extension Requests">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              <ClipboardList className="size-6" />
              Extension Requests
            </h2>
            <p className="text-muted-foreground text-sm">
              {isSuperAdmin
                ? 'Review and manage feature requests from all LGUs'
                : 'Submit and track feature requests for your organization'}
            </p>
          </div>
          {(isLocalAdmin || isSuperAdmin) && (
            <Button onClick={() => setSubmitOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Request
            </Button>
          )}
        </div>

        {isSuperAdmin ? (
          /* ── Super Admin: tabbed view ── */
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Requests</TabsTrigger>
              <TabsTrigger value="mine">My Tenant</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {/* Filters */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchAllRequests} disabled={loadingAll}>
                  <RefreshCw className={`size-4 ${loadingAll ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <RequestTable
                requests={allRequests}
                loading={loadingAll}
                showTenant
                onView={openDetail}
                onReview={openReview}
                isSuperAdmin
              />
            </TabsContent>

            <TabsContent value="mine" className="mt-4">
              <RequestTable
                requests={myRequests}
                loading={loadingMy}
                onView={openDetail}
              />
            </TabsContent>
          </Tabs>
        ) : (
          /* ── Local Admin: own requests only ── */
          <RequestTable
            requests={myRequests}
            loading={loadingMy}
            onView={openDetail}
          />
        )}
      </div>

      {/* ── Submit Dialog ── */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" />
              Submit Feature Request
            </DialogTitle>
            <DialogDescription>
              Describe the feature or customization you need. Our team will review and respond.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => { setForm(p => ({ ...p, title: e.target.value })); if (formErrors.title) setFormErrors(p => ({ ...p, title: '' })); }}
                placeholder="e.g., Add bulk trainee import from CSV"
                className={formErrors.title ? 'border-destructive' : ''}
              />
              {formErrors.title && <p className="text-xs text-destructive">{formErrors.title}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={form.description}
                onChange={e => { setForm(p => ({ ...p, description: e.target.value })); if (formErrors.description) setFormErrors(p => ({ ...p, description: '' })); }}
                placeholder="Describe the feature in detail — what it should do and how it should work..."
                rows={4}
                className={formErrors.description ? 'border-destructive' : ''}
              />
              {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
            </div>
            <div className="space-y-2">
              <Label>Business Justification</Label>
              <Textarea
                value={form.business_justification}
                onChange={e => setForm(p => ({ ...p, business_justification: e.target.value }))}
                placeholder="Why is this feature important for your LGU operations?"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority *</Label>
                <Select value={form.priority} onValueChange={(v: ExtensionRequestPriority) => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Affected Users</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.affected_users_count}
                  onChange={e => setForm(p => ({ ...p, affected_users_count: e.target.value }))}
                  placeholder="Estimated count"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog (Super Admin) ── */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription className="truncate">{selectedRequest?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={reviewStatus} onValueChange={(v: ExtensionRequestStatus) => setReviewStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Review Notes</Label>
              <Textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add notes for the requesting LGU..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={reviewing}>Cancel</Button>
            <Button onClick={handleReview} disabled={reviewing}>
              {reviewing ? 'Saving...' : 'Save Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailRequest?.title}</DialogTitle>
            <div className="flex gap-2 mt-1">
              {detailRequest && <StatusBadge status={detailRequest.status} />}
              {detailRequest && <PriorityBadge priority={detailRequest.priority} />}
            </div>
          </DialogHeader>
          {detailRequest && (
            <div className="space-y-4 py-2 text-sm">
              {detailRequest.tenant?.name && (
                <div><span className="text-muted-foreground">Organization: </span><span className="font-medium">{detailRequest.tenant.name}</span></div>
              )}
              <div>
                <p className="text-muted-foreground mb-1">Description</p>
                <p className="whitespace-pre-wrap">{detailRequest.description}</p>
              </div>
              {detailRequest.business_justification && (
                <div>
                  <p className="text-muted-foreground mb-1">Business Justification</p>
                  <p className="whitespace-pre-wrap">{detailRequest.business_justification}</p>
                </div>
              )}
              {detailRequest.affected_users_count != null && (
                <div><span className="text-muted-foreground">Affected Users: </span>{detailRequest.affected_users_count}</div>
              )}
              <div><span className="text-muted-foreground">Submitted: </span>{formatDate(detailRequest.created_at)}</div>
              {detailRequest.reviewed_at && (
                <div><span className="text-muted-foreground">Reviewed: </span>{formatDate(detailRequest.reviewed_at)}</div>
              )}
              {detailRequest.review_notes && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-muted-foreground text-xs mb-1">Review Notes</p>
                  <p className="whitespace-pre-wrap">{detailRequest.review_notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            {isSuperAdmin && detailRequest && (
              <Button onClick={() => { setDetailOpen(false); openReview(detailRequest); }}>
                Review
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Request table sub-component
// ---------------------------------------------------------------------------

interface RequestTableProps {
  requests: ExtensionRequest[];
  loading: boolean;
  showTenant?: boolean;
  isSuperAdmin?: boolean;
  onView: (req: ExtensionRequest) => void;
  onReview?: (req: ExtensionRequest) => void;
}

function RequestTable({ requests, loading, showTenant, isSuperAdmin, onView, onReview }: RequestTableProps) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="mb-4 size-12 text-muted-foreground" />
          <p className="text-muted-foreground">No extension requests yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Desktop table */}
        <Table className="hidden sm:table">
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              {showTenant && <TableHead>Organization</TableHead>}
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map(req => (
              <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onView(req)}>
                <TableCell className="font-medium max-w-xs truncate">{req.title}</TableCell>
                {showTenant && <TableCell className="text-muted-foreground text-sm">{req.tenant?.name ?? '—'}</TableCell>}
                <TableCell><PriorityBadge priority={req.priority} /></TableCell>
                <TableCell><StatusBadge status={req.status} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(req.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => onView(req)}>
                      <Eye className="size-4" />
                    </Button>
                    {isSuperAdmin && onReview && (
                      <Button variant="ghost" size="sm" onClick={() => onReview(req)}>
                        Review
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3 p-4">
          {requests.map(req => (
            <Card key={req.id} className="cursor-pointer" onClick={() => onView(req)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug flex-1">{req.title}</p>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={req.priority} />
                  {showTenant && req.tenant?.name && (
                    <span className="text-xs text-muted-foreground">{req.tenant.name}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(req.created_at)}</p>
                {isSuperAdmin && onReview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1"
                    onClick={e => { e.stopPropagation(); onReview(req); }}
                  >
                    Review
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
