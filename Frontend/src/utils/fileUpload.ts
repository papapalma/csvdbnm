import axios from 'axios';
import logger from './logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Tenant-scoped upload categories.
 * Format: "{top-level}/{sub-type}" matching the backend /api/upload/tenant endpoint.
 *
 * Legacy flat categories ('items', 'trainees', etc.) are kept as aliases so
 * existing call-sites continue to work during the migration period.
 */
export type TenantUploadCategory =
  | 'images/items'
  | 'images/trainees'
  | 'images/programs'
  | 'images/cms'
  | 'documents/programs'
  | 'documents/trainees'
  | 'documents/certificates'
  | 'documents/reports'
  | 'qrcodes/trainees'
  | 'qrcodes/items'
  | 'qrcodes/certificates';

/** @deprecated Use TenantUploadCategory instead */
export type UploadCategory = 'items' | 'trainees' | 'programs' | 'cms' | 'qrcodes' | 'documents';

/** Map legacy flat categories to their tenant-scoped equivalents */
const LEGACY_CATEGORY_MAP: Record<UploadCategory, TenantUploadCategory> = {
  items:     'images/items',
  trainees:  'images/trainees',
  programs:  'images/programs',
  cms:       'images/cms',
  qrcodes:   'qrcodes/items',
  documents: 'documents/programs',
};

interface UploadOptions {
  file: File | string;  // File object or base64 string
  /** Accepts both legacy flat categories and new tenant-scoped categories */
  category: UploadCategory | TenantUploadCategory;
  prefix?: string;  // Optional prefix for filename (e.g., 'item_123')
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  success: boolean;
  filePath?: string;
  url?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  defaultThumbnailPath?: string;
  error?: string;
}

/**
 * Convert File to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } => {
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check allowed types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Image must be JPG, PNG, GIF, or WebP' };
  }

  // Check file size
  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: `Image must be less than ${maxSizeMB}MB` };
  }

  return { valid: true };
};

/**
 * Validate document file
 */
export const validateDocumentFile = (file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } => {
  // Check allowed types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File must be PDF, Word, or Excel document' };
  }

  // Check file size
  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: `Document must be less than ${maxSizeMB}MB` };
  }

  return { valid: true };
};

/**
 * Resolve a category to its tenant-scoped format.
 * Accepts both legacy flat categories and already-scoped categories.
 */
function resolveTenantCategory(category: UploadCategory | TenantUploadCategory): TenantUploadCategory {
  if (category.includes('/')) {
    // Already in tenant-scoped format
    return category as TenantUploadCategory;
  }
  return LEGACY_CATEGORY_MAP[category as UploadCategory] ?? 'images/items';
}

/**
 * Upload file to server using the tenant-scoped endpoint (/api/upload/tenant).
 * Falls back gracefully to the legacy endpoint if the tenant endpoint is unavailable.
 */
export const uploadFile = async (options: UploadOptions): Promise<UploadResult> => {
  const { prefix, onProgress } = options;
  const tenantCategory = resolveTenantCategory(options.category);
  const isDocument = tenantCategory.startsWith('documents/');
  let filename: string | undefined;

  try {
    const { file } = options;

    // Convert File to base64 if needed
    let fileData: string;
    if (file instanceof File) {
      // Validate file based on category
      if (isDocument) {
        const validation = validateDocumentFile(file);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      } else {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }

      fileData = await fileToBase64(file);
      filename = file.name;
    } else {
      fileData = file;
      // Infer a sensible extension for base64 QR codes
      filename = tenantCategory.startsWith('qrcodes/') ? 'qrcode.png' : 'file';
    }

    // Upload to the tenant-scoped endpoint
    const response = await axios.post(
      `${API_BASE_URL}/upload/tenant`,
      {
        file: fileData,
        category: tenantCategory,
        filename,
        prefix,
      },
      {
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );

    return {
      success: true,
      filePath: response.data?.data?.filePath,
      url: response.data?.data?.url,
      thumbnailPath: response.data?.data?.thumbnailPath,
      thumbnailUrl: response.data?.data?.thumbnailUrl,
      // Legacy field — not returned by tenant endpoint but kept for compatibility
      defaultThumbnailPath: response.data?.data?.defaultThumbnailPath,
    };
  } catch (error: any) {
    logger.error('Upload error', { error, category: tenantCategory, filename, prefix });
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Upload failed',
    };
  }
};

/**
 * Get full URL for a file path
 */
export const getFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  
  // If already a full URL, return as is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3001';
  return `${baseUrl}${filePath}`;
};

/**
 * Upload item photo
 */
export const uploadItemPhoto = async (file: File, itemId?: number | string, onProgress?: (progress: number) => void) => {
  return uploadFile({
    file,
    category: 'images/items',
    prefix: itemId ? `item_${itemId}` : undefined,
    onProgress,
  });
};

/**
 * Upload trainee photo
 */
export const uploadTraineePhoto = async (file: File, traineeId?: number | string, onProgress?: (progress: number) => void) => {
  return uploadFile({
    file,
    category: 'images/trainees',
    prefix: traineeId ? `trainee_${traineeId}` : undefined,
    onProgress,
  });
};

/**
 * Upload program image
 */
export const uploadProgramImage = async (file: File, programId?: number | string, onProgress?: (progress: number) => void) => {
  return uploadFile({
    file,
    category: 'images/programs',
    prefix: programId ? `program_${programId}` : undefined,
    onProgress,
  });
};

/**
 * Upload CMS image
 */
export const uploadCMSImage = async (file: File, imageName?: string, onProgress?: (progress: number) => void) => {
  return uploadFile({
    file,
    category: 'images/cms',
    prefix: imageName,
    onProgress,
  });
};

/**
 * Upload QR code image
 */
export const uploadQRCode = async (base64Data: string, type: 'item' | 'trainee' | 'certificate', id: number | string) => {
  const subType = type === 'certificate' ? 'qrcodes/certificates'
    : type === 'trainee' ? 'qrcodes/trainees'
    : 'qrcodes/items';
  return uploadFile({
    file: base64Data,
    category: subType,
    prefix: `qr_${type}_${id}`,
  });
};

/**
 * Upload a document (PDF, Word, Excel)
 */
export const uploadDocument = async (
  file: File,
  subType: 'programs' | 'trainees' | 'certificates' | 'reports' = 'programs',
  prefix?: string,
  onProgress?: (progress: number) => void,
) => {
  return uploadFile({
    file,
    category: `documents/${subType}` as TenantUploadCategory,
    prefix,
    onProgress,
  });
};
