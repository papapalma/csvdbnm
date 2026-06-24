// Data Anomaly Detection Types
export type AnomalyCategory = 'trainee' | 'inventory' | 'lending' | 'program' | 'activity_log' | 'system';
export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type AnomalyStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type TriggerType = 'scheduled' | 'manual';
export type ResolutionType = 'auto_fix' | 'manual' | 'dismiss';

export interface Anomaly {
  id: string;
  category: AnomalyCategory;
  anomaly_type: string;
  severity: AnomalySeverity;
  entity_type: string;
  entity_id: string | null;
  entity_identifier: string | null;
  description: string;
  detection_logic: string | null;
  recommendation: string | null;
  metadata: Record<string, any> | null;
  status: AnomalyStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  auto_resolved: boolean;
  detected_at: string;
  first_occurrence_at: string | null;
  last_occurrence_at: string | null;
  occurrence_count: number;
  detection_run_id: string | null;
}

export interface DetectionRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_anomalies_found: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  trigger_type: TriggerType;
  triggered_by: string | null;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  config_snapshot: Record<string, any> | null;
}

export interface DetectionConfig {
  id: string;
  config_key: string;
  config_value: Record<string, any>;
  description: string | null;
  updated_at: string;
  updated_by: string;
}

export interface AnomalyFilters {
  category?: AnomalyCategory[];
  severity?: AnomalySeverity[];
  status?: AnomalyStatus[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export interface ResolutionRequest {
  resolution_type: ResolutionType;
  resolution_notes: string;
}

export interface AnomalySummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  open: number;
  in_progress: number;
  resolved: number;
  dismissed: number;
}

export interface AnomalyPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedAnomalies {
  items: Anomaly[];
  pagination: AnomalyPagination;
}

export interface CategoryCount {
  category: AnomalyCategory;
  count: number;
}

export interface TrendDataPoint {
  date: string;
  critical: number;
  warning: number;
  info: number;
  total: number;
}
