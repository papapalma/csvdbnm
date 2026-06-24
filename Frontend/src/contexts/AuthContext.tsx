import { createContext, useContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { UserRole, getRolePermissions, Permission } from '../utils/roles';
import { authLogger } from '../utils/activityLogger';
import authService, { TenantSelectionResponse } from '../services/authService';
import { logger } from '../utils/logger';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  tenantId?: string;
  tenantName?: string;
}

/** Returned by login() when the backend requires tenant selection */
export interface TenantSelectionRequired {
  requiresTenantSelection: true;
  selectionToken: string;
  tenants: Array<{ id: string; name: string; is_primary: boolean }>;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean | TenantSelectionRequired>;
  selectTenant: (selectionToken: string, tenantId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  permissions: Permission;
  hasPermission: (permission: keyof Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: Permission = {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('bmdc-user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    let mounted = true;
    const savedUser = sessionStorage.getItem('bmdc-user');

    // Only probe /auth/me when the client already has a cached session.
    if (!savedUser) {
      setUser(null);
      return () => {
        mounted = false;
      };
    }

    authService.getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;

        const existing = savedUser ? JSON.parse(savedUser) : {};
        const userData: User = {
          id: currentUser.id,
          name: currentUser.username,
          email: currentUser.email,
          role: currentUser.role as UserRole,
          tenantId: existing.tenantId,
          tenantName: existing.tenantName,
        };

        setUser(userData);
        sessionStorage.setItem('bmdc-user', JSON.stringify(userData));
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        sessionStorage.removeItem('bmdc-user');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const permissions = useMemo(() => {
    if (!user || !user.role) {
      return DEFAULT_PERMISSIONS;
    }
    return getRolePermissions(user.role);
  }, [user]);

  const hasPermission = (permission: keyof Permission): boolean => {
    if (!user || !user.role) {
      return false;
    }
    const userPermissions = getRolePermissions(user.role);
    return userPermissions?.[permission] ?? false;
  };

  const login = async (email: string, password: string): Promise<boolean | TenantSelectionRequired> => {
    try {
      const response = await authService.login({ email, password });

      // Multi-tenant selection required
      if ('requires_tenant_selection' in response && response.requires_tenant_selection) {
        const tenantResp = response as TenantSelectionResponse;
        return {
          requiresTenantSelection: true,
          selectionToken: tenantResp.selection_token,
          tenants: tenantResp.tenants,
        };
      }

      // Single-tenant direct login
      const userData: User = {
        id: response.user.id,
        name: response.user.username,
        email: response.user.email,
        role: response.user.role as UserRole,
        tenantId: response.user.tenantId,
        tenantName: response.user.tenantName,
      };

      setUser(userData);
      sessionStorage.setItem('bmdc-user', JSON.stringify(userData));

      authLogger.login(userData.name, userData.id, userData.role);

      return true;
    } catch (error) {
      logger.error('Login error', { error });
      authLogger.loginFailed(email, 'Invalid credentials');
      return false;
    }
  };

  const selectTenant = async (selectionToken: string, tenantId: string): Promise<boolean> => {
    try {
      const response = await authService.selectTenant(selectionToken, tenantId);

      const userData: User = {
        id: response.user.id,
        name: response.user.username,
        email: response.user.email,
        role: response.user.role as UserRole,
        tenantId: response.user.tenantId,
        tenantName: response.user.tenantName,
      };

      setUser(userData);
      sessionStorage.setItem('bmdc-user', JSON.stringify(userData));

      authLogger.login(userData.name, userData.id, userData.role);

      return true;
    } catch (error) {
      logger.error('Tenant selection error', { error });
      return false;
    }
  };

  const logout = async () => {
    if (user) {
      authLogger.logout(user.name, user.id);
    }

    await authService.logout();
    setUser(null);
    sessionStorage.removeItem('bmdc-user');
  };

  return (
    <AuthContext.Provider value={{ user, login, selectTenant, logout, isAuthenticated: !!user, permissions, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
