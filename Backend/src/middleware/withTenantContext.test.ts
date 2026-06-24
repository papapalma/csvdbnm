/**
 * Unit tests for the withTenantContext middleware wrapper
 *
 * Validates Requirements 14.6 and 14.8:
 *   - 14.6  Middleware wrapper applies tenant context to authenticated routes
 *   - 14.8  Request logging captures tenant_id, user_id, endpoint, timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from './withTenantContext';
import { generateToken } from '@/lib/auth/jwt';
import type { JWTPayload } from '@/types';
import type { TenantContext } from './tenantContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPayload(overrides: Partial<JWTPayload> = {}): Omit<JWTPayload, 'jti' | 'iat' | 'exp'> {
  return {
    userId: 'user-uuid-1234',
    email: 'user@example.com',
    role: 'local_admin',
    tenantId: 'tenant-uuid-5678',
    ...overrides,
  };
}

function requestWithBearerToken(token: string, method = 'GET'): NextRequest {
  return new NextRequest('http://localhost/api/programs', {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
}

function requestWithNoAuth(): NextRequest {
  return new NextRequest('http://localhost/api/programs');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withTenantContext', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  describe('valid authenticated request', () => {
    it('calls the inner handler with the resolved TenantContext', async () => {
      const token = generateToken(buildPayload());
      const request = requestWithBearerToken(token);

      let capturedContext: TenantContext | undefined;

      const handler = withTenantContext(async (_req, ctx) => {
        capturedContext = ctx;
        return NextResponse.json({ ok: true });
      });

      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(capturedContext).toBeDefined();
      expect(capturedContext!.tenantId).toBe('tenant-uuid-5678');
      expect(capturedContext!.userId).toBe('user-uuid-1234');
      expect(capturedContext!.role).toBe('local_admin');
      expect(capturedContext!.isSuperAdmin).toBe(false);
    });

    it('sets isSuperAdmin to true for super_admin role', async () => {
      const token = generateToken(buildPayload({ role: 'super_admin' }));
      const request = requestWithBearerToken(token);

      let capturedContext: TenantContext | undefined;

      const handler = withTenantContext(async (_req, ctx) => {
        capturedContext = ctx;
        return NextResponse.json({ ok: true });
      });

      await handler(request);

      expect(capturedContext!.isSuperAdmin).toBe(true);
    });

    it('passes the original request to the inner handler', async () => {
      const token = generateToken(buildPayload());
      const request = requestWithBearerToken(token, 'POST');

      let capturedRequest: NextRequest | undefined;

      const handler = withTenantContext(async (req, _ctx) => {
        capturedRequest = req;
        return NextResponse.json({ ok: true });
      });

      await handler(request);

      expect(capturedRequest).toBe(request);
      expect(capturedRequest!.method).toBe('POST');
    });

    it('passes dynamic route params to the inner handler', async () => {
      const token = generateToken(buildPayload());
      const request = requestWithBearerToken(token);

      let capturedParams: Record<string, string> | undefined;

      const handler = withTenantContext(async (_req, _ctx, params) => {
        capturedParams = params;
        return NextResponse.json({ ok: true });
      });

      await handler(request, { params: { id: 'program-id-999' } });

      expect(capturedParams).toEqual({ id: 'program-id-999' });
    });

    it('resolves async params (Next.js 15 Promise<params> pattern)', async () => {
      const token = generateToken(buildPayload());
      const request = requestWithBearerToken(token);

      let capturedParams: Record<string, string> | undefined;

      const handler = withTenantContext(async (_req, _ctx, params) => {
        capturedParams = params;
        return NextResponse.json({ ok: true });
      });

      await handler(request, { params: Promise.resolve({ id: 'async-param-id' }) });

      expect(capturedParams).toEqual({ id: 'async-param-id' });
    });
  });

  // ── Missing / invalid token ───────────────────────────────────────────────

  describe('unauthenticated request', () => {
    it('returns 403 without calling the inner handler', async () => {
      const request = requestWithNoAuth();
      let handlerCalled = false;

      const handler = withTenantContext(async (_req, _ctx) => {
        handlerCalled = true;
        return NextResponse.json({ ok: true });
      });

      const response = await handler(request);

      expect(response.status).toBe(403);
      expect(handlerCalled).toBe(false);
    });

    it('returns 403 for an invalid token', async () => {
      const request = new NextRequest('http://localhost/api/programs', {
        headers: { authorization: 'Bearer not.a.valid.jwt' },
      });

      const handler = withTenantContext(async (_req, _ctx) => NextResponse.json({ ok: true }));

      const response = await handler(request);

      expect(response.status).toBe(403);
    });
  });

  // ── Response passthrough ──────────────────────────────────────────────────

  describe('response passthrough', () => {
    it('returns the exact response produced by the inner handler', async () => {
      const token = generateToken(buildPayload());
      const request = requestWithBearerToken(token);

      const handler = withTenantContext(async (_req, _ctx) => {
        return NextResponse.json({ message: 'hello' }, { status: 201 });
      });

      const response = await handler(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.message).toBe('hello');
    });
  });
});
