import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../utils/logger';

/**
 * API Configuration
 * Central configuration for all API calls in the application
 */

// API Base URL - Change this to your backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Create Axios Instance
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Enable cookies for authentication
});

/**
 * Request Interceptor
 * Add authentication token to all requests
 */
apiClient.interceptors.request.use(
  (config) => {
    // Auth is handled via the HttpOnly cookie set by the backend (SEC-4).
    // We do NOT read from localStorage or set Authorization headers here.

    // Log request in development
    if (import.meta.env.DEV) {
      logger.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
      });
    }

    return config;
  },
  (error) => {
    logger.error('[API Request Error]', { error });
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handle responses and errors globally
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in development
    if (import.meta.env.DEV) {
      logger.debug(`[API Response] ${response.config.url}`);
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Log error in development
    if (import.meta.env.DEV) {
      logger.error('[API Error]', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    }

    // Handle 401 Unauthorized.
    // Try one refresh attempt using the cached session, then retry the original request.
    if (error.response?.status === 401 && !originalRequest._retry) {
      const hasCachedUser = !!sessionStorage.getItem('bmdc-user');
      originalRequest._retry = true;

      // Avoid infinite loop when refresh endpoint itself fails.
      if (originalRequest.url?.includes('/auth/refresh')) {
        sessionStorage.removeItem('bmdc-user');
        window.location.href = '/';
        return Promise.reject(error);
      }

      // Anonymous requests should not trigger refresh. There is no session to recover.
      if (!hasCachedUser) {
        if (originalRequest.url?.includes('/auth/me')) {
          sessionStorage.removeItem('bmdc-user');
        }
        return Promise.reject(error);
      }

      try {
        await apiClient.post('/auth/refresh');
        return apiClient(originalRequest);
      } catch (refreshError) {
        sessionStorage.removeItem('bmdc-user');
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      logger.warn('Access forbidden - insufficient permissions');
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      logger.warn('Resource not found');
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      logger.error('Server error - please try again later');
    }

    // Handle Network Error
    if (error.message === 'Network Error') {
      logger.warn('Network error - please check your connection');
    }

    return Promise.reject(error);
  }
);

/**
 * API Response Interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  /** Present on error responses from the backend (errorResponse utility) */
  error?: string;
  errors?: any;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * API Error Interface
 */
export interface ApiError {
  message: string;
  status?: number;
  errors?: any;
}

/**
 * Generic API Request Handler
 */
class ApiService {
  /**
   * GET Request
   */
  async get<T = any>(
    url: string,
    params?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.get<ApiResponse<T>>(url, {
        params,
        ...config,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * POST Request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * PUT Request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * PATCH Request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * DELETE Request
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Upload File
   */
  async uploadFile<T = any>(
    url: string,
    file: File,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<ApiResponse<T>>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Download File
   */
  async downloadFile(
    url: string,
    filename: string,
    params?: any
  ): Promise<void> {
    try {
      const response = await apiClient.get(url, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Handle API Errors
   */
  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error
      const data = error.response.data as any;
      const validationMessages = data?.errors
        ? Object.values(data.errors)
            .flatMap((entry: any) => Array.isArray(entry) ? entry : [String(entry)])
            .filter(Boolean)
        : [];

      const message =
        data?.message
        || data?.error
        || (validationMessages.length > 0 ? validationMessages[0] : undefined)
        || 'An error occurred';

      return {
        message,
        status: error.response.status,
        errors: data?.errors ?? validationMessages,
      };
    } else if (error.request) {
      // No response received
      return {
        message: 'No response from server. Please check your connection.',
        status: 0,
      };
    } else {
      // Request setup error
      return {
        message: error.message || 'An error occurred',
      };
    }
  }
}

// Export singleton instance
export const api = new ApiService();

// Export axios instance for custom usage
export { apiClient };

// Export base URL for reference
export { API_BASE_URL };

/**
 * Backend static-file base URL (no /api suffix).
 * Use this to build full URLs for images and uploads stored on the backend.
 */
export const BACKEND_BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  API_BASE_URL.replace(/\/api$/, '');

export const DEFAULT_THUMBNAIL_PATH = '/uploads/images/defaults/blank-thumbnail.webp';

/**
 * UUID pattern used to detect tenant-scoped upload paths.
 * Tenant paths look like: /uploads/{uuid}/images/items/photo.jpg
 */
const TENANT_PATH_RE = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;

/**
 * Convert a relative upload path returned by the backend into a full URL the
 * browser can load.
 *
 * - Tenant-scoped paths (/uploads/{tenant_id}/...) are routed through the
 *   secure /api/files/{tenant_id}/... proxy so the backend can enforce
 *   tenant isolation (Req 15.3, 15.4).
 * - Legacy flat paths (/uploads/images/...) are served directly from the
 *   public directory as before.
 * - Absolute URLs, blob: and data: URLs are passed through unchanged.
 */
export function getFileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  // Tenant-scoped path → route through the secure API proxy
  if (TENANT_PATH_RE.test(path)) {
    // /uploads/{tenant_id}/images/items/photo.jpg
    // → {API_BASE_URL}/files/{tenant_id}/images/items/photo.jpg
    const withoutUploadsPrefix = path.replace(/^\/uploads\//, '');
    return `${API_BASE_URL}/files/${withoutUploadsPrefix}`;
  }

  // Legacy flat path → serve directly from the public directory
  return `${BACKEND_BASE_URL}${path}`;
}

/**
 * Resolve a source image path to its matching thumbnail path.
 * Falls back to a reusable blank thumbnail when no source image exists.
 *
 * Handles both:
 *   - Tenant-scoped paths: /uploads/{tenant_id}/images/{sub}/photo.jpg
 *     → /uploads/{tenant_id}/images/{sub}/thumbnails/photo.webp
 *   - Legacy flat paths: /uploads/images/{category}/photo.jpg
 *     → /uploads/images/{category}/thumbnails/photo.webp
 */
export function getThumbnailPath(path: string | null | undefined): string {
  if (!path) {
    return DEFAULT_THUMBNAIL_PATH;
  }

  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '/');

  if (normalizedPath.includes('/thumbnails/')) {
    return normalizedPath;
  }

  // Tenant-scoped path: /uploads/{uuid}/images/{sub}/{filename}
  const tenantMatch = normalizedPath.match(
    /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/images\/([^/]+)\/(.+)$/i
  );
  if (tenantMatch) {
    const [, tenantId, sub, remainder] = tenantMatch;
    const filename = remainder.split('/').pop() || '';
    const baseName = filename.replace(/\.[^.]+$/, '');
    if (!baseName) return DEFAULT_THUMBNAIL_PATH;
    return `/uploads/${tenantId}/images/${sub}/thumbnails/${baseName}.webp`;
  }

  // Legacy flat path: /uploads/images/{category}/{filename}
  const legacyMatch = normalizedPath.match(/^\/uploads\/images\/([^/]+)\/(.+)$/);
  if (!legacyMatch) {
    return DEFAULT_THUMBNAIL_PATH;
  }

  const [, category, remainder] = legacyMatch;
  if (category === 'defaults') {
    return DEFAULT_THUMBNAIL_PATH;
  }

  const filename = remainder.split('/').pop() || '';
  const baseName = filename.replace(/\.[^.]+$/, '');
  if (!baseName) {
    return DEFAULT_THUMBNAIL_PATH;
  }

  return `/uploads/images/${category}/thumbnails/${baseName}.webp`;
}

/**
 * Convert a source image path to a full thumbnail URL.
 */
export function getThumbnailUrl(path: string | null | undefined): string {
  const thumbnailPath = getThumbnailPath(path);
  return getFileUrl(thumbnailPath);
}

export default api;
