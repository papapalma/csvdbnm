// Role names match the backend database CHECK constraint exactly:
// 'super_admin' | 'local_admin' | 'staff_training_coordinator' | 'staff_inventory_manager' | 'trainee'
export type UserRole =
  | 'super_admin'
  | 'local_admin'
  | 'staff_training_coordinator'
  | 'staff_inventory_manager'
  | 'trainee';

export interface Permission {
  canManageTrainees: boolean;
  canManageItems: boolean;
  canManageLendings: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canDeleteRecords: boolean;
  canScanQR: boolean;
  canManagePrograms: boolean;
  canManageCMS: boolean;
  canManageAccounts: boolean;
  canViewAnomalies: boolean;
  canResolveAnomalies: boolean;
  canConfigureDetection: boolean;
  canExportAnomalies: boolean;
  canTriggerDetection: boolean;
  canViewActivityLogs: boolean;
  canExportActivityLogs: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  super_admin: {
    canManageTrainees: true,
    canManageItems: true,
    canManageLendings: true,
    canViewReports: true,
    canManageSettings: true,
    canDeleteRecords: true,
    canScanQR: true,
    canManagePrograms: true,
    canManageCMS: true,
    canManageAccounts: true,
    canViewAnomalies: true,
    canResolveAnomalies: true,
    canConfigureDetection: true,
    canExportAnomalies: true,
    canTriggerDetection: true,
    canViewActivityLogs: true,
    canExportActivityLogs: true,
  },
  local_admin: {
    canManageTrainees: true,
    canManageItems: true,
    canManageLendings: true,
    canViewReports: true,
    canManageSettings: true,
    canDeleteRecords: true,
    canScanQR: true,
    canManagePrograms: true,
    canManageCMS: true,
    canManageAccounts: true,
    canViewAnomalies: true,
    canResolveAnomalies: true,
    canConfigureDetection: true,
    canExportAnomalies: true,
    canTriggerDetection: true,
    canViewActivityLogs: true,
    canExportActivityLogs: true,
  },
  staff_training_coordinator: {
    canManageTrainees: true,
    canManageItems: false,
    canManageLendings: false,
    canViewReports: true,
    canManageSettings: true,
    canDeleteRecords: false,
    canScanQR: true,
    canManagePrograms: true,
    canManageCMS: false,
    canManageAccounts: false,
    canViewAnomalies: false,
    canResolveAnomalies: false,
    canConfigureDetection: false,
    canExportAnomalies: false,
    canTriggerDetection: false,
    canViewActivityLogs: false,
    canExportActivityLogs: false,
  },
  staff_inventory_manager: {
    canManageTrainees: false,
    canManageItems: true,
    canManageLendings: true,
    canViewReports: true,
    canManageSettings: true,
    canDeleteRecords: false,
    canScanQR: true,
    canManagePrograms: false,
    canManageCMS: false,
    canManageAccounts: false,
    canViewAnomalies: false,
    canResolveAnomalies: false,
    canConfigureDetection: false,
    canExportAnomalies: false,
    canTriggerDetection: false,
    canViewActivityLogs: false,
    canExportActivityLogs: false,
  },
  trainee: {
    canManageTrainees: false,
    canManageItems: false,
    canManageLendings: false,
    canViewReports: false,
    canManageSettings: false,
    canDeleteRecords: false,
    canScanQR: false,
    canManagePrograms: false,
    canManageCMS: false,
    canManageAccounts: false,
    canViewAnomalies: false,
    canResolveAnomalies: false,
    canConfigureDetection: false,
    canExportAnomalies: false,
    canTriggerDetection: false,
    canViewActivityLogs: false,
    canExportActivityLogs: false,
  },
};

export function getRolePermissions(role: UserRole): Permission {
  return ROLE_PERMISSIONS[role] ?? {
    canManageTrainees: false,
    canManageItems: false,
    canManageLendings: false,
    canViewReports: false,
    canManageSettings: false,
    canDeleteRecords: false,
    canScanQR: false,
    canManagePrograms: false,
    canManageCMS: false,
    canManageAccounts: false,
    canViewAnomalies: false,
    canResolveAnomalies: false,
    canConfigureDetection: false,
    canExportAnomalies: false,
    canTriggerDetection: false,
    canViewActivityLogs: false,
    canExportActivityLogs: false,
  };
}

export function getRoleBadgeColor(role: UserRole | string): string {
  switch (role) {
    case 'super_admin':
      return 'bg-purple-600 text-white border-purple-700';
    case 'local_admin':
      return 'bg-primary text-primary-foreground';
    case 'staff_training_coordinator':
      return 'bg-secondary text-secondary-foreground';
    case 'staff_inventory_manager':
      return 'bg-accent text-accent-foreground';
    case 'trainee':
      return 'bg-blue-600 text-white border-blue-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getRoleDisplayName(role: UserRole | string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'local_admin':
      return 'Local Admin';
    case 'staff_training_coordinator':
      return 'Staff (Trainees)';
    case 'staff_inventory_manager':
      return 'Staff (Inventory)';
    case 'trainee':
      return 'Trainee';
    default:
      return role;
  }
}
