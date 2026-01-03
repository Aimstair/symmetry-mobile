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
import 'react-native-url-polyfill/auto';

// Get environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️  Supabase URL or Anon Key not found in environment variables.\n' +
    'Make sure to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage for session persistence
    storage: undefined, // Will use default AsyncStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Log configuration (helpful for debugging)
if (__DEV__) {
  console.log('📡 Supabase Configuration:', {
    url: supabaseUrl || '❌ Not configured',
    configured: isSupabaseConfigured(),
  });
}
