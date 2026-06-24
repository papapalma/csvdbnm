import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
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
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Users, Package, FileText, TrendingUp, TrendingDown, UserPlus, PackagePlus, QrCode, BarChart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dashboardLogger } from '../utils/activityLogger';
import reportService from '../services/reportService';
import activityLogService from '../services/activityLogService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [analyticsData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [, setLoading] = useState(true);
  const rowsPerPage = 10;

  const totalActivityPages = Math.ceil(recentActivity.length / rowsPerPage);
  const activityStart = (activityPage - 1) * rowsPerPage;
  const paginatedRecentActivity = recentActivity.slice(activityStart, activityStart + rowsPerPage);

  // Redirect trainees to their own dashboard, super_admin to platform dashboard
  useEffect(() => {
    if (user?.role === 'trainee') {
      navigate('/trainee/dashboard', { replace: true });
    } else if (user?.role === 'super_admin') {
      navigate('/super-admin', { replace: true });
    }
  }, [user, navigate]);

  // Fetch dashboard data from backend
  useEffect(() => {
    dashboardLogger.viewed();
    fetchDashboardData();
  }, []);

  useEffect(() => {
    setActivityPage(1);
  }, [recentActivity.length]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats
      const data = await reportService.getDashboardStats();
      
      // Map backend stats to cards
      const statsCards = [
        {
          label: 'Active Trainees',
          value: data.trainees?.active || 0,
          trend: `${data.trainees?.total || 0} total`,
          trendUp: true,
          icon: Users,
          bg: 'bg-blue-100 dark:bg-blue-950',
          color: 'text-blue-600 dark:text-blue-400'
        },
        {
          label: 'Available Items',
          value: data.inventory?.available || 0,
          trend: `${data.inventory?.total || 0} total`,
          trendUp: data.inventory?.available > data.inventory?.borrowed,
          icon: Package,
          bg: 'bg-green-100 dark:bg-green-950',
          color: 'text-green-600 dark:text-green-400'
        },
        {
          label: 'Active Lendings',
          value: data.lending?.active || 0,
          trend: `${data.lending?.overdue || 0} overdue`,
          trendUp: false,
          icon: FileText,
          bg: 'bg-orange-100 dark:bg-orange-950',
          color: 'text-orange-600 dark:text-orange-400'
        }
      ];
      
      setStats(statsCards);
      
      // Fetch recent activity logs (only for users with permission)
      if (hasPermission('canViewActivityLogs')) {
        try {
          const activityResponse = await activityLogService.getActivityLogs({});
          if (activityResponse?.data) {
            setRecentActivity(activityResponse.data);
          }
        } catch (activityError) {
          // Silently handle activity log errors - user can still see stats
          logger.warn('Failed to fetch activity logs', { error: activityError });
        }
      }
      
    } catch (error) {
      logger.error('Failed to fetch dashboard data', { error });
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h2>Welcome back!</h2>
          <p className="text-muted-foreground">Here's what's happening with your training center today.</p>
        </div>

        {/* KPI Cards - Desktop 3-column, Mobile single column */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <div className={`flex size-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`size-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <h1>{stat.value}</h1>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {stat.trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    <span>{stat.trend}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions - Desktop */}
        <div className="hidden sm:block">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link to="/trainees/new">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <UserPlus className="size-6" />
                    Add Trainee
                  </Button>
                </Link>
                <Link to="/items/new">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <PackagePlus className="size-6" />
                    Add Item
                  </Button>
                </Link>
                <Link to="/scan">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <QrCode className="size-6" />
                    Scan QR
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Mobile (Horizontal Scroll) */}
        <div className="sm:hidden">
          <h3 className="mb-3">Quick Actions</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <Link to="/trainees/new">
              <Card className="min-w-[140px]">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <UserPlus className="size-6 text-primary" />
                  </div>
                  <p className="text-sm text-center">Add Trainee</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/items/new">
              <Card className="min-w-[140px]">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-secondary/10">
                    <PackagePlus className="size-6 text-secondary" />
                  </div>
                  <p className="text-sm text-center">Add Item</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/scan">
              <Card className="min-w-[140px]">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-accent/10">
                    <QrCode className="size-6 text-accent" />
                  </div>
                  <p className="text-sm text-center">Scan QR</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent Activity - Desktop Table */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system activity and changes</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecentActivity.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>{activity.userName}</TableCell>
                        <TableCell>{activity.action}</TableCell>
                        <TableCell>{activity.module}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {activity.description}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalActivityPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                            className={activityPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            size={undefined}
                          />
                        </PaginationItem>

                        {Array.from({ length: totalActivityPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalActivityPages ||
                            (page >= activityPage - 1 && page <= activityPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setActivityPage(page)}
                                  isActive={activityPage === page}
                                  className="cursor-pointer"
                                  size={undefined}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          if (page === activityPage - 2 || page === activityPage + 2) {
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
                            onClick={() => setActivityPage(prev => Math.min(totalActivityPages, prev + 1))}
                            className={activityPage === totalActivityPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            size={undefined}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity - Mobile Cards */}
        <div className="md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h3>Recent Activity</h3>
            <Link to="/lendings">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity) => (
                <Card key={activity.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="mb-1 font-medium">{activity.userName}</p>
                        <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {activity.module}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="mb-4 size-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No recent activity</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        {analyticsData.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analyticsData.map((category) => (
              <Card key={category.category}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{category.category}</CardDescription>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <BarChart className="size-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {category.data.map((item: any) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${item.color}`} />
                          <p className="text-sm">{item.label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm">{item.value}</p>
                          <Progress value={item.percentage} className="h-2 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">No analytics data available</p>
              <p className="text-sm text-muted-foreground mt-2">Analytics will appear as you add trainees, items, and programs</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}