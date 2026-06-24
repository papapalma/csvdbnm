import api from './api';

/**
 * Authentication API Service
 * All authentication-related API calls
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    tenantId?: string;
    tenantName?: string;
  };
  token: string;
  refreshToken?: string;
}

export interface TenantSelectionResponse {
  requires_tenant_selection: true;
  selection_token: string;
  tenants: Array<{ id: string; name: string; is_primary: boolean }>;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export type LoginResponse = AuthResponse | TenantSelectionResponse;

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

class AuthService {
  /**
   * Login user — returns either a full AuthResponse or a TenantSelectionResponse
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    // Token is transmitted via HttpOnly cookie set by the backend (SEC-4).
    // Do NOT store it in localStorage — that would expose it to XSS.
    return response.data;
  }

  /**
   * Select tenant after multi-tenant login prompt
   */
  async selectTenant(selectionToken: string, tenantId: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/select-tenant', {
      selection_token: selectionToken,
      tenant_id: tenantId,
    });
    return response.data;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    // Token is transmitted via HttpOnly cookie — do NOT store in localStorage.
    return response.data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout'); // backend clears the HttpOnly cookie
    } catch {
      // Ignore errors — still clear client-side user cache
    } finally {
      // Remove only the non-sensitive user profile cache.
      sessionStorage.removeItem('bmdc-user');
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<{ token: string }> {
    const response = await api.post<{ token: string }>('/auth/refresh');
    return response.data;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', {
      token,
      newPassword,
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    // Can no longer check the HttpOnly cookie from JS.
    // Use the presence of user profile data as a proxy.
    return !!sessionStorage.getItem('bmdc-user');
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    // Auth tokens are HttpOnly cookies and are intentionally not accessible from JS.
    return null;
  }
}

export const authService = new AuthService();
export default authService;
