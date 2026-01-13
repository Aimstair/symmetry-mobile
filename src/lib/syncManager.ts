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
import { addBreadcrumb } from '@/lib/monitoring';
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
  requiresManualRetry?: boolean; // Dead Letter Queue flag
  nextRetryAt?: number; // Timestamp for next retry
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
  private backoffTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  // Maximum retry attempts before moving to Dead Letter Queue
  private static readonly MAX_RETRY_ATTEMPTS = 10;

  /**
   * Calculate exponential backoff delay
   * Formula: min(30s, 2^attempts * 1s + random jitter)
   */
  private calculateBackoff(attempts: number): number {
    const baseDelay = Math.pow(2, attempts) * 1000;
    const jitter = Math.random() * 1000;
    return Math.min(30000, baseDelay + jitter);
  }

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
   * Only syncs items that are ready (not in backoff and not in DLQ)
   */
  private startPeriodicSync() {
    // Check every 5 seconds for items ready to sync
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.hasRetryableItems()) {
        this.syncPendingItems();
      }
    }, 5000);
  }

  /**
   * Check if there are items ready to be retried
   */
  private hasRetryableItems(): boolean {
    const now = Date.now();
    return this.pendingQueue.some(
      item => !item.requiresManualRetry && 
              (!item.nextRetryAt || item.nextRetryAt <= now)
    );
  }

  /**
   * Schedule a retry with exponential backoff
   */
  private scheduleRetry(item: PendingSyncItem): void {
    // Clear any existing timeout for this item
    const existingTimeout = this.backoffTimeouts.get(item.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const backoffDelay = this.calculateBackoff(item.attempts);
    item.nextRetryAt = Date.now() + backoffDelay;
    this.savePendingQueue();

    if (__DEV__) {
      console.log(`⏱️ Scheduling retry for ${item.tableName}:${item.recordId} in ${Math.round(backoffDelay / 1000)}s (attempt ${item.attempts})`);
    }

    const timeout = setTimeout(() => {
      this.backoffTimeouts.delete(item.id);
      if (this.isOnline) {
        this.syncPendingItems();
      }
    }, backoffDelay);

    this.backoffTimeouts.set(item.id, timeout);
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
    // Add breadcrumb for debugging
    addBreadcrumb(`Queuing ${operation} on ${tableName}`, 'sync', {
      operation,
      tableName,
      recordId,
    });
    
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
   * Uses batching to reduce network requests
   * Skips items in Dead Letter Queue or still in backoff
   */
  async syncPendingItems(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing || !this.isOnline || this.pendingQueue.length === 0) {
      return { success: 0, failed: 0 };
    }
    
    // Filter out items that aren't ready for sync
    const now = Date.now();
    const itemsToSync = this.pendingQueue.filter(
      item => !item.requiresManualRetry && 
              (!item.nextRetryAt || item.nextRetryAt <= now)
    );
    
    if (itemsToSync.length === 0) {
      return { success: 0, failed: 0 };
    }
    
    // Add breadcrumb for debugging
    addBreadcrumb('Starting sync', 'sync', {
      pendingCount: this.pendingQueue.length,
      syncingCount: itemsToSync.length,
      dlqCount: this.pendingQueue.filter(i => i.requiresManualRetry).length,
    });
    
    this.isSyncing = true;
    this.notifyListeners();
    
    let success = 0;
    let failed = 0;
    
    // Group items by table and operation for batching
    const batches = new Map<string, PendingSyncItem[]>();
    
    for (const item of itemsToSync) {
      const key = `${item.tableName}:${item.operation}`;
      if (!batches.has(key)) {
        batches.set(key, []);
      }
      batches.get(key)!.push(item);
    }
    
    // Process each batch
    for (const [key, items] of batches) {
      const [tableName, operation] = key.split(':') as [string, SyncOperation];
      
      try {
        if (operation === 'DELETE') {
          // Process deletes one by one (can't batch easily)
          for (const item of items) {
            try {
              await this.executeSyncOperation(item);
              this.pendingQueue = this.pendingQueue.filter((p) => p.id !== item.id);
              success++;
            } catch (error) {
              this.markItemFailed(item, error);
              failed++;
            }
          }
        } else {
          // Batch INSERT and UPDATE operations using upsert
          const payloads = items.map((item) => item.payload);
          
          const { error } = await supabase.from(tableName).upsert(payloads, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });
          
          if (error) {
            // If batch fails, fall back to individual processing
            if (__DEV__) {
              console.warn('Batch upsert failed, falling back to individual:', error.message);
            }
            for (const item of items) {
              try {
                await this.executeSyncOperation(item);
                this.pendingQueue = this.pendingQueue.filter((p) => p.id !== item.id);
                success++;
              } catch (itemError) {
                this.markItemFailed(item, itemError);
                failed++;
              }
            }
          } else {
            // Batch succeeded - remove all items
            const itemIds = new Set(items.map((i) => i.id));
            this.pendingQueue = this.pendingQueue.filter((p) => !itemIds.has(p.id));
            success += items.length;
          }
        }
      } catch (batchError) {
        if (__DEV__) {
          console.error('Batch processing error:', batchError);
        }
        // Mark all items in this batch as failed
        for (const item of items) {
          this.markItemFailed(item, batchError);
          failed++;
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
   * Mark an item as failed and schedule retry with exponential backoff
   * If max attempts exceeded, move to Dead Letter Queue
   */
  private markItemFailed(item: PendingSyncItem, error: unknown) {
    const index = this.pendingQueue.findIndex((p) => p.id === item.id);
    if (index >= 0) {
      this.pendingQueue[index].attempts++;
      this.pendingQueue[index].lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if exceeded max attempts - move to Dead Letter Queue
      if (this.pendingQueue[index].attempts > OfflineSyncManager.MAX_RETRY_ATTEMPTS) {
        this.pendingQueue[index].requiresManualRetry = true;
        if (__DEV__) {
          console.warn('🚨 Sync item moved to Dead Letter Queue (exceeded max attempts):', {
            table: item.tableName,
            recordId: item.recordId,
            attempts: this.pendingQueue[index].attempts,
            lastError: this.pendingQueue[index].lastError,
          });
        }
        
        // Add breadcrumb for monitoring
        addBreadcrumb('Item moved to DLQ', 'sync', {
          tableName: item.tableName,
          recordId: item.recordId,
          attempts: this.pendingQueue[index].attempts,
        });
      } else {
        // Schedule retry with exponential backoff
        this.scheduleRetry(this.pendingQueue[index]);
      }
    }
  }

  /**
   * Execute a single sync operation
   */
  private async executeSyncOperation(item: PendingSyncItem): Promise<void> {
    const { operation, tableName, recordId, payload } = item;
    
    switch (operation) {
      case 'INSERT': {
        // Use upsert to prevent duplicate key errors on retries
        const { error } = await supabase.from(tableName).upsert(payload, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });
        if (error) throw error;
        break;
      }
      case 'UPDATE': {
        // Use upsert for updates too - more resilient to race conditions
        const { error } = await supabase.from(tableName).upsert(payload, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });
        if (error) throw error;
        break;
      }
      case 'DELETE': {
        const { error } = await supabase.from(tableName).delete().eq('id', recordId);
        if (error) throw error;
        break;
      }
    }
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
   * Get items in the Dead Letter Queue (require manual retry)
   */
  getDeadLetterQueue(): PendingSyncItem[] {
    return this.pendingQueue.filter(item => item.requiresManualRetry === true);
  }

  /**
   * Retry all items in the Dead Letter Queue
   * Resets their attempts and removes DLQ flag
   */
  retryDeadLetterQueue(): void {
    let retried = 0;
    this.pendingQueue = this.pendingQueue.map(item => {
      if (item.requiresManualRetry) {
        retried++;
        return {
          ...item,
          attempts: 0,
          requiresManualRetry: false,
          nextRetryAt: undefined,
          lastError: undefined,
        };
      }
      return item;
    });
    
    if (retried > 0) {
      this.savePendingQueue();
      this.notifyListeners();
      
      if (__DEV__) {
        console.log(`🔄 Retrying ${retried} items from Dead Letter Queue`);
      }
      
      if (this.isOnline) {
        this.syncPendingItems();
      }
    }
  }

  /**
   * Remove a specific item from the queue (e.g., if manually resolved)
   */
  removeFromQueue(itemId: string): void {
    this.pendingQueue = this.pendingQueue.filter(item => item.id !== itemId);
    
    // Clear any pending timeout
    const timeout = this.backoffTimeouts.get(itemId);
    if (timeout) {
      clearTimeout(timeout);
      this.backoffTimeouts.delete(itemId);
    }
    
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
    // Clear all backoff timeouts
    this.backoffTimeouts.forEach(timeout => clearTimeout(timeout));
    this.backoffTimeouts.clear();
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
