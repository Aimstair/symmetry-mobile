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

// ============================================================================
// TYPES
// ============================================================================

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type SyncPriority = 'critical' | 'high' | 'normal' | 'low';

export interface QueueOperationOptions {
  priority?: SyncPriority;
  clientUpdatedAt?: Date | string | number;
  immediate?: boolean;
  conflictTarget?: string;
}

export interface PendingSyncItem {
  id: string;
  operation: SyncOperation;
  tableName: string;
  recordId: string;
  payload: any;
  createdAt: Date;
  priority: SyncPriority;
  clientUpdatedAt?: number;
  conflictTarget?: string;
  attempts: number;
  lastError?: string;
  requiresManualRetry?: boolean; // Dead Letter Queue flag
  nextRetryAt?: number; // Timestamp for next retry
}

export interface SyncPendingByPriority {
  critical: number;
  high: number;
  normal: number;
  low: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  pendingByPriority: SyncPendingByPriority;
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
  private lastSyncedAt: Date | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private backoffTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private syncTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Maximum retry attempts before moving to Dead Letter Queue
  private static readonly MAX_RETRY_ATTEMPTS = 10;
  private static readonly PERIODIC_SYNC_INTERVAL_MS = 5000;
  private static readonly RECONNECT_SYNC_DEBOUNCE_MS = 1500;
  private static readonly FOLLOW_UP_SYNC_DEBOUNCE_MS = 300;
  private static readonly MAX_SYNC_ITEMS_PER_CYCLE = 40;

  private static readonly PRIORITY_WEIGHT: Record<SyncPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  /**
   * Calculate exponential backoff delay
   * Formula: min(30s, 2^attempts * 1s + random jitter)
   */
  private calculateBackoff(attempts: number): number {
    const baseDelay = Math.pow(2, attempts) * 1000;
    const jitter = Math.random() * 1000;
    return Math.min(30000, baseDelay + jitter);
  }

  private toTimestamp(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.getTime();
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    }

    return undefined;
  }

  private getPriorityForTable(tableName: string): SyncPriority {
    if (tableName === 'workout_sessions' || tableName === 'session_exercises' || tableName === 'session_sets') {
      return 'critical';
    }

    if (tableName === 'workout_plans' || tableName === 'workout_days' || tableName === 'plan_exercises' || tableName === 'workout_schedule') {
      return 'high';
    }

    if (tableName === 'users' || tableName === 'nutrition_targets' || tableName === 'equipment_profiles' || tableName === 'training_days_history' || tableName === 'measurement_logs' || tableName === 'physique_scans' || tableName === 'cardio_logs') {
      return 'normal';
    }

    return 'low';
  }

  private getPendingByPriority(): SyncPendingByPriority {
    const counts: SyncPendingByPriority = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const item of this.pendingQueue) {
      counts[item.priority] += 1;
    }

    return counts;
  }

  private scheduleSyncTrigger(debounceMs: number = 0): void {
    if (!this.isOnline) {
      return;
    }

    if (this.syncTriggerTimeout) {
      clearTimeout(this.syncTriggerTimeout);
      this.syncTriggerTimeout = null;
    }

    if (debounceMs <= 0) {
      void this.syncPendingItems();
      return;
    }

    this.syncTriggerTimeout = setTimeout(() => {
      this.syncTriggerTimeout = null;
      if (this.isOnline) {
        void this.syncPendingItems();
      }
    }, debounceMs);
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
      const stored = await storageAdapter.getItem(SYNC_KEYS.PENDING_QUEUE);
      if (typeof stored === 'string' && stored.length > 0) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.pendingQueue = parsed.map((item) => ({
            ...item,
            createdAt: item?.createdAt ? new Date(item.createdAt) : new Date(),
            priority: item?.priority || this.getPriorityForTable(item?.tableName || ''),
            clientUpdatedAt: this.toTimestamp(item?.clientUpdatedAt),
            conflictTarget: typeof item?.conflictTarget === 'string' && item.conflictTarget.trim().length > 0
              ? item.conflictTarget
              : undefined,
          }));
        }
      }

      const lastSynced = await storageAdapter.getItem(SYNC_KEYS.LAST_SYNCED);
      if (typeof lastSynced === 'string' && lastSynced.length > 0) {
        const parsedDate = new Date(lastSynced);
        this.lastSyncedAt = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
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
      void storageAdapter.setItem(SYNC_KEYS.PENDING_QUEUE, JSON.stringify(this.pendingQueue));
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
        this.scheduleSyncTrigger(OfflineSyncManager.RECONNECT_SYNC_DEBOUNCE_MS);
      }

      if (!this.isOnline && this.syncTriggerTimeout) {
        clearTimeout(this.syncTriggerTimeout);
        this.syncTriggerTimeout = null;
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
        this.scheduleSyncTrigger();
      }
    }, OfflineSyncManager.PERIODIC_SYNC_INTERVAL_MS);
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
        this.scheduleSyncTrigger();
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
    payload: any,
    options: QueueOperationOptions = {}
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
      priority: options.priority || this.getPriorityForTable(tableName),
      clientUpdatedAt: this.toTimestamp(options.clientUpdatedAt),
      conflictTarget: options.conflictTarget,
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
    if (this.isOnline && options.immediate !== false) {
      this.scheduleSyncTrigger();
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
    const retryableItems = this.pendingQueue.filter(
      item => !item.requiresManualRetry && 
              (!item.nextRetryAt || item.nextRetryAt <= now)
    );
    
    if (retryableItems.length === 0) {
      return { success: 0, failed: 0 };
    }

    const itemsToSync = retryableItems
      .sort((a, b) => {
        const priorityDiff = OfflineSyncManager.PRIORITY_WEIGHT[a.priority] - OfflineSyncManager.PRIORITY_WEIGHT[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, OfflineSyncManager.MAX_SYNC_ITEMS_PER_CYCLE);
    
    // Add breadcrumb for debugging
    addBreadcrumb('Starting sync', 'sync', {
      pendingCount: this.pendingQueue.length,
      syncingCount: itemsToSync.length,
      readyCount: retryableItems.length,
      dlqCount: this.pendingQueue.filter(i => i.requiresManualRetry).length,
    });
    
    this.isSyncing = true;
    this.notifyListeners();
    
    let success = 0;
    let failed = 0;
    
    // Group items by table and operation for batching
    const batches = new Map<string, PendingSyncItem[]>();
    
    for (const item of itemsToSync) {
      const key = `${item.tableName}:${item.operation}:${item.conflictTarget || 'id'}`;
      if (!batches.has(key)) {
        batches.set(key, []);
      }
      batches.get(key)!.push(item);
    }
    
    // Process each batch
    for (const [key, items] of batches) {
      const [tableName, operation, conflictTarget] = key.split(':') as [string, SyncOperation, string];
      
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
            onConflict: conflictTarget || 'id',
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
      this.lastSyncedAt = new Date();
      void storageAdapter.setItem(SYNC_KEYS.LAST_SYNCED, this.lastSyncedAt.toISOString());
    }
    
    this.isSyncing = false;
    this.notifyListeners();
    
    if (__DEV__) {
      console.log(`🔄 Sync complete: ${success} success, ${failed} failed`);
    }

    if (this.hasRetryableItems()) {
      this.scheduleSyncTrigger(OfflineSyncManager.FOLLOW_UP_SYNC_DEBOUNCE_MS);
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
    const { operation, tableName, recordId, payload, conflictTarget } = item;
    
    switch (operation) {
      case 'INSERT': {
        // Use upsert to prevent duplicate key errors on retries
        const { error } = await supabase.from(tableName).upsert(payload, {
          onConflict: conflictTarget || 'id',
          ignoreDuplicates: false,
        });
        if (error) throw error;
        break;
      }
      case 'UPDATE': {
        // Use upsert for updates too - more resilient to race conditions
        const { error } = await supabase.from(tableName).upsert(payload, {
          onConflict: conflictTarget || 'id',
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
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingQueue.length,
      pendingByPriority: this.getPendingByPriority(),
      lastSyncedAt: this.lastSyncedAt,
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
        this.scheduleSyncTrigger();
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
    if (this.syncTriggerTimeout) {
      clearTimeout(this.syncTriggerTimeout);
      this.syncTriggerTimeout = null;
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
