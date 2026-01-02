import { MMKV } from 'react-native-mmkv';

/**
 * MMKV Storage Wrapper
 * 
 * Drop-in replacement for localStorage
 * Synchronous, fast, encrypted storage
 */

export const storage = new MMKV({
  id: 'symmetry-app-storage',
  encryptionKey: 'your-secure-encryption-key-here', // TODO: Move to secure env
});

export const storageAdapter = {
  getItem: (key: string): string | null => {
    const value = storage.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
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
  const item = storage.getString(key);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  storage.delete(key);
}

export function clearStorage(): void {
  storage.clearAll();
}
