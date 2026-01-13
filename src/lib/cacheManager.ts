/**
 * Cache Manager - LRU Cache Hygiene
 * 
 * Manages the FileSystem cache to prevent unbounded storage growth.
 * Uses Least Recently Used (LRU) eviction strategy.
 * 
 * Features:
 * - Configurable max cache size
 * - Automatic cleanup on app launch
 * - Sorts by modification time (oldest first)
 * - Deletes oldest files until under limit
 */

import * as FileSystem from 'expo-file-system';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum cache size in bytes (500MB default) */
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

/** Cache directory path */
const CACHE_DIRECTORY = FileSystem.cacheDirectory;

/** Minimum time between cache cleanups (1 hour) */
const MIN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in ms

/** Storage key for last cleanup timestamp */
const LAST_CLEANUP_KEY = 'cache:last_cleanup';

// ============================================================================
// TYPES
// ============================================================================

interface CacheFileInfo {
  uri: string;
  size: number;
  modificationTime: number;
}

interface CacheStats {
  totalFiles: number;
  totalSize: number;
  oldestFile: Date | null;
  newestFile: Date | null;
}

interface CleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  currentSize: number;
  wasNeeded: boolean;
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

class CacheManager {
  private lastCleanupTime: number = 0;
  private isCleaningUp: boolean = false;

  /**
   * Get information about all files in the cache directory
   */
  private async getCacheFiles(): Promise<CacheFileInfo[]> {
    if (!CACHE_DIRECTORY) {
      if (__DEV__) console.warn('Cache directory not available');
      return [];
    }

    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
      const fileInfos: CacheFileInfo[] = [];

      for (const fileName of files) {
        try {
          const uri = `${CACHE_DIRECTORY}${fileName}`;
          const info = await FileSystem.getInfoAsync(uri, { size: true });
          
          if (info.exists && !info.isDirectory) {
            fileInfos.push({
              uri,
              size: info.size || 0,
              modificationTime: info.modificationTime || Date.now(),
            });
          }
        } catch (err) {
          // Skip files we can't read
          if (__DEV__) console.warn(`Could not read file info: ${fileName}`);
        }
      }

      return fileInfos;
    } catch (error) {
      if (__DEV__) console.error('Failed to read cache directory:', error);
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const files = await this.getCacheFiles();
    
    if (files.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
      };
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const sorted = files.sort((a, b) => a.modificationTime - b.modificationTime);

    return {
      totalFiles: files.length,
      totalSize,
      oldestFile: new Date(sorted[0].modificationTime * 1000),
      newestFile: new Date(sorted[sorted.length - 1].modificationTime * 1000),
    };
  }

  /**
   * Clean the cache using LRU eviction strategy
   * Deletes oldest files until cache size is under MAX_CACHE_SIZE
   */
  async cleanCache(force: boolean = false): Promise<CleanupResult> {
    // Prevent concurrent cleanups
    if (this.isCleaningUp) {
      return {
        filesDeleted: 0,
        bytesFreed: 0,
        currentSize: 0,
        wasNeeded: false,
      };
    }

    // Check if we've cleaned up recently (unless forced)
    const now = Date.now();
    if (!force && now - this.lastCleanupTime < MIN_CLEANUP_INTERVAL) {
      if (__DEV__) console.log('🧹 Cache cleanup skipped (too recent)');
      return {
        filesDeleted: 0,
        bytesFreed: 0,
        currentSize: 0,
        wasNeeded: false,
      };
    }

    this.isCleaningUp = true;
    this.lastCleanupTime = now;

    try {
      const files = await this.getCacheFiles();
      
      // Calculate total size
      let totalSize = files.reduce((sum, f) => sum + f.size, 0);

      // Check if cleanup is needed
      if (totalSize <= MAX_CACHE_SIZE) {
        if (__DEV__) {
          console.log(`🧹 Cache is within limits: ${this.formatBytes(totalSize)} / ${this.formatBytes(MAX_CACHE_SIZE)}`);
        }
        return {
          filesDeleted: 0,
          bytesFreed: 0,
          currentSize: totalSize,
          wasNeeded: false,
        };
      }

      // Sort by modification time (oldest first for LRU)
      const sorted = files.sort((a, b) => a.modificationTime - b.modificationTime);

      let filesDeleted = 0;
      let bytesFreed = 0;

      // Delete oldest files until under limit
      for (const file of sorted) {
        if (totalSize <= MAX_CACHE_SIZE) {
          break;
        }

        try {
          await FileSystem.deleteAsync(file.uri, { idempotent: true });
          totalSize -= file.size;
          bytesFreed += file.size;
          filesDeleted++;
        } catch (err) {
          if (__DEV__) console.warn(`Failed to delete cache file: ${file.uri}`);
        }
      }

      if (__DEV__) {
        console.log(`🧹 Cache cleanup complete: ${filesDeleted} files deleted, ${this.formatBytes(bytesFreed)} freed`);
        console.log(`🧹 Current cache size: ${this.formatBytes(totalSize)} / ${this.formatBytes(MAX_CACHE_SIZE)}`);
      }

      return {
        filesDeleted,
        bytesFreed,
        currentSize: totalSize,
        wasNeeded: true,
      };
    } catch (error) {
      if (__DEV__) console.error('Cache cleanup failed:', error);
      return {
        filesDeleted: 0,
        bytesFreed: 0,
        currentSize: 0,
        wasNeeded: false,
      };
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Clear the entire cache
   */
  async clearCache(): Promise<void> {
    if (!CACHE_DIRECTORY) return;

    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
      
      for (const fileName of files) {
        try {
          await FileSystem.deleteAsync(`${CACHE_DIRECTORY}${fileName}`, { idempotent: true });
        } catch (err) {
          // Ignore individual file deletion errors
        }
      }

      if (__DEV__) console.log('🧹 Cache cleared completely');
    } catch (error) {
      if (__DEV__) console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Get the maximum cache size setting
   */
  getMaxCacheSize(): number {
    return MAX_CACHE_SIZE;
  }

  /**
   * Get the maximum cache size as formatted string
   */
  getMaxCacheSizeFormatted(): string {
    return this.formatBytes(MAX_CACHE_SIZE);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const cacheManager = new CacheManager();

// ============================================================================
// HOOK FOR REACT COMPONENTS
// ============================================================================

import { useState, useEffect } from 'react';

export function useCacheStats() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const cacheStats = await cacheManager.getCacheStats();
      setStats(cacheStats);
      setIsLoading(false);
    }
    loadStats();
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    const cacheStats = await cacheManager.getCacheStats();
    setStats(cacheStats);
    setIsLoading(false);
  };

  return { stats, isLoading, refresh };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Run cache cleanup silently on app launch
 * Should be called in useDataInitialization or _layout.tsx
 */
export async function runCacheCleanup(): Promise<void> {
  try {
    await cacheManager.cleanCache();
  } catch (error) {
    // Silently fail - cache cleanup is not critical
    if (__DEV__) console.warn('Cache cleanup failed silently:', error);
  }
}

export default cacheManager;
