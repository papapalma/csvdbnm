/**
 * Integration tests for /api/files/[...path]/route.ts
 *
 * Tests Requirements 2.1, 2.2, 2.4, 2.5, 3.5:
 *   - 2.1: System serves tenant-scoped images with proper authentication
 *   - 2.2: System returns fully qualified accessible URLs
 *   - 2.4: Next.js Image component successfully fetches images
 *   - 2.5: System serves static files with correct CORS headers and content-type
 *   - 3.5: Tenant isolation and authentication checks continue unchanged
 */

import { NextRequest } from 'next/server';
import { GET, OPTIONS } from './route';
import { generateToken } from '@/lib/auth/jwt';
import { promises as fs } from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'public', 'uploads');

describe('GET /api/files/[...path]', () => {
  const testTenantId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const testUserId = 'user-123';
  const testRole = 'admin';
  
  // Helper to create a test file
  async function createTestFile(relativePath: string, content: string = 'test image content'): Promise<string> {
    const fullPath = path.join(UPLOAD_BASE_DIR, relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  }

  // Helper to clean up test file
  async function cleanupTestFile(relativePath: string) {
    const fullPath = path.join(UPLOAD_BASE_DIR, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  // Helper to create request with auth token
  function createAuthenticatedRequest(
    pathSegments: string[],
    tenantId: string = testTenantId,
    userId: string = testUserId,
    role: string = testRole
  ): NextRequest {
    const token = generateToken({ userId, tenantId, role });
    const url = `http://localhost:3001/api/files/${pathSegments.join('/')}`;
    
    return new NextRequest(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication token', async () => {
      const url = `http://localhost:3001/api/files/${testTenantId}/images/test.jpg`;
      const request = new NextRequest(url, { method: 'GET' });
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'test.jpg'] }),
      };

      const response = await GET(request, context);
      expect(response.status).toBe(403);
    });

    it('should reject requests with invalid tenant isolation', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000001';
      const request = createAuthenticatedRequest([testTenantId, 'images', 'test.jpg']);
      
      const context = {
        params: Promise.resolve({ path: [differentTenantId, 'images', 'test.jpg'] }),
      };

      const response = await GET(request, context);
      expect(response.status).toBe(403);
    });

    it('should allow super admin to access files from any tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000001';
      const testFile = `${differentTenantId}/images/test-admin.jpg`;
      
      await createTestFile(testFile);

      const request = createAuthenticatedRequest(
        [differentTenantId, 'images', 'test-admin.jpg'],
        testTenantId,
        testUserId,
        'super_admin'
      );
      
      const context = {
        params: Promise.resolve({ path: [differentTenantId, 'images', 'test-admin.jpg'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);
      
      expect(response.status).toBe(200);
    });
  });

  describe('File Serving', () => {
    it('should serve existing image files with correct content-type', async () => {
      const testFile = `${testTenantId}/images/test-image.jpg`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'images', 'test-image.jpg']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'test-image.jpg'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    });

    it('should serve PNG images with correct content-type', async () => {
      const testFile = `${testTenantId}/images/test-image.png`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'images', 'test-image.png']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'test-image.png'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
    });

    it('should return 404 for non-existent files', async () => {
      const request = createAuthenticatedRequest([testTenantId, 'images', 'non-existent.jpg']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'non-existent.jpg'] }),
      };

      const response = await GET(request, context);
      expect(response.status).toBe(404);
    });

    it('should reject path traversal attempts', async () => {
      const request = createAuthenticatedRequest([testTenantId, '..', '..', 'etc', 'passwd']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, '..', '..', 'etc', 'passwd'] }),
      };

      const response = await GET(request, context);
      expect(response.status).toBe(403);
    });
  });

  describe('Response Headers', () => {
    it('should include CORS headers in response', async () => {
      const testFile = `${testTenantId}/images/test-cors.jpg`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'images', 'test-cors.jpg']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'test-cors.jpg'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should include cache control headers', async () => {
      const testFile = `${testTenantId}/images/test-cache.jpg`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'images', 'test-cache.jpg']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'test-cache.jpg'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    });

    it('should include content-disposition header', async () => {
      const testFile = `${testTenantId}/images/test-disposition.jpg`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'images', 'test-disposition.jpg']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'test-disposition.jpg'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.headers.get('Content-Disposition')).toContain('inline');
      expect(response.headers.get('Content-Disposition')).toContain('test-disposition.jpg');
    });
  });

  describe('Various File Types', () => {
    it('should serve QR code images', async () => {
      const testFile = `${testTenantId}/qrcodes/trainees/qr_trainee_123.png`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'qrcodes', 'trainees', 'qr_trainee_123.png']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'qrcodes', 'trainees', 'qr_trainee_123.png'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
    });

    it('should serve PDF documents with correct content-type', async () => {
      const testFile = `${testTenantId}/documents/programs/syllabus.pdf`;
      await createTestFile(testFile, 'PDF content');

      const request = createAuthenticatedRequest([testTenantId, 'documents', 'programs', 'syllabus.pdf']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'documents', 'programs', 'syllabus.pdf'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('should serve WebP images with correct content-type', async () => {
      const testFile = `${testTenantId}/images/profiles/avatar.webp`;
      await createTestFile(testFile);

      const request = createAuthenticatedRequest([testTenantId, 'images', 'profiles', 'avatar.webp']);
      
      const context = {
        params: Promise.resolve({ path: [testTenantId, 'images', 'profiles', 'avatar.webp'] }),
      };

      const response = await GET(request, context);
      
      await cleanupTestFile(testFile);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/webp');
    });
  });
});

describe('OPTIONS /api/files/[...path]', () => {
  it('should handle CORS preflight requests', async () => {
    const url = 'http://localhost:3001/api/files/test-tenant/images/test.jpg';
    const request = new NextRequest(url, { method: 'OPTIONS' });

    const response = await OPTIONS(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });
});
