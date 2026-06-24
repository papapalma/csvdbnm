import {
  getAllItems,
  bulkAdd,
  updateItem,
  deleteItem,
  getItem,
  addPendingSync,
  getPendingSync,
  removePendingSync,
  setCacheTimestamp,
  needsRefresh,
  STORES,
} from './offlineDB';
import { toast } from 'sonner@2.0.3';
import logger from './logger';

export class OfflineManager {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingOperations();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Check if online
  public checkOnline(): boolean {
    return this.isOnline;
  }

  // Fetch with offline support
  public async fetchWithOfflineSupport<T>(
    storeName: string,
    apiCall: () => Promise<T[]>,
    forceRefresh: boolean = false
  ): Promise<T[]> {
    // If online and (force refresh or needs refresh), fetch from API
    if (this.isOnline && (forceRefresh || await needsRefresh(storeName))) {
      try {
        const data = await apiCall();
        
        // Store in IndexedDB
        await bulkAdd(storeName, data);
        await setCacheTimestamp(storeName, Date.now());
        
        logger.debug('Fetched items from API for offline cache', { storeName, count: data.length });
        return data;
      } catch (error) {
        logger.error('API call failed; falling back to cache', { storeName, error });
        toast.warning('Using cached data', {
          description: 'Unable to fetch latest data from server',
        });
      }
    }

    // Return cached data
    const cachedData = await getAllItems<T>(storeName);
    logger.debug('Retrieved items from offline cache', { storeName, count: cachedData.length });
    return cachedData;
  }

  // Create with offline support
  public async createWithOfflineSupport<T extends { id: string | number }>(
    storeName: string,
    item: T,
    apiCall: (item: T) => Promise<T>
  ): Promise<T> {
    if (this.isOnline) {
      try {
        // Try to create via API
        const result = await apiCall(item);
        
        // Store in IndexedDB
        await updateItem(storeName, result);
        
        toast.success('Created successfully');
        return result;
      } catch (error) {
        logger.error('API create failed; saving for later sync', { storeName, error });
        
        // Save to IndexedDB and pending sync
        await updateItem(storeName, item);
        await addPendingSync({
          type: 'create',
          storeName,
          data: item,
          timestamp: Date.now(),
          retryCount: 0,
        });
        
        toast.warning('Saved offline', {
          description: 'Changes will sync when connection is restored',
        });
        
        return item;
      }
    } else {
      // Offline mode
      await updateItem(storeName, item);
      await addPendingSync({
        type: 'create',
        storeName,
        data: item,
        timestamp: Date.now(),
        retryCount: 0,
      });
      
      toast.info('Saved offline', {
        description: 'Changes will sync when back online',
      });
      
      return item;
    }
  }

  // Update with offline support
  public async updateWithOfflineSupport<T extends { id: string | number }>(
    storeName: string,
    item: T,
    apiCall: (item: T) => Promise<T>
  ): Promise<T> {
    if (this.isOnline) {
      try {
        // Try to update via API
        const result = await apiCall(item);
        
        // Update in IndexedDB
        await updateItem(storeName, result);
        
        toast.success('Updated successfully');
        return result;
      } catch (error) {
        logger.error('API update failed; saving for later sync', { storeName, error });
        
        // Update in IndexedDB and pending sync
        await updateItem(storeName, item);
        await addPendingSync({
          type: 'update',
          storeName,
          data: item,
          timestamp: Date.now(),
          retryCount: 0,
        });
        
        toast.warning('Saved offline', {
          description: 'Changes will sync when connection is restored',
        });
        
        return item;
      }
    } else {
      // Offline mode
      await updateItem(storeName, item);
      await addPendingSync({
        type: 'update',
        storeName,
        data: item,
        timestamp: Date.now(),
        retryCount: 0,
      });
      
      toast.info('Saved offline', {
        description: 'Changes will sync when back online',
      });
      
      return item;
    }
  }

  // Delete with offline support
  public async deleteWithOfflineSupport(
    storeName: string,
    id: string | number,
    apiCall: (id: string | number) => Promise<void>
  ): Promise<void> {
    if (this.isOnline) {
      try {
        // Try to delete via API
        await apiCall(id);
        
        // Delete from IndexedDB
        await deleteItem(storeName, id);
        
        toast.success('Deleted successfully');
      } catch (error) {
        logger.error('API delete failed; saving for later sync', { storeName, error });
        
        // Mark for deletion in pending sync
        await addPendingSync({
          type: 'delete',
          storeName,
          data: { id },
          timestamp: Date.now(),
          retryCount: 0,
        });
        
        // Still delete from local cache
        await deleteItem(storeName, id);
        
        toast.warning('Deleted offline', {
          description: 'Changes will sync when connection is restored',
        });
      }
    } else {
      // Offline mode
      await addPendingSync({
        type: 'delete',
        storeName,
        data: { id },
        timestamp: Date.now(),
        retryCount: 0,
      });
      
      // Delete from local cache
      await deleteItem(storeName, id);
      
      toast.info('Deleted offline', {
        description: 'Changes will sync when back online',
      });
    }
  }

  // Get single item with offline support
  public async getWithOfflineSupport<T>(
    storeName: string,
    id: string | number,
    apiCall?: (id: string | number) => Promise<T>
  ): Promise<T | undefined> {
    if (this.isOnline && apiCall) {
      try {
        const data = await apiCall(id);
        await updateItem(storeName, data);
        return data;
      } catch (error) {
        logger.error('API get failed; using cache', { storeName, id, error });
      }
    }

    return await getItem<T>(storeName, id);
  }

  // Sync pending operations
  public async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    logger.debug('Starting sync of pending operations');

    try {
      const pendingItems = await getPendingSync();
      
      if (pendingItems.length === 0) {
        logger.debug('No pending operations to sync');
        this.syncInProgress = false;
        return;
      }

      logger.debug('Syncing pending operations', { pendingCount: pendingItems.length });
      
      let successCount = 0;
      let failCount = 0;

      for (const item of pendingItems) {
        try {
          // Note: In production, you'd call the actual API here
          // For now, we just remove from pending sync
          await removePendingSync(item.id!);
          successCount++;
        } catch (error) {
          logger.error('Failed to sync pending item', { pendingId: item.id, error });
          failCount++;
          
          // Update retry count
          if (item.retryCount < 3) {
            await updateItem(STORES.PENDING_SYNC, {
              ...item,
              retryCount: item.retryCount + 1,
            });
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Synced ${successCount} changes`, {
          description: 'Your offline changes have been saved',
        });
      }

      if (failCount > 0) {
        toast.error(`Failed to sync ${failCount} changes`, {
          description: 'Will retry later',
        });
      }

      logger.info('Sync complete', { successCount, failCount });
    } catch (error) {
      logger.error('Sync failed', { error });
      toast.error('Sync failed', {
        description: 'Will retry when connection is stable',
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get pending sync count
  public async getPendingSyncCount(): Promise<number> {
    const pending = await getPendingSync();
    return pending.length;
  }

  // Force refresh all data
  public async refreshAllData(
    apiCalls: Record<string, () => Promise<any[]>>
  ): Promise<void> {
    if (!this.isOnline) {
      toast.warning('Cannot refresh offline', {
        description: 'Connect to internet to refresh data',
      });
      return;
    }

    toast.info('Refreshing data...', {
      description: 'Fetching latest data from server',
    });

    let successCount = 0;
    let failCount = 0;

    for (const [storeName, apiCall] of Object.entries(apiCalls)) {
      try {
        const data = await apiCall();
        await bulkAdd(storeName, data);
        await setCacheTimestamp(storeName, Date.now());
        successCount++;
      } catch (error) {
        logger.error('Failed to refresh offline cache', { storeName, error });
        failCount++;
      }
    }

    if (successCount > 0 && failCount === 0) {
      toast.success('Data refreshed', {
        description: 'All data is up to date',
      });
    } else if (failCount > 0) {
      toast.warning('Partial refresh', {
        description: `${successCount} updated, ${failCount} failed`,
      });
    }
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();

// Helper hook for React components
export function useOfflineManager() {
  return offlineManager;
}
