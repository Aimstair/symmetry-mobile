/**
 * Offline Sync Manager
 * 
 * Handles offline-first data synchronization between local storage and Supabase.
 * 
 * Strategy:
 * - READ: Always from local storage (fast, works offline)
 * - WRITE: Local first, then queue for cloud sync
 * - SYNC: Background sync when online, retry failed operations
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { storageAdapter } from './storage';
import { supabase, checkSupabaseConnection } from '@/lib/supabase';
import type { WorkoutPlan, WorkoutSession, PhysiqueScan, User } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface PendingSyncItem {
  id: string;
  operation: SyncOperation;
  tableName: string;
  recordId: string;
  payload: any;
  createdAt: Date;
  attempts: number;
  lastError?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const SYNC_KEYS = {
  PENDING_QUEUE: 'sync:pending_queue',
  LAST_SYNCED: 'sync:last_synced',
  SYNC_STATUS: 'sync:status',
} as const;

// ============================================================================
// OFFLINE SYNC MANAGER
// ============================================================================

class OfflineSyncManager {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private pendingQueue: PendingSyncItem[] = [];
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the sync manager
   */
  private async initialize() {
    // Load pending queue from storage
    await this.loadPendingQueue();
    
    // Start network monitoring
    this.startNetworkMonitoring();
    
    // Start periodic sync (every 30 seconds when online)
    this.startPeriodicSync();
  }

  /**
   * Load pending sync queue from storage
   */
  private async loadPendingQueue() {
    try {
      const stored = storageAdapter.getItem(SYNC_KEYS.PENDING_QUEUE);
      if (stored) {
        this.pendingQueue = JSON.parse(stored);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load sync queue:', error);
      }
    }
  }

  /**
   * Save pending queue to storage
   */
  private savePendingQueue() {
    try {
      storageAdapter.setItem(SYNC_KEYS.PENDING_QUEUE, JSON.stringify(this.pendingQueue));
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save sync queue:', error);
      }
    }
  }

  /**
   * Start monitoring network connectivity
   */
  private startNetworkMonitoring() {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (__DEV__) {
        console.log('📶 Network status:', this.isOnline ? 'ONLINE' : 'OFFLINE');
      }
      
      // If we just came online, trigger sync
      if (wasOffline && this.isOnline) {
        this.syncPendingItems();
      }
      
      this.notifyListeners();
    });
  }

  /**
   * Start periodic sync interval
   */
  private startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.pendingQueue.length > 0) {
        this.syncPendingItems();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Add an operation to the sync queue
   */
  async queueOperation(
    operation: SyncOperation,
    tableName: string,
    recordId: string,
    payload: any
  ): Promise<void> {
    const item: PendingSyncItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      tableName,
      recordId,
      payload,
      createdAt: new Date(),
      attempts: 0,
    };
    
    // Check for existing operation on same record (dedupe)
    const existingIndex = this.pendingQueue.findIndex(
      (p) => p.tableName === tableName && p.recordId === recordId
    );
    
    if (existingIndex >= 0) {
      // Replace existing with new operation
      this.pendingQueue[existingIndex] = item;
    } else {
      this.pendingQueue.push(item);
    }
    
    this.savePendingQueue();
    this.notifyListeners();
    
    // Try immediate sync if online
    if (this.isOnline) {
      this.syncPendingItems();
    }
  }

  /**
   * Sync all pending items to the cloud
   */
  async syncPendingItems(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing || !this.isOnline || this.pendingQueue.length === 0) {
      return { success: 0, failed: 0 };
    }
    
    this.isSyncing = true;
    this.notifyListeners();
    
    let success = 0;
    let failed = 0;
    
    // Process queue items
    const itemsToProcess = [...this.pendingQueue];
    
    for (const item of itemsToProcess) {
      try {
        await this.executeSyncOperation(item);
        
        // Remove from queue on success
        this.pendingQueue = this.pendingQueue.filter((p) => p.id !== item.id);
        success++;
      } catch (error) {
        // Mark as failed, increment attempts
        const index = this.pendingQueue.findIndex((p) => p.id === item.id);
        if (index >= 0) {
          this.pendingQueue[index].attempts++;
          this.pendingQueue[index].lastError = error instanceof Error ? error.message : 'Unknown error';
        }
        failed++;
        
        // If too many attempts, move to end of queue
        if (this.pendingQueue[index]?.attempts >= 5) {
          if (__DEV__) {
            console.warn('Sync item exceeded max attempts:', item);
          }
        }
      }
    }
    
    this.savePendingQueue();
    
    // Update last synced timestamp
    if (success > 0) {
      storageAdapter.setItem(SYNC_KEYS.LAST_SYNCED, new Date().toISOString());
    }
    
    this.isSyncing = false;
    this.notifyListeners();
    
    if (__DEV__) {
      console.log(`🔄 Sync complete: ${success} success, ${failed} failed`);
    }
    
    return { success, failed };
  }

  /**
   * Execute a single sync operation
   */
  private async executeSyncOperation(item: PendingSyncItem): Promise<void> {
    const { operation, tableName, recordId, payload } = item;
    
    switch (operation) {
      case 'INSERT': {
        const { error } = await supabase.from(tableName).insert(payload);
        if (error) throw error;
        break;
      }
      case 'UPDATE': {
        const { error } = await supabase.from(tableName).update(payload).eq('id', recordId);
        if (error) throw error;
        break;
      }
      case 'DELETE': {
        const { error } = await supabase.from(tableName).delete().eq('id', recordId);
        if (error) throw error;
        break;
      }
    }
    
    // Mark as synced in the table
    await supabase.from(tableName).update({ synced_at: new Date().toISOString() }).eq('id', recordId);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    const lastSyncedStr = storageAdapter.getItem(SYNC_KEYS.LAST_SYNCED);
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingQueue.length,
      lastSyncedAt: lastSyncedStr ? new Date(lastSyncedStr) : null,
      lastError: this.pendingQueue[0]?.lastError || null,
    };
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  /**
   * Check if currently online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Force a sync attempt
   */
  async forceSync(): Promise<{ success: number; failed: number }> {
    // Check actual connectivity first
    this.isOnline = await checkSupabaseConnection();
    return this.syncPendingItems();
  }

  /**
   * Clear pending queue (use with caution)
   */
  clearQueue() {
    this.pendingQueue = [];
    this.savePendingQueue();
    this.notifyListeners();
  }

  /**
   * Cleanup on unmount
   */
  destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners.clear();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const syncManager = new OfflineSyncManager();

// ============================================================================
// HOOK FOR REACT COMPONENTS
// ============================================================================

import { useState, useEffect } from 'react';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());
  
  useEffect(() => {
    return syncManager.subscribe(setStatus);
  }, []);
  
  return status;
}
