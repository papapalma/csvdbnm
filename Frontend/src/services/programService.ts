import api from './api';

/**
 * Program API Service
 * All program-related API calls
 */

export interface Program {
  id: string;
  name: string;
  description?: string;
  duration_weeks: number;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  // max_trainees is NOT NULL in the DB — required field
  max_trainees: number;
  // instructor is present in the backend type and DB schema
  instructor?: string | null;
  image_path?: string | null;
  thumbnail_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProgramData {
  name: string;
  description: string;
  duration_weeks: number;
  start_date: string;
  end_date: string;
  // max_trainees is required by the backend validator (min 1)
  max_trainees: number;
  instructor?: string | null;
  image_path?: string | null;
}

export interface UpdateProgramData extends Partial<CreateProgramData> {
  status?: 'upcoming' | 'active' | 'completed' | 'cancelled';
  image_path?: string | null;
}

export interface ProgramFilters {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

class ProgramService {
  /**
   * Get all programs.
   * Returns the full ApiResponse so callers can access .data, .pagination, etc.
   */
  async getPrograms(filters?: ProgramFilters) {
    return api.get<Program[]>('/programs', filters);
  }

  /**
   * Get program by ID
   */
  async getProgramById(id: string): Promise<Program> {
    const response = await api.get<Program>(`/programs/${id}`);
    return response.data;
  }

  /**
   * Create new program
   * Backend expects ISO datetime strings for start_date and end_date
   */
  async createProgram(data: CreateProgramData): Promise<Program> {
    const payload = {
      ...data,
      start_date: data.start_date.includes('T') ? data.start_date : `${data.start_date}T00:00:00.000Z`,
      end_date:   data.end_date.includes('T')   ? data.end_date   : `${data.end_date}T00:00:00.000Z`,
    };
    const response = await api.post<Program>('/programs', payload);
    return response.data;
  }

  /**
   * Update program
   */
  async updateProgram(id: string, data: UpdateProgramData): Promise<Program> {
    const payload: any = { ...data };
    if (data.start_date && !data.start_date.includes('T')) {
      payload.start_date = `${data.start_date}T00:00:00.000Z`;
    }
    if (data.end_date && !data.end_date.includes('T')) {
      payload.end_date = `${data.end_date}T00:00:00.000Z`;
    }
    const response = await api.put<Program>(`/programs/${id}`, payload);
    return response.data;
  }

  /**
   * Delete program
   */
  async deleteProgram(id: string): Promise<void> {
    await api.delete(`/programs/${id}`);
  }

  /**
   * Get program statistics
   */
  async getProgramStats() {
    const response = await api.get('/programs/stats');
    return response.data;
  }

  /**
   * Get trainees enrolled in program
   */
  async getProgramTrainees(programId: string) {
    const response = await api.get(`/programs/${programId}/trainees`);
    return response.data;
  }

  /**
   * Export programs to CSV
   * TODO: Backend endpoint not yet implemented
   */
  async exportPrograms(_filters?: ProgramFilters): Promise<void> {
    // await api.downloadFile('/programs/export', 'programs.csv', filters);
    throw new Error('Export programs endpoint not yet implemented in backend');
  }
}

export const programService = new ProgramService();
export default programService;
