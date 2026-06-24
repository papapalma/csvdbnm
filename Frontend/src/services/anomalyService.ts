import api, { ApiResponse } from './api';
import {
  Anomaly,
  AnomalyFilters,
  ResolutionRequest,
  DetectionRun,
  DetectionConfig,
  AnomalySummary,
  PaginatedAnomalies,
} from '../types/anomaly';

/**
 * Anomaly Detection API Service
 * All data quality anomaly detection API calls
 */

class AnomalyService {
  /**
   * Get all anomalies with filters
   */
  async getAnomalies(
    filters?: AnomalyFilters,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedAnomalies> {
    const params: Record<string, string> = {};
    if (filters?.category?.length) params.category = filters.category.join(',');
    if (filters?.severity?.length) params.severity = filters.severity.join(',');
    if (filters?.status?.length) params.status = filters.status.join(',');
    if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters?.dateTo) params.dateTo = filters.dateTo;
    if (filters?.searchQuery) params.search = filters.searchQuery;
    params.page = String(page);
    params.limit = String(limit);

    const response = await api.get<Anomaly[]>('/anomalies', params) as ApiResponse<Anomaly[]>;
    return {
      items: response.data || [],
      pagination: {
        page: response.pagination?.page || page,
        limit: response.pagination?.limit || limit,
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 1,
      },
    };
  }

  /**
   * Get anomaly by ID
   */
  async getAnomalyById(id: string): Promise<Anomaly> {
    const response = await api.get<Anomaly>(`/anomalies/${id}`);
    return response.data;
  }

  /**
   * Get anomaly summary statistics
   */
  async getAnomalySummary(): Promise<AnomalySummary> {
    const response = await api.get<AnomalySummary>('/anomalies/summary');
    return response.data;
  }

  /**
   * Resolve an anomaly
   */
  async resolveAnomaly(id: string, resolution: ResolutionRequest): Promise<Anomaly> {
    const response = await api.post<Anomaly>(`/anomalies/${id}/resolve`, resolution);
    return response.data;
  }

  /**
   * Reopen a resolved or dismissed anomaly
   */
  async reopenAnomaly(id: string): Promise<Anomaly> {
    const response = await api.post<Anomaly>(`/anomalies/${id}/reopen`);
    return response.data;
  }

  /**
   * Trigger manual detection scan
   * Runs all anomaly detection checks
   */
  async triggerManualScan(): Promise<DetectionRun> {
    const response = await api.post<DetectionRun>('/anomalies/scan');
    return response.data;
  }

  /**
   * Get detection configuration
   */
  async getDetectionConfig(): Promise<DetectionConfig> {
    const response = await api.get<DetectionConfig>('/anomalies/config');
    return response.data;
  }

  /**
   * Update detection configuration
   */
  async updateDetectionConfig(config: Partial<DetectionConfig>): Promise<DetectionConfig> {
    const response = await api.put<DetectionConfig>('/anomalies/config', config);
    return response.data;
  }

  /**
   * Get detection run history
   */
  async getDetectionRuns(limit?: number): Promise<DetectionRun[]> {
    const response = await api.get<DetectionRun[]>('/anomalies/runs', limit ? { limit } : undefined);
    return response.data;
  }

  /**
   * Get detection run by ID
   */
  async getDetectionRunById(id: string): Promise<DetectionRun> {
    const response = await api.get<DetectionRun>(`/anomalies/runs/${id}`);
    return response.data;
  }

  /**
   * Export anomalies to CSV
   */
  async exportAnomaliesToCSV(anomalies: Anomaly[]): Promise<string> {
    const ids = anomalies.map((anomaly) => anomaly.id);
    const response = await api.post<{ csv: string }>('/anomalies/export', { ids });
    return response.data.csv;
  }

  /**
   * Get anomalies by category
   */
  async getAnomaliesByCategory(category: string): Promise<Anomaly[]> {
    const response = await api.get<Anomaly[]>('/anomalies', { category });
    return response.data;
  }

  /**
   * Get anomalies by severity
   */
  async getAnomaliesBySeverity(severity: string): Promise<Anomaly[]> {
    const response = await api.get<Anomaly[]>('/anomalies', { severity });
    return response.data;
  }

  /**
   * Get anomalies by entity
   */
  async getAnomaliesByEntity(entityType: string, entityId: string): Promise<Anomaly[]> {
    const response = await api.get<Anomaly[]>('/anomalies', { entityType, entityId });
    return response.data;
  }

  /**
   * Dismiss multiple anomalies
   */
  async dismissAnomalies(ids: string[], reason: string): Promise<void> {
    await api.post('/anomalies/dismiss-bulk', { ids, reason });
  }

  /**
   * Auto-resolve anomalies
   */
  async autoResolveAnomalies(category?: string): Promise<{ resolved: number }> {
    const response = await api.post<{ resolved: number }>('/anomalies/auto-resolve', category ? { category } : {});
    return response.data;
  }
}

export const anomalyService = new AnomalyService();
export default anomalyService;
