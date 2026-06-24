import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  UserPlus, Edit, Trash2, Users, Search,
  CheckCircle2, XCircle, Clock, Eye, BookOpen
} from 'lucide-react';
import { getRoleDisplayName, getRoleBadgeColor, UserRole } from '../utils/roles';
import { toast } from 'sonner';
import userService, { User as ApiUser } from '../services/userService';
import registrationService, { PendingRegistration } from '../services/registrationService';
import { useAuth } from '../contexts/AuthContext';
import { ListSkeleton, TableSkeleton } from '../components/LoadingSkeletons';

interface User extends ApiUser {}

export default function AccountManagementPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('accounts');

  // â”€â”€ Accounts state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: '', email: '', role: 'staff_inventory_manager' as UserRole, password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // â”€â”€ Pending Registrations state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('pending');
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<PendingRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewing, setReviewing] = useState(false);
  const [accountsPage, setAccountsPage] = useState(1);
  const [registrationsPage, setRegistrationsPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => { fetchUsers(); fetchRegistrations(); }, []);

  // Refetch accounts when search changes
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => fetchUsers(), 300);
      return () => clearTimeout(t);
    }
  }, [searchQuery]);

  useEffect(() => {
    setAccountsPage(1);
  }, [searchQuery]);

  // Refetch registrations when filters change
  useEffect(() => {
    const t = setTimeout(() => fetchRegistrations(), 300);
    return () => clearTimeout(t);
  }, [regSearch, regStatusFilter]);

  useEffect(() => {
    setRegistrationsPage(1);
  }, [regSearch, regStatusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers({ search: searchQuery || undefined });
      setUsers(data);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    try {
      setLoadingRegs(true);
      const data = await registrationService.getRegistrations({
        status: regStatusFilter || undefined,
        search: regSearch || undefined,
      });
      setRegistrations(data);
      // Update badge count separately for 'pending'
      if (regStatusFilter === 'pending') setPendingCount(data.length);
      else {
        const pending = await registrationService.getRegistrations({ status: 'pending' });
        setPendingCount(pending.length);
      }
    } catch (error: any) {
      // Silently fail if no permission
      if (error?.status !== 403) toast.error(error?.message || 'Failed to load registrations');
    } finally {
      setLoadingRegs(false);
    }
  };

  const openReviewModal = (reg: PendingRegistration, action: 'approve' | 'reject') => {
    setSelectedReg(reg);
    setReviewAction(action);
    setRejectReason('');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!selectedReg) return;
    if (reviewAction === 'reject' && !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setReviewing(true);
    try {
      if (reviewAction === 'approve') {
        await registrationService.approveRegistration(selectedReg.id);
        toast.success(`Registration approved! Account created for ${selectedReg.first_name} ${selectedReg.last_name}.`);
      } else {
        await registrationService.rejectRegistration(selectedReg.id, rejectReason.trim());
        toast.success('Registration rejected.');
      }
      setReviewModalOpen(false);
      fetchRegistrations();
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${reviewAction} registration`);
    } finally {
      setReviewing(false);
    }
  };

  // â”€â”€ Account CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.username.trim()) errors.username = 'Username is required';
    else if (formData.username.length < 3) errors.username = 'Username must be at least 3 characters';
    else if (formData.username.length > 100) errors.username = 'Username must not exceed 100 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email address';
    else if (formData.email.length > 255) errors.email = 'Email must not exceed 255 characters';
    if (!isEdit) {
      if (!formData.password) errors.password = 'Password is required';
      else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    } else if (formData.password) {
      if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateForm(false)) return;
    setSubmitting(true);
    try {
      await userService.createUser({ username: formData.username.trim(), email: formData.email.trim(), password: formData.password, role: formData.role as any });
      await fetchUsers();
      toast.success('User added successfully');
      setAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser || !validateForm(true)) return;
    setSubmitting(true);
    try {
      const updateData: any = { username: formData.username.trim(), email: formData.email.trim(), role: formData.role as any };
      if (formData.password) updateData.password = formData.password;
      await userService.updateUser(selectedUser.id, updateData);
      await fetchUsers();
      toast.success('User updated successfully');
      setEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
    } catch (error: any) {
      if (error?.status === 404) {
        toast.error('User no longer exists. Refreshing list...');
        await fetchUsers();
        setEditModalOpen(false);
        setSelectedUser(null);
        resetForm();
      } else {
        toast.error(error?.message || 'Failed to update user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.email === 'admin@bmdc.edu.ph') { toast.error('Cannot delete the main admin account'); return; }
    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
      try {
        await userService.deleteUser(user.id);
        await fetchUsers();
        toast.success('User deleted successfully');
      } catch (error: any) {
        if (error?.status === 404) { toast.warning('User was already deleted. Refreshing list...'); await fetchUsers(); }
        else toast.error(error?.message || 'Failed to delete user');
      }
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({ username: user.username, email: user.email, role: user.role, password: '' });
    setFormErrors({});
    setEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ username: '', email: '', role: 'staff_inventory_manager', password: '' });
    setFormErrors({});
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const usersTotalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const usersStartIndex = (accountsPage - 1) * rowsPerPage;
  const paginatedUsers = filteredUsers.slice(usersStartIndex, usersStartIndex + rowsPerPage);

  const registrationsTotalPages = Math.ceil(registrations.length / rowsPerPage);
  const registrationsStartIndex = (registrationsPage - 1) * rowsPerPage;
  const paginatedRegistrations = registrations.slice(registrationsStartIndex, registrationsStartIndex + rowsPerPage);

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"><Clock className="mr-1 size-3" />Pending</Badge>;
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 className="mr-1 size-3" />Approved</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"><XCircle className="mr-1 size-3" />Rejected</Badge>;
  };

  const canReview = currentUser?.role === 'local_admin' || currentUser?.role === 'staff_training_coordinator';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2"><Users className="size-8" />Account Management</h1>
            <p className="text-muted-foreground">Manage user accounts, permissions, and trainee registrations</p>
          </div>
          <Button onClick={() => { resetForm(); setAddModalOpen(true); }}>
            <UserPlus className="mr-2 size-4" />Add User
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="accounts">
              <Users className="mr-2 size-4" />User Accounts
            </TabsTrigger>
            <TabsTrigger value="registrations" className="relative">
              <BookOpen className="mr-2 size-4" />Pending Registrations
              {pendingCount > 0 && (
                <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* â”€â”€ ACCOUNTS TAB â”€â”€ */}
          <TabsContent value="accounts" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </CardContent>
            </Card>

            {loading && (
              <div className="space-y-3">
                <TableSkeleton rows={5} />
                <div className="sm:hidden">
                  <ListSkeleton rows={4} />
                </div>
              </div>
            )}

            {!loading && (
              <Card className="hidden sm:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-10"><AvatarFallback className="bg-primary text-primary-foreground">{user.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                              <p className="font-medium">{user.username}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(user.role)} style={(user.role as string) === 'trainee' ? { backgroundColor: '#2563eb', color: 'white', borderColor: '#1e40af' } : undefined}>
                              {getRoleDisplayName(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditModal(user)}><Edit className="size-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user)} disabled={user.email === 'admin@bmdc.edu.ph'}><Trash2 className="size-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {!loading && (
              <div className="sm:hidden space-y-3">
                {paginatedUsers.map(user => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Avatar className="size-12 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground">{user.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2">
                            <h4 className="truncate">{user.username}</h4>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className="mb-3">
                            <Badge className={getRoleBadgeColor(user.role)} style={(user.role as string) === 'trainee' ? { backgroundColor: '#2563eb', color: 'white', borderColor: '#1e40af' } : undefined}>
                              {getRoleDisplayName(user.role)}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditModal(user)}><Edit className="mr-1 size-4" />Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user)} disabled={user.email === 'admin@bmdc.edu.ph'}><Trash2 className="size-4" /></Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!loading && filteredUsers.length === 0 && (
              <div className="py-12 text-center"><Users className="mx-auto mb-4 size-12 text-muted-foreground" /><p className="text-muted-foreground">No users found</p></div>
            )}

            {!loading && filteredUsers.length > 0 && usersTotalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setAccountsPage(prev => Math.max(1, prev - 1))}
                        className={accountsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>

                    {Array.from({ length: usersTotalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === usersTotalPages ||
                        (page >= accountsPage - 1 && page <= accountsPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setAccountsPage(page)}
                              isActive={accountsPage === page}
                              className="cursor-pointer"
                              size={undefined}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }

                      if (page === accountsPage - 2 || page === accountsPage + 2) {
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
                        onClick={() => setAccountsPage(prev => Math.min(usersTotalPages, prev + 1))}
                        className={accountsPage === usersTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>

          {/* â”€â”€ REGISTRATIONS TAB â”€â”€ */}
          <TabsContent value="registrations" className="space-y-4 mt-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search registrations..." value={regSearch} onChange={e => setRegSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {loadingRegs && (
              <div className="space-y-3">
                <TableSkeleton rows={4} />
                <div className="md:hidden">
                  <ListSkeleton rows={3} />
                </div>
              </div>
            )}

            {!loadingRegs && registrations.length === 0 && (
              <div className="py-12 text-center">
                <Clock className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">No {regStatusFilter} registrations</p>
              </div>
            )}

            {!loadingRegs && registrations.length > 0 && (
              <>
                {/* Desktop table */}
                <Card className="hidden md:block">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Program</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          {canReview && <TableHead className="w-[120px]">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRegistrations.map(reg => (
                          <TableRow key={reg.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{reg.first_name} {reg.last_name}</p>
                                <p className="text-xs text-muted-foreground">{reg.email}</p>
                                <p className="text-xs text-muted-foreground">@{reg.username}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{reg.program?.name || 'â€”'}</p>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(reg.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{statusBadge(reg.status)}</TableCell>
                            {canReview && (
                              <TableCell>
                                {reg.status === 'pending' ? (
                                  <div className="flex gap-1">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 px-2" onClick={() => openReviewModal(reg, 'approve')}>
                                      <CheckCircle2 className="size-3 mr-1" />Approve
                                    </Button>
                                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 h-7 px-2" onClick={() => openReviewModal(reg, 'reject')}>
                                      <XCircle className="size-3 mr-1" />Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => { setSelectedReg(reg); setReviewModalOpen(true); setReviewAction('approve'); }}>
                                    <Eye className="size-3 mr-1" />View
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {paginatedRegistrations.map(reg => (
                    <Card key={reg.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{reg.first_name} {reg.last_name}</p>
                            <p className="text-xs text-muted-foreground">{reg.email}</p>
                            <p className="text-xs text-muted-foreground">@{reg.username}</p>
                          </div>
                          {statusBadge(reg.status)}
                        </div>
                        {reg.program && <p className="text-sm"><span className="text-muted-foreground">Program:</span> {reg.program.name}</p>}
                        <p className="text-xs text-muted-foreground">Submitted {new Date(reg.created_at).toLocaleDateString()}</p>
                        {reg.status === 'rejected' && reg.rejection_reason && (
                          <p className="text-xs text-red-600 dark:text-red-400"><span className="font-medium">Reason:</span> {reg.rejection_reason}</p>
                        )}
                        {canReview && reg.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => openReviewModal(reg, 'approve')}>
                              <CheckCircle2 className="mr-1 size-3" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => openReviewModal(reg, 'reject')}>
                              <XCircle className="mr-1 size-3" />Reject
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {registrationsTotalPages > 1 && (
                  <div className="flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setRegistrationsPage(prev => Math.max(1, prev - 1))}
                            className={registrationsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            size={undefined}
                          />
                        </PaginationItem>

                        {Array.from({ length: registrationsTotalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === registrationsTotalPages ||
                            (page >= registrationsPage - 1 && page <= registrationsPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setRegistrationsPage(page)}
                                  isActive={registrationsPage === page}
                                  className="cursor-pointer"
                                  size={undefined}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          if (page === registrationsPage - 2 || page === registrationsPage + 2) {
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
                            onClick={() => setRegistrationsPage(prev => Math.min(registrationsTotalPages, prev + 1))}
                            className={registrationsPage === registrationsTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            size={undefined}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* â”€â”€ Add User Modal â”€â”€ */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account with specific role and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-username">Username *</Label>
              <Input id="add-username" value={formData.username} onChange={e => { setFormData({ ...formData, username: e.target.value }); setFormErrors({ ...formErrors, username: '' }); }} placeholder="john_doe" className={formErrors.username ? 'border-destructive' : ''} />
              {formErrors.username && <p className="text-sm text-destructive">{formErrors.username}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email Address *</Label>
              <Input id="add-email" type="email" value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors({ ...formErrors, email: '' }); }} placeholder="john@bmdc.edu.ph" className={formErrors.email ? 'border-destructive' : ''} />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">Role *</Label>
              <Select value={formData.role} onValueChange={(v: string) => setFormData({ ...formData, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_admin">Local Admin</SelectItem>
                  <SelectItem value="staff_inventory_manager">Staff (Inventory)</SelectItem>
                  <SelectItem value="staff_training_coordinator">Staff (Trainees)</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Password *</Label>
              <Input id="add-password" type="password" value={formData.password} onChange={e => { setFormData({ ...formData, password: e.target.value }); setFormErrors({ ...formErrors, password: '' }); }} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" className={formErrors.password ? 'border-destructive' : ''} />
              {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
              <p className="text-xs text-muted-foreground">Must be at least 6 characters with uppercase, lowercase, and number</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={submitting}>{submitting ? 'Adding...' : 'Add User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Edit User Modal â”€â”€ */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account information and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username *</Label>
              <Input id="edit-username" value={formData.username} onChange={e => { setFormData({ ...formData, username: e.target.value }); setFormErrors({ ...formErrors, username: '' }); }} placeholder="john_doe" className={formErrors.username ? 'border-destructive' : ''} />
              {formErrors.username && <p className="text-sm text-destructive">{formErrors.username}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input id="edit-email" type="email" value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors({ ...formErrors, email: '' }); }} placeholder="john@bmdc.edu.ph" className={formErrors.email ? 'border-destructive' : ''} />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={formData.role} onValueChange={(v: string) => setFormData({ ...formData, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_admin">Local Admin</SelectItem>
                  <SelectItem value="staff_inventory_manager">Staff (Inventory)</SelectItem>
                  <SelectItem value="staff_training_coordinator">Staff (Trainees)</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (optional)</Label>
              <Input id="edit-password" type="password" value={formData.password} onChange={e => { setFormData({ ...formData, password: e.target.value }); setFormErrors({ ...formErrors, password: '' }); }} placeholder="Leave blank to keep current password" className={formErrors.password ? 'border-destructive' : ''} />
              {formErrors.password ? <p className="text-sm text-destructive">{formErrors.password}</p> : <p className="text-xs text-muted-foreground">If changing, must be at least 6 characters with uppercase, lowercase, and number</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Review Registration Modal â”€â”€ */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedReg?.status !== 'pending' ? 'Registration Details' : reviewAction === 'approve' ? 'Approve Registration' : 'Reject Registration'}
            </DialogTitle>
            <DialogDescription>
              {selectedReg?.first_name} {selectedReg?.last_name} â€” {selectedReg?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedReg && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg bg-muted/50 p-4 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Username</span><span>@{selectedReg.username}</span>
                <span className="text-muted-foreground">Program</span><span>{selectedReg.program?.name || 'â€”'}</span>
                <span className="text-muted-foreground">Phone</span><span>{selectedReg.phone}</span>
                <span className="text-muted-foreground">Sex</span><span>{selectedReg.sex}</span>
                <span className="text-muted-foreground">Civil Status</span><span>{selectedReg.civil_status}</span>
                <span className="text-muted-foreground">Education</span><span>{selectedReg.educational_attainment}</span>
                <span className="text-muted-foreground">Employment</span><span>{selectedReg.employment_status}</span>
                <span className="text-muted-foreground">Classification</span><span>{selectedReg.classification}</span>
                <span className="col-span-2 text-muted-foreground">Address</span>
                <span className="col-span-2 text-xs">{selectedReg.street}, {selectedReg.barangay}, {selectedReg.municipality}, {selectedReg.province}</span>
                <span className="text-muted-foreground">Submitted</span>
                <span>{new Date(selectedReg.created_at).toLocaleString()}</span>
              </div>

              {/* Current status */}
              {selectedReg.status !== 'pending' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {statusBadge(selectedReg.status)}
                  {selectedReg.rejection_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">Reason: {selectedReg.rejection_reason}</p>
                  )}
                </div>
              )}

              {/* Reject reason input */}
              {selectedReg.status === 'pending' && reviewAction === 'reject' && (
                <div className="space-y-2">
                  <Label>Reason for Rejection *</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this registration is being rejected..."
                    rows={3}
                  />
                </div>
              )}

              {selectedReg.status === 'pending' && reviewAction === 'approve' && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">
                  Approving will create a <strong>Trainee</strong> user account and a trainee profile. The applicant will be able to log in immediately.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModalOpen(false)} disabled={reviewing}>
              {selectedReg?.status !== 'pending' ? 'Close' : 'Cancel'}
            </Button>
            {selectedReg?.status === 'pending' && (
              <Button
                onClick={handleReviewSubmit}
                disabled={reviewing}
                className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}
              >
                {reviewing ? 'Processing...' : reviewAction === 'approve' ? 'Approve & Create Account' : 'Reject Registration'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
