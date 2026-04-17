import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage Wrapper - MMKV with AsyncStorage Fallback
 * * MMKV is synchronous and fast. We wrap it to handle environments 
 * where JSI is unavailable (e.g., Remote Debugging).
 */

// 1. Initialize MMKV safely. If it fails, we catch the error and use AsyncStorage.
let mmkv: MMKV | null = null;
try {
  mmkv = new MMKV({ id: 'symmetry-storage' });
} catch (e) {
  console.warn("MMKV failed to initialize (likely due to Remote Debugging). Falling back to AsyncStorage.");
}

/**
 * Storage adapter for Zustand persist middleware
 */
export const storageAdapter: StateStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (mmkv) return mmkv.getString(key) ?? null;
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (mmkv) {
      mmkv.set(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (mmkv) {
      mmkv.delete(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

/**
 * Helper functions for typed storage
 */
export const StorageKeys = {
  USER: 'user',
  WORKOUT_PLANS: 'workout_plans',
  BODY_MEASUREMENTS: 'body_measurements',
  SETTINGS: 'settings',
} as const;

export async function getStorageItem<T>(key: string): Promise<T | null> {
  // Try MMKV first
  if (mmkv) {
    const item = mmkv.getString(key);
    if (item) {
      try {
        return JSON.parse(item) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
  
  // Fallback to Async Storage
  try {
    const item = await AsyncStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  const stringValue = JSON.stringify(value);
  if (mmkv) {
    mmkv.set(key, stringValue);
    return;
  }
  await AsyncStorage.setItem(key, stringValue);
}

export async function removeStorageItem(key: string): Promise<void> {
  if (mmkv) {
    mmkv.delete(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function clearStorage(): Promise<void> {
  if (mmkv) {
    mmkv.clearAll();
    return;
  }
  await AsyncStorage.clear();
}