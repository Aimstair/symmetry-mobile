import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage Wrapper - Expo Compatible
 * 
 * Uses AsyncStorage for Expo Go compatibility
 * TODO: Switch to MMKV for production builds with:
 * import { MMKV } from 'react-native-mmkv';
 */

// For Expo Go, we'll use a synchronous wrapper around AsyncStorage
// This is not ideal but works for development
let cache: Record<string, string> = {};
let isInitialized = false;

// Initialize cache from AsyncStorage
const initializeCache = async () => {
  if (isInitialized) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const items = await AsyncStorage.multiGet(keys);
    items.forEach(([key, value]) => {
      if (value) cache[key] = value;
    });
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize storage cache:', error);
  }
};

// Start initialization
initializeCache();

export const storageAdapter = {
  getItem: (key: string): string | null => {
    return cache[key] ?? null;
  },
  setItem: (key: string, value: string): void => {
    cache[key] = value;
    // Async persist
    AsyncStorage.setItem(key, value).catch(console.error);
  },
  removeItem: (key: string): void => {
    delete cache[key];
    // Async persist
    AsyncStorage.removeItem(key).catch(console.error);
  },
};

/**
 * Helper functions for typed storage
 */
export const StorageKeys = {
  USER: 'user',
  WORKOUT_PLANS: 'workout-plans',
  BODY_MEASUREMENTS: 'body-measurements',
  SETTINGS: 'settings',
} as const;

export function getStorageItem<T>(key: string): T | null {
  const item = storageAdapter.getItem(key);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  storageAdapter.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  storageAdapter.removeItem(key);
}

export function clearStorage(): void {
  cache = {};
  AsyncStorage.clear().catch(console.error);
}
