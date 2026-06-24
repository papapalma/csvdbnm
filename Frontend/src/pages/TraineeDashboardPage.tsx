import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  Award, 
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  User,
  TrendingUp,
  CalendarX,
  WifiOff,
  Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFileUrl } from '../services/api';
import traineeService from '../services/traineeService';
import programService from '../services/programService';
import { toast } from 'sonner';
import logger from '../utils/logger';
import { CardGridSkeleton, ListSkeleton } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';
import { offlineManager } from '../utils/offlineManager';
import { STORES } from '../utils/offlineDB';

interface AttendanceStats {
  total_sessions: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_rate: number;
}

interface Attendance {
  id: string;
  status: string;
  check_in_time: string;
  check_out_time?: string;
  created_at: string;
  program_sessions?: {
    session_date: string;
    start_time: string;
    end_time: string;
    programs?: {
      name: string;
    };
  };
}

interface ProgramSession {
  id: string;
  program_id: string;
  session_number: number;
  date: string;
  session_date?: string;
  start_time: string;
  end_time: string;
  topic?: string;
  title?: string;
  description?: string;
  location?: string;
  session_type?: string;
  is_excluded_date?: boolean;
}

interface ExcludedDate {
  id: string;
  date: string;
  reason: string;
  description?: string;
}

interface TraineeProfile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  photo_path?: string;
  program_id?: string;
  status: string;
  enrollment_date: string;
  program?: {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
    instructor?: string | null;
    duration_weeks?: number;
    max_trainees?: number;
  };
}

export default function TraineeDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [traineeProfile, setTraineeProfile] = useState<TraineeProfile | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<ProgramSession[]>([]);
  const [excludedDates, setExcludedDates] = useState<ExcludedDate[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // Track online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if push notifications are already enabled
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }

    // Load all dashboard data with a single optimized API call
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Use offline-aware fetch: try API first, fall back to IndexedDB cache
        let dashboardData: any;
        try {
          dashboardData = await traineeService.getMyDashboard();
          // Cache the profile data for offline access
          if (dashboardData?.profile) {
            await offlineManager.fetchWithOfflineSupport(
              STORES.TRAINEES,
              async () => [dashboardData.profile],
              true
            );
          }
          // Cache programs for offline access
          try {
            await offlineManager.fetchWithOfflineSupport(
              STORES.PROGRAMS,
              () => programService.getPrograms({ status: 'active' }).then(r => r.data || []),
              false
            );
          } catch {
            // Non-critical — ignore
          }
        } catch (apiError) {
          // Offline fallback: load from IndexedDB
          logger.warn('API unavailable, loading from offline cache', { apiError });
          const cachedProfiles = await offlineManager.fetchWithOfflineSupport<any>(
            STORES.TRAINEES,
            async () => [],
            false
          );
          if (cachedProfiles.length > 0) {
            dashboardData = { profile: cachedProfiles[0], attendanceStats: null, recentAttendance: [], upcomingSessions: [], excludedDates: [] };
            toast.info('Showing cached data', { description: 'Connect to internet for latest updates' });
          } else {
            throw apiError;
          }
        }
        
        // Set profile data
        const profileData: TraineeProfile = {
          id: dashboardData.profile.id,
          first_name: dashboardData.profile.first_name,
          last_name: dashboardData.profile.last_name,
          middle_name: dashboardData.profile.middle_name,
          email: dashboardData.profile.email,
          phone: dashboardData.profile.phone,
          photo_path: dashboardData.profile.photo_path || '',
          program_id: dashboardData.profile.program_id,
          status: dashboardData.profile.status,
          enrollment_date: dashboardData.profile.enrollment_date,
          program: (dashboardData.profile as any).program || undefined
        };
        
        setTraineeProfile(profileData);
        setAttendanceStats(dashboardData.attendanceStats);
        setRecentAttendance(dashboardData.recentAttendance);
        setUpcomingSessions(dashboardData.upcomingSessions || []);
        setExcludedDates(dashboardData.excludedDates || []);

      } catch (error: any) {
        logger.error('Failed to load dashboard data', { error });
        toast.error(error?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="size-4 text-green-500" />;
      case 'absent':
        return <XCircle className="size-4 text-red-500" />;
      case 'late':
        return <AlertCircle className="size-4 text-yellow-500" />;
      case 'excused':
        return <Clock className="size-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      present: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      absent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      late: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      excused: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSessionTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      lecture: 'bg-blue-100 text-blue-800',
      lab: 'bg-purple-100 text-purple-800',
      workshop: 'bg-green-100 text-green-800',
      exam: 'bg-red-100 text-red-800',
      seminar: 'bg-orange-100 text-orange-800',
      field_trip: 'bg-teal-100 text-teal-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notifications enabled', {
          description: 'You will receive alerts for schedule changes and reminders',
        });
      } else {
        toast.info('Notifications blocked', {
          description: 'Enable notifications in your browser settings to receive alerts',
        });
      }
    } catch (error) {
      logger.error('Failed to request notification permission', { error });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="My Dashboard">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>

          <CardGridSkeleton count={4} />
          <ListSkeleton rows={4} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Dashboard">
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-primary">
              <AvatarImage src={traineeProfile?.photo_path ? getFileUrl(traineeProfile.photo_path) : ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {traineeProfile?.first_name?.[0]}{traineeProfile?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">
                Welcome, {traineeProfile?.first_name}!
              </h1>
              <p className="text-muted-foreground">
                {traineeProfile?.program?.name || 'No program enrolled'}
              </p>
              {user?.tenantName && (
                <p className="text-xs text-primary font-medium mt-0.5">{user.tenantName}</p>
              )}
            </div>
          </div>
          <Link to="/trainee/profile">
            <Button variant="outline">
              <User className="mr-2 size-4" />
              View Profile
            </Button>
          </Link>
        </div>

        {/* Offline Banner */}
        {isOffline && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <WifiOff className="size-4 shrink-0" />
            <span>You are offline. Showing cached data — connect to get the latest updates.</span>
          </div>
        )}

        {/* Push Notification Prompt */}
        {'Notification' in window && !notificationsEnabled && !isOffline && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
              <Bell className="size-4 shrink-0" />
              <span>Enable notifications to get alerts for schedule changes and reminders</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleEnableNotifications} className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300">
              Enable
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{attendanceStats?.attendance_rate || 0}%</div>
              <Progress value={attendanceStats?.attendance_rate || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sessions Attended</CardTitle>
              <CheckCircle2 className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceStats?.present_count || 0}</div>
              <p className="text-xs text-muted-foreground">
                out of {attendanceStats?.total_sessions || 0} sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
              <AlertCircle className="size-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{attendanceStats?.late_count || 0}</div>
              <p className="text-xs text-muted-foreground">
                times marked late
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Absences</CardTitle>
              <XCircle className="size-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{attendanceStats?.absent_count || 0}</div>
              <p className="text-xs text-muted-foreground">
                sessions missed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Program Progress */}
        {traineeProfile?.program && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <GraduationCap className="size-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{traineeProfile.program.name}</CardTitle>
                    <CardDescription>{traineeProfile.program.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={traineeProfile.program.status === 'active' ? 'default' : 'secondary'}>
                  {traineeProfile.program.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-sm">
                    Started: {formatDate(traineeProfile.program.start_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-sm">
                    Ends: {formatDate(traineeProfile.program.end_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span className="text-sm">
                    Enrolled: {formatDate(traineeProfile.enrollment_date)}
                  </span>
                </div>
                {traineeProfile.program.instructor && (
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <span className="text-sm">Instructor: {traineeProfile.program.instructor}</span>
                  </div>
                )}
                {traineeProfile.program.duration_weeks && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <span className="text-sm">Duration: {traineeProfile.program.duration_weeks} weeks</span>
                  </div>
                )}
                {traineeProfile.program.max_trainees && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-muted-foreground" />
                    <span className="text-sm">Max Trainees: {traineeProfile.program.max_trainees}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Schedule and Attendance */}
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming Sessions</TabsTrigger>
            <TabsTrigger value="attendance">Recent Attendance</TabsTrigger>
            <TabsTrigger value="excluded">No-Session Dates</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingSessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="size-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming sessions</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingSessions.map((session) => {
                  const sessionDate = session.session_date || session.date;
                  const isExcluded = session.is_excluded_date;
                  
                  return (
                    <Card key={session.id} className={`hover:shadow-md transition-shadow ${
                      isExcluded ? 'border-orange-300 bg-orange-50/50' : ''
                    }`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{session.title || session.topic}</CardTitle>
                          {isExcluded ? (
                            <Badge className="bg-orange-100 text-orange-800">
                              <CalendarX className="size-3 mr-1" />
                              No Session
                            </Badge>
                          ) : session.session_type && (
                            <Badge className={getSessionTypeBadge(session.session_type)}>
                              {session.session_type}
                            </Badge>
                          )}
                        </div>
                        {isExcluded && (
                          <CardDescription className="text-xs text-orange-600">
                            This date is excluded from attendance
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="size-4" />
                          {formatDate(sessionDate)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="size-4" />
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </div>
                        {session.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="size-4" />
                            {session.location}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            {recentAttendance.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Award className="size-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No attendance records yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {recentAttendance.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(record.status)}
                          <div>
                            <p className="font-medium">{record.program_sessions?.programs?.name || 'Session'}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(record.program_sessions?.session_date || '')} • {formatTime(record.program_sessions?.start_time || '')}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusBadge(record.status)}>
                          {record.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="excluded" className="space-y-4">
            {excludedDates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarX className="size-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming excluded dates</p>
                  <p className="text-sm text-muted-foreground mt-2">Weekends and holidays will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarX className="size-5" />
                    No-Session Dates
                  </CardTitle>
                  <CardDescription>
                    These dates are excluded from attendance (weekends, holidays, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {excludedDates.map((excluded) => (
                      <div 
                        key={excluded.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200"
                      >
                        <CalendarX className="size-5 text-orange-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-orange-900">
                            {formatDate(excluded.date)}
                          </div>
                          <div className="text-sm text-orange-700">{excluded.reason}</div>
                          {excluded.description && (
                            <div className="text-xs text-orange-600 mt-1">{excluded.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
