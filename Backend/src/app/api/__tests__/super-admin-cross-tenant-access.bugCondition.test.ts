/**
 * Bug Condition Exploration Test - Super Admin Cross-Tenant Access
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 *
 * **Property 1: Bug Condition** - Super Admin Cross-Tenant Access PostgreSQL Type Error
 *
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 *
 * **GOAL**: Surface counterexamples that demonstrate PostgreSQL type casting errors
 * when super admins (`context.isSuperAdmin = true`, `context.tenantId = 'platform'`)
 * access tenant-scoped endpoints.
 *
 * **Bug Condition**:
 * WHEN a super admin accesses tenant-scoped endpoints (extension-requests, lendings/overdue, registrations)
 * THEN the system attempts to filter by `.eq('tenant_id', 'platform')`
 * AND PostgreSQL fails to cast the string 'platform' to UUID type
 * AND returns 500 Internal Server Error instead of cross-tenant data
 *
 * **Expected Behavior** (what the test asserts - will fail on unfixed code):
 * WHEN a super admin accesses tenant-scoped endpoints
 * THEN the system SHALL return 200 OK with cross-tenant data
 * AND no PostgreSQL type casting errors SHALL occur
 *
 * **Expected Test Outcome on UNFIXED code**: FAILURES
 * - 500 errors from PostgreSQL UUID type mismatch
 * - Error messages containing "invalid input syntax for type uuid"
 * - Endpoints fail to return cross-tenant data
 */

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth/jwt';
import { GET as getExtensionRequests } from '../extension-requests/route';
import { GET as getOverdueLendings } from '../lendings/overdue/route';
import { GET as getRegistrations } from '../registrations/route';

describe('Bug Condition Exploration: Super Admin Cross-Tenant Access', () => {
  // Super admin authentication context
  const SUPER_ADMIN_USER_ID = 'super-admin-test-user-00000';
  const SUPER_ADMIN_EMAIL = 'superadmin@platform.test';
  const SUPER_ADMIN_ROLE = 'super_admin';
  const SUPER_ADMIN_TENANT_ID = 'platform'; // String literal that causes UUID cast failure

  /**
   * Helper: Create an authenticated NextRequest with super admin JWT
   */
  function createSuperAdminRequest(url: string, method: string = 'GET'): NextRequest {
    const token = generateToken({
      userId: SUPER_ADMIN_USER_ID,
      email: SUPER_ADMIN_EMAIL,
      role: SUPER_ADMIN_ROLE,
      tenantId: SUPER_ADMIN_TENANT_ID, // 'platform' string will cause UUID casting errors
    });

    const req = new NextRequest(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return req;
  }

  /**
   * Test 1: Extension Requests Endpoint
   * Bug Condition: Super admin accesses /api/extension-requests
   * Expected on UNFIXED code: 500 error due to PostgreSQL UUID type mismatch
   * Expected on FIXED code: 200 OK with cross-tenant data
   */
  describe('Property 1.1: Extension Requests - Super Admin Access', () => {
    it('SHOULD return 200 OK with cross-tenant extension requests (will FAIL on unfixed code with 500 error)', async () => {
      // Arrange: Create super admin request
      const request = createSuperAdminRequest('http://localhost:3001/api/extension-requests');

      // Act: Call the API endpoint
      const response = await getExtensionRequests(request);

      // Assert: Expected behavior (200 OK with data)
      // On UNFIXED code: This will FAIL with 500 due to PostgreSQL UUID cast error
      // On FIXED code: This will PASS with 200 OK and cross-tenant data
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(responseBody.data).toHaveProperty('data');
      expect(Array.isArray(responseBody.data.data)).toBe(true);

      // Expected: Cross-tenant data (no tenant filtering applied)
      // On UNFIXED code: Won't reach this assertion due to 500 error above
      console.log(`✓ Extension requests returned: ${responseBody.data.data.length} records`);
    });

    it('SHOULD NOT return PostgreSQL type casting errors (will FAIL on unfixed code)', async () => {
      // Arrange
      const request = createSuperAdminRequest('http://localhost:3001/api/extension-requests');

      // Act
      const response = await getExtensionRequests(request);

      // Assert: Should not contain PostgreSQL error messages
      const responseText = await response.text();
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { error: responseText };
      }

      // On UNFIXED code: This will FAIL - response will contain PostgreSQL UUID errors
      // On FIXED code: This will PASS - no database errors
      expect(responseText.toLowerCase()).not.toContain('invalid input syntax');
      expect(responseText.toLowerCase()).not.toContain('uuid');
      expect(responseText.toLowerCase()).not.toContain('type');
      expect(responseBody.error || '').not.toContain('PostgreSQL');
    });
  });

  /**
   * Test 2: Overdue Lendings Endpoint
   * Bug Condition: Super admin accesses /api/lendings/overdue
   * Expected on UNFIXED code: 500 error due to type casting on tenant_id = 'platform'
   * Expected on FIXED code: 200 OK with cross-tenant overdue lendings
   */
  describe('Property 1.2: Overdue Lendings - Super Admin Access', () => {
    it('SHOULD return 200 OK with cross-tenant overdue lendings (will FAIL on unfixed code with 500 error)', async () => {
      // Arrange: Create super admin request
      const request = createSuperAdminRequest('http://localhost:3001/api/lendings/overdue');

      // Act: Call the API endpoint
      const response = await getOverdueLendings(request);

      // Assert: Expected behavior (200 OK with data)
      // On UNFIXED code: This will FAIL with 500 due to service-level tenant filtering error
      // On FIXED code: This will PASS with 200 OK and cross-tenant data
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(Array.isArray(responseBody.data)).toBe(true);

      // Expected: Cross-tenant data (no tenant filtering applied)
      console.log(`✓ Overdue lendings returned: ${responseBody.data.length} records`);
    });

    it('SHOULD NOT return PostgreSQL type casting errors (will FAIL on unfixed code)', async () => {
      // Arrange
      const request = createSuperAdminRequest('http://localhost:3001/api/lendings/overdue');

      // Act
      const response = await getOverdueLendings(request);

      // Assert: Should not contain database errors
      const responseText = await response.text();
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { error: responseText };
      }

      // On UNFIXED code: This will FAIL - response will contain type casting errors
      expect(responseText.toLowerCase()).not.toContain('invalid input syntax');
      expect(responseText.toLowerCase()).not.toContain('uuid');
      expect(responseBody.error || '').not.toContain('PostgreSQL');
    });
  });

  /**
   * Test 3: Registrations Endpoint
   * Bug Condition: Super admin accesses /api/registrations?status=pending
   * Expected on UNFIXED code: 500 error due to service-level tenant filtering
   * Expected on FIXED code: 200 OK with cross-tenant pending registrations
   */
  describe('Property 1.3: Pending Registrations - Super Admin Access', () => {
    it('SHOULD return 200 OK with cross-tenant pending registrations (will FAIL on unfixed code with 500 error)', async () => {
      // Arrange: Create super admin request with status filter
      const request = createSuperAdminRequest('http://localhost:3001/api/registrations?status=pending');

      // Act: Call the API endpoint
      const response = await getRegistrations(request);

      // Assert: Expected behavior (200 OK with data)
      // On UNFIXED code: This will FAIL - registrationService doesn't check isSuperAdmin
      // On FIXED code: This will PASS with 200 OK and cross-tenant data
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data');
      expect(Array.isArray(responseBody.data)).toBe(true);

      // Expected: Cross-tenant data (all pending registrations across tenants)
      console.log(`✓ Pending registrations returned: ${responseBody.data.length} records`);
    });

    it('SHOULD NOT return PostgreSQL type casting errors (will FAIL on unfixed code)', async () => {
      // Arrange
      const request = createSuperAdminRequest('http://localhost:3001/api/registrations?status=pending');

      // Act
      const response = await getRegistrations(request);

      // Assert: Should not contain database errors
      const responseText = await response.text();
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { error: responseText };
      }

      // On UNFIXED code: This will FAIL if service applies tenant filtering
      expect(responseText.toLowerCase()).not.toContain('invalid input syntax');
      expect(responseText.toLowerCase()).not.toContain('uuid');
      expect(responseBody.error || '').not.toContain('PostgreSQL');
    });
  });

  /**
   * Summary Test: All Super Admin Tenant-Scoped Endpoints
   * Validates that super admins can access ALL tenant-scoped endpoints without errors
   */
  describe('Property 1.4: Cross-Endpoint Super Admin Access', () => {
    it('SHOULD allow super admin to access multiple tenant-scoped endpoints without errors', async () => {
      // Arrange: Create requests for all endpoints
      const extensionReq = createSuperAdminRequest('http://localhost:3001/api/extension-requests');
      const lendingsReq = createSuperAdminRequest('http://localhost:3001/api/lendings/overdue');
      const registrationsReq = createSuperAdminRequest('http://localhost:3001/api/registrations?status=pending');

      // Act: Call all endpoints
      const [extResponse, lendResponse, regResponse] = await Promise.all([
        getExtensionRequests(extensionReq),
        getOverdueLendings(lendingsReq),
        getRegistrations(registrationsReq),
      ]);

      // Assert: All should return 200 OK (will FAIL on unfixed code)
      expect(extResponse.status).toBe(200);
      expect(lendResponse.status).toBe(200);
      expect(regResponse.status).toBe(200);

      // Parse responses
      const [extBody, lendBody, regBody] = await Promise.all([
        extResponse.json(),
        lendResponse.json(),
        regResponse.json(),
      ]);

      // Validate successful responses
      expect(extBody.success).toBe(true);
      expect(lendBody.success).toBe(true);
      expect(regBody.success).toBe(true);

      console.log('✓ All super admin tenant-scoped endpoints returned successfully');
      console.log(`  - Extension requests: ${extBody.data?.data?.length || 0} records`);
      console.log(`  - Overdue lendings: ${lendBody.data?.length || 0} records`);
      console.log(`  - Pending registrations: ${regBody.data?.length || 0} records`);
    });
  });
});
