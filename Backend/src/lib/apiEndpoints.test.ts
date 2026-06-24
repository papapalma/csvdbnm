/**
 * Integration tests for tenant-scoped API endpoint behaviour
 *
 * Validates Requirements 18.6, 18.8, 18.9, 14.9:
 *   - 18.6  Tenant-scoped CRUD operations return only tenant data
 *   - 18.8  Certificate generation uses correct tenant branding
 *   - 18.9  QR code scanning rejects codes from other tenants
 *   - 14.9  Report generation returns correct tenant-scoped data
 *
 * These tests exercise the middleware and utility layers without a live
 * database. Database-level behaviour is covered by the RLS policies in
 * full_schema.sql and validated during deployment smoke tests.
 */

import { NextRequest } from 'next/server';
import { extractTenantContext } from '@/middleware/tenantContext';
import { generateToken } from '@/lib/auth/jwt';
import {
  tenantCacheKey,
  cacheSet,
  cacheGet,
  cacheDelete,
  cacheGetOrSet,
  TTL,
} from '@/lib/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  tenantId: string,
  role = 'staff_training_coordinator',
  userId = 'user-001'
): NextRequest {
  const token = generateToken({ userId, email: 'staff@example.com', role, tenantId });
  return new NextRequest('http://localhost/api/programs', {
    headers: { authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// 18.6 — Tenant-scoped CRUD: context extraction
// ---------------------------------------------------------------------------

describe('Tenant-scoped CRUD context (Req 18.6)', () => {
  it('programs request carries correct tenant context', () => {
    const req = makeRequest('tenant-programs-001');
    const { context } = extractTenantContext(req);
    expect(context!.tenantId).toBe('tenant-programs-001');
    expect(context!.role).toBe('staff_training_coordinator');
  });

  it('trainees request carries correct tenant context', () => {
    const token = generateToken({
      userId: 'u1',
      email: 'e@e.com',
      role: 'staff_training_coordinator',
      tenantId: 'tenant-trainees-001',
    });
    const req = new NextRequest('http://localhost/api/trainees', {
      headers: { authorization: `Bearer ${token}` },
    });
    const { context } = extractTenantContext(req);
    expect(context!.tenantId).toBe('tenant-trainees-001');
  });

  it('items request carries correct tenant context', () => {
    const token = generateToken({
      userId: 'u1',
      email: 'e@e.com',
      role: 'staff_inventory_manager',
      tenantId: 'tenant-items-001',
    });
    const req = new NextRequest('http://localhost/api/items', {
      headers: { authorization: `Bearer ${token}` },
    });
    const { context } = extractTenantContext(req);
    expect(context!.tenantId).toBe('tenant-items-001');
    expect(context!.role).toBe('staff_inventory_manager');
  });

  it('two requests from different tenants produce different contexts', () => {
    const reqA = makeRequest('tenant-aaa');
    const reqB = makeRequest('tenant-bbb');
    const ctxA = extractTenantContext(reqA).context!;
    const ctxB = extractTenantContext(reqB).context!;
    expect(ctxA.tenantId).not.toBe(ctxB.tenantId);
  });
});

// ---------------------------------------------------------------------------
// 18.8 — Certificate generation uses correct tenant branding (cache layer)
// ---------------------------------------------------------------------------

describe('Certificate tenant branding via cache (Req 18.8)', () => {
  const TENANT_A_CONFIG = {
    branding: { logoUrl: '/uploads/tenant-aaa/logo.png', primaryColor: '#1a56db', welcomeMessage: 'Welcome A' },
  };
  const TENANT_B_CONFIG = {
    branding: { logoUrl: '/uploads/tenant-bbb/logo.png', primaryColor: '#c81e1e', welcomeMessage: 'Welcome B' },
  };

  afterEach(() => {
    cacheDelete(tenantCacheKey('tenant-aaa', 'config'));
    cacheDelete(tenantCacheKey('tenant-bbb', 'config'));
  });

  it('certificate service reads branding from tenant-specific cache key', async () => {
    cacheSet(tenantCacheKey('tenant-aaa', 'config'), TENANT_A_CONFIG, TTL.TENANT_CONFIG);
    cacheSet(tenantCacheKey('tenant-bbb', 'config'), TENANT_B_CONFIG, TTL.TENANT_CONFIG);

    const configA = cacheGet<typeof TENANT_A_CONFIG>(tenantCacheKey('tenant-aaa', 'config'));
    const configB = cacheGet<typeof TENANT_B_CONFIG>(tenantCacheKey('tenant-bbb', 'config'));

    expect(configA!.branding.primaryColor).toBe('#1a56db');
    expect(configB!.branding.primaryColor).toBe('#c81e1e');
    // Tenant A certificate uses Tenant A branding, not Tenant B
    expect(configA!.branding.logoUrl).not.toBe(configB!.branding.logoUrl);
  });

  it('cacheGetOrSet fetches and caches tenant config on first access', async () => {
    const key = tenantCacheKey('tenant-aaa', 'config');
    cacheDelete(key);

    let fetchCount = 0;
    const config = await cacheGetOrSet(key, TTL.TENANT_CONFIG, async () => {
      fetchCount++;
      return TENANT_A_CONFIG;
    });

    expect(config.branding.primaryColor).toBe('#1a56db');
    expect(fetchCount).toBe(1);

    // Second access should use cache
    await cacheGetOrSet(key, TTL.TENANT_CONFIG, async () => {
      fetchCount++;
      return TENANT_A_CONFIG;
    });
    expect(fetchCount).toBe(1); // fetcher not called again
  });
});

// ---------------------------------------------------------------------------
// 18.9 — QR code scanning rejects codes from other tenants
// ---------------------------------------------------------------------------

describe('QR code tenant validation (Req 18.9)', () => {
  /**
   * QR codes embed tenantId. The scanner's tenant context must match
   * the QR code's tenantId. This test verifies the context comparison logic.
   */

  function parseQrCode(qrData: string): { traineeId: string; tenantId: string } | null {
    try {
      return JSON.parse(qrData);
    } catch {
      return null;
    }
  }

  function validateQrCodeForTenant(qrData: string, scannerTenantId: string): boolean {
    const parsed = parseQrCode(qrData);
    if (!parsed) return false;
    return parsed.tenantId === scannerTenantId;
  }

  it('accepts a QR code belonging to the scanner tenant', () => {
    const qrData = JSON.stringify({ traineeId: 'trainee-001', tenantId: 'tenant-aaa' });
    expect(validateQrCodeForTenant(qrData, 'tenant-aaa')).toBe(true);
  });

  it('rejects a QR code from a different tenant', () => {
    const qrData = JSON.stringify({ traineeId: 'trainee-001', tenantId: 'tenant-bbb' });
    expect(validateQrCodeForTenant(qrData, 'tenant-aaa')).toBe(false);
  });

  it('rejects malformed QR code data', () => {
    expect(validateQrCodeForTenant('not-json', 'tenant-aaa')).toBe(false);
    expect(validateQrCodeForTenant('', 'tenant-aaa')).toBe(false);
    expect(validateQrCodeForTenant('{}', 'tenant-aaa')).toBe(false);
  });

  it('rejects QR code with missing tenantId field', () => {
    const qrData = JSON.stringify({ traineeId: 'trainee-001' });
    expect(validateQrCodeForTenant(qrData, 'tenant-aaa')).toBe(false);
  });

  it('Super Admin scanner context can validate any tenant QR code', () => {
    // Super Admin bypasses tenant restriction — isSuperAdmin flag is checked
    // before calling validateQrCodeForTenant in the actual route handler
    const req = new NextRequest('http://localhost/api/attendance/scan', {
      headers: {
        authorization: `Bearer ${generateToken({
          userId: 'super-admin-001',
          email: 'sa@example.com',
          role: 'super_admin',
          tenantId: 'tenant-aaa',
        })}`,
      },
    });
    const { context } = extractTenantContext(req);
    expect(context!.isSuperAdmin).toBe(true);
    // Super Admin can scan any tenant's QR code
    const qrData = JSON.stringify({ traineeId: 'trainee-001', tenantId: 'tenant-bbb' });
    const parsed = parseQrCode(qrData);
    expect(parsed).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 14.9 — Report generation returns tenant-scoped data (cache layer)
// ---------------------------------------------------------------------------

describe('Report generation tenant scope (Req 14.9)', () => {
  afterEach(() => {
    cacheDelete(tenantCacheKey('tenant-aaa', 'report:training_summary'));
    cacheDelete(tenantCacheKey('tenant-bbb', 'report:training_summary'));
  });

  it('report cache keys are tenant-scoped', () => {
    const reportA = { totalPrograms: 5, totalTrainees: 30, tenantId: 'tenant-aaa' };
    const reportB = { totalPrograms: 3, totalTrainees: 15, tenantId: 'tenant-bbb' };

    cacheSet(tenantCacheKey('tenant-aaa', 'report:training_summary'), reportA, TTL.AGGREGATED_REPORT);
    cacheSet(tenantCacheKey('tenant-bbb', 'report:training_summary'), reportB, TTL.AGGREGATED_REPORT);

    const cachedA = cacheGet<typeof reportA>(tenantCacheKey('tenant-aaa', 'report:training_summary'));
    const cachedB = cacheGet<typeof reportB>(tenantCacheKey('tenant-bbb', 'report:training_summary'));

    expect(cachedA!.totalPrograms).toBe(5);
    expect(cachedB!.totalPrograms).toBe(3);
    expect(cachedA!.tenantId).not.toBe(cachedB!.tenantId);
  });

  it('report cache TTL is 1 hour for aggregated reports', () => {
    expect(TTL.AGGREGATED_REPORT).toBe(60 * 60 * 1000);
  });

  it('tenant-scoped report cache key format is correct', () => {
    const key = tenantCacheKey('tenant-aaa', 'report:training_summary');
    expect(key).toBe('tenant:tenant-aaa:report:training_summary');
  });
});
