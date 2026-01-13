import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';

/**
 * Storage Wrapper - MMKV Implementation
 * 
 * MMKV is synchronous and blazing fast, eliminating race conditions.
 * We keep the async interface for compatibility with existing code.
 */

// Initialize MMKV instance
const mmkv = new MMKV({ id: 'symmetry-storage' });

/**
 * Storage adapter for Zustand persist middleware
 * Uses MMKV under the hood but maintains async interface for compatibility
 */
export const storageAdapter: StateStorage = {
  getItem: (key: string): string | null => {
    return mmkv.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    mmkv.set(key, value);
  },
  removeItem: (key: string): void => {
    mmkv.delete(key);
  },
};

/**
 * Helper functions for typed storage
 * NOTE: These remain async-returning for interface compatibility with LocalService
 */
export const StorageKeys = {
  USER: 'user',
  WORKOUT_PLANS: 'workout_plans',
  BODY_MEASUREMENTS: 'body_measurements',
  SETTINGS: 'settings',
} as const;

export async function getStorageItem<T>(key: string): Promise<T | null> {
  const item = mmkv.getString(key);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  mmkv.set(key, JSON.stringify(value));
}

export async function removeStorageItem(key: string): Promise<void> {
  mmkv.delete(key);
}

export async function clearStorage(): Promise<void> {
  mmkv.clearAll();
}
