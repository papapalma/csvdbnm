import api, { ApiResponse } from './api';

export interface NonAttendanceDate {
  id: string;
  date: string;
  reason: string;
  description?: string;
  program_id?: string;
  is_recurring: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNonAttendanceDateData {
  date: string;
  reason: string;
  description?: string;
  program_id?: string;
  is_recurring?: boolean;
}

export interface NonAttendanceDateFilters {
  program_id?: string;
  start_date?: string;
  end_date?: string;
}

class NonAttendanceDateService {
  /**
   * Get all non-attendance dates
   */
  async getNonAttendanceDates(filters?: NonAttendanceDateFilters): Promise<ApiResponse<NonAttendanceDate[]>> {
    return api.get<NonAttendanceDate[]>('/non-attendance-dates', filters);
  }

  /**
   * Create a new non-attendance date
   */
  async createNonAttendanceDate(data: CreateNonAttendanceDateData): Promise<ApiResponse<NonAttendanceDate>> {
    return api.post<NonAttendanceDate>('/non-attendance-dates', data);
  }

  /**
   * Bulk create non-attendance dates
   */
  async bulkCreateNonAttendanceDates(dates: CreateNonAttendanceDateData[]): Promise<ApiResponse<NonAttendanceDate[]>> {
    return api.post<NonAttendanceDate[]>('/non-attendance-dates', { dates });
  }

  /**
   * Generate all weekends for a year
   */
  async generateWeekendsForYear(year: number, programId?: string): Promise<ApiResponse<{ count: number }>> {
    return api.post<{ count: number }>('/non-attendance-dates', {
      bulk_action: 'generate_weekends',
      year,
      program_id: programId,
    });
  }

  /**
   * Update a non-attendance date
   */
  async updateNonAttendanceDate(id: string, data: Partial<CreateNonAttendanceDateData>): Promise<ApiResponse<NonAttendanceDate>> {
    return api.put<NonAttendanceDate>(`/non-attendance-dates/${id}`, data);
  }

  /**
   * Delete a non-attendance date
   */
  async deleteNonAttendanceDate(id: string): Promise<ApiResponse<null>> {
    return api.delete<null>(`/non-attendance-dates/${id}`);
  }
}

export default new NonAttendanceDateService();
