/**
 * Activity Logger Utility
 * Tracks all user actions across the BMDC application
 */

export type ActionType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'view' 
  | 'search'
  | 'filter'
  | 'export'
  | 'login' 
  | 'logout'
  | 'scan'
  | 'upload'
  | 'download';

export type ModuleType = 
  | 'trainees' 
  | 'items' 
  | 'programs' 
  | 'lendings' 
  | 'auth'
  | 'cms'
  | 'reports'
  | 'settings'
  | 'account'
  | 'dashboard';

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: ActionType;
  module: ModuleType;
  userId: string;
  userName: string;
  userRole: string;
  details: string;
  metadata?: {
    traineeId?: string;
    itemId?: number | string;
    programId?: string;
    lendingId?: string;
    changes?: any;
    searchQuery?: string;
    filterCriteria?: any;
    exportFormat?: string;
    ipAddress?: string;
    userAgent?: string;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
    // Allow ad-hoc metadata fields (e.g., resultsCount, clearedBy)
    [key: string]: any;
  };
}

import { logger } from './logger';

const STORAGE_KEY = 'bmdc-activity-logs';
const MAX_LOGS = 10000; // Keep last 10,000 logs

/**
 * Get current user from sessionStorage
 */
function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem('bmdc-user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (error) {
    logger.error('Error getting current user from sessionStorage', { error });
  }
  return { id: 'system', name: 'System', role: 'system' };
}

/**
 * Get browser/device information
 */
function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
  };
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all activity logs
 */
export function getActivityLogs(): ActivityLog[] {
  try {
    const logsStr = sessionStorage.getItem(STORAGE_KEY);
    if (logsStr) {
      return JSON.parse(logsStr);
    }
  } catch (error) {
    logger.error('Error reading activity logs from sessionStorage', { error });
  }
  return [];
}

/**
 * Save activity logs
 */
function saveActivityLogs(logs: ActivityLog[]): void {
  try {
    // Keep only the most recent logs to prevent storage overflow
    const trimmedLogs = logs.slice(-MAX_LOGS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    logger.error('Error saving activity logs to sessionStorage', { error });
    
    // If storage is full, remove oldest logs and try again
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      const reducedLogs = logs.slice(-Math.floor(MAX_LOGS / 2));
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reducedLogs));
      } catch (retryError) {
        logger.error('Failed to save logs even after reducing size', { retryError });
      }
    }
  }
}

/**
 * Log an activity
 */
export function logActivity(
  action: ActionType,
  module: ModuleType,
  details: string,
  metadata?: ActivityLog['metadata']
): void {
  try {
    const user = getCurrentUser();
    const browserInfo = getBrowserInfo();
    
    const log: ActivityLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      action,
      module,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details,
      metadata: {
        ...metadata,
        userAgent: browserInfo.userAgent,
      },
    };
    
    const logs = getActivityLogs();
    logs.push(log);
    saveActivityLogs(logs);
    
    // Also log to console in development
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      logger.debug('Activity Logged', { action, module, details, user: user.name });
    }
  } catch (error) {
    logger.error('Error logging activity', { error });
  }
}

/**
 * Log trainee actions
 */
export const traineeLogger = {
  created: (traineeName: string, traineeId: string) => {
    logActivity('create', 'trainees', `Created trainee: ${traineeName}`, {
      traineeId,
      success: true,
    });
  },
  updated: (traineeName: string, traineeId: string, changes?: any) => {
    logActivity('update', 'trainees', `Updated trainee: ${traineeName}`, {
      traineeId,
      changes,
      success: true,
    });
  },
  deleted: (traineeName: string, traineeId: string) => {
    logActivity('delete', 'trainees', `Deleted trainee: ${traineeName}`, {
      traineeId,
      success: true,
    });
  },
  viewed: (traineeName: string, traineeId: string) => {
    logActivity('view', 'trainees', `Viewed trainee details: ${traineeName}`, {
      traineeId,
    });
  },
  searched: (query: string, resultsCount: number) => {
    logActivity('search', 'trainees', `Searched trainees: "${query}" (${resultsCount} results)`, {
      searchQuery: query,
      resultsCount,
    });
  },
  filtered: (filters: any, resultsCount: number) => {
    logActivity('filter', 'trainees', `Filtered trainees (${resultsCount} results)`, {
      filterCriteria: filters,
      resultsCount,
    });
  },
  exported: (format: string, count: number) => {
    logActivity('export', 'trainees', `Exported ${count} trainees to ${format}`, {
      exportFormat: format,
      count,
    });
  },
  photoUploaded: (traineeName: string, traineeId: string) => {
    logActivity('upload', 'trainees', `Uploaded photo for trainee: ${traineeName}`, {
      traineeId,
      success: true,
    });
  },
};

/**
 * Log item/inventory actions
 */
export const itemLogger = {
  created: (itemName: string, itemId: string | number) => {
    logActivity('create', 'items', `Created item: ${itemName}`, {
      itemId: itemId.toString(),
      success: true,
    });
  },
  updated: (itemName: string, itemId: string | number, changes?: any) => {
    logActivity('update', 'items', `Updated item: ${itemName}`, {
      itemId: itemId.toString(),
      changes,
      success: true,
    });
  },
  deleted: (itemName: string, itemId: string | number) => {
    logActivity('delete', 'items', `Deleted item: ${itemName}`, {
      itemId: itemId.toString(),
      success: true,
    });
  },
  viewed: (itemName: string, itemId: string | number) => {
    logActivity('view', 'items', `Viewed item details: ${itemName}`, {
      itemId: itemId.toString(),
    });
  },
  searched: (query: string, resultsCount: number) => {
    logActivity('search', 'items', `Searched items: "${query}" (${resultsCount} results)`, {
      searchQuery: query,
      resultsCount,
    });
  },
  filtered: (filters: any, resultsCount: number) => {
    logActivity('filter', 'items', `Filtered items (${resultsCount} results)`, {
      filterCriteria: filters,
      resultsCount,
    });
  },
  scanned: (itemName: string, itemId: string | number) => {
    logActivity('scan', 'items', `Scanned QR code for item: ${itemName}`, {
      itemId: itemId.toString(),
    });
  },
};

/**
 * Log program actions
 */
export const programLogger = {
  created: (programName: string, programId: string) => {
    logActivity('create', 'programs', `Created program: ${programName}`, {
      programId,
      success: true,
    });
  },
  updated: (programName: string, programId: string, changes?: any) => {
    logActivity('update', 'programs', `Updated program: ${programName}`, {
      programId,
      changes,
      success: true,
    });
  },
  deleted: (programName: string, programId: string) => {
    logActivity('delete', 'programs', `Deleted program: ${programName}`, {
      programId,
      success: true,
    });
  },
  viewed: (programName: string, programId: string) => {
    logActivity('view', 'programs', `Viewed program details: ${programName}`, {
      programId,
    });
  },
  statusChanged: (programName: string, programId: string, oldStatus: string, newStatus: string) => {
    logActivity('update', 'programs', `Program "${programName}" status changed from ${oldStatus} to ${newStatus}`, {
      programId,
      changes: { status: { old: oldStatus, new: newStatus } },
    });
  },
  searched: (query: string, resultsCount: number) => {
    logActivity('search', 'programs', `Searched programs: "${query}" (${resultsCount} results)`, {
      searchQuery: query,
      resultsCount,
    });
  },
  filtered: (filters: any, resultsCount: number) => {
    logActivity('filter', 'programs', `Filtered programs (${resultsCount} results)`, {
      filterCriteria: filters,
      resultsCount,
    });
  },
};

/**
 * Log lending actions
 */
export const lendingLogger = {
  created: (traineeName: string, itemName: string, lendingId: string) => {
    logActivity('create', 'lendings', `Lent "${itemName}" to ${traineeName}`, {
      lendingId,
      success: true,
    });
  },
  returned: (traineeName: string, itemName: string, lendingId: string) => {
    logActivity('update', 'lendings', `${traineeName} returned "${itemName}"`, {
      lendingId,
      changes: { status: 'returned' },
      success: true,
    });
  },
  deleted: (traineeName: string, itemName: string, lendingId: string) => {
    logActivity('delete', 'lendings', `Deleted lending record: "${itemName}" to ${traineeName}`, {
      lendingId,
      success: true,
    });
  },
  viewed: (traineeName: string, itemName: string, lendingId: string) => {
    logActivity('view', 'lendings', `Viewed lending: "${itemName}" to ${traineeName}`, {
      lendingId,
    });
  },
  overdue: (traineeName: string, itemName: string, lendingId: string) => {
    logActivity('update', 'lendings', `Lending marked overdue: "${itemName}" to ${traineeName}`, {
      lendingId,
      changes: { status: 'overdue' },
    });
  },
  searched: (query: string, resultsCount: number) => {
    logActivity('search', 'lendings', `Searched lendings: "${query}" (${resultsCount} results)`, {
      searchQuery: query,
      resultsCount,
    });
  },
  filtered: (filters: any, resultsCount: number) => {
    logActivity('filter', 'lendings', `Filtered lendings (${resultsCount} results)`, {
      filterCriteria: filters,
      resultsCount,
    });
  },
};

/**
 * Log authentication actions
 */
export const authLogger = {
  login: (userName: string, userId: string, userRole: string) => {
    logActivity('login', 'auth', `User logged in: ${userName} (${userRole})`, {
      userId,
      userRole,
      success: true,
    });
  },
  loginFailed: (email: string, reason: string) => {
    logActivity('login', 'auth', `Failed login attempt: ${email} - ${reason}`, {
      success: false,
      errorMessage: reason,
    });
  },
  logout: (userName: string, userId: string) => {
    logActivity('logout', 'auth', `User logged out: ${userName}`, {
      userId,
      success: true,
    });
  },
};

/**
 * Log CMS actions
 */
export const cmsLogger = {
  updated: (section: string, changes?: any) => {
    logActivity('update', 'cms', `Updated CMS section: ${section}`, {
      changes,
      success: true,
    });
  },
  viewed: (section: string) => {
    logActivity('view', 'cms', `Viewed CMS settings: ${section}`, {});
  },
};

/**
 * Log report actions
 */
export const reportLogger = {
  generated: (reportType: string, filters?: any) => {
    logActivity('view', 'reports', `Generated ${reportType} report`, {
      filterCriteria: filters,
    });
  },
  exported: (reportType: string, format: string) => {
    logActivity('export', 'reports', `Exported ${reportType} report as ${format}`, {
      exportFormat: format,
    });
  },
};

/**
 * Log dashboard actions
 */
export const dashboardLogger = {
  viewed: () => {
    logActivity('view', 'dashboard', 'Viewed dashboard', {});
  },
};

/**
 * Log settings actions
 */
export const settingsLogger = {
  updated: (setting: string, changes?: any) => {
    logActivity('update', 'settings', `Updated setting: ${setting}`, {
      changes,
      success: true,
    });
  },
  viewed: () => {
    logActivity('view', 'settings', 'Viewed settings page', {});
  },
};

/**
 * Log account management actions
 */
export const accountLogger = {
  userCreated: (userName: string, userId: string, role: string) => {
    logActivity('create', 'account', `Created user account: ${userName} (${role})`, {
      userId,
      role,
      success: true,
    });
  },
  userUpdated: (userName: string, userId: string, changes?: any) => {
    logActivity('update', 'account', `Updated user account: ${userName}`, {
      userId,
      changes,
      success: true,
    });
  },
  userDeleted: (userName: string, userId: string) => {
    logActivity('delete', 'account', `Deleted user account: ${userName}`, {
      userId,
      success: true,
    });
  },
  passwordChanged: (userName: string, userId: string) => {
    logActivity('update', 'account', `Changed password for: ${userName}`, {
      userId,
      success: true,
    });
  },
};

/**
 * Get logs filtered by criteria
 */
export function getFilteredLogs(filters: {
  action?: ActionType;
  module?: ModuleType;
  userId?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}): ActivityLog[] {
  let logs = getActivityLogs();
  
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  
  if (filters.module) {
    logs = logs.filter(log => log.module === filters.module);
  }
  
  if (filters.userId) {
    logs = logs.filter(log => log.userId === filters.userId);
  }
  
  if (filters.startDate) {
    logs = logs.filter(log => log.timestamp >= filters.startDate!);
  }
  
  if (filters.endDate) {
    logs = logs.filter(log => log.timestamp <= filters.endDate!);
  }
  
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    logs = logs.filter(log => 
      log.details.toLowerCase().includes(query) ||
      log.userName.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.module.toLowerCase().includes(query)
    );
  }
  
  return logs.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get activity statistics
 */
export function getActivityStats() {
  const logs = getActivityLogs();
  
  const stats = {
    total: logs.length,
    byAction: {} as Record<ActionType, number>,
    byModule: {} as Record<ModuleType, number>,
    byUser: {} as Record<string, number>,
    recentActivity: logs.slice(-10).reverse(),
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
  };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  logs.forEach(log => {
    // By action
    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    
    // By module
    stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1;
    
    // By user
    stats.byUser[log.userName] = (stats.byUser[log.userName] || 0) + 1;
    
    // Time-based counts
    const logDate = new Date(log.timestamp);
    if (logDate >= today) stats.todayCount++;
    if (logDate >= weekAgo) stats.weekCount++;
    if (logDate >= monthAgo) stats.monthCount++;
  });
  
  return stats;
}

/**
 * Export logs to JSON
 */
export function exportLogsToJSON(): string {
  const logs = getActivityLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Export logs to CSV
 */
export function exportLogsToCSV(): string {
  const logs = getActivityLogs();
  
  if (logs.length === 0) {
    return 'No logs to export';
  }
  
  const headers = ['Timestamp', 'Action', 'Module', 'User', 'Role', 'Details'];
  const rows = logs.map(log => [
    log.timestamp,
    log.action,
    log.module,
    log.userName,
    log.userRole,
    log.details,
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  return csv;
}

/**
 * Clear all logs (admin only)
 */
export function clearAllLogs(): void {
  const user = getCurrentUser();
  
  // Log the clearing action before clearing
  logActivity('delete', 'settings', `Cleared all activity logs (${getActivityLogs().length} logs)`, {
    clearedBy: user.id,
    success: true,
  });
  
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Clear old logs (keep only last N days)
 */
export function clearOldLogs(daysToKeep: number = 90): void {
  const logs = getActivityLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const filteredLogs = logs.filter(
    log => new Date(log.timestamp) >= cutoffDate
  );
  
  const removedCount = logs.length - filteredLogs.length;
  
  saveActivityLogs(filteredLogs);
  
  logActivity('delete', 'settings', `Cleared ${removedCount} old logs (kept last ${daysToKeep} days)`, {
    daysToKeep,
    removedCount,
    success: true,
  });
}