import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Download, FileText, ChevronDown, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import reportService from '../services/reportService';
import logger from '../utils/logger';
import PrintableReport from '../components/PrintableReport';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('2024-10-01');
  const [dateTo, setDateTo] = useState('2024-10-31');
  const [reportType, setReportType] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [programData, setProgramData] = useState<any[]>([]);
  
  // Print state management
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Summary statistics state
  // TODO: These should be calculated from actual report data or fetched from backend
  // @ts-expect-error - Setters will be used when implementing dynamic statistics
  const [totalLendings, setTotalLendings] = useState(127);
  // @ts-expect-error - Setters will be used when implementing dynamic statistics
  const [itemsReturned, setItemsReturned] = useState(98);
  // @ts-expect-error - Setters will be used when implementing dynamic statistics
  const [activeLoans, setActiveLoans] = useState(29);
  // @ts-expect-error - Setters will be used when implementing dynamic statistics
  const [newTrainees, setNewTrainees] = useState(34);

  const COLORS = ['#1976D2', '#43A047', '#FBC02D', '#00ACC1'];

  // Fetch report data from backend
  useEffect(() => {
    fetchReportData();
  }, [dateFrom, dateTo, reportType]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const filters = {
        startDate: dateFrom,
        endDate: dateTo
      };

      // Fetch activity analytics (currently not implemented in backend)
      try {
        const activityResponse: any = await reportService.getActivityAnalytics(filters);
        if (activityResponse?.trend) {
          setActivityData(activityResponse.trend.map((item: any) => ({
            date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            borrowed: item.borrowed || 0,
            returned: item.returned || 0
          })));
        }
      } catch (error) {
        // Set mock data for demonstration
        setActivityData([
          { date: 'Feb 20', borrowed: 5, returned: 3 },
          { date: 'Feb 21', borrowed: 8, returned: 6 },
          { date: 'Feb 22', borrowed: 12, returned: 9 },
          { date: 'Feb 23', borrowed: 7, returned: 11 },
          { date: 'Feb 24', borrowed: 9, returned: 8 },
          { date: 'Feb 25', borrowed: 6, returned: 7 }
        ]);
      }

      // Fetch inventory report for category data
      try {
        const inventoryResponse = await reportService.getInventoryReport(filters);
        if (inventoryResponse?.byCategory) {
          const categoryEntries = Object.entries(inventoryResponse.byCategory);
          setCategoryData(categoryEntries.map(([name, value]) => ({ name, value })));
        }
      } catch (error) {
        // Set mock data for demonstration
        setCategoryData([
          { name: 'Tools', value: 45 },
          { name: 'Equipment', value: 32 },
          { name: 'Materials', value: 28 },
          { name: 'Electronics', value: 15 }
        ]);
      }

      // Fetch program report (currently not implemented in backend)
      try {
        const programResponse: any = await reportService.getProgramReport(filters);
        if (programResponse?.programStats) {
          setProgramData(programResponse.programStats.map((item: any) => ({
            program: item.name,
            trainees: item.enrolledCount || 0
          })));
        }
      } catch (error) {
        // Set mock data for demonstration
        setProgramData([
          { program: 'Computer Literacy', trainees: 25 },
          { program: 'Automotive Repair', trainees: 18 },
          { program: 'Cosmetology', trainees: 22 },
          { program: 'Culinary Arts', trainees: 15 },
          { program: 'Electronics', trainees: 12 }
        ]);
      }
    } catch (error) {
      logger.error('Failed to fetch reports', { error });
      toast.error('Failed to load report data');
      // Set empty data on error
      setActivityData([]);
      setCategoryData([]);
      setProgramData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    try {
      if (format === 'pdf') {
        await reportService.exportReportToPDF(reportType, {
          startDate: dateFrom,
          endDate: dateTo
        });
      } else if (format === 'csv') {
        await reportService.exportReportToCSV(reportType, {
          startDate: dateFrom,
          endDate: dateTo
        });
      }
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      logger.error('Export failed', { error });
      toast.error(`Failed to export report as ${format.toUpperCase()}`);
    }
  };

  const handlePrint = async () => {
    // Feature detection - check if window.print is supported
    if (typeof window.print !== 'function') {
      toast.error('Print functionality is not supported in your browser. Please use PDF export.');
      return;
    }
    
    try {
      setIsPrinting(true);
      
      // Small delay to ensure PrintableReport renders
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger browser print dialog
      window.print();
    } catch (error) {
      logger.error('Print failed', { error });
      toast.error('Failed to open print dialog. Please try exporting as PDF instead.');
      setIsPrinting(false);
    }
  };

  // Set up afterprint event listener to reset isPrinting state
  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    
    window.addEventListener('afterprint', handleAfterPrint);
    
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  return (
    <DashboardLayout title="Reports & Analytics">
      {/* Conditionally render PrintableReport when isPrinting is true */}
      {isPrinting && (
        <PrintableReport
          reportTitle="Reports & Analytics"
          dateFrom={dateFrom}
          dateTo={dateTo}
          reportType={reportType}
          generatedAt={new Date().toISOString()}
          summaryStats={{
            totalLendings,
            itemsReturned,
            activeLoans,
            newTrainees,
          }}
          activityData={activityData}
          categoryData={categoryData}
          programData={programData}
        />
      )}
      
      <div className={`space-y-6 ${isPrinting ? 'print-hidden' : ''}`}>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2>Reports</h2>
            <p className="text-muted-foreground">View and export analytics data</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <FileText className="mr-2 size-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <Download className="mr-2 size-4" />
              Export PDF
            </Button>
            <Button 
              variant="outline" 
              onClick={handlePrint}
              disabled={isPrinting}
            >
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

        {/* Filters - Desktop */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
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
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="trainees">Trainees Only</SelectItem>
                    <SelectItem value="items">Items Only</SelectItem>
                    <SelectItem value="lendings">Lendings Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full">Apply Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters - Mobile (Collapsible) */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="md:hidden">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Filters</CardTitle>
                  <ChevronDown className={`size-5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom-mobile">Date From</Label>
                  <Input
                    id="dateFrom-mobile"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo-mobile">Date To</Label>
                  <Input
                    id="dateTo-mobile"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportType-mobile">Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activity</SelectItem>
                      <SelectItem value="trainees">Trainees Only</SelectItem>
                      <SelectItem value="items">Items Only</SelectItem>
                      <SelectItem value="lendings">Lendings Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">Apply Filters</Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Activity Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Lending Activity Trend</CardTitle>
              <CardDescription>Borrowing and returning over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="borrowed" stroke="#1976D2" strokeWidth={2} name="Borrowed" />
                    <Line type="monotone" dataKey="returned" stroke="#43A047" strokeWidth={2} name="Returned" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Items by Category</CardTitle>
              <CardDescription>Distribution of item categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((_, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Program Enrollment */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Trainees by Program</CardTitle>
              <CardDescription>Current enrollment across training programs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={programData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="program" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="trainees" fill="#1976D2" name="Number of Trainees" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
            <CardDescription>Key metrics for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Lendings</p>
                <h3>{totalLendings}</h3>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Items Returned</p>
                <h3>{itemsReturned}</h3>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Active Loans</p>
                <h3>{activeLoans}</h3>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">New Trainees</p>
                <h3>{newTrainees}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
