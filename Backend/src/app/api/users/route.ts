import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth';
import { successResponse, createdResponse, errorResponse } from '@/utils/responses';
import { requireRoleAsync } from '@/middleware/auth';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { z } from 'zod';

// OPTIONS /api/users - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

const createUserSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  username: z.string().min(3).max(100).trim(),
  password: z.string().min(6).max(100),
  role: z.enum(['local_admin', 'staff_training_coordinator', 'staff_inventory_manager', 'trainee']).default('staff_inventory_manager'),
});

/**
 * GET /api/users
 * Get all users (admin only)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['local_admin', 'super_admin']);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role');

  let query = supabaseAdmin
    .from('users')
    .select('id, email, username, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
  }

  if (role) {
    query = query.eq('role', role);
  }

  const { data: users, error } = await query;
  if (error) throw error;

  return successResponse(users);
});

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireRoleAsync(request, ['local_admin', 'super_admin']);
  if ('error' in authResult) return authResult.error;

  const body = await request.json();
  const validatedData = createUserSchema.parse(body);

  // Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', validatedData.email)
    .single();

  if (existingUser) {
    return errorResponse('User with this email already exists', 409);
  }

  const passwordHash = await hashPassword(validatedData.password);

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({
      email: validatedData.email,
      username: validatedData.username,
      password_hash: passwordHash,
      role: validatedData.role,
    })
    .select('id, email, username, role, created_at, updated_at')
    .single();

  if (error) throw error;

  return createdResponse(user);
});
