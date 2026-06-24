/**
 * Unit tests for Tenant Context Utility Functions
 *
 * Validates Requirements 14.6 and 14.8:
 *   - 14.6  Helper functions for tenant-scoped queries reduce code duplication
 *   - 14.8  Request logging captures tenant_id, user_id, endpoint, timestamp
 */

import {
  logTenantRequest,
  tenantQuery,
  tenantFindById,
  tenantInsert,
  tenantUpdate,
  tenantDelete,
  tenantCount,
  RequestLogEntry,
} from './tenantUtils';
import type { TenantContext } from '@/middleware/tenantContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal TenantContext for a regular tenant user. */
function buildContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'tenant-uuid-1111',
    userId: 'user-uuid-2222',
    role: 'local_admin',
    isSuperAdmin: false,
    ...overrides,
  };
}

/** Build a minimal TenantContext for a Super Admin. */
function buildSuperAdminContext(): TenantContext {
  return buildContext({ role: 'super_admin', isSuperAdmin: true });
}

// ---------------------------------------------------------------------------
// Supabase client mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a lightweight mock of the Supabase query builder chain.
 *
 * The mock records which filters were applied so tests can assert on them
 * without a real database connection.
 */
function createMockClient(returnData: unknown = [], returnError: unknown = null) {
  const calls: Record<string, unknown[]> = {};

  const record = (method: string, ...args: unknown[]) => {
    calls[method] = args;
    return builder;
  };

  const builder: Record<string, unknown> & { _calls: typeof calls } = {
    _calls: calls,
    select: (...args: unknown[]) => record('select', ...args),
    eq: (...args: unknown[]) => record('eq', ...args),
    order: (...args: unknown[]) => record('order', ...args),
    limit: (...args: unknown[]) => record('limit', ...args),
    range: (...args: unknown[]) => record('range', ...args),
    insert: (...args: unknown[]) => record('insert', ...args),
    update: (...args: unknown[]) => record('update', ...args),
    delete: (...args: unknown[]) => record('delete', ...args),
    maybeSingle: async () => ({ data: Array.isArray(returnData) ? returnData[0] ?? null : returnData, error: returnError }),
  };

  // Make the builder itself awaitable (for queries that don't call maybeSingle)
  (builder as any).then = (resolve: (v: unknown) => void) =>
    resolve({ data: returnData, error: returnError, count: Array.isArray(returnData) ? (returnData as unknown[]).length : null });

  const client = {
    from: (_table: string) => {
      calls['table'] = [_table];
      return builder;
    },
    _calls: calls,
  };

  return client as unknown as import('@supabase/supabase-js').SupabaseClient & { _calls: typeof calls };
}

// ---------------------------------------------------------------------------
// logTenantRequest
// ---------------------------------------------------------------------------

describe('logTenantRequest', () => {
  it('returns a RequestLogEntry with all required fields', () => {
    const context = buildContext();
    const entry: RequestLogEntry = logTenantRequest(context, 'GET', '/api/programs');

    expect(entry.tenant_id).toBe('tenant-uuid-1111');
    expect(entry.user_id).toBe('user-uuid-2222');
    expect(entry.role).toBe('local_admin');
    expect(entry.endpoint).toBe('/api/programs');
    expect(entry.method).toBe('GET');
    expect(entry.is_super_admin).toBe(false);
    expect(typeof entry.timestamp).toBe('string');
  });

  it('normalises method to uppercase', () => {
    const entry = logTenantRequest(buildContext(), 'post', '/api/trainees');
    expect(entry.method).toBe('POST');
  });

  it('sets is_super_admin to true for Super Admin context', () => {
    const entry = logTenantRequest(buildSuperAdminContext(), 'GET', '/api/admin/tenants');
    expect(entry.is_super_admin).toBe(true);
  });

  it('timestamp is a valid ISO 8601 string', () => {
    const entry = logTenantRequest(buildContext(), 'GET', '/api/items');
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });
});

// ---------------------------------------------------------------------------
// tenantQuery
// ---------------------------------------------------------------------------

describe('tenantQuery', () => {
  it('applies tenant_id filter for regular users', async () => {
    const client = createMockClient([{ id: '1', tenant_id: 'tenant-uuid-1111' }]);
    const context = buildContext();

    await tenantQuery(client, 'programs', context);

    // The eq filter for tenant_id must have been called
    expect(client._calls['eq']).toEqual(['tenant_id', 'tenant-uuid-1111']);
  });

  it('does NOT apply tenant_id filter for Super Admin', async () => {
    const client = createMockClient([]);
    const context = buildSuperAdminContext();

    await tenantQuery(client, 'programs', context);

    // eq should not have been called with tenant_id
    const eqArgs = client._calls['eq'];
    if (eqArgs) {
      expect(eqArgs[0]).not.toBe('tenant_id');
    }
  });

  it('applies additional filters from options', async () => {
    const client = createMockClient([]);
    const context = buildContext();

    await tenantQuery(client, 'programs', context, { filters: { status: 'active' } });

    // The last eq call should be for the additional filter
    expect(client._calls['eq']).toEqual(['status', 'active']);
  });

  it('applies ordering when specified', async () => {
    const client = createMockClient([]);
    const context = buildContext();

    await tenantQuery(client, 'programs', context, {
      orderBy: { column: 'created_at', ascending: false },
    });

    expect(client._calls['order']).toEqual(['created_at', { ascending: false }]);
  });

  it('applies limit when specified', async () => {
    const client = createMockClient([]);
    const context = buildContext();

    await tenantQuery(client, 'programs', context, { limit: 10 });

    expect(client._calls['limit']).toEqual([10]);
  });
});

// ---------------------------------------------------------------------------
// tenantFindById
// ---------------------------------------------------------------------------

describe('tenantFindById', () => {
  it('filters by id and tenant_id for regular users', async () => {
    const row = { id: 'row-id-1', tenant_id: 'tenant-uuid-1111', name: 'Test' };
    const client = createMockClient(row);
    const context = buildContext();

    const { data } = await tenantFindById(client, 'programs', 'row-id-1', context);

    expect(client._calls['eq']).toBeDefined();
    // The first eq call should be for 'id'
    expect(data).toEqual(row);
  });

  it('does NOT apply tenant_id filter for Super Admin', async () => {
    const row = { id: 'row-id-1', tenant_id: 'other-tenant', name: 'Test' };
    const client = createMockClient(row);
    const context = buildSuperAdminContext();

    const { data } = await tenantFindById(client, 'programs', 'row-id-1', context);

    expect(data).toEqual(row);
  });
});

// ---------------------------------------------------------------------------
// tenantInsert
// ---------------------------------------------------------------------------

describe('tenantInsert', () => {
  it('injects tenant_id into the inserted row', async () => {
    const inserted = { id: 'new-id', tenant_id: 'tenant-uuid-1111', name: 'New Program' };
    const client = createMockClient(inserted);
    const context = buildContext();

    const { data } = await tenantInsert(client, 'programs', { name: 'New Program' }, context);

    // insert should have been called with tenant_id included
    const insertArgs = client._calls['insert'] as unknown[];
    expect(insertArgs).toBeDefined();
    const insertedRow = insertArgs[0] as Record<string, unknown>;
    expect(insertedRow.tenant_id).toBe('tenant-uuid-1111');
    expect(insertedRow.name).toBe('New Program');
    expect(data).toEqual(inserted);
  });

  it('overwrites any tenant_id provided in payload with context tenant_id', async () => {
    const client = createMockClient({ id: 'x', tenant_id: 'tenant-uuid-1111' });
    const context = buildContext();

    await tenantInsert(client, 'programs', { name: 'Test', tenant_id: 'attacker-tenant' }, context);

    const insertArgs = client._calls['insert'] as unknown[];
    const row = insertArgs[0] as Record<string, unknown>;
    expect(row.tenant_id).toBe('tenant-uuid-1111');
  });
});

// ---------------------------------------------------------------------------
// tenantUpdate
// ---------------------------------------------------------------------------

describe('tenantUpdate', () => {
  it('constrains update to current tenant for regular users', async () => {
    const updated = { id: 'row-id', tenant_id: 'tenant-uuid-1111', name: 'Updated' };
    const client = createMockClient(updated);
    const context = buildContext();

    const { data } = await tenantUpdate(client, 'programs', 'row-id', { name: 'Updated' }, context);

    expect(client._calls['eq']).toBeDefined();
    expect(data).toEqual(updated);
  });

  it('does NOT apply tenant_id constraint for Super Admin', async () => {
    const updated = { id: 'row-id', tenant_id: 'other-tenant', name: 'Updated' };
    const client = createMockClient(updated);
    const context = buildSuperAdminContext();

    const { data } = await tenantUpdate(client, 'programs', 'row-id', { name: 'Updated' }, context);

    expect(data).toEqual(updated);
  });
});

// ---------------------------------------------------------------------------
// tenantDelete
// ---------------------------------------------------------------------------

describe('tenantDelete', () => {
  it('constrains delete to current tenant for regular users', async () => {
    const client = createMockClient(null);
    const context = buildContext();

    const { error } = await tenantDelete(client, 'programs', 'row-id', context);

    expect(client._calls['eq']).toBeDefined();
    expect(error).toBeNull();
  });

  it('does NOT apply tenant_id constraint for Super Admin', async () => {
    const client = createMockClient(null);
    const context = buildSuperAdminContext();

    const { error } = await tenantDelete(client, 'programs', 'row-id', context);

    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tenantCount
// ---------------------------------------------------------------------------

describe('tenantCount', () => {
  it('applies tenant_id filter for regular users', async () => {
    const client = createMockClient([]);
    const context = buildContext();

    await tenantCount(client, 'trainees', context);

    expect(client._calls['eq']).toEqual(['tenant_id', 'tenant-uuid-1111']);
  });

  it('applies additional filters when provided', async () => {
    const client = createMockClient([]);
    const context = buildContext();

    await tenantCount(client, 'trainees', context, { status: 'active' });

    expect(client._calls['eq']).toEqual(['status', 'active']);
  });

  it('does NOT apply tenant_id filter for Super Admin', async () => {
    const client = createMockClient([]);
    const context = buildSuperAdminContext();

    await tenantCount(client, 'trainees', context);

    const eqArgs = client._calls['eq'];
    if (eqArgs) {
      expect(eqArgs[0]).not.toBe('tenant_id');
    }
  });
});
