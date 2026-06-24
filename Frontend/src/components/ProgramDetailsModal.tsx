import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Skeleton } from './ui/skeleton';
import { GraduationCap, Calendar, Clock, Award, User, BarChart3, CalendarDays, ExternalLink, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Program } from '../pages/ProgramsPage';
import sessionService, { ProgramSession } from '../services/sessionService';
import attendanceService, { AttendanceStats } from '../services/attendanceService';

interface ProgramDetailsModalProps {
  program: Program | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (program: Program) => void;
  canManage?: boolean;
}

export default function ProgramDetailsModal({ program, open, onOpenChange, onEdit, canManage }: ProgramDetailsModalProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ProgramSession[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Delete state
  const [sessionToDelete, setSessionToDelete] = useState<ProgramSession | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeleteLoading(true);
    try {
      await sessionService.deleteSession(sessionToDelete.id);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      toast.success('Session deleted');
      setSessionToDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to delete session');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClearAllSessions = async () => {
    if (!program) return;
    setClearAllLoading(true);
    try {
      await Promise.all(sessions.map(s => sessionService.deleteSession(s.id)));
      setSessions([]);
      toast.success('All sessions cleared');
      setClearAllOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to clear sessions');
    } finally {
      setClearAllLoading(false);
    }
  };

  useEffect(() => {
    if (open && program) {
      setDataLoading(true);
      Promise.all([
        sessionService.getSessionsByProgram(program.id),
        attendanceService.getAttendanceStats(program.id),
      ])
        .then(([sessRes, statsRes]) => {
          setSessions(
            (sessRes.data ?? []).sort((a, b) =>
              b.session_date.localeCompare(a.session_date) || a.start_time.localeCompare(b.start_time)
            )
          );
          setStats(statsRes.data ?? null);
        })
        .catch(() => {})
        .finally(() => setDataLoading(false));
    } else if (!open) {
      setSessions([]);
      setStats(null);
    }
  }, [open, program]);

  if (!program) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Program Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Program Image */}
          {program.photoUrl && (
            <div className="flex justify-center">
              <img
                src={program.photoUrl}
                alt={program.name}
                className="h-48 w-auto rounded-md object-cover shadow"
              />
            </div>
          )}

          {/* Header Info */}
          <div className="flex items-start gap-4">
            {!program.photoUrl && (
              <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <GraduationCap className="size-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="mb-2">{program.name}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge className={getStatusColor(program.status)}>
                  {program.status}
                </Badge>
                <Badge variant="outline" className="border-primary text-primary">
                  {program.duration}
                </Badge>
                <Badge variant="outline" className="border-secondary text-secondary">
                  {program.level}
                </Badge>
              </div>
            </div>
          </div>

          {/* Description */}
          {program.description && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Description</h4>
              <p className="text-muted-foreground">{program.description}</p>
            </div>
          )}

          {/* Instructor */}
          {program.instructor && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Instructor</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <User className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{program.instructor}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Duration */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">{program.duration}</p>
              </div>
            </div>

            {/* Level */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                <Award className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Level</p>
                <p className="font-semibold">{program.level}</p>
              </div>
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10">
                <Calendar className="size-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-semibold">{formatDate(program.startDate)}</p>
              </div>
            </div>

            {/* End Date */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                <Calendar className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-semibold">{formatDate(program.endDate)}</p>
              </div>
            </div>
          </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="sessions" className="text-xs gap-1.5">
              <CalendarDays className="size-3.5" />Sessions {!dataLoading && sessions.length > 0 && `(${sessions.length})`}
            </TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs gap-1.5">
              <BarChart3 className="size-3.5" />Attendance
            </TabsTrigger>
          </TabsList>

          {/* ── Sessions Tab ── */}
          <TabsContent value="sessions">
            {dataLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <CalendarDays className="size-10 mb-2 opacity-40" />
                <p className="text-sm">No sessions have been created for this program.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                {Object.entries(
                  sessions.reduce((acc, s) => {
                    const key = s.session_date.slice(0, 7);
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(s);
                    return acc;
                  }, {} as Record<string, ProgramSession[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, monthSessions]) => {
                  const [yr, mo] = monthKey.split('-');
                  const monthLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  return (
                    <div key={monthKey}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        {monthLabel} <span className="font-normal opacity-70">({monthSessions.length})</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {monthSessions
                          .sort((a, b) => a.session_date.localeCompare(b.session_date))
                          .map(s => {
                            const d = new Date(s.session_date + 'T00:00:00');
                            const dayNum = d.getDate();
                            const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
                            const statusCls = s.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : s.status === 'cancelled'
                              ? 'bg-red-100 text-red-700 border-red-200 opacity-60 line-through dark:bg-red-900/30'
                              : 'bg-primary/10 text-primary border-primary/20';
                            return (
                              <span
                                key={s.id}
                                title={`${s.title} · ${s.session_date} · ${s.start_time}–${s.end_time}`}
                                className={`relative inline-flex flex-col items-center w-10 py-1 rounded-lg border text-xs font-medium select-none group ${statusCls}`}
                              >
                                <span className="text-[9px] opacity-60 leading-none">{dow}</span>
                                <span className="text-sm font-bold leading-tight">{dayNum}</span>
                                {canManage && (
                                  <button
                                    onClick={() => setSessionToDelete(s)}
                                    title="Delete session"
                                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center size-4 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
                                  >
                                    <X className="size-2.5" />
                                  </button>
                                )}
                              </span>
                            );
                          })
                        }
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-3 pt-2 border-t flex-wrap text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary/50 inline-block" />Scheduled</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" />Completed</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-400 inline-block" />Cancelled</span>
                  <span className="ml-auto">{sessions.length} total</span>
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setClearAllOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Clear All Sessions
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Attendance Tab ── */}
          <TabsContent value="attendance">
            {dataLoading ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                </div>
              </div>
            ) : !stats || stats.total === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <BarChart3 className="size-10 mb-2 opacity-40" />
                <p className="text-sm">No attendance records yet.</p>
                <p className="text-xs mt-1">Scan trainee QR codes during sessions to start recording.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Present', value: stats.present, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
                    { label: 'Absent', value: stats.absent, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
                    { label: 'Late', value: stats.late, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/10' },
                    { label: 'Excused', value: stats.excused, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                  ].map(s => (
                    <div key={s.label} className={`flex items-center gap-3 p-3 rounded-lg ${s.bg}`}>
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round((s.value / stats.total) * 100)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Total records: {stats.total}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Delete single session confirmation ── */}
        <Dialog open={!!sessionToDelete} onOpenChange={v => { if (!v) setSessionToDelete(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Session?</DialogTitle>
              <DialogDescription>
                <strong>{sessionToDelete?.session_date}</strong> ({sessionToDelete?.title}) will be permanently deleted along with all its attendance records. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={deleteLoading} onClick={() => setSessionToDelete(null)}>Cancel</Button>
              <Button variant="destructive" disabled={deleteLoading} onClick={handleDeleteSession}>
                {deleteLoading ? 'Deleting…' : 'Delete Session'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Clear all sessions confirmation ── */}
        <Dialog open={clearAllOpen} onOpenChange={v => { if (!v) setClearAllOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Clear All Sessions?</DialogTitle>
              <DialogDescription>
                All <strong>{sessions.length}</strong> sessions for this program will be permanently deleted, including every attendance record tied to them. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={clearAllLoading} onClick={() => setClearAllOpen(false)}>Cancel</Button>
              <Button variant="destructive" disabled={clearAllLoading} onClick={handleClearAllSessions}>
                {clearAllLoading ? 'Clearing…' : 'Clear All Sessions'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => { 
              onOpenChange(false); 
              navigate(`/programs/${program.id}/attendance`); 
            }}
          >
            <ExternalLink className="mr-2 size-4" />
            View Attendance
          </Button>
          {canManage && onEdit && (
            <Button 
              variant="default" 
              className="flex-1"
              onClick={() => {
                onEdit(program);
                onOpenChange(false);
              }}
            >
              <GraduationCap className="mr-2 size-4" />
              Edit Program
            </Button>
          )}
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}
