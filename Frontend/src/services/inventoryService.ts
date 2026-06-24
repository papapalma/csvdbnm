import api from './api';

/**
 * Inventory API Service
 * All inventory-related API calls
 */

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  available_quantity: number;
  unit: string;
  location: string;
  qr_code: string;
  image_path?: string | null;
  thumbnail_path?: string | null;
  qr_code_path?: string | null;
  // 'maintenance' matches the backend DB CHECK constraint
  status: 'available' | 'low_stock' | 'out_of_stock' | 'maintenance';
  minimum_quantity: number;
  purchase_date?: string | null;
  condition?: 'New' | 'Good' | 'Fair' | 'Poor' | 'Damaged' | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryData {
  name: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  minimum_quantity?: number;
  purchase_date?: string | null;
  condition?: string | null;
  image_path?: string | null;
  qr_code_path?: string | null;
}

export interface UpdateInventoryData extends Partial<CreateInventoryData> {
  qr_code_path?: string | null;
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

class InventoryService {
  /**
   * Get all inventory items
   */
  async getInventoryItems(filters?: InventoryFilters) {
    const response = await api.get<InventoryItem[]>('/items', filters);
    return response;
  }

  /**
   * Get inventory item by ID
   */
  async getInventoryItemById(id: string): Promise<InventoryItem> {
    const response = await api.get<InventoryItem>(`/items/${id}`);
    return response.data;
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(data: CreateInventoryData): Promise<InventoryItem> {
    const response = await api.post<InventoryItem>('/items', data);
    return response.data;
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(id: string, data: UpdateInventoryData): Promise<InventoryItem> {
    const response = await api.put<InventoryItem>(`/items/${id}`, data);
    return response.data;
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(id: string): Promise<void> {
    await api.delete(`/items/${id}`);
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats() {
    const response = await api.get('/items/stats');
    return response.data;
  }

  /**
   * Get low stock items
   * TODO: Backend endpoint not yet implemented
   */
  async getLowStockItems() {
    // const response = await api.get<InventoryItem[]>('/items/low-stock');
    // return response.data;
    throw new Error('Low stock items endpoint not yet implemented in backend');
  }

  /**
   * Adjust inventory stock
   * TODO: Backend endpoint not yet implemented
   */
  async adjustStock(_id: string, _quantity: number, _reason: string): Promise<InventoryItem> {
    // const response = await api.post<InventoryItem>(`/items/${id}/adjust`, {
    //   quantity,
    //   reason,
    // });
    // return response.data;
    throw new Error('Adjust stock endpoint not yet implemented in backend');
  }

  /**
   * Export inventory to CSV
   */
  async exportInventory(filters?: InventoryFilters): Promise<void> {
    await api.downloadFile('/items/export', 'inventory.csv', filters);
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;
