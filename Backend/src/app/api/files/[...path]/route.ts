/**
 * GET /api/files/{tenant_id}/{file_type}/{...filename}
 *
 * Tenant-Scoped File Access Endpoint
 *
 * Implements Requirements 15.3, 15.4, 15.7:
 *   - 15.3  Verify that the file's tenant_id matches the requesting user's tenant_id
 *   - 15.4  Return 403 Forbidden for cross-tenant file access attempts
 *   - 15.7  Log all file access attempts including user_id, tenant_id, file_path, timestamp
 *
 * This endpoint acts as a secure proxy for tenant-scoped files stored under
 * /uploads/{tenant_id}/... It validates the requesting user's tenant context
 * before serving the file, preventing cross-tenant access even if the URL is
 * known.
 *
 * Super Admins may access files from any tenant.
 *
 * URL pattern:
 *   GET /api/files/{tenant_id}/images/items/photo.jpg
 *   GET /api/files/{tenant_id}/documents/programs/syllabus.pdf
 *   GET /api/files/{tenant_id}/qrcodes/trainees/qr_abc.png
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireTenantContext } from '@/middleware/tenantContext';
import { UPLOAD_BASE_DIR, validateTenantId } from '@/lib/fileStorage';
import { withErrorHandler } from '@/middleware/errorHandler';
import { forbiddenResponse, notFoundResponse } from '@/utils/responses';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// MIME type map
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || 'https://bmdc.site')
    : 'http://localhost:3000';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':      allowedOrigin,
      'Access-Control-Allow-Methods':     'GET, OPTIONS',
      'Access-Control-Allow-Headers':     'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age':           '86400', // 24 hours
    },
  });
}

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
  ) => {
    // ── 1. Auth ─────────────────────────────────────────────────────────────
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) {
      // Enhanced logging for authentication failures
      logger.warn('[FILE_ACCESS] Authentication failed', {
        url: request.url,
        method: request.method,
        hasAuthHeader: !!request.headers.get('authorization'),
        hasCookie: !!request.headers.get('cookie'),
        timestamp: new Date().toISOString(),
      });
      return ctxResult.error;
    }
    const { tenantId: userTenantId, userId, isSuperAdmin } = ctxResult.context;

    // ── 2. Resolve path segments ─────────────────────────────────────────────
    const { path: segments } = await context.params;

    if (!segments || segments.length < 2) {
      return notFoundResponse('Invalid file path');
    }

    // First segment is the tenant_id embedded in the URL
    const [fileTenantId, ...rest] = segments;

    // ── 3. Validate the tenant_id in the URL ─────────────────────────────────
    try {
      validateTenantId(fileTenantId);
    } catch {
      return notFoundResponse('Invalid file path');
    }

    // ── 4. Tenant isolation check (Req 15.3, 15.4) ───────────────────────────
    const filePath = `/uploads/${fileTenantId}/${rest.join('/')}`;

    if (!isSuperAdmin && fileTenantId.toLowerCase() !== userTenantId.toLowerCase()) {
      // Enhanced logging for tenant isolation violations
      logger.warn('[FILE_ACCESS] Cross-tenant access attempt blocked', {
        userId,
        userTenantId,
        fileTenantId,
        filePath,
        requestedSegments: segments.join('/'),
        isSuperAdmin,
        timestamp: new Date().toISOString(),
      });
      return forbiddenResponse('You do not have permission to access this file');
    }

    // ── 5. Resolve absolute path and guard against traversal ─────────────────
    const relativeParts = [fileTenantId, ...rest];
    const absolutePath = path.join(UPLOAD_BASE_DIR, ...relativeParts);

    // Ensure the resolved path stays within UPLOAD_BASE_DIR
    if (!absolutePath.startsWith(UPLOAD_BASE_DIR)) {
      logger.warn('[FILE_ACCESS] Path traversal attempt blocked', {
        userId,
        userTenantId,
        filePath,
        timestamp: new Date().toISOString(),
      });
      return forbiddenResponse('Invalid file path');
    }

    // ── 6. Read file ──────────────────────────────────────────────────────────
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(absolutePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Enhanced logging for missing files with detailed path information
        logger.warn('[FILE_ACCESS] File not found', {
          userId,
          userTenantId,
          fileTenantId,
          requestedPath: filePath,
          absolutePath,
          segments: segments.join('/'),
          timestamp: new Date().toISOString(),
        });
        return notFoundResponse('File not found');
      }
      // Log other file system errors
      logger.error('[FILE_ACCESS] File system error', {
        userId,
        userTenantId,
        filePath,
        absolutePath,
        errorCode: (err as NodeJS.ErrnoException).code,
        errorMessage: (err as Error).message,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }

    // ── 7. Log successful access (Req 15.7) ───────────────────────────────────
    logger.info('[FILE_ACCESS] File served', {
      userId,
      tenantId: userTenantId,
      filePath,
      sizeBytes: fileBuffer.length,
      timestamp: new Date().toISOString(),
    });

    // ── 8. Return file with appropriate headers ───────────────────────────────
    const filename = path.basename(absolutePath);
    const mimeType = getMimeType(filename);

    // Determine CORS origin based on environment
    const allowedOrigin = process.env.NODE_ENV === 'production'
      ? (process.env.FRONTEND_URL || 'https://bmdc.site')
      : 'http://localhost:3000';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type':                    mimeType,
        'Content-Length':                  String(fileBuffer.length),
        'Content-Disposition':             `inline; filename="${filename}"`,
        // Cache for 1 hour — files are immutable once written
        'Cache-Control':                   'private, max-age=3600',
        // CORS headers to allow frontend access
        'Access-Control-Allow-Origin':     allowedOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods':    'GET, OPTIONS',
        'Access-Control-Allow-Headers':    'Content-Type, Authorization',
      },
    });
  }
);
