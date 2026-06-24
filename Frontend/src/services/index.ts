/**
 * Central API Services Export
 * All API services in one place for easy importing
 */

// Core API
export { default as api, apiClient, API_BASE_URL } from './api';
export type { ApiResponse, ApiError } from './api';

// Authentication Service
export { default as authService } from './authService';
export type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  User,
} from './authService';

// Trainee Service
export { default as traineeService } from './traineeService';
export type {
  Trainee,
  CreateTraineeData,
  UpdateTraineeData,
  TraineeFilters,
} from './traineeService';

// Inventory Service
export { default as inventoryService } from './inventoryService';
export type {
  InventoryItem,
  CreateInventoryData,
  UpdateInventoryData,
  InventoryFilters,
} from './inventoryService';

// Lending Service
export { default as lendingService } from './lendingService';
export type {
  LendingRecord,
  CreateLendingData,
  ReturnLendingData,
  LendingFilters,
} from './lendingService';

// Program Service
export { default as programService } from './programService';
export type {
  Program,
  CreateProgramData,
  UpdateProgramData,
  ProgramFilters,
} from './programService';

// Anomaly Service
export { default as anomalyService } from './anomalyService';

// Activity Log Service
export { default as activityLogService } from './activityLogService';
export type {
  ActivityLog,
  ActivityFilters,
  ActivityStats,
} from './activityLogService';

// Report Service
export { default as reportService } from './reportService';
export type {
  ReportFilters,
  DashboardStats,
  TraineeReport,
  InventoryReport,
  LendingReport,
  ProgramReport,
} from './reportService';

/**
 * Usage Examples:
 * 
 * // Import specific service
 * import { traineeService } from '@/services';
 * const trainees = await traineeService.getTrainees();
 * 
 * // Import multiple services
 * import { authService, inventoryService } from '@/services';
 * 
 * // Import types
 * import type { Trainee, CreateTraineeData } from '@/services';
 * 
 * // Import core API for custom calls
 * import { api } from '@/services';
 * const response = await api.get('/custom-endpoint');
 */
