import api from './api';

export type ExtensionRequestPriority = 'low' | 'medium' | 'high' | 'critical';
export type ExtensionRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'in_development'
  | 'deployed'
  | 'rejected';

export interface ExtensionRequest {
  id: string;
  tenant_id: string;
  requested_by: string;
  title: string;
  description: string;
  business_justification?: string | null;
  priority: ExtensionRequestPriority;
  status: ExtensionRequestStatus;
  affected_users_count?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
  tenant?: { name: string };
  requested_by_user?: { username: string; email: string };
  reviewed_by_user?: { username: string; email: string };
}

export interface CreateExtensionRequestData {
  title: string;
  description: string;
  business_justification?: string;
  priority: ExtensionRequestPriority;
  affected_users_count?: number;
}

class ExtensionRequestService {
  /** Get tenant-scoped extension requests (Local Admin) */
  async getMyRequests(filters?: { status?: string; page?: number; limit?: number }) {
    const response = await api.get<{ data: ExtensionRequest[]; total: number }>(
      '/extension-requests',
      filters
    );
    return response.data;
  }

  /** Submit a new extension request (Local Admin) */
  async createRequest(data: CreateExtensionRequestData): Promise<ExtensionRequest> {
    const response = await api.post<ExtensionRequest>('/extension-requests', data);
    return response.data;
  }

  /** Get all extension requests across tenants (Super Admin) */
  async getAllRequests(filters?: {
    status?: string;
    priority?: string;
    tenant_id?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await api.get<{ data: ExtensionRequest[]; total: number }>(
      '/admin/extension-requests',
      filters
    );
    return response.data;
  }

  /** Review / update status of an extension request (Super Admin) */
  async reviewRequest(
    id: string,
    data: { status: ExtensionRequestStatus; review_notes?: string }
  ): Promise<ExtensionRequest> {
    const response = await api.patch<ExtensionRequest>(
      `/admin/extension-requests/${id}`,
      data
    );
    return response.data;
  }
}

export const extensionRequestService = new ExtensionRequestService();
export default extensionRequestService;
