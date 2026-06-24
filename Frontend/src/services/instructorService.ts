import { api, ApiResponse } from './api';

export interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  photo_path?: string;
  thumbnail_path?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateInstructorData {
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  photo_path?: string;
}

export interface UpdateInstructorData extends Partial<CreateInstructorData> {
  status?: 'active' | 'inactive';
}

export interface InstructorFilters {
  status?: string;
  search?: string;
}

class InstructorService {
  async getInstructors(filters?: InstructorFilters): Promise<ApiResponse<Instructor[]>> {
    return api.get<Instructor[]>('/instructors', filters);
  }

  async getInstructorById(id: string): Promise<ApiResponse<Instructor>> {
    return api.get<Instructor>(`/instructors/${id}`);
  }

  async createInstructor(data: CreateInstructorData): Promise<ApiResponse<Instructor>> {
    return api.post<Instructor>('/instructors', data);
  }

  async updateInstructor(id: string, data: UpdateInstructorData): Promise<ApiResponse<Instructor>> {
    return api.put<Instructor>(`/instructors/${id}`, data);
  }

  async deleteInstructor(id: string): Promise<ApiResponse<void>> {
    return api.delete<void>(`/instructors/${id}`);
  }
}

export const instructorService = new InstructorService();
export default instructorService;
