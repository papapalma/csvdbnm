import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Download,
  FileText,
  Building2,
  Users,
  GraduationCap,
  Package,
  Award,
  Printer,
  Loader2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import reportService, { PlatformSummaryReport, CrossTenantComparisonReport } from '../services/reportService';
import logger from '../utils/logger';

const COLORS = ['#1976D2', '#43A047', '#FBC02D', '#00ACC1', '#E91E63', '#9C27B0', '#FF5722', '#607D8B'];

export default function SuperAdminReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect non-super_admin users
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportingPlatformPdf, setExportingPlatformPdf] = useState(false);
  const [exportingPlatformCsv, setExportingPlatformCsv] = useState(false);
  const [exportingComparisonPdf, setExportingComparisonPdf] = useState(false);
  const [exportingComparisonCsv, setExportingComparisonCsv] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [platformSummary, setPlatformSummary] = useState<PlatformSummaryReport | null>(null);
  const [crossTenantComparison, setCrossTenantComparison] = useState<CrossTenantComparisonReport | null>(null);

  // ── Fetch Data ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const filters = {
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
      };

      const [summaryData, comparisonData] = await Promise.all([
        reportService.getPlatformSummary(filters),
        reportService.getCrossTenantComparison(filters),
      ]);

      setPlatformSummary(summaryData);
      setCrossTenantComparison(comparisonData);
    } catch (error) {
      logger.error('Failed to fetch super admin reports', { error });
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // ── Export Handlers ───────────────────────────────────────────────────────
  const handleExportPlatformPdf = async () => {
    setExportingPlatformPdf(true);
    try {
      await reportService.exportPlatformSummaryPDF({ startDate: dateFrom, endDate: dateTo });
      toast.success('Platform summary PDF downloaded');
    } catch (error) {
      logger.error('Failed to export platform summary PDF', { error });
      toast.error('Failed to export PDF');
    } finally {
      setExportingPlatformPdf(false);
    }
  };

  const handleExportPlatformCsv = async () => {
    setExportingPlatformCsv(true);
    try {
      await reportService.exportPlatformSummaryCSV({ startDate: dateFrom, endDate: dateTo });
      toast.success('Platform summary CSV downloaded');
    } catch (error) {
      logger.error('Failed to export platform summary CSV', { error });
      toast.error('Failed to export CSV');
    } finally {
      setExportingPlatformCsv(false);
    }
  };

  const handleExportComparisonPdf = async () => {
    setExportingComparisonPdf(true);
    try {
      await reportService.exportCrossTenantComparisonPDF({ startDate: dateFrom, endDate: dateTo });
      toast.success('Cross-tenant comparison PDF downloaded');
    } catch (error) {
      logger.error('Failed to export comparison PDF', { error });
      toast.error('Failed to export PDF');
    } finally {
      setExportingComparisonPdf(false);
    }
  };

  const handleExportComparisonCsv = async () => {
    setExportingComparisonCsv(true);
    try {
      await reportService.exportCrossTenantComparisonCSV({ startDate: dateFrom, endDate: dateTo });
      toast.success('Cross-tenant comparison CSV downloaded');
    } catch (error) {
      logger.error('Failed to export comparison CSV', { error });
      toast.error('Failed to export CSV');
    } finally {
      setExportingComparisonCsv(false);
    }
  };

  const handlePrint = async () => {
    if (typeof window.print !== 'function') {
      toast.error('Print functionality not supported. Please use PDF export.');
      return;
    }
    try {
      setIsPrinting(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.print();
    } catch (error) {
      logger.error('Print failed', { error });
      toast.error('Failed to open print dialog. Please try PDF export.');
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // ── Computed Data ─────────────────────────────────────────────────────────
  const tenantProgramsData = platformSummary?.tenantBreakdowns.map((t) => ({
    name: t.tenantName.length > 15 ? t.tenantName.slice(0, 15) + '...' : t.tenantName,
    programs: t.programs,
    enrollments: t.enrollments,
    completions: t.completions,
  })) || [];

  const tenantTraineesData = platformSummary?.tenantBreakdowns.map((t) => ({
    name: t.tenantName.length > 15 ? t.tenantName.slice(0, 15) + '...' : t.tenantName,
    trainees: t.trainees,
  })) || [];

  const tenantItemsData = platformSummary?.tenantBreakdowns.map((t) => ({
    name: t.tenantName,
    value: t.items,
  })) || [];

  const performanceData = crossTenantComparison?.tenants.map((t) => ({
    name: t.tenantName.length > 15 ? t.tenantName.slice(0, 15) + '...' : t.tenantName,
    enrollmentRate: parseFloat(t.enrollmentRate.toFixed(1)),
    completionRate: parseFloat(t.completionRate.toFixed(1)),
    inventoryUtilization: parseFloat(t.inventoryUtilization.toFixed(1)),
  })) || [];

  // ── Summary Cards ─────────────────────────────────────────────────────────
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
        {
          label: 'Total Enrollments',
          value: platformSummary.totalEnrollments,
          sub: 'across all LGUs',
          icon: FileText,
          bg: 'bg-cyan-100 dark:bg-cyan-950',
          color: 'text-cyan-600 dark:text-cyan-400',
        },
        {
          label: 'Total Certificates',
          value: platformSummary.totalCertificates,
          sub: 'issued',
          icon: Award,
          bg: 'bg-amber-100 dark:bg-amber-950',
          color: 'text-amber-600 dark:text-amber-400',
        },
      ]
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Super Admin Reports & Analytics">
      <div className={`space-y-6 ${isPrinting ? 'print:block' : ''}`}>
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <h2 className="flex items-center gap-2">
              <TrendingUp className="size-6" />
              Platform Reports & Analytics
            </h2>
            <p className="text-muted-foreground">
              Cross-tenant reporting and performance analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              {isPrinting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 size-4" />
                  Print
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Filters ── */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-5" />
              Date Range Filter
            </CardTitle>
            <CardDescription>Optional: Filter reports by date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Date From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Date To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={fetchReports} disabled={loading}>
                  {loading ? 'Loading...' : 'Apply Filters'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Summary Cards ── */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="mb-1 h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Tabbed Reports ── */}
        <Tabs defaultValue="overview" className="print:hidden">
          <TabsList>
            <TabsTrigger value="overview">Platform Overview</TabsTrigger>
            <TabsTrigger value="comparison">LGU Comparison</TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            {/* Export Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPlatformPdf}
                disabled={exportingPlatformPdf || loading}
              >
                <Download className="mr-2 size-4" />
                {exportingPlatformPdf ? 'Exporting...' : 'PDF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPlatformCsv}
                disabled={exportingPlatformCsv || loading}
              >
                <Download className="mr-2 size-4" />
                {exportingPlatformCsv ? 'Exporting...' : 'CSV'}
              </Button>
            </div>

            {loading ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-[300px] w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Programs by Tenant */}
                <Card>
                  <CardHeader>
                    <CardTitle>Programs by LGU</CardTitle>
                    <CardDescription>Program distribution across tenants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tenantProgramsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="programs" fill="#1976D2" name="Programs" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Enrollments & Completions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Enrollments & Completions by LGU</CardTitle>
                    <CardDescription>Training progress across tenants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tenantProgramsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="enrollments" fill="#43A047" name="Enrollments" />
                          <Bar dataKey="completions" fill="#FBC02D" name="Completions" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Trainees by Tenant */}
                <Card>
                  <CardHeader>
                    <CardTitle>Trainees by LGU</CardTitle>
                    <CardDescription>Total trainee count per tenant</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tenantTraineesData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="trainees" fill="#00ACC1" name="Trainees" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Inventory by Tenant */}
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Distribution</CardTitle>
                    <CardDescription>Items by LGU tenant</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tenantItemsData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {tenantItemsData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── Comparison Tab ── */}
          <TabsContent value="comparison" className="mt-4 space-y-6">
            {/* Export Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportComparisonPdf}
                disabled={exportingComparisonPdf || loading}
              >
                <Download className="mr-2 size-4" />
                {exportingComparisonPdf ? 'Exporting...' : 'PDF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportComparisonCsv}
                disabled={exportingComparisonCsv || loading}
              >
                <Download className="mr-2 size-4" />
                {exportingComparisonCsv ? 'Exporting...' : 'CSV'}
              </Button>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-[400px] w-full" />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics Comparison</CardTitle>
                  <CardDescription>
                    Enrollment rate, completion rate, and inventory utilization by LGU
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="enrollmentRate"
                          stroke="#1976D2"
                          strokeWidth={2}
                          name="Enrollment Rate %"
                        />
                        <Line
                          type="monotone"
                          dataKey="completionRate"
                          stroke="#43A047"
                          strokeWidth={2}
                          name="Completion Rate %"
                        />
                        <Line
                          type="monotone"
                          dataKey="inventoryUtilization"
                          stroke="#FBC02D"
                          strokeWidth={2}
                          name="Inventory Utilization %"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Print View (Hidden on screen) ── */}
        {isPrinting && platformSummary && (
          <div className="hidden print:block">
            <h1 className="mb-4 text-2xl font-bold">Platform Reports & Analytics</h1>
            <p className="mb-4 text-sm text-gray-600">
              Generated: {new Date().toLocaleString()}
            </p>
            <div className="mb-6 space-y-2">
              <p>Total Tenants: {platformSummary.totalTenants}</p>
              <p>Total Programs: {platformSummary.totalPrograms}</p>
              <p>Total Trainees: {platformSummary.totalTrainees}</p>
              <p>Total Items: {platformSummary.totalItems}</p>
              <p>Total Enrollments: {platformSummary.totalEnrollments}</p>
              <p>Total Certificates: {platformSummary.totalCertificates}</p>
            </div>
            <h2 className="mb-2 text-xl font-bold">Tenant Breakdown</h2>
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Tenant</th>
                  <th className="border p-2 text-left">Programs</th>
                  <th className="border p-2 text-left">Enrollments</th>
                  <th className="border p-2 text-left">Completions</th>
                  <th className="border p-2 text-left">Trainees</th>
                  <th className="border p-2 text-left">Items</th>
                </tr>
              </thead>
              <tbody>
                {platformSummary.tenantBreakdowns.map((t) => (
                  <tr key={t.tenantId}>
                    <td className="border p-2">{t.tenantName}</td>
                    <td className="border p-2">{t.programs}</td>
                    <td className="border p-2">{t.enrollments}</td>
                    <td className="border p-2">{t.completions}</td>
                    <td className="border p-2">{t.trainees}</td>
                    <td className="border p-2">{t.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
