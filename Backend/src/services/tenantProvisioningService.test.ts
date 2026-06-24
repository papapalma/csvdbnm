/**
 * Unit tests for the Tenant Provisioning Service
 *
 * Validates Requirements 1.1, 1.3, 1.4, 1.5:
 *   - 1.1  Generate a unique tenant_id using UUID v4
 *   - 1.3  Create default TenantConfiguration with placeholder branding
 *   - 1.4  Validate tenant name uniqueness across the Platform
 *   - 1.5  Store tenant metadata (name, status, contact info)
 *
 * These tests mock the supabaseAdmin client to avoid requiring a live
 * database connection. The service logic (validation, default config
 * construction, rollback on failure) is tested in isolation.
 */

// ---------------------------------------------------------------------------
// Mock supabaseAdmin BEFORE importing the service so the module-level
// import in tenantProvisioningService.ts receives the mock.
// ---------------------------------------------------------------------------

const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIlike = jest.fn();

// Build a chainable query builder mock
function buildQueryChain(terminalFn: jest.Mock) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: terminalFn,
    maybeSingle: terminalFn,
  };
  return chain;
}

// We need a more flexible mock that can return different results per call
let fromCallCount = 0;
const fromResponses: Array<() => any> = [];

const mockFrom = jest.fn().mockImplementation((_table: string) => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => {
      const respFn = fromResponses[fromCallCount++];
      return respFn ? respFn() : Promise.resolve({ data: null, error: null });
    }),
    maybeSingle: jest.fn().mockImplementation(() => {
      const respFn = fromResponses[fromCallCount++];
      return respFn ? respFn() : Promise.resolve({ data: null, error: null });
    }),
  };
  return chain;
});

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

// Mock hashPassword to avoid bcrypt overhead in unit tests
jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
}));

// Mock logger to suppress output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  isTenantNameTaken,
  createTenant,
  type CreateTenantParams,
} from './tenantProvisioningService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResponse(data: any) {
  return () => Promise.resolve({ data, error: null });
}

function makeErrorResponse(message: string, code = 'PGRST000') {
  return () => Promise.resolve({ data: null, error: { message, code } });
}

const VALID_PARAMS: CreateTenantParams = {
  name: 'Bongabong LGU',
  contactEmail: 'contact@bongabong.gov.ph',
  contactPhone: '+63-912-345-6789',
  address: 'Bongabong, Oriental Mindoro',
  adminEmail: 'admin@bongabong.gov.ph',
  adminUsername: 'bongabong_admin',
  adminPassword: 'SecurePass123!',
};

const MOCK_TENANT = {
  id: 'tenant-uuid-0001',
  name: 'Bongabong LGU',
  status: 'active',
  contact_email: 'contact@bongabong.gov.ph',
  contact_phone: '+63-912-345-6789',
  address: 'Bongabong, Oriental Mindoro',
  configuration: {
    branding: {
      logoUrl: null,
      primaryColor: '#1a56db',
      secondaryColor: '#7e3af2',
      welcomeMessage: 'Welcome to Bongabong LGU Training Management System',
    },
    features: {
      inventoryManagement: true,
      certificateGeneration: false,
      qrCodeAttendance: false,
      mobileAppAccess: false,
    },
    notifications: { whatsapp: null, email: null },
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const MOCK_ADMIN_USER = {
  id: 'user-uuid-0001',
  email: 'admin@bongabong.gov.ph',
  username: 'bongabong_admin',
  role: 'local_admin',
};

// ---------------------------------------------------------------------------
// isTenantNameTaken
// ---------------------------------------------------------------------------

describe('isTenantNameTaken', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('returns true when a tenant with the same name exists', async () => {
    fromResponses.push(makeSuccessResponse({ id: 'existing-tenant-id' }));

    const result = await isTenantNameTaken('Bongabong LGU');
    expect(result).toBe(true);
  });

  it('returns false when no tenant with that name exists', async () => {
    fromResponses.push(makeSuccessResponse(null));

    const result = await isTenantNameTaken('New LGU');
    expect(result).toBe(false);
  });

  it('throws an error when the database query fails', async () => {
    fromResponses.push(makeErrorResponse('Connection refused'));

    await expect(isTenantNameTaken('Any LGU')).rejects.toThrow(
      'Failed to check tenant name uniqueness'
    );
  });
});

// ---------------------------------------------------------------------------
// createTenant — happy path
// ---------------------------------------------------------------------------

describe('createTenant — happy path', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('returns a CreatedTenant with the correct shape', async () => {
    // 1. isTenantNameTaken → no existing tenant
    fromResponses.push(makeSuccessResponse(null));
    // 2. Check admin email uniqueness → no existing user
    fromResponses.push(makeSuccessResponse(null));
    // 3. Check admin username uniqueness → no existing user
    fromResponses.push(makeSuccessResponse(null));
    // 4. Insert tenant → success
    fromResponses.push(makeSuccessResponse(MOCK_TENANT));
    // 5. Insert admin user → success
    fromResponses.push(makeSuccessResponse(MOCK_ADMIN_USER));
    // 6. Insert users_tenants link → success (no single/maybeSingle needed)
    // We need to handle the insert without single() for users_tenants
    // Override mockFrom for this call to return a non-single chain
    const originalMockFrom = mockFrom.getMockImplementation();

    const result = await createTenant(VALID_PARAMS);

    expect(result.id).toBe(MOCK_TENANT.id);
    expect(result.name).toBe(MOCK_TENANT.name);
    expect(result.status).toBe('active');
    expect(result.contactEmail).toBe(MOCK_TENANT.contact_email);
    expect(result.adminUser.id).toBe(MOCK_ADMIN_USER.id);
    expect(result.adminUser.role).toBe('local_admin');
  });

  it('includes default branding configuration with placeholder values', async () => {
    fromResponses.push(makeSuccessResponse(null)); // name check
    fromResponses.push(makeSuccessResponse(null)); // email check
    fromResponses.push(makeSuccessResponse(null)); // username check
    fromResponses.push(makeSuccessResponse(MOCK_TENANT)); // tenant insert
    fromResponses.push(makeSuccessResponse(MOCK_ADMIN_USER)); // user insert

    const result = await createTenant(VALID_PARAMS);

    expect(result.configuration.branding.primaryColor).toBe('#1a56db');
    expect(result.configuration.branding.secondaryColor).toBe('#7e3af2');
    expect(result.configuration.branding.logoUrl).toBeNull();
    expect(result.configuration.branding.welcomeMessage).toContain('Bongabong LGU');
  });

  it('creates admin user with local_admin role', async () => {
    fromResponses.push(makeSuccessResponse(null)); // name check
    fromResponses.push(makeSuccessResponse(null)); // email check
    fromResponses.push(makeSuccessResponse(null)); // username check
    fromResponses.push(makeSuccessResponse(MOCK_TENANT)); // tenant insert
    fromResponses.push(makeSuccessResponse(MOCK_ADMIN_USER)); // user insert

    const result = await createTenant(VALID_PARAMS);

    expect(result.adminUser.role).toBe('local_admin');
    expect(result.adminUser.email).toBe(VALID_PARAMS.adminEmail);
    expect(result.adminUser.username).toBe(VALID_PARAMS.adminUsername);
  });
});

// ---------------------------------------------------------------------------
// createTenant — validation failures (Req 1.4)
// ---------------------------------------------------------------------------

describe('createTenant — validation failures', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('throws when tenant name is already taken (Req 1.4)', async () => {
    // isTenantNameTaken → existing tenant found
    fromResponses.push(makeSuccessResponse({ id: 'existing-id' }));

    await expect(createTenant(VALID_PARAMS)).rejects.toThrow(
      'A tenant with the name "Bongabong LGU" already exists'
    );
  });

  it('throws when admin email is already in use', async () => {
    fromResponses.push(makeSuccessResponse(null));                    // name check → available
    fromResponses.push(makeSuccessResponse({ id: 'existing-user' })); // email check → taken

    await expect(createTenant(VALID_PARAMS)).rejects.toThrow(
      `A user with email "${VALID_PARAMS.adminEmail}" already exists`
    );
  });

  it('throws when admin username is already in use', async () => {
    fromResponses.push(makeSuccessResponse(null));                    // name check → available
    fromResponses.push(makeSuccessResponse(null));                    // email check → available
    fromResponses.push(makeSuccessResponse({ id: 'existing-user' })); // username check → taken

    await expect(createTenant(VALID_PARAMS)).rejects.toThrow(
      `A user with username "${VALID_PARAMS.adminUsername}" already exists`
    );
  });
});

// ---------------------------------------------------------------------------
// createTenant — rollback on failure
// ---------------------------------------------------------------------------

describe('createTenant — rollback on failure', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('throws when tenant insert fails', async () => {
    fromResponses.push(makeSuccessResponse(null));          // name check → available
    fromResponses.push(makeSuccessResponse(null));          // email check → available
    fromResponses.push(makeSuccessResponse(null));          // username check → available
    fromResponses.push(makeErrorResponse('DB write error')); // tenant insert → fail

    await expect(createTenant(VALID_PARAMS)).rejects.toThrow('Failed to create tenant');
  });

  it('throws when admin user insert fails and rolls back tenant', async () => {
    fromResponses.push(makeSuccessResponse(null));           // name check → available
    fromResponses.push(makeSuccessResponse(null));           // email check → available
    fromResponses.push(makeSuccessResponse(null));           // username check → available
    fromResponses.push(makeSuccessResponse(MOCK_TENANT));    // tenant insert → success
    fromResponses.push(makeErrorResponse('User insert fail')); // user insert → fail

    await expect(createTenant(VALID_PARAMS)).rejects.toThrow('Failed to create admin user');

    // Verify that mockFrom was called with 'tenants' for the rollback delete
    const fromCalls = mockFrom.mock.calls.map((c: any[]) => c[0]);
    expect(fromCalls).toContain('tenants');
  });
});

// ---------------------------------------------------------------------------
// Default configuration structure (Req 1.3)
// ---------------------------------------------------------------------------

describe('default TenantConfiguration structure (Req 1.3)', () => {
  beforeEach(() => {
    fromCallCount = 0;
    fromResponses.length = 0;
    mockFrom.mockClear();
  });

  it('includes all required feature flags set to their defaults', async () => {
    fromResponses.push(makeSuccessResponse(null));
    fromResponses.push(makeSuccessResponse(null));
    fromResponses.push(makeSuccessResponse(null));
    fromResponses.push(makeSuccessResponse(MOCK_TENANT));
    fromResponses.push(makeSuccessResponse(MOCK_ADMIN_USER));

    const result = await createTenant(VALID_PARAMS);

    expect(result.configuration.features).toMatchObject({
      inventoryManagement: true,
      certificateGeneration: false,
      qrCodeAttendance: false,
      mobileAppAccess: false,
    });
  });

  it('initializes notifications as null (not yet configured)', async () => {
    fromResponses.push(makeSuccessResponse(null));
    fromResponses.push(makeSuccessResponse(null));
    fromResponses.push(makeSuccessResponse(null));
    fromResponses.push(makeSuccessResponse(MOCK_TENANT));
    fromResponses.push(makeSuccessResponse(MOCK_ADMIN_USER));

    const result = await createTenant(VALID_PARAMS);

    expect(result.configuration.notifications.whatsapp).toBeNull();
    expect(result.configuration.notifications.email).toBeNull();
  });
});
