import api from './api';

/**
 * Trainee API Service
 * All trainee-related API calls
 */

// Simple cache for reducing redundant API calls
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30000; // 30 seconds cache
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export interface Trainee {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  sex: 'Male' | 'Female';
  birth_date: string;
  birth_place: string;
  civil_status: 'Single' | 'Married' | 'Widowed' | 'Separated';
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  educational_attainment: 'Elementary' | 'High School' | 'Senior High School' | 'Vocational' | 'College' | 'Post Graduate';
  course: string;
  year_graduated: string;
  classification: 'Out-of-School Youth' | 'Student' | 'Unemployed' | 'Underemployed' | '4Ps Beneficiary';
  disability?: string | null;
  employment_status: 'Employed' | 'Unemployed' | 'Self-employed' | 'Student';
  program_id: string;
  qr_code: string;
  photo_path?: string | null;
  thumbnail_path?: string | null;
  qr_code_path?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  status: 'active' | 'inactive' | 'completed' | 'dropped';
  enrollment_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTraineeData {
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  sex: 'Male' | 'Female';
  birth_date: string;
  birth_place: string;
  civil_status: 'Single' | 'Married' | 'Widowed' | 'Separated';
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  educational_attainment: 'Elementary' | 'High School' | 'Senior High School' | 'Vocational' | 'College' | 'Post Graduate';
  course: string;
  year_graduated: string;
  classification: 'Out-of-School Youth' | 'Student' | 'Unemployed' | 'Underemployed' | '4Ps Beneficiary';
  disability?: string | null;
  employment_status: 'Employed' | 'Unemployed' | 'Self-employed' | 'Student';
  program_id: string;
  photo_path?: string | null;
  qr_code_path?: string | null;
  enrollment_date?: string;
}

export interface UpdateTraineeData extends Partial<CreateTraineeData> {
  status?: 'active' | 'inactive' | 'completed' | 'dropped';
}

export interface TraineeFilters {
  search?: string;
  program?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

class TraineeService {
  /**
   * Get all trainees
   */
  async getTrainees(filters?: TraineeFilters) {
    const response = await api.get<Trainee[]>('/trainees', filters);
    return response;
  }

  /**
   * Get trainee by ID
   */
  async getTraineeById(id: string): Promise<Trainee> {
    const response = await api.get<Trainee>(`/trainees/${id}`);
    return response.data;
  }

  /**
   * Create new trainee
   */
  async createTrainee(data: CreateTraineeData): Promise<Trainee> {
    const response = await api.post<Trainee>('/trainees', data);
    return response.data;
  }

  /**
   * Update trainee
   */
  async updateTrainee(id: string, data: UpdateTraineeData): Promise<Trainee> {
    const response = await api.put<Trainee>(`/trainees/${id}`, data);
    return response.data;
  }

  /**
   * Delete trainee
   */
  async deleteTrainee(id: string): Promise<void> {
    await api.delete(`/trainees/${id}`);
  }

  /**
   * Get current trainee's own profile (for trainee role)
   * Uses cache to reduce redundant API calls
   */
  async getMyProfile(): Promise<Trainee> {
    const cached = getCached<Trainee>('myProfile');
    if (cached) return cached;
    
    const response = await api.get<Trainee>('/trainees/me');
    setCache('myProfile', response.data);
    return response.data;
  }

  /**
   * Update current trainee's own profile (for trainee role)
   * Only certain fields can be updated by trainees
   * Clears cache after update
   */
  async updateMyProfile(data: Partial<UpdateTraineeData>): Promise<Trainee> {
    const response = await api.put<Trainee>('/trainees/me', data);
    // Clear cache after update to fetch fresh data
    clearCache('myProfile');
    clearCache('myDashboard');
    return response.data;
  }

  /**
   * Get all dashboard data in a single optimized API call (for trainee role)
   * Returns profile, attendance stats, recent attendance, and upcoming sessions
   * Uses cache to reduce redundant API calls
   */
  async getMyDashboard(): Promise<{
    profile: Trainee;
    attendanceStats: {
      total_sessions: number;
      present_count: number;
      late_count: number;
      absent_count: number;
      attendance_rate: number;
    };
    recentAttendance: any[];
    upcomingSessions: any[];
    excludedDates: any[];
  }> {
    const cached = getCached<any>('myDashboard');
    if (cached) return cached;
    
    const response = await api.get('/trainees/me/dashboard');
    setCache('myDashboard', response.data);
    // Also cache the profile separately for getMyProfile
    if (response.data.profile) {
      setCache('myProfile', response.data.profile);
    }
    return response.data;
  }

  /**
   * Get trainee statistics
   */
  async getTraineeStats() {
    const response = await api.get('/trainees/stats');
    return response.data;
  }

  /**
   * Export trainees to CSV
   */
  async exportTrainees(filters?: TraineeFilters): Promise<void> {
    await api.downloadFile('/trainees/export', 'trainees.csv', filters);
  }
}

export const traineeService = new TraineeService();
export default traineeService;
