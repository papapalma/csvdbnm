import api from './api';

/**
 * User API Service
 * All user management API calls
 */

export interface User {
  id: string;
  email: string;
  username: string;
  // Role values match the backend database CHECK constraint exactly
  role: 'local_admin' | 'staff_training_coordinator' | 'staff_inventory_manager' | 'trainee';
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  role: 'local_admin' | 'staff_training_coordinator' | 'staff_inventory_manager';
}

export interface UpdateUserData {
  email?: string;
  username?: string;
  password?: string;
  role?: 'local_admin' | 'staff_training_coordinator' | 'staff_inventory_manager';
}

export interface UserFilters {
  search?: string;
  role?: string;
}

class UserService {
  /**
   * Get all users
   */
  async getUsers(filters?: UserFilters): Promise<User[]> {
    const response = await api.get<User[]>('/users', filters);
    return response.data;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserData): Promise<User> {
    const response = await api.post<User>('/users', data);
    return response.data;
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  }
}

export const userService = new UserService();
export default userService;
