import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withErrorHandler } from '@/middleware/errorHandler';
import { requireAuthAsync } from '@/middleware/auth';
import { handleOptionsRequest } from '@/middleware/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

/**
 * Resolve the tenant_id to use for a request.
 * Priority: query param → JWT → first active tenant (public fallback)
 */
async function resolveTenantId(request: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get('tenant_id');
  if (fromQuery) return fromQuery;

  // Try JWT (won't throw on missing token — just returns null)
  try {
    const authResult = await requireAuthAsync(request);
    if (!('error' in authResult) && authResult.user.tenantId) {
      return authResult.user.tenantId;
    }
  } catch {
    // No token — fall through to public default
  }

  // Public fallback: use the first active tenant
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  return data?.id ?? null;
}

/**
 * GET /api/cms-settings
 * Public endpoint — returns CMS settings for the current tenant.
 * Tenant resolved from: ?tenant_id param → JWT → first active tenant.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const tenantId = await resolveTenantId(request);

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'No tenant found' },
      { status: 404 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('cms_settings')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) throw error;

  // Convert array of key-value rows to a flat object
  const settings: Record<string, any> = {};
  data?.forEach(item => {
    try {
      settings[item.key] = JSON.parse(item.value);
    } catch {
      settings[item.key] = item.value;
    }
  });

  return NextResponse.json({ success: true, data: settings });
});

/**
 * PUT /api/cms-settings
 * Upsert a single CMS setting for the current tenant.
 * Requires authentication.
 *
 * Body: { key: string, value: any, description?: string }
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuthAsync(request);
  if ('error' in authResult) return authResult.error;

  const tenantId = authResult.user.tenantId;
  const body = await request.json();
  const { key, value, description } = body;

  if (!key) throw new Error('Key is required');
  if (value === undefined) throw new Error('Value is required');
  if (!tenantId) throw new Error('Tenant context is required');

  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

  const { data, error } = await supabaseAdmin
    .from('cms_settings')
    .upsert(
      {
        tenant_id: tenantId,
        key,
        value: valueStr,
        description: description || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,key' }
    )
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({ success: true, data });
});
