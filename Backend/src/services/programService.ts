import { supabaseAdmin } from '@/lib/supabase-admin';
import { db } from '@/lib/db';
import { Program } from '@/types';
import { CreateProgramInput, UpdateProgramInput } from '@/utils/validators';
import { deleteImageWithThumbnail, ensureThumbnailForImagePath } from '@/utils/fileUpload';

export class ProgramService {
  private async withThumbnail(program: Program): Promise<Program> {
    return {
      ...program,
      thumbnail_path: await ensureThumbnailForImagePath(program.image_path ?? null),
    };
  }

  async getAllPrograms(filters?: {
    status?: string;
    search?: string;
    tenantId?: string;
  }): Promise<Program[]> {
    let query = supabaseAdmin
      .from('programs')
      .select('*');

    // Tenant isolation — filter by tenant_id when provided (Req 7.2, 7.3)
    if (filters?.tenantId) {
      query = query.eq('tenant_id', filters.tenantId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    
    query = query.order('start_date', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;

    const programs = data || [];
    return Promise.all(programs.map((program) => this.withThumbnail(program as Program)));
  }

  async getProgramById(id: string, tenantId?: string): Promise<Program | null> {
    let query = supabaseAdmin
      .from('programs')
      .select('*')
      .eq('id', id);

    // Tenant isolation — only return the program if it belongs to this tenant (Req 7.8)
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return null;
    }

    return this.withThumbnail(data as Program);
  }

  async createProgram(programData: CreateProgramInput & { tenantId?: string }): Promise<Program> {
    const status = this.calculateProgramStatus(
      programData.start_date,
      programData.end_date
    );

    const { tenantId, ...rest } = programData as any;

    const newProgram = {
      ...rest,
      status,
      max_trainees: programData.max_trainees || 30,
      // Map camelCase tenantId → snake_case tenant_id for DB (Req 7.1)
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };
    
    // Use supabaseAdmin to bypass RLS policies
    const { data, error } = await supabaseAdmin
      .from('programs')
      .insert(newProgram)
      .select()
      .single();
    
    if (error) throw error;
    return this.withThumbnail(data);
  }

  async updateProgram(id: string, programData: UpdateProgramInput): Promise<Program> {
    const existingProgram = await this.getProgramById(id);
    if (!existingProgram) {
      throw new Error('Program not found');
    }
    
    const updateData: any = { ...programData };
    
    if (programData.start_date || programData.end_date) {
      const startDate = programData.start_date || existingProgram.start_date;
      const endDate = programData.end_date || existingProgram.end_date;
      updateData.status = this.calculateProgramStatus(startDate, endDate);
    }

    const imageWasUpdated = Object.prototype.hasOwnProperty.call(programData, 'image_path');
    const updatedProgram = await db.update<Program>('programs', id, updateData);

    if (
      imageWasUpdated &&
      existingProgram.image_path &&
      programData.image_path !== existingProgram.image_path
    ) {
      await deleteImageWithThumbnail(existingProgram.image_path);
    }

    return this.withThumbnail(updatedProgram);
  }

  async deleteProgram(id: string): Promise<void> {
    const existingProgram = await this.getProgramById(id);
    await db.delete('programs', id);

    if (existingProgram?.image_path) {
      await deleteImageWithThumbnail(existingProgram.image_path);
    }
  }

  private calculateProgramStatus(
    startDate: string,
    endDate: string
  ): 'upcoming' | 'active' | 'completed' {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'active';
  }

  async getProgramStats(programId: string): Promise<{
    totalTrainees: number;
    activeTrainees: number;
    graduatedTrainees: number;
  }> {
    const { data: trainees, error } = await supabaseAdmin
      .from('trainees')
      .select('status')
      .eq('program_id', programId);
    
    if (error) throw error;
    
    return {
      totalTrainees: trainees?.length || 0,
      activeTrainees: trainees?.filter((t: any) => t.status === 'active').length || 0,
      graduatedTrainees: trainees?.filter((t: any) => t.status === 'graduated').length || 0,
    };
  }
}

export const programService = new ProgramService();
