import api from './api';

export interface OverdueLending {
  id: string;
  item_id: string;
  trainee_id?: string;
  borrower_name?: string;
  borrower_contact?: string;
  quantity: number;
  lent_date: string;
  expected_return_date: string;
  status: 'overdue';
  notes?: string;
  item?: { id: string; name: string; [key: string]: any };
  trainee?: { id: string; first_name: string; last_name: string; [key: string]: any };
}

class OverdueNotificationService {
  /**
   * Get all overdue lending records
   */
  async getOverdueLendings() {
    const response = await api.get<OverdueLending[]>('/lendings/overdue');
    return response;
  }

  /**
   * Calculate days overdue
   */
  calculateDaysOverdue(expectedReturnDate: string): number {
    const today = new Date();
    const dueDate = new Date(expectedReturnDate);
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get severity level based on days overdue
   */
  getSeverity(daysOverdue: number): 'critical' | 'warning' | 'info' {
    if (daysOverdue > 7) return 'critical';
    if (daysOverdue > 3) return 'warning';
    return 'info';
  }
}

export default new OverdueNotificationService();
