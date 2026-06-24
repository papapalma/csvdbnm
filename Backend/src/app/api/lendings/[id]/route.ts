import { NextRequest } from 'next/server';
import { lendingService } from '@/services/lendingService';
import { requireTenantContext } from '@/middleware/tenantContext';
import { successResponse, notFoundResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';

// OPTIONS /api/lendings/:id - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}
// GET /api/lendings/:id - Get lending by ID (tenant-scoped)
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error;
    const { tenantId, isSuperAdmin } = ctxResult.context;

    const lending = await lendingService.getLendingById(id);

    if (!lending) {
      return notFoundResponse('Lending not found');
    }

    // Enforce tenant isolation — only allow access to own tenant's lendings
    if (!isSuperAdmin && lending.tenant_id && lending.tenant_id !== tenantId) {
      return notFoundResponse('Lending not found');
    }

    return successResponse(lending);
  }
);
