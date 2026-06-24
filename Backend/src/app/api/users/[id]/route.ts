import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth';
import { successResponse, errorResponse, noContentResponse } from '@/utils/responses';
import { requireRoleAsync } from '@/middleware/auth';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { z } from 'zod';

// OPTIONS /api/users/[id] - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

const updateUserSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim().optional(),
  username: z.string().min(3).max(100).trim().optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['local_admin', 'staff_training_coordinator', 'staff_inventory_manager', 'trainee']).optional(),
});

/**
 * GET /api/users/[id]
 * Get a single user by ID (admin only)
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['local_admin', 'super_admin']);
  if ('error' in authResult) return authResult.error;

  const { id } = params;

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, username, role, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !user) return errorResponse('User not found', 404);

  return successResponse(user);
});

/**
 * PUT /api/users/[id]
 * Update a user (admin only)
 */
export const PUT = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['local_admin', 'super_admin']);
  if ('error' in authResult) return authResult.error;

  const { id } = params;
  const body = await request.json();
  const validatedData = updateUserSchema.parse(body);

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', id)
    .single();

  if (!existingUser) return errorResponse('User not found', 404);

  if (validatedData.email) {
    const { data: emailUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', validatedData.email)
      .neq('id', id)
      .single();

    if (emailUser) return errorResponse('Email already in use', 409);
  }

  const updateData: any = {};
  if (validatedData.email) updateData.email = validatedData.email;
  if (validatedData.username) updateData.username = validatedData.username;
  if (validatedData.role) updateData.role = validatedData.role;
  if (validatedData.password) {
    updateData.password_hash = await hashPassword(validatedData.password);
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('id, email, username, role, created_at, updated_at')
    .single();

  if (error) throw error;

  return successResponse(user);
});

/**
 * DELETE /api/users/[id]
 * Delete a user (admin only)
 */
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const authResult = await requireRoleAsync(request, ['local_admin', 'super_admin']);
  if ('error' in authResult) return authResult.error;

  const { id } = params;

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('id', id)
    .single();

  if (!existingUser) return errorResponse('User not found', 404);

  if (existingUser.email === 'admin@bmdc.edu.ph') {
    return errorResponse('Cannot delete the main admin account', 403);
  }

  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', id);

  if (error) throw error;

  return noContentResponse();
});
