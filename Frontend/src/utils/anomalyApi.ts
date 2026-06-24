import { Anomaly, AnomalyFilters, ResolutionRequest, DetectionRun, AnomalySummary, PaginatedAnomalies } from '../types/anomaly';
import { anomalyService } from '../services/anomalyService';
import logger from './logger';

// Fetch anomalies with optional filters
export async function fetchAnomalies(
  filters?: AnomalyFilters,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedAnomalies> {
  try {
    return await anomalyService.getAnomalies(filters, page, limit);
  } catch (error) {
    logger.error('Error fetching anomalies', { error, filters, page, limit });
    throw error;
  }
}

// Get anomaly by ID
export async function getAnomalyById(id: string): Promise<Anomaly | null> {
  try {
    return await anomalyService.getAnomalyById(id);
  } catch (error) {
    logger.error('Error fetching anomaly', { error, id });
    return null;
  }
}

// Get anomaly summary statistics
export async function getAnomalySummary(): Promise<AnomalySummary> {
  try {
    return await anomalyService.getAnomalySummary();
  } catch (error) {
    logger.error('Error fetching anomaly summary', { error });
    throw error;
  }
}

// Resolve an anomaly
export async function resolveAnomaly(id: string, resolution: ResolutionRequest): Promise<Anomaly> {
  try {
    return await anomalyService.resolveAnomaly(id, resolution);
  } catch (error) {
    logger.error('Error resolving anomaly', { error, id });
    throw error;
  }
}

// Reopen an anomaly
export async function reopenAnomaly(id: string): Promise<Anomaly> {
  return await anomalyService.reopenAnomaly(id);
}

// Trigger manual detection scan
export async function triggerManualScan(): Promise<DetectionRun> {
  try {
    return await anomalyService.triggerManualScan();
  } catch (error) {
    logger.error('Error triggering manual scan', { error });
    throw error;
  }
}

// Get recent detection runs
export async function getDetectionRuns(limit: number = 10): Promise<DetectionRun[]> {
  try {
    return await anomalyService.getDetectionRuns(limit);
  } catch (error) {
    logger.error('Error fetching detection runs', { error, limit });
    return [];
  }
}

// Export anomalies to CSV (client-side generation)
export function exportAnomaliesToCSV(anomalies: Anomaly[]): string {
  const headers = ['ID', 'Category', 'Type', 'Severity', 'Status', 'Description', 'Entity', 'Detected At', 'Resolution Notes'];
  const rows = anomalies.map(a => [
    a.id,
    a.category,
    a.anomaly_type,
    a.severity,
    a.status,
    a.description,
    a.entity_identifier || 'N/A',
    new Date(a.detected_at).toLocaleString(),
    a.resolution_notes || 'N/A'
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

// Helper function to get severity badge color
export function getSeverityColor(severity: 'critical' | 'warning' | 'info'): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'info':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }
}

// Helper function to get status badge color
export function getStatusColor(status: 'open' | 'in_progress' | 'resolved' | 'dismissed'): string {
  switch (status) {
    case 'open':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'resolved':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'dismissed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

// Helper function to format category name
export function formatCategoryName(category: string): string {
  return category.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Helper function to get category icon
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    trainee: '👤',
    inventory: '📦',
    lending: '📋',
    program: '🎓',
    activity_log: '📊',
    system: '⚙️'
  };
  return icons[category] || '❓';
}
