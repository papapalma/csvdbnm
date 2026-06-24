import api from './api';

/**
 * Activity Log API Service
 * All activity logging API calls
 */

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  // Cross-tenant fields
  tenantId?: string | null;
  tenantName?: string | null;
  scope?: 'platform' | 'tenant';
}

export interface ActivityFilters {
  userId?: string;
  action?: string;
  module?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
  // Cross-tenant filters
  tenantId?: string;
}

export interface ActivityStats {
  totalActions: number;
  uniqueUsers: number;
  actionsByModule: Record<string, number>;
  recentActivity: ActivityLog[];
}

class ActivityLogService {
  /**
   * Get all activity logs
   */
  async getActivityLogs(filters?: ActivityFilters): Promise<ActivityLog[]> {
    const response = await api.get<ActivityLog[]>('/activity-logs', filters);
    return response.data ?? [];
  }

  /**
   * Get activity log by ID
   * TODO: Backend endpoint not yet implemented
   */
  async getActivityLogById(_id: string): Promise<ActivityLog> {
    // const response = await api.get<ActivityLog>(`/activity-logs/${id}`);
    // return response.data;
    throw new Error('Activity log by ID endpoint not yet implemented in backend');
  }

  /**
   * Create activity log
   * TODO: Backend endpoint not yet implemented
   */
  async createActivityLog(data: {
    action: string;
    module: string;
    entityType?: string;
    entityId?: string;
    description: string;
    metadata?: any;
  }): Promise<ActivityLog> {
    void data;
    // const response = await api.post<ActivityLog>('/activity-logs', data);
    // return response.data;
    throw new Error('Create activity log endpoint not yet implemented in backend');
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(startDate?: string, endDate?: string): Promise<ActivityStats> {
    const response = await api.get<ActivityStats>('/activity-logs/stats', {
      startDate,
      endDate,
    });
    return response.data;
  }

  /**
   * Get user activity
   * TODO: Backend endpoint not yet implemented
   */
  async getUserActivity(_userId: string, _limit?: number) {
    // const response = await api.get<ActivityLog[]>(`/activity-logs/user/${userId}`, { limit });
    // return response.data;
    throw new Error('User activity endpoint not yet implemented in backend');
  }

  /**
   * Get entity activity
   * TODO: Backend endpoint not yet implemented
   */
  async getEntityActivity(_entityType: string, _entityId: string) {
    // const response = await api.get<ActivityLog[]>(
    //   `/activity-logs/entity/${entityType}/${entityId}`
    // );
    // return response.data;
    throw new Error('Entity activity endpoint not yet implemented in backend');
  }

  /**
   * Export activity logs to CSV
   * TODO: Backend endpoint not yet implemented
   */
  async exportActivityLogs(_filters?: ActivityFilters): Promise<void> {
    // await api.downloadFile('/activity-logs/export', 'activity-logs.csv', filters);
    throw new Error('Export activity logs endpoint not yet implemented in backend');
  }

  /**
   * Clear old activity logs
   * TODO: Backend endpoint not yet implemented
   */
  async clearOldLogs(_olderThanDays: number): Promise<{ deleted: number }> {
    // const response = await api.delete<{ deleted: number }>('/activity-logs/clear', {
    //   params: { olderThanDays },
    // });
    // return response.data;
    throw new Error('Clear old logs endpoint not yet implemented in backend');
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
