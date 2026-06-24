import api from './api';

/**
 * Reports API Service
 * All reporting and analytics API calls
 */

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  module?: string;
  format?: 'json' | 'csv' | 'pdf';
}

export interface DashboardStats {
  trainees: {
    total: number;
    active: number;
    completed: number;
    inactive: number;
  };
  inventory: {
    total: number;
    available: number;
    borrowed: number;
    lowStock: number;
  };
  lending: {
    total: number;
    active: number;
    overdue: number;
    returned: number;
  };
  programs: {
    total: number;
    ongoing: number;
    upcoming: number;
    completed: number;
  };
}

export interface TraineeReport {
  totalTrainees: number;
  byProgram: Record<string, number>;
  byStatus: Record<string, number>;
  enrollmentTrend: Array<{ date: string; count: number }>;
  completionRate: number;
}

export interface AttendanceReport {
  filters: {
    startDate?: string;
    endDate?: string;
    programId?: string;
    sessionId?: string;
  };
  summary: {
    totalSessions: number;
    excludedSessions: number;
    activeSessions: number;
    totalExpectedRecords: number;
    totalRecordedRecords: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
    recordCoverageRate: number;
  };
  byProgram: Array<{
    programId: string;
    programName: string;
    sessions: number;
    expected: number;
    recorded: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
    recordCoverageRate: number;
  }>;
  bySession: Array<{
    sessionId: string;
    title: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    programId: string;
    programName: string;
    expected: number;
    recorded: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  }>;
  trend: Array<{
    date: string;
    expected: number;
    recorded: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  }>;
}

export interface InventoryReport {
  totalItems: number;
  totalValue: number;
  byCategory: Record<string, number>;
  utilizationRate: number;
  lowStockItems: Array<{ id: string; name: string; quantity: number }>;
}

export interface LendingReport {
  totalTransactions: number;
  activeLoans: number;
  overdueItems: number;
  returnRate: number;
  popularItems: Array<{ id: string; name: string; borrowCount: number }>;
  borrowingTrend: Array<{ date: string; count: number }>;
}

export interface ProgramReport {
  totalPrograms: number;
  enrollmentRate: number;
  completionRate: number;
  byCategory: Record<string, number>;
  popularPrograms: Array<{ id: string; name: string; enrolled: number }>;
  programStats?: Array<{
    id: string;
    name: string;
    status: string;
    enrolledCount: number;
    completedCount: number;
    completionRate: number;
    capacity: number;
    start_date: string;
    end_date: string;
  }>;
}

export interface ActivityReport {
  totalActions: number;
  byAction: Record<string, number>;
  byModule: Record<string, number>;
  trend: Array<{ date: string; borrowed: number; returned: number; total: number }>;
  topUsers: Array<{ id: string; userName: string; count: number }>;
  recent: Array<Record<string, any>>;
}

export interface UserReport {
  totalUsers: number;
  byRole: Record<string, number>;
  activeUsers: number;
  inactiveUsers: number;
  newUsersTrend: Array<{ date: string; count: number }>;
  userActivity: Array<Record<string, any>>;
}

export interface ComprehensiveReport {
  generated_at: string;
  generated_by: string;
  filters: ReportFilters;
  dashboard: DashboardStats;
  reports: Record<string, any>;
}

export interface ReportScheduleConfig {
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  format: 'pdf' | 'csv';
  filters?: ReportFilters;
  isActive?: boolean;
}

export interface ReportSchedule {
  id: string;
  report_type: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  format: 'pdf' | 'csv';
  filters?: Record<string, any> | null;
  is_active: boolean;
  status: 'scheduled' | 'paused' | 'failed';
  execution_strategy: string;
  last_run_at: string | null;
  next_run_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

class ReportService {
  private normalizeReportType(reportType: string): string {
    const normalized = reportType.toLowerCase();
    if (normalized === 'items') return 'inventory';
    if (normalized === 'lending') return 'lendings';
    if (normalized === 'all') return 'dashboard';
    return normalized;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/reports/dashboard');
    return response.data;
  }

  /**
   * Get trainee report
   */
  async getTraineeReport(filters?: ReportFilters): Promise<TraineeReport> {
    const response = await api.get<TraineeReport>('/reports/trainees', filters);
    return response.data;
  }

  /**
   * Get attendance analytics report
   */
  async getAttendanceReport(filters?: ReportFilters & { programId?: string; sessionId?: string }): Promise<AttendanceReport> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.programId) params.program_id = filters.programId;
    if (filters?.sessionId) params.session_id = filters.sessionId;

    const response = await api.get<AttendanceReport>('/reports/attendance', params);
    return response.data;
  }

  /**
   * Get inventory report
   * Backend endpoint: GET /api/reports/inventory
   */
  async getInventoryReport(filters?: ReportFilters): Promise<InventoryReport> {
    const response = await api.get<InventoryReport>('/reports/inventory', filters);
    return response.data;
  }

  /**
   * Get lending report
   * Backend endpoint: GET /api/reports/lendings
   */
  async getLendingReport(filters?: ReportFilters): Promise<LendingReport> {
    const response = await api.get<LendingReport>('/reports/lendings', filters);
    return response.data;
  }

  /**
   * Get program report
   */
  async getProgramReport(filters?: ReportFilters): Promise<ProgramReport> {
    const response = await api.get<ProgramReport>('/reports/programs', filters);
    return response.data;
  }

  /**
   * Get anomalies report
   * Backend endpoint: GET /api/reports/anomalies
   */
  async getAnomaliesReport(filters?: ReportFilters) {
    const response = await api.get('/reports/anomalies', filters);
    return response.data;
  }

  /**
   * Generate comprehensive report
   */
  async generateComprehensiveReport(filters?: ReportFilters): Promise<ComprehensiveReport> {
    const response = await api.post<ComprehensiveReport>('/reports/comprehensive', filters || {});
    return response.data;
  }

  /**
   * Export report to PDF
   */
  async exportReportToPDF(reportType: string, filters?: ReportFilters): Promise<void> {
    const normalizedType = this.normalizeReportType(reportType);
    await api.downloadFile(
      `/reports/${normalizedType}/pdf`,
      `${normalizedType}-report.pdf`,
      filters
    );
  }

  /**
   * Export report to CSV
   */
  async exportReportToCSV(reportType: string, filters?: ReportFilters): Promise<void> {
    const normalizedType = this.normalizeReportType(reportType);
    await api.downloadFile(
      `/reports/${normalizedType}/csv`,
      `${normalizedType}-report.csv`,
      filters
    );
  }

  /**
   * Get activity analytics
   */
  async getActivityAnalytics(filters?: ReportFilters): Promise<ActivityReport> {
    const response = await api.get<ActivityReport>('/reports/activity', filters);
    return response.data;
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(filters?: ReportFilters): Promise<UserReport> {
    const response = await api.get<UserReport>('/reports/users', filters);
    return response.data;
  }

  /**
   * Schedule automated report
   */
  async scheduleReport(config: ReportScheduleConfig): Promise<ReportSchedule> {
    const response = await api.post<ReportSchedule>('/reports/schedule', config);
    return response.data;
  }

  /**
   * Get report schedules
   */
  async getReportSchedules(filters?: {
    status?: 'scheduled' | 'paused' | 'failed';
    isActive?: boolean;
    limit?: number;
  }): Promise<ReportSchedule[]> {
    const response = await api.get<ReportSchedule[]>('/reports/schedule', filters);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Super Admin Cross-Tenant Reports
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get platform summary (Super Admin only)
   * Backend endpoint: GET /api/admin/reports/platform-summary
   */
  async getPlatformSummary(filters?: ReportFilters): Promise<PlatformSummaryReport> {
    const response = await api.get<PlatformSummaryReport>('/admin/reports/platform-summary', filters);
    return response.data;
  }

  /**
   * Get cross-tenant comparison (Super Admin only)
   * Backend endpoint: GET /api/admin/reports/cross-tenant-comparison
   */
  async getCrossTenantComparison(filters?: ReportFilters): Promise<CrossTenantComparisonReport> {
    const response = await api.get<CrossTenantComparisonReport>('/admin/reports/cross-tenant-comparison', filters);
    return response.data;
  }

  /**
   * Export platform summary to PDF (Super Admin only)
   */
  async exportPlatformSummaryPDF(filters?: ReportFilters): Promise<void> {
    await api.downloadFile(
      '/admin/reports/platform-summary?format=pdf',
      `platform-summary-${new Date().toISOString().slice(0, 10)}.pdf`,
      filters
    );
  }

  /**
   * Export platform summary to CSV (Super Admin only)
   */
  async exportPlatformSummaryCSV(filters?: ReportFilters): Promise<void> {
    await api.downloadFile(
      '/admin/reports/platform-summary?format=csv',
      `platform-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      filters
    );
  }

  /**
   * Export cross-tenant comparison to PDF (Super Admin only)
   */
  async exportCrossTenantComparisonPDF(filters?: ReportFilters): Promise<void> {
    await api.downloadFile(
      '/admin/reports/cross-tenant-comparison?format=pdf',
      `cross-tenant-comparison-${new Date().toISOString().slice(0, 10)}.pdf`,
      filters
    );
  }

  /**
   * Export cross-tenant comparison to CSV (Super Admin only)
   */
  async exportCrossTenantComparisonCSV(filters?: ReportFilters): Promise<void> {
    await api.downloadFile(
      '/admin/reports/cross-tenant-comparison?format=csv',
      `cross-tenant-comparison-${new Date().toISOString().slice(0, 10)}.csv`,
      filters
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Super Admin Report Interfaces
// ═══════════════════════════════════════════════════════════════════════

export interface PlatformSummaryReport {
  totalTenants: number;
  activeTenants: number;
  totalPrograms: number;
  totalEnrollments: number;
  totalCompletions: number;
  totalTrainees: number;
  totalItems: number;
  totalCertificates: number;
  generatedAt: string;
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
  tenantBreakdowns: Array<{
    tenantId: string;
    tenantName: string;
    status: string;
    programs: number;
    enrollments: number;
    completions: number;
    trainees: number;
    items: number;
    certificates: number;
  }>;
}

export interface CrossTenantComparisonReport {
  generatedAt: string;
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    status: string;
    programs: number;
    enrollments: number;
    completions: number;
    trainees: number;
    items: number;
    certificates: number;
    enrollmentRate: number;
    completionRate: number;
    inventoryUtilization: number;
  }>;
}

export const reportService = new ReportService();
export default reportService;
