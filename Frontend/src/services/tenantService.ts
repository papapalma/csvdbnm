import api from './api';

/**
 * Tenant Management API Service
 * Super Admin operations for managing tenants across the platform.
 */

export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  configuration?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantData {
  name: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
}

export interface PlatformSummary {
  totalTenants: number;
  activeTenants: number;
  totalPrograms: number;
  totalTrainees: number;
  totalItems: number;
  tenantBreakdowns?: Array<{
    tenantId: string;
    tenantName: string;
    programs: number;
    trainees: number;
    items: number;
  }>;
}

class TenantService {
  /**
   * Get all tenants (Super Admin only).
   * Backend returns: { success, data: Tenant[] }
   * api.get returns the parsed body, so .data is Tenant[].
   */
  async getTenants(): Promise<{ data: Tenant[] }> {
    const response = await api.get<Tenant[]>('/admin/tenants');
    // response is { success, data: Tenant[] }
    return { data: response.data || [] };
  }

  /**
   * Get a single tenant by ID.
   */
  async getTenantById(id: string): Promise<Tenant> {
    const response = await api.get<Tenant>(`/admin/tenants/${id}`);
    return response.data;
  }

  /**
   * Create a new tenant.
   */
  async createTenant(data: CreateTenantData): Promise<Tenant> {
    const response = await api.post<Tenant>('/admin/tenants', {
      name: data.name,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      address: data.address,
      adminEmail: data.adminEmail,
      adminUsername: data.adminUsername,
      adminPassword: data.adminPassword,
    });
    return response.data;
  }

  /**
   * Deactivate a tenant.
   */
  async deactivateTenant(id: string): Promise<void> {
    await api.patch(`/admin/tenants/${id}/deactivate`);
  }

  /**
   * Reactivate a tenant.
   */
  async reactivateTenant(id: string): Promise<void> {
    await api.patch(`/admin/tenants/${id}/reactivate`);
  }

  /**
   * Get platform-wide aggregated stats (Super Admin only).
   * Backend returns: { success, data: PlatformSummary }
   */
  async getPlatformSummary(): Promise<PlatformSummary> {
    const response = await api.get<PlatformSummary>('/admin/reports/platform-summary');
    return response.data;
  }

  /**
   * Update tenant configuration (Local Admin).
   */
  async updateTenantConfiguration(
    tenantId: string,
    config: {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      welcomeMessage?: string;
    }
  ): Promise<void> {
    await api.patch(`/tenants/${tenantId}/configuration`, config);
  }
}

export const tenantService = new TenantService();
export default tenantService;
