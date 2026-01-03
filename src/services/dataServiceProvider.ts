/**
 * Data Service Provider
 * 
 * This file provides a singleton data service instance that can be used throughout the app.
 * It automatically switches between LocalService and CloudService based on configuration.
 * 
 * Usage:
 * ```typescript
 * import { dataService } from '@/services/dataServiceProvider';
 * 
 * // Use in any component/screen
 * const workoutPlans = await dataService.workout.getWorkoutPlans(userId);
 * ```
 */

import Constants from 'expo-constants';
import { localService } from './LocalService';
import { cloudService } from './CloudService';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { IDataService } from './interfaces';

/**
 * Determine which service to use based on environment configuration
 */
function getDataService(): IDataService {
  // Get the data service mode from environment
  const dataServiceMode = Constants.expoConfig?.extra?.dataService || 
                          process.env.EXPO_PUBLIC_DATA_SERVICE || 
                          'local';

  // Use CloudService only if:
  // 1. Mode is set to 'cloud'
  // 2. Supabase is properly configured (URL and Anon Key are set)
  if (dataServiceMode === 'cloud' && isSupabaseConfigured()) {
    if (__DEV__) {
      console.log('📦 Data Service: CloudService (Supabase)');
    }
    return cloudService;
  }

  // Default to LocalService
  if (__DEV__) {
    console.log('📦 Data Service: LocalService (AsyncStorage)');
    if (dataServiceMode === 'cloud' && !isSupabaseConfigured()) {
      console.warn('⚠️  CloudService requested but Supabase not configured. Falling back to LocalService.');
    }
  }
  return localService;
}

/**
 * Singleton data service instance
 * This is the ONLY instance your app should use
 */
export const dataService = getDataService();

/**
 * Helper function to check which service is active
 */
export const isUsingCloudService = (): boolean => {
  return dataService === cloudService;
};

/**
 * Helper to get service name for debugging/display
 */
export const getActiveServiceName = (): 'local' | 'cloud' => {
  return dataService === cloudService ? 'cloud' : 'local';
};
