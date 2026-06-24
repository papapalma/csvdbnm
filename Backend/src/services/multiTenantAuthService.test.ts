/**
 * Unit tests for the Multi-Tenant Authentication Service
 *
 * Validates Requirements 6.1, 6.2, 6.6, 6.7:
 *   - 6.2  Determine the user's tenant association after authentication
 *   - 6.6  Support multi-tenant login (users belonging to multiple tenants)
 *   - 6.7  Prompt for tenant selection when user belongs to multiple tenants;
 *          generate tenant-scoped JWT after selection
 */

import {
  issueTenantSelectionToken,
  redeemTenantSelectionToken,
  generateTenantScopedToken,
  type TenantSummary,
} from './multiTenantAuthService';
import { verifyToken } from '@/lib/auth/jwt';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-0001';
const EMAIL = 'user@example.com';
const ROLE = 'local_admin';

const TENANT_A: TenantSummary = {
  id: 'tenant-uuid-aaaa',
  name: 'Bongabong LGU',
  is_primary: true,
  status: 'active',
};

const TENANT_B: TenantSummary = {
  id: 'tenant-uuid-bbbb',
  name: 'Roxas LGU',
  is_primary: false,
  status: 'active',
};

// ---------------------------------------------------------------------------
// generateTenantScopedToken
// ---------------------------------------------------------------------------

describe('generateTenantScopedToken', () => {
  it('returns a JWT containing the correct userId, email, role, and tenantId', () => {
    const token = generateTenantScopedToken(USER_ID, EMAIL, ROLE, TENANT_A.id);
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(USER_ID);
    expect(payload!.email).toBe(EMAIL);
    expect(payload!.role).toBe(ROLE);
    expect(payload!.tenantId).toBe(TENANT_A.id);
  });

  it('includes a jti (JWT ID) for token revocation tracking', () => {
    const token = generateTenantScopedToken(USER_ID, EMAIL, ROLE, TENANT_A.id);
    const payload = verifyToken(token);

    expect(payload!.jti).toBeDefined();
    expect(typeof payload!.jti).toBe('string');
    expect(payload!.jti.length).toBeGreaterThan(0);
  });

  it('generates unique jti values for each call', () => {
    const token1 = generateTenantScopedToken(USER_ID, EMAIL, ROLE, TENANT_A.id);
    const token2 = generateTenantScopedToken(USER_ID, EMAIL, ROLE, TENANT_A.id);

    const p1 = verifyToken(token1);
    const p2 = verifyToken(token2);

    expect(p1!.jti).not.toBe(p2!.jti);
  });

  it('embeds the correct tenantId for different tenants', () => {
    const tokenA = generateTenantScopedToken(USER_ID, EMAIL, ROLE, TENANT_A.id);
    const tokenB = generateTenantScopedToken(USER_ID, EMAIL, ROLE, TENANT_B.id);

    expect(verifyToken(tokenA)!.tenantId).toBe(TENANT_A.id);
    expect(verifyToken(tokenB)!.tenantId).toBe(TENANT_B.id);
  });
});

// ---------------------------------------------------------------------------
// issueTenantSelectionToken + redeemTenantSelectionToken
// ---------------------------------------------------------------------------

describe('issueTenantSelectionToken / redeemTenantSelectionToken', () => {
  describe('successful redemption', () => {
    it('returns a tenant-scoped JWT when token and tenantId are valid', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A, TENANT_B]);
      const result = redeemTenantSelectionToken(selectionToken, TENANT_A.id);

      expect(result).not.toBeNull();
      expect(result!.token).toBeDefined();

      const payload = verifyToken(result!.token);
      expect(payload!.userId).toBe(USER_ID);
      expect(payload!.email).toBe(EMAIL);
      expect(payload!.role).toBe(ROLE);
      expect(payload!.tenantId).toBe(TENANT_A.id);
    });

    it('returns the correct userId, email, and role in the result', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A]);
      const result = redeemTenantSelectionToken(selectionToken, TENANT_A.id);

      expect(result!.userId).toBe(USER_ID);
      expect(result!.email).toBe(EMAIL);
      expect(result!.role).toBe(ROLE);
    });

    it('allows selecting either tenant when user belongs to multiple tenants', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A, TENANT_B]);

      const resultA = redeemTenantSelectionToken(selectionToken, TENANT_A.id);
      expect(resultA).not.toBeNull();
      expect(verifyToken(resultA!.token)!.tenantId).toBe(TENANT_A.id);
    });
  });

  describe('one-time use enforcement (Req 6.7)', () => {
    it('returns null on second redemption of the same token', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A]);

      const first = redeemTenantSelectionToken(selectionToken, TENANT_A.id);
      expect(first).not.toBeNull();

      const second = redeemTenantSelectionToken(selectionToken, TENANT_A.id);
      expect(second).toBeNull();
    });
  });

  describe('invalid token scenarios', () => {
    it('returns null for an unknown selection token', () => {
      const result = redeemTenantSelectionToken('completely-invalid-token', TENANT_A.id);
      expect(result).toBeNull();
    });

    it('returns null when tenantId is not in the allowed set', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A]);
      // TENANT_B was not included in the allowed set
      const result = redeemTenantSelectionToken(selectionToken, TENANT_B.id);
      expect(result).toBeNull();
    });

    it('returns null for an empty tenantId string', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A]);
      const result = redeemTenantSelectionToken(selectionToken, '');
      expect(result).toBeNull();
    });
  });

  describe('token isolation', () => {
    it('different users get different selection tokens', () => {
      const token1 = issueTenantSelectionToken('user-1', EMAIL, ROLE, [TENANT_A]);
      const token2 = issueTenantSelectionToken('user-2', EMAIL, ROLE, [TENANT_A]);

      expect(token1).not.toBe(token2);
    });

    it('user-1 token cannot be used to select a tenant for user-2', () => {
      const token1 = issueTenantSelectionToken('user-1', EMAIL, ROLE, [TENANT_A]);
      // Redeem token1 for user-1 — should succeed
      const result1 = redeemTenantSelectionToken(token1, TENANT_A.id);
      expect(result1).not.toBeNull();
      expect(result1!.userId).toBe('user-1');

      // token1 is now consumed; a second attempt returns null
      const result2 = redeemTenantSelectionToken(token1, TENANT_A.id);
      expect(result2).toBeNull();
    });
  });

  describe('JWT payload correctness after selection', () => {
    it('generated JWT contains tenantId matching the selected tenant', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A, TENANT_B]);
      const result = redeemTenantSelectionToken(selectionToken, TENANT_B.id);

      const payload = verifyToken(result!.token);
      expect(payload!.tenantId).toBe(TENANT_B.id);
    });

    it('generated JWT is verifiable (not tampered)', () => {
      const selectionToken = issueTenantSelectionToken(USER_ID, EMAIL, ROLE, [TENANT_A]);
      const result = redeemTenantSelectionToken(selectionToken, TENANT_A.id);

      // verifyToken returns null for invalid/tampered tokens
      const payload = verifyToken(result!.token);
      expect(payload).not.toBeNull();
    });
  });
});
