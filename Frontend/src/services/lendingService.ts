import api from './api';

/**
 * Lending API Service
 * All lending/borrowing-related API calls
 */

export interface LendingRecord {
  id: string;
  item_id: string;
  trainee_id?: string;
  borrower_name?: string;
  borrower_contact?: string;
  quantity: number;
  lent_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  status: 'active' | 'returned' | 'overdue' | 'lost';
  notes?: string;
  lent_by?: string;
  returned_by?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  item?: { id: string; name: string; [key: string]: any };
  trainee?: { id: string; first_name: string; last_name: string; [key: string]: any };
}

export interface CreateLendingData {
  trainee_id?: string;
  borrower_name?: string;
  borrower_contact?: string;
  item_id: string;
  quantity: number;
  expected_return_date: string; // ISO datetime e.g. 2025-06-01T00:00:00.000Z
  notes?: string;
}

export interface ReturnLendingData {
  notes?: string;
}

export interface LendingFilters {
  search?: string;
  status?: string;
  trainee_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  perPage?: number;
}

class LendingService {
  /**
   * Get all lending records
   */
  async getLendingRecords(filters?: LendingFilters) {
    const response = await api.get<LendingRecord[]>('/lendings', filters);
    return response;
  }

  /**
   * Get lending record by ID
   */
  async getLendingRecordById(id: string): Promise<LendingRecord> {
    const response = await api.get<LendingRecord>(`/lendings/${id}`);
    return response.data;
  }

  /**
   * Create new lending record (borrow a single item).
   * Normalises plain date strings to ISO datetime automatically.
   * Matches backend POST /lendings schema.
   */
  async createLending(data: CreateLendingData): Promise<LendingRecord> {
    const payload: CreateLendingData = {
      ...data,
      expected_return_date: data.expected_return_date.includes('T')
        ? data.expected_return_date
        : `${data.expected_return_date}T00:00:00.000Z`,
    };
    const response = await api.post<LendingRecord>('/lendings', payload);
    return response.data;
  }

  /**
   * Return borrowed items
   */
  async returnItem(id: string, data: ReturnLendingData): Promise<LendingRecord> {
    const response = await api.post<LendingRecord>(`/lendings/${id}/return`, data);
    return response.data;
  }

  /**
   * Delete lending record
   * TODO: Backend endpoint not yet implemented
   */
  async deleteLendingRecord(_id: string): Promise<void> {
    // await api.delete(`/lendings/${id}`);
    throw new Error('Delete lending endpoint not yet implemented in backend');
  }

  /**
   * Get lending statistics
   */
  async getLendingStats() {
    const response = await api.get('/lendings/stats');
    return response.data;
  }

  /**
   * Get overdue items
   * TODO: Backend endpoint not yet implemented
   */
  async getOverdueItems() {
    throw new Error('Overdue items endpoint not yet implemented in backend');
  }

  /**
   * Export lending records to CSV
   */
  async exportLendingRecords(_filters?: LendingFilters): Promise<void> {
    await api.downloadFile('/lendings/export', 'lendings.csv', _filters);
  }
}

export const lendingService = new LendingService();
export default lendingService;

