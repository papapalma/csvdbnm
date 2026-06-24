/**
 * Unit tests for the Tenant Context Extraction Middleware
 *
 * Validates Requirements 14.1, 14.4, 14.5:
 *   - 14.1  tenant_id is extracted from the JWT on every request
 *   - 14.4  Middleware validates tenant_id presence in authenticated requests
 *   - 14.5  Returns 403 Forbidden when tenant context is invalid or missing
 */

import { NextRequest } from 'next/server';
import { extractTenantContext, requireTenantContext } from './tenantContext';
import { generateToken } from '@/lib/auth/jwt';
import type { JWTPayload } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid JWTPayload for a regular tenant user. */
function buildPayload(overrides: Partial<JWTPayload> = {}): Omit<JWTPayload, 'jti' | 'iat' | 'exp'> {
  return {
    userId: 'user-uuid-1234',
    email: 'user@example.com',
    role: 'local_admin',
    tenantId: 'tenant-uuid-5678',
    ...overrides,
  };
}

/** Create a NextRequest with an Authorization: Bearer header. */
function requestWithBearerToken(token: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { authorization: `Bearer ${token}` },
  });
}

/** Create a NextRequest with an auth_token httpOnly cookie. */
function requestWithCookie(token: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { cookie: `auth_token=${encodeURIComponent(token)}` },
  });
}

/** Create a NextRequest with no auth credentials. */
function requestWithNoAuth(): NextRequest {
  return new NextRequest('http://localhost/api/test');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractTenantContext', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  describe('valid token in Authorization header', () => {
    it('returns context with correct tenantId, userId, and role', () => {
      const token = generateToken(buildPayload());
      const result = extractTenantContext(requestWithBearerToken(token));

      expect(result.error).toBeUndefined();
      expect(result.context).toBeDefined();
      expect(result.context!.tenantId).toBe('tenant-uuid-5678');
      expect(result.context!.userId).toBe('user-uuid-1234');
      expect(result.context!.role).toBe('local_admin');
    });

    it('sets isSuperAdmin to false for non-super_admin roles', () => {
      const roles = ['local_admin', 'staff_training_coordinator', 'staff_inventory_manager', 'trainee'];
      for (const role of roles) {
        const token = generateToken(buildPayload({ role }));
        const result = extractTenantContext(requestWithBearerToken(token));
        expect(result.context!.isSuperAdmin).toBe(false);
      }
    });

    it('sets isSuperAdmin to true for super_admin role', () => {
      const token = generateToken(buildPayload({ role: 'super_admin' }));
      const result = extractTenantContext(requestWithBearerToken(token));

      expect(result.context!.isSuperAdmin).toBe(true);
    });
  });

  describe('valid token in httpOnly cookie', () => {
    it('returns context when token is in auth_token cookie', () => {
      const token = generateToken(buildPayload());
      const result = extractTenantContext(requestWithCookie(token));

      expect(result.error).toBeUndefined();
      expect(result.context!.tenantId).toBe('tenant-uuid-5678');
      expect(result.context!.userId).toBe('user-uuid-1234');
    });
  });

  // ── Missing token ─────────────────────────────────────────────────────────

  describe('missing token', () => {
    it('returns 403 when no token is present', async () => {
      const result = extractTenantContext(requestWithNoAuth());

      expect(result.context).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(403);
    });

    it('error body contains a descriptive message', async () => {
      const result = extractTenantContext(requestWithNoAuth());
      const body = await result.error!.json();

      expect(body.success).toBe(false);
      expect(body.error).toMatch(/missing/i);
    });
  });

  // ── Invalid / tampered token ──────────────────────────────────────────────

  describe('invalid token', () => {
    it('returns 403 for a completely invalid token string', async () => {
      const result = extractTenantContext(requestWithBearerToken('not.a.valid.jwt'));

      expect(result.context).toBeUndefined();
      expect(result.error!.status).toBe(403);
    });

    it('returns 403 for a token signed with a different secret', async () => {
      // Manually craft a token with a wrong secret
      const jwt = await import('jsonwebtoken');
      const fakeToken = jwt.default.sign(
        { userId: 'u1', email: 'x@x.com', role: 'local_admin', tenantId: 't1', jti: 'abc' },
        'wrong-secret',
        { expiresIn: 3600 }
      );

      const result = extractTenantContext(requestWithBearerToken(fakeToken));
      expect(result.error!.status).toBe(403);
    });

    it('returns 403 for an expired token', async () => {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET!;
      const expiredToken = jwt.default.sign(
        { userId: 'u1', email: 'x@x.com', role: 'local_admin', tenantId: 't1', jti: 'abc' },
        secret,
        { expiresIn: -1 } // already expired
      );

      const result = extractTenantContext(requestWithBearerToken(expiredToken));
      expect(result.error!.status).toBe(403);
    });
  });

  // ── Missing payload fields ────────────────────────────────────────────────

  describe('token missing required payload fields', () => {
    it('returns 403 when tenantId is absent from payload', async () => {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET!;
      // Omit tenantId intentionally
      const token = jwt.default.sign(
        { userId: 'u1', email: 'x@x.com', role: 'local_admin', jti: 'abc' },
        secret,
        { expiresIn: 3600 }
      );

      const result = extractTenantContext(requestWithBearerToken(token));
      expect(result.error!.status).toBe(403);

      const body = await result.error!.json();
      expect(body.error).toMatch(/tenantId/i);
    });

    it('returns 403 when userId is absent from payload', async () => {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET!;
      // Omit userId intentionally
      const token = jwt.default.sign(
        { email: 'x@x.com', role: 'local_admin', tenantId: 't1', jti: 'abc' },
        secret,
        { expiresIn: 3600 }
      );

      const result = extractTenantContext(requestWithBearerToken(token));
      expect(result.error!.status).toBe(403);

      const body = await result.error!.json();
      expect(body.error).toMatch(/userId/i);
    });
  });

  // ── Token source priority ─────────────────────────────────────────────────

  describe('token source priority', () => {
    it('prefers Authorization header over cookie when both are present', () => {
      const headerToken = generateToken(buildPayload({ tenantId: 'tenant-from-header' }));
      const cookieToken = generateToken(buildPayload({ tenantId: 'tenant-from-cookie' }));

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          authorization: `Bearer ${headerToken}`,
          cookie: `auth_token=${encodeURIComponent(cookieToken)}`,
        },
      });

      const result = extractTenantContext(request);
      expect(result.context!.tenantId).toBe('tenant-from-header');
    });
  });
});

// ---------------------------------------------------------------------------
// requireTenantContext (alias / convenience wrapper)
// ---------------------------------------------------------------------------

describe('requireTenantContext', () => {
  it('is equivalent to extractTenantContext for a valid token', () => {
    const token = generateToken(buildPayload());
    const req = requestWithBearerToken(token);

    const r1 = extractTenantContext(req);
    const r2 = requireTenantContext(req);

    expect(r1.context).toEqual(r2.context);
  });

  it('returns 403 for a missing token (same as extractTenantContext)', async () => {
    const result = requireTenantContext(requestWithNoAuth());
    expect(result.error!.status).toBe(403);
  });
});
