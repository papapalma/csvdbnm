import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import {
  ChevronLeft, Users, Calendar, Clock, RefreshCw,
  UserX, Loader2, BarChart3,
  CheckCircle2, XCircle, BookOpen, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import programService from '../services/programService';
import sessionService, { ProgramSession } from '../services/sessionService';
import attendanceService, { Attendance, AttendanceStats } from '../services/attendanceService';
import { api } from '../services/api';
import type { Trainee } from '../services/traineeService';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'absent',  label: 'Absent',  color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'late',    label: 'Late',    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'excused', label: 'Excused', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
] as const;

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt?.color ?? 'bg-muted text-muted-foreground'}`}>
      {opt?.label ?? status}
    </span>
  );
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function AttendancePage() {
  const { id: programId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [program, setProgram] = useState<any>(null);
  const [sessions, setSessions] = useState<ProgramSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);

  const [programLoading, setProgramLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;



  // ── Load program, sessions, overall stats ────────────────────────────────────
  useEffect(() => {
    if (!programId) return;
    setProgramLoading(true);
    Promise.all([
      programService.getProgramById(programId),
      sessionService.getSessionsByProgram(programId),
      attendanceService.getAttendanceStats(programId),
    ])
      .then(([prog, sessRes, statsRes]) => {
        setProgram(prog);
        const list = (sessRes.data ?? []).sort((a: ProgramSession, b: ProgramSession) =>
          b.session_date.localeCompare(a.session_date) || a.start_time.localeCompare(b.start_time)
        );
        setSessions(list);
        setStats(statsRes.data ?? null);
        // Auto-select today's session first; otherwise most recent
        const today = new Date().toISOString().split('T')[0];
        const todaySession = list.find((s: ProgramSession) => s.session_date === today);
        setSelectedSessionId(todaySession?.id ?? list[0]?.id ?? '');
      })
      .catch(() => toast.error('Failed to load program data'))
      .finally(() => setProgramLoading(false));
  }, [programId]);

  // ── Load attendance + enrolled trainees for selected session ─────────────────
  useEffect(() => {
    if (!selectedSessionId || !programId) return;
    setAttendanceLoading(true);
    Promise.all([
      attendanceService.getAttendanceBySession(selectedSessionId),
      api.get<Trainee[]>('/trainees', { program_id: programId, status: 'active' }),
    ])
      .then(([attRes, traineeRes]) => {
        setAttendance(attRes.data ?? []);
        setTrainees(traineeRes.data ?? []);
      })
      .catch(() => toast.error('Failed to load attendance'))
      .finally(() => setAttendanceLoading(false));
  }, [selectedSessionId, programId]);

  const getRecord = (traineeId: string) => attendance.find(a => a.trainee_id === traineeId);

  const handleMark = async (traineeId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    if (!selectedSessionId) return;
    setMarkingId(traineeId);
    try {
      await attendanceService.markAttendance({ session_id: selectedSessionId, trainee_id: traineeId, status });
      const res = await attendanceService.getAttendanceBySession(selectedSessionId);
      setAttendance(res.data ?? []);
      toast.success('Attendance updated');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update attendance');
    } finally {
      setMarkingId(null);
    }
  };

  const handleBulkAbsent = async () => {
    if (!selectedSessionId) return;
    setBulkLoading(true);
    try {
      const res = await attendanceService.bulkMarkAbsent(selectedSessionId);
      toast.success(`Marked ${res.data?.markedAbsent ?? 0} trainees as absent`);
      const attRes = await attendanceService.getAttendanceBySession(selectedSessionId);
      setAttendance(attRes.data ?? []);
    } catch {
      toast.error('Failed to bulk mark absent');
    } finally {
      setBulkLoading(false);
    }
  };

  const refreshAttendance = async () => {
    if (!selectedSessionId) return;
    setAttendanceLoading(true);
    try {
      const res = await attendanceService.getAttendanceBySession(selectedSessionId);
      setAttendance(res.data ?? []);
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const unrecordedCount = trainees.filter(t => !getRecord(t.id)).length;
  const totalPages = Math.ceil(trainees.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedTrainees = trainees.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSessionId]);



  // Attendance counts for selected session
  const sessionPresent = attendance.filter(a => a.status === 'present').length;
  const sessionLate = attendance.filter(a => a.status === 'late').length;
  const sessionAbsent = attendance.filter(a => a.status === 'absent').length;
  const sessionExcused = attendance.filter(a => a.status === 'excused').length;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/programs')} className="mt-0.5 shrink-0">
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="size-6 text-primary shrink-0" />
              Attendance
            </h1>
            {program && (
              <div className="mt-1.5 space-y-1.5">
                <p className="text-base font-medium text-foreground truncate">{program.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {program.instructor && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <GraduationCap className="size-3" />{program.instructor}
                    </Badge>
                  )}
                  {program.level && (
                    <Badge variant="outline" className="text-xs">{program.level}</Badge>
                  )}
                  <Badge
                    variant={program.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize text-xs"
                  >
                    {program.status}
                  </Badge>
                  {program.start_date && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Calendar className="size-3" />
                      {new Date(program.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {program.end_date
                        ? ` – ${new Date(program.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : ''}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {programLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {/* ── Overall Stats ──────────────────────────────────────────── */}
            {stats && (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {[
                  { label: 'Present', value: stats.present, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', Icon: CheckCircle2 },
                  { label: 'Absent',  value: stats.absent,  color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/30',     Icon: XCircle },
                  { label: 'Late',    value: stats.late,    color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/30', Icon: Clock },
                  { label: 'Excused', value: stats.excused, color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-950/30',     Icon: BookOpen },
                ].map(s => (
                  <Card key={s.label} className={`border-0 shadow-sm ${s.bg}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                        <s.Icon className={`size-4 ${s.color} opacity-60`} />
                      </div>
                      <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.total > 0 ? Math.round((s.value / stats.total) * 100) : 0}% of records
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* ── Session Selector ───────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="size-4 text-primary" />
                      Session Attendance
                    </CardTitle>
                    {sessions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} total</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={refreshAttendance} disabled={attendanceLoading || !selectedSessionId} className="gap-1.5">
                      <RefreshCw className={`size-4 ${attendanceLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    {selectedSessionId && unrecordedCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkAbsent}
                        disabled={bulkLoading}
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10"
                      >
                        {bulkLoading ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
                        Mark {unrecordedCount} as Absent
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <Calendar className="size-10 opacity-30" />
                    <p className="text-sm">No sessions have been created for this program yet.</p>
                    <p className="text-xs opacity-70">Sessions can be generated from the program edit page.</p>
                  </div>
                ) : (
                  <>
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a session…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map(s => {
                          const today = new Date().toISOString().split('T')[0];
                          return (
                            <SelectItem key={s.id} value={s.id}>
                              {s.session_date === today ? '📅 Today — ' : `${s.session_date} — `}
                              {s.title} ({formatTime(s.start_time)})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {selectedSession && (
                      <div className="rounded-lg border bg-muted/30 px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="size-3.5 shrink-0" />
                          <span className="font-medium text-foreground">{formatTime(selectedSession.start_time)}</span>
                          <span>–</span>
                          <span className="font-medium text-foreground">{formatTime(selectedSession.end_time)}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="size-3.5 shrink-0" />
                          <span className="font-medium text-foreground">{trainees.length}</span> enrolled
                        </span>
                        <Badge variant="outline" className="capitalize text-xs">{selectedSession.session_type ?? 'session'}</Badge>
                        <Badge
                          variant={selectedSession.status === 'completed' ? 'default' : 'secondary'}
                          className="capitalize text-xs"
                        >
                          {selectedSession.status}
                        </Badge>
                      </div>
                    )}


                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Trainee Attendance Table ───────────────────────────────── */}
            {selectedSessionId && (
              <Card>
                <CardHeader className="pb-0 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Trainees
                    </CardTitle>
                    {!attendanceLoading && attendance.length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="size-3" />{sessionPresent}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <Clock className="size-3" />{sessionLate}
                        </span>
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <XCircle className="size-3" />{sessionAbsent}
                        </span>
                        {sessionExcused > 0 && (
                          <span className="flex items-center gap-1 text-sky-600 font-medium">
                            <BookOpen className="size-3" />{sessionExcused}
                          </span>
                        )}
                        {unrecordedCount > 0 && (
                          <span className="text-muted-foreground">· {unrecordedCount} pending</span>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <Separator className="mt-3" />
                <CardContent className="p-0">
                  {attendanceLoading ? (
                    <div className="p-6 space-y-3">
                      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : trainees.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-muted-foreground">
                      <Users className="size-10 mb-2 opacity-40" />
                      <p className="text-sm">No active trainees enrolled in this program.</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Trainee</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="hidden sm:table-cell">Check-in</TableHead>
                              <TableHead>Mark Attendance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedTrainees.map(trainee => {
                              const record = getRecord(trainee.id);
                              const isUpdating = markingId === trainee.id;
                              return (
                                <TableRow key={trainee.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold select-none">
                                        {trainee.first_name?.[0]}{trainee.last_name?.[0]}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">
                                          {trainee.last_name}, {trainee.first_name}
                                          {trainee.middle_name ? ` ${trainee.middle_name[0]}.` : ''}
                                        </p>
                                        <p className="text-xs text-muted-foreground hidden sm:block">{trainee.email}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {record
                                      ? <StatusBadge status={record.status} />
                                      : <span className="text-xs text-muted-foreground italic">Not recorded</span>
                                    }
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                    {record?.check_in_time
                                      ? new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : '—'
                                    }
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                      {(['present', 'late', 'absent', 'excused'] as const).map(s => {
                                        const opt = STATUS_OPTIONS.find(o => o.value === s)!;
                                        const isActive = record?.status === s;
                                        return (
                                          <button
                                            key={s}
                                            disabled={isUpdating || isActive}
                                            onClick={() => handleMark(trainee.id, s)}
                                            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors capitalize
                                            ${isActive
                                              ? opt.color + ' opacity-70 cursor-not-allowed'
                                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                            }`}
                                          >
                                            {isUpdating
                                              ? <Loader2 className="size-3 animate-spin inline" />
                                              : s
                                            }
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {totalPages > 1 && (
                        <div className="p-4 flex justify-center">
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
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
