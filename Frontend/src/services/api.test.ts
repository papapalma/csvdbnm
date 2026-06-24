/**
 * Tests for API service environment variable configuration
 * Task 3.2: Configure Frontend VITE_BACKEND_URL environment variable
 */

import { describe, it, expect } from 'vitest';
import { getFileUrl, getThumbnailPath, API_BASE_URL, BACKEND_BASE_URL } from './api';

describe('API Service Environment Configuration', () => {
  describe('Environment Variables', () => {
    it('should have API_BASE_URL configured', () => {
      expect(API_BASE_URL).toBeDefined();
      expect(typeof API_BASE_URL).toBe('string');
    });

    it('should have BACKEND_BASE_URL configured', () => {
      expect(BACKEND_BASE_URL).toBeDefined();
      expect(typeof BACKEND_BASE_URL).toBe('string');
    });

    it('should derive BACKEND_BASE_URL from VITE_BACKEND_URL or API_BASE_URL', () => {
      // BACKEND_BASE_URL should either be explicitly set via VITE_BACKEND_URL
      // or derived from API_BASE_URL by stripping /api suffix
      const expectedFromApiBase = API_BASE_URL.replace(/\/api$/, '');
      
      // If VITE_BACKEND_URL is set, BACKEND_BASE_URL should match it
      // Otherwise, it should be the API_BASE_URL without /api suffix
      expect(
        BACKEND_BASE_URL === import.meta.env.VITE_BACKEND_URL ||
        BACKEND_BASE_URL === expectedFromApiBase
      ).toBe(true);
    });
  });

  describe('getFileUrl() Function', () => {
    it('should construct correct URL for legacy flat image paths', () => {
      const path = '/uploads/images/programs/program_123.jpg';
      const url = getFileUrl(path);
      
      // Should use BACKEND_BASE_URL for legacy flat paths
      expect(url).toContain('/uploads/images/programs/program_123.jpg');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should construct correct URL for tenant-scoped paths', () => {
      const path = '/uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890/images/items/photo.jpg';
      const url = getFileUrl(path);
      
      // Should route through API proxy for tenant-scoped paths
      expect(url).toContain('/api/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/images/items/photo.jpg');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should pass through absolute HTTP URLs unchanged', () => {
      const path = 'http://example.com/image.jpg';
      const url = getFileUrl(path);
      
      expect(url).toBe('http://example.com/image.jpg');
    });

    it('should pass through HTTPS URLs unchanged', () => {
      const path = 'https://example.com/image.jpg';
      const url = getFileUrl(path);
      
      expect(url).toBe('https://example.com/image.jpg');
    });

    it('should pass through blob URLs unchanged', () => {
      const path = 'blob:http://localhost:3000/abc-123';
      const url = getFileUrl(path);
      
      expect(url).toBe('blob:http://localhost:3000/abc-123');
    });

    it('should pass through data URLs unchanged', () => {
      const path = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
      const url = getFileUrl(path);
      
      expect(url).toBe('data:image/png;base64,iVBORw0KGgoAAAANS...');
    });

    it('should return empty string for null path', () => {
      const url = getFileUrl(null);
      expect(url).toBe('');
    });

    it('should return empty string for undefined path', () => {
      const url = getFileUrl(undefined);
      expect(url).toBe('');
    });

    it('should handle CMS image paths correctly', () => {
      const path = '/uploads/images/cms/hero_banner_123.jpg';
      const url = getFileUrl(path);
      
      // CMS images are legacy flat paths
      expect(url).toContain('/uploads/images/cms/hero_banner_123.jpg');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should handle QR code paths in tenant-scoped directory', () => {
      const path = '/uploads/ffffffff-ffff-ffff-ffff-ffffffffffff/qrcodes/trainees/qr_trainee_123.png';
      const url = getFileUrl(path);
      
      // QR codes in tenant directories should use API proxy
      expect(url).toContain('/api/files/ffffffff-ffff-ffff-ffff-ffffffffffff/qrcodes/trainees/qr_trainee_123.png');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should handle profile image paths correctly', () => {
      const path = '/uploads/images/profiles/user_123.jpg';
      const url = getFileUrl(path);
      
      // Profile images in legacy flat structure
      expect(url).toContain('/uploads/images/profiles/user_123.jpg');
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('Path Type Detection', () => {
    it('should correctly identify tenant-scoped paths by UUID pattern', () => {
      const tenantScopedPaths = [
        '/uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890/images/items/photo.jpg',
        '/uploads/00000000-0000-0000-0000-000000000001/documents/file.pdf',
        '/uploads/ffffffff-ffff-ffff-ffff-ffffffffffff/qrcodes/qr.png',
      ];

      tenantScopedPaths.forEach(path => {
        const url = getFileUrl(path);
        // Tenant-scoped paths should go through API proxy
        expect(url).toContain('/api/files/');
      });
    });

    it('should correctly identify legacy flat paths', () => {
      const legacyFlatPaths = [
        '/uploads/images/programs/program_123.jpg',
        '/uploads/images/cms/banner.jpg',
        '/uploads/images/profiles/user.jpg',
        '/uploads/documents/report.pdf',
      ];

      legacyFlatPaths.forEach(path => {
        const url = getFileUrl(path);
        // Legacy flat paths should NOT go through API proxy
        expect(url).not.toContain('/api/files/');
        expect(url).toContain(path);
      });
    });
  });
});
