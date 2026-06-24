import { api } from './api';

export interface CMSSettings {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  appearance: {
    logo: string;
    heroBackground: string;
  };
  mission: string;
  vision: string;
  contact: {
    address: string;
    addressLine2: string;
    phone: string;
    email: string;
    facebook: string;
  };
  footer: {
    companyName: string;
    tagline: string;
  };
}

class CMSSettingsService {
  /**
   * Get all CMS settings from the database
   */
  async getSettings(): Promise<CMSSettings | null> {
    try {
      const response = await api.get<Record<string, any>>('/cms-settings');
      if (!response.success || !response.data) {
        return null;
      }
      return response.data as CMSSettings;
    } catch (error) {
      console.error('Failed to fetch CMS settings:', error);
      return null;
    }
  }

  /**
   * Update a single setting in the database
   */
  async updateSetting(key: string, value: any, description?: string) {
    const response = await api.put('/cms-settings', {
      key,
      value,
      description
    });
    if (!response.success) {
      throw new Error('Failed to update setting');
    }
    return response.data;
  }

  /**
   * Bulk update all settings in the database
   */
  async updateSettings(settings: Partial<CMSSettings>) {
    const response = await api.post('/cms-settings/bulk', {
      settings
    });
    if (!response.success) {
      throw new Error('Failed to update settings');
    }
    return response.data;
  }

  /**
   * Migrate settings from localStorage to database (one-time migration)
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const saved = localStorage.getItem('bmdc-cms-settings');
      if (!saved) {
        return false; // Nothing to migrate
      }

      const settings = JSON.parse(saved);
      await this.updateSettings(settings);
      
      // Mark as migrated but don't remove yet (for safety)
      localStorage.setItem('bmdc-cms-migrated', 'true');
      
      console.log('✅ CMS settings migrated from localStorage to database');
      return true;
    } catch (error) {
      console.error('Failed to migrate CMS settings:', error);
      return false;
    }
  }
}

export default new CMSSettingsService();
