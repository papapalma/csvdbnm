import { api, ApiResponse } from './api';

export interface ProgramSession {
  id: string;
  program_id: string;
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location?: string;
  session_type: 'lecture' | 'lab' | 'workshop' | 'exam' | 'seminar' | 'field_trip';
  status: 'scheduled' | 'completed' | 'cancelled' | 'postponed';
  created_at: string;
  updated_at: string;
  program?: {
    id: string;
    name: string;
  };
}

export interface CreateSessionData {
  program_id: string;
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location?: string;
  session_type?: 'lecture' | 'lab' | 'workshop' | 'exam' | 'seminar' | 'field_trip';
}

export interface UpdateSessionData extends Partial<CreateSessionData> {
  status?: 'scheduled' | 'completed' | 'cancelled' | 'postponed';
}

class SessionService {
  async getSessions(filters?: { 
    program_id?: string; 
    upcoming?: boolean; 
    today?: boolean;
    limit?: number;
  }): Promise<ApiResponse<ProgramSession[]>> {
    const params: any = {};
    if (filters?.program_id) params.program_id = filters.program_id;
    if (filters?.upcoming) params.upcoming = 'true';
    if (filters?.today) params.today = 'true';
    if (filters?.limit) params.limit = filters.limit.toString();
    
    return api.get<ProgramSession[]>('/sessions', params);
  }

  async getSessionsByProgram(programId: string): Promise<ApiResponse<ProgramSession[]>> {
    return api.get<ProgramSession[]>('/sessions', { program_id: programId });
  }

  async getSessionById(id: string): Promise<ApiResponse<ProgramSession>> {
    return api.get<ProgramSession>(`/sessions/${id}`);
  }

  async getUpcomingSessions(limit: number = 10): Promise<ApiResponse<ProgramSession[]>> {
    return api.get<ProgramSession[]>('/sessions', { upcoming: 'true', limit: limit.toString() });
  }

  async getTodaySessions(): Promise<ApiResponse<ProgramSession[]>> {
    return api.get<ProgramSession[]>('/sessions', { today: 'true' });
  }

  async createSession(data: CreateSessionData): Promise<ApiResponse<ProgramSession>> {
    return api.post<ProgramSession>('/sessions', data);
  }

  async createBulkSessions(sessions: CreateSessionData[]): Promise<ApiResponse<ProgramSession[]>> {
    return api.post<ProgramSession[]>('/sessions', { sessions });
  }

  async updateSession(id: string, data: UpdateSessionData): Promise<ApiResponse<ProgramSession>> {
    return api.put<ProgramSession>(`/sessions/${id}`, data);
  }

  async deleteSession(id: string): Promise<ApiResponse<void>> {
    return api.delete<void>(`/sessions/${id}`);
  }
}

export const sessionService = new SessionService();
export default sessionService;
