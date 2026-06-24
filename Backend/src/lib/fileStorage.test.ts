/**
 * Unit tests for the tenant-scoped file storage utility.
 *
 * Validates: Requirements 15.1, 15.6
 */

import path from 'path';
import { promises as fs } from 'fs';

// We override UPLOAD_BASE_DIR by pointing process.cwd() to a temp dir.
// Because the module reads process.cwd() at call-time (not import-time),
// we can set it before each test.

import {
  UPLOAD_BASE_DIR,
  UPLOAD_URL_PREFIX,
  validateTenantId,
  getTenantRootDir,
  getDocumentDir,
  getImageDir,
  getImageThumbnailDir,
  getQRCodeDir,
  generateDocumentPath,
  generateImagePath,
  generateQRCodePath,
  initTenantDirectories,
  tenantDirectoriesExist,
  extractTenantIdFromPath,
  pathBelongsToTenant,
} from './fileStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OTHER_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// ---------------------------------------------------------------------------
// validateTenantId
// ---------------------------------------------------------------------------

describe('validateTenantId', () => {
  it('accepts a valid UUID', () => {
    expect(() => validateTenantId(VALID_TENANT_ID)).not.toThrow();
  });

  it('accepts uppercase UUID', () => {
    expect(() => validateTenantId(VALID_TENANT_ID.toUpperCase())).not.toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => validateTenantId('')).toThrow(/Invalid tenant_id/);
  });

  it('throws for a non-UUID string', () => {
    expect(() => validateTenantId('not-a-uuid')).toThrow(/Invalid tenant_id/);
  });

  it('throws for a path-traversal attempt', () => {
    expect(() => validateTenantId('../etc/passwd')).toThrow(/Invalid tenant_id/);
  });
});

// ---------------------------------------------------------------------------
// Directory path helpers
// ---------------------------------------------------------------------------

describe('getTenantRootDir', () => {
  it('returns the correct absolute path', () => {
    const result = getTenantRootDir(VALID_TENANT_ID);
    expect(result).toBe(path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID));
  });

  it('throws for an invalid tenant_id', () => {
    expect(() => getTenantRootDir('bad-id')).toThrow();
  });
});

describe('getDocumentDir', () => {
  it.each(['programs', 'trainees', 'certificates', 'reports'] as const)(
    'returns correct path for sub-type "%s"',
    (subType) => {
      const result = getDocumentDir(VALID_TENANT_ID, subType);
      expect(result).toBe(
        path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'documents', subType)
      );
    }
  );
});

describe('getImageDir', () => {
  it.each(['programs', 'trainees', 'items', 'cms'] as const)(
    'returns correct path for sub-type "%s"',
    (subType) => {
      const result = getImageDir(VALID_TENANT_ID, subType);
      expect(result).toBe(
        path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'images', subType)
      );
    }
  );
});

describe('getImageThumbnailDir', () => {
  it.each(['programs', 'trainees', 'items', 'cms'] as const)(
    'returns correct thumbnail path for sub-type "%s"',
    (subType) => {
      const result = getImageThumbnailDir(VALID_TENANT_ID, subType);
      expect(result).toBe(
        path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'images', subType, 'thumbnails')
      );
    }
  );
});

describe('getQRCodeDir', () => {
  it.each(['trainees', 'items', 'certificates'] as const)(
    'returns correct path for sub-type "%s"',
    (subType) => {
      const result = getQRCodeDir(VALID_TENANT_ID, subType);
      expect(result).toBe(
        path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'qrcodes', subType)
      );
    }
  );
});

// ---------------------------------------------------------------------------
// generateDocumentPath
// ---------------------------------------------------------------------------

describe('generateDocumentPath', () => {
  it('returns correct paths for a document', () => {
    const result = generateDocumentPath(VALID_TENANT_ID, 'programs', 'syllabus.pdf');

    expect(result.absolutePath).toBe(
      path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'documents', 'programs', 'syllabus.pdf')
    );
    expect(result.relativePath).toBe(
      `${UPLOAD_URL_PREFIX}/${VALID_TENANT_ID}/documents/programs/syllabus.pdf`
    );
    expect(result.url).toContain(`/uploads/${VALID_TENANT_ID}/documents/programs/syllabus.pdf`);
  });

  it('throws for an unsafe filename with path traversal', () => {
    expect(() =>
      generateDocumentPath(VALID_TENANT_ID, 'reports', '../../../etc/passwd')
    ).toThrow(/Unsafe filename/);
  });

  it('throws for an invalid tenant_id', () => {
    expect(() => generateDocumentPath('bad', 'trainees', 'file.pdf')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// generateImagePath
// ---------------------------------------------------------------------------

describe('generateImagePath', () => {
  it('returns correct paths including thumbnail', () => {
    const result = generateImagePath(VALID_TENANT_ID, 'items', 'photo.jpg');

    expect(result.absolutePath).toBe(
      path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'images', 'items', 'photo.jpg')
    );
    expect(result.relativePath).toBe(
      `${UPLOAD_URL_PREFIX}/${VALID_TENANT_ID}/images/items/photo.jpg`
    );
    // Default thumbnail filename: photo.webp
    expect(result.thumbnailRelativePath).toBe(
      `${UPLOAD_URL_PREFIX}/${VALID_TENANT_ID}/images/items/thumbnails/photo.webp`
    );
    expect(result.thumbnailAbsolutePath).toBe(
      path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'images', 'items', 'thumbnails', 'photo.webp')
    );
  });

  it('accepts a custom thumbnail filename', () => {
    const result = generateImagePath(VALID_TENANT_ID, 'cms', 'logo.png', 'logo_thumb.webp');
    expect(result.thumbnailRelativePath).toContain('logo_thumb.webp');
  });

  it('throws for an unsafe filename', () => {
    expect(() =>
      generateImagePath(VALID_TENANT_ID, 'trainees', '../secret.jpg')
    ).toThrow(/Unsafe filename/);
  });
});

// ---------------------------------------------------------------------------
// generateQRCodePath
// ---------------------------------------------------------------------------

describe('generateQRCodePath', () => {
  it('returns correct paths for a QR code', () => {
    const result = generateQRCodePath(VALID_TENANT_ID, 'trainees', 'qr_abc.png');

    expect(result.absolutePath).toBe(
      path.join(UPLOAD_BASE_DIR, VALID_TENANT_ID, 'qrcodes', 'trainees', 'qr_abc.png')
    );
    expect(result.relativePath).toBe(
      `${UPLOAD_URL_PREFIX}/${VALID_TENANT_ID}/qrcodes/trainees/qr_abc.png`
    );
    expect(result.url).toContain(`/uploads/${VALID_TENANT_ID}/qrcodes/trainees/qr_abc.png`);
  });

  it('throws for an unsafe filename', () => {
    expect(() =>
      generateQRCodePath(VALID_TENANT_ID, 'certificates', '../../evil.png')
    ).toThrow(/Unsafe filename/);
  });
});

// ---------------------------------------------------------------------------
// extractTenantIdFromPath
// ---------------------------------------------------------------------------

describe('extractTenantIdFromPath', () => {
  it('extracts tenant_id from a valid relative path', () => {
    const result = extractTenantIdFromPath(
      `/uploads/${VALID_TENANT_ID}/images/items/photo.jpg`
    );
    expect(result).toBe(VALID_TENANT_ID);
  });

  it('returns null for a non-tenant path', () => {
    expect(extractTenantIdFromPath('/uploads/images/items/photo.jpg')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractTenantIdFromPath('')).toBeNull();
  });

  it('returns null when the second segment is not a UUID', () => {
    expect(extractTenantIdFromPath('/uploads/not-a-uuid/images/photo.jpg')).toBeNull();
  });

  it('handles Windows-style backslash separators', () => {
    const winPath = `\\uploads\\${VALID_TENANT_ID}\\qrcodes\\items\\qr.png`;
    const result = extractTenantIdFromPath(winPath);
    expect(result).toBe(VALID_TENANT_ID);
  });
});

// ---------------------------------------------------------------------------
// pathBelongsToTenant
// ---------------------------------------------------------------------------

describe('pathBelongsToTenant', () => {
  it('returns true when the path belongs to the tenant', () => {
    const relativePath = `/uploads/${VALID_TENANT_ID}/documents/reports/report.pdf`;
    expect(pathBelongsToTenant(relativePath, VALID_TENANT_ID)).toBe(true);
  });

  it('returns false when the path belongs to a different tenant', () => {
    const relativePath = `/uploads/${OTHER_TENANT_ID}/documents/reports/report.pdf`;
    expect(pathBelongsToTenant(relativePath, VALID_TENANT_ID)).toBe(false);
  });

  it('returns false for a non-tenant path', () => {
    expect(pathBelongsToTenant('/uploads/images/items/photo.jpg', VALID_TENANT_ID)).toBe(false);
  });

  it('is case-insensitive for the tenant_id comparison', () => {
    const relativePath = `/uploads/${VALID_TENANT_ID.toUpperCase()}/images/cms/logo.png`;
    expect(pathBelongsToTenant(relativePath, VALID_TENANT_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// initTenantDirectories / tenantDirectoriesExist  (filesystem tests)
//
// UPLOAD_BASE_DIR is evaluated at module load time from process.cwd(), so we
// cannot patch it via process.cwd in tests.  Instead we create the required
// directories directly under the real UPLOAD_BASE_DIR using a unique tenant
// UUID that we clean up afterwards.
// ---------------------------------------------------------------------------

const FS_TEST_TENANT = '11111111-2222-3333-4444-555555555555';
const FS_TEST_TENANT_2 = '22222222-3333-4444-5555-666666666666';

describe('initTenantDirectories', () => {
  afterAll(async () => {
    // Clean up the test tenant directories created under the real uploads dir
    try {
      await fs.rm(path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT), { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('creates all required sub-directories for a tenant', async () => {
    await initTenantDirectories(FS_TEST_TENANT);

    const expectedDirs = [
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'documents', 'programs'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'documents', 'trainees'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'documents', 'certificates'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'documents', 'reports'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'programs'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'programs', 'thumbnails'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'trainees'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'trainees', 'thumbnails'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'items'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'items', 'thumbnails'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'cms'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'images', 'cms', 'thumbnails'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'qrcodes', 'trainees'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'qrcodes', 'items'),
      path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT, 'qrcodes', 'certificates'),
    ];

    for (const dir of expectedDirs) {
      await expect(fs.access(dir)).resolves.toBeUndefined();
    }
  });

  it('is idempotent — calling twice does not throw', async () => {
    await expect(initTenantDirectories(FS_TEST_TENANT)).resolves.toBeUndefined();
    await expect(initTenantDirectories(FS_TEST_TENANT)).resolves.toBeUndefined();
  });

  it('throws for an invalid tenant_id', async () => {
    await expect(initTenantDirectories('not-a-uuid')).rejects.toThrow(/Invalid tenant_id/);
  });
});

describe('tenantDirectoriesExist', () => {
  afterAll(async () => {
    try {
      await fs.rm(path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT_2), { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('returns false before directories are created', async () => {
    // Ensure the directory does not exist first
    await fs.rm(path.join(UPLOAD_BASE_DIR, FS_TEST_TENANT_2), { recursive: true, force: true }).catch(() => {});
    const result = await tenantDirectoriesExist(FS_TEST_TENANT_2);
    expect(result).toBe(false);
  });

  it('returns true after directories are created', async () => {
    await initTenantDirectories(FS_TEST_TENANT_2);
    const result = await tenantDirectoriesExist(FS_TEST_TENANT_2);
    expect(result).toBe(true);
  });
});
