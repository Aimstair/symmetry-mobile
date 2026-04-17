import { showAppAlert } from '@/store/useAlertStore';
/**
 * Supabase Configuration
 * 
 * This module initializes the Supabase client for the app.
 * It reads from environment variables to support both local and production environments.
 * 
 * Local Development: http://127.0.0.1:54321
 * Production: https://your-project.supabase.co
 */

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-url-polyfill/auto';

// Get environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'âš ï¸  Supabase URL or Anon Key not found in environment variables.\n' +
    'Make sure to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

// CRITICAL: Production environment check
// Prevents releasing a build configured with local/dev Supabase URL
if (!__DEV__ && supabaseUrl) {
  const isLocalUrl = supabaseUrl.includes('192.168') || 
                     supabaseUrl.includes('localhost') || 
                     supabaseUrl.includes('127.0.0.1') ||
                     supabaseUrl.includes('.local');
  
  if (isLocalUrl) {
    // This is a production build but configured with a local URL!
    console.error('ðŸš¨ CRITICAL: Production build configured with local Supabase URL:', supabaseUrl);
    
    // Show alert to user (will appear on app launch)
    setTimeout(() => {
      showAppAlert(
        'Configuration Error',
        'This build is configured with a development URL and cannot connect to the server. Please contact support or reinstall the app.',
        [{ text: 'OK' }]
      );
    }, 1000);
    
    // Also throw error to make it very visible in crash reporting
    throw new Error(
      `Production build configured with local Supabase URL: ${supabaseUrl}. ` +
      'Please check EAS Secrets and ensure EXPO_PUBLIC_SUPABASE_URL is set to the production URL.'
    );
  }
}

// Robust storage adapter for Supabase Auth
// Uses AsyncStorage with proper error handling and retry logic
const SupabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (error) {
      if (__DEV__) {
        console.error('âŒ AsyncStorage getItem error:', key, error);
      }
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      if (__DEV__) {
        console.error('âŒ AsyncStorage setItem error:', key, error);
      }
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      if (__DEV__) {
        console.error('âŒ AsyncStorage removeItem error:', key, error);
      }
    }
  },
};

// Create Supabase client with robust auth configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SupabaseStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Faster lock acquisition for mobile
    storageKey: 'symmetry-auth-session',
    // Use implicit flow for OAuth (returns tokens directly in URL hash)
    // PKCE flow returns a code that needs to be exchanged, which is harder
    // to handle with our Edge Function redirect approach
    flowType: 'implicit',
  },
  // Global fetch options for better mobile performance
  global: {
    fetch: (url, options) => {
      // Manual timeout implementation (AbortSignal.timeout not available in RN)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      return fetch(url, {
        ...options,
        signal: options?.signal || controller.signal,
      }).finally(() => clearTimeout(timeoutId));
    },
  },
});

// Auto-refresh session when app comes to foreground
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export function initializeSupabaseAppStateListener() {
  if (appStateSubscription) return; // Already initialized
  
  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      // App came to foreground - start auto refresh
      supabase.auth.startAutoRefresh();
    } else {
      // App went to background - stop auto refresh to save battery
      supabase.auth.stopAutoRefresh();
    }
  });
}

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Helper to check network connectivity via Supabase
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

// Log configuration (helpful for debugging)
if (__DEV__) {
  console.log('âœ… Supabase client initialized');
}



