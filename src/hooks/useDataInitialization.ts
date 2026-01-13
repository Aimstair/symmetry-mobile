/**
 * Data Initialization Hook
 * 
 * This hook handles loading data from the data service (local or cloud)
 * and populating the Zustand store on app startup.
 * 
 * Features:
 * - Loads user, workout plans, and progress data
 * - Provides loading/error states for UI rendering
 * - Automatically syncs data service with store
 * - Runs cache cleanup on app launch
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { dataService } from '@/services/dataServiceProvider';
import { localService } from '@/services/LocalService';
import { useAppStore } from '@/store/useAppStore';
import { runCacheCleanup } from '@/lib/cacheManager';

interface DataInitializationState {
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface UseDataInitializationReturn extends DataInitializationState {
  refetch: () => Promise<void>;
}

/**
 * Hook to initialize app data from the data service
 * 
 * @param userId - The user ID to fetch data for (can be null during onboarding)
 * @returns Loading state, error state, and refetch function
 */
export function useDataInitialization(userId: string | null): UseDataInitializationReturn {
  const [state, setState] = useState<DataInitializationState>({
    isLoading: true,
    isInitialized: false,
    error: null,
  });

  // Get store actions
  const setUser = useAppStore((s) => s.setUser);
  const setNutritionTargets = useAppStore((s) => s.setNutritionTargets);
  const setEquipment = useAppStore((s) => s.setEquipment);
  const setWorkoutPlans = useAppStore((s) => s.setWorkoutPlans);
  const isGuest = useAppStore((s) => s.isGuest);
  
  // Track if cache cleanup has run this session
  const cacheCleanupRan = useRef(false);

  const initializeData = useCallback(async () => {
    // Run cache cleanup once per app session (silently in background)
    if (!cacheCleanupRan.current) {
      cacheCleanupRan.current = true;
      runCacheCleanup(); // Fire and forget - don't await
    }
    
    if (!userId) {
      setState({
        isLoading: false,
        isInitialized: true,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (__DEV__) {
        console.log('📥 Initializing data for user:', userId);
      }

      // Use LocalService directly for guest users to avoid UUID errors
      const service = isGuest ? localService : dataService;

      // Fetch all data in parallel
      const [user, nutritionTargets, equipment, workoutPlans] = await Promise.all([
        service.user.getUser(userId),
        service.user.getNutritionTargets(userId),
        service.user.getEquipment(userId),
        service.workout.getWorkoutPlans(userId),
      ]);

      // Update store with fetched data
      if (user) {
        setUser(user);
        if (__DEV__) console.log('✅ User loaded:', user.name);
      }

      if (nutritionTargets) {
        setNutritionTargets(nutritionTargets);
        if (__DEV__) console.log('✅ Nutrition targets loaded');
      }

      if (equipment) {
        setEquipment(equipment);
        if (__DEV__) console.log('✅ Equipment profile loaded');
      }

      if (workoutPlans && workoutPlans.length > 0) {
        setWorkoutPlans(workoutPlans);
        if (__DEV__) console.log('✅ Workout plans loaded:', workoutPlans.length);
      }

      setState({
        isLoading: false,
        isInitialized: true,
        error: null,
      });

      if (__DEV__) {
        console.log('🎉 Data initialization complete');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      console.error('❌ Data initialization error:', errorMessage);
      
      setState({
        isLoading: false,
        isInitialized: false,
        error: errorMessage,
      });
    }
  }, [userId, isGuest, setUser, setNutritionTargets, setEquipment, setWorkoutPlans]);

  // Initialize on mount and when userId changes
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  return {
    ...state,
    refetch: initializeData,
  };
}

/**
 * Hook to load progress data (body measurements, scans, cardio logs)
 * Separated from main init for lazy loading on the Progress tab
 */
export function useProgressDataInitialization(userId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the bulk set methods instead of individual add methods
  const setMeasurementLogs = useAppStore((s) => s.setMeasurementLogs);
  const setPhysiqueScans = useAppStore((s) => s.setPhysiqueScans);
  const setCardioLogs = useAppStore((s) => s.setCardioLogs);
  const isGuest = useAppStore((s) => s.isGuest);

  const loadProgressData = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use LocalService directly for guest users to avoid UUID errors
      const service = isGuest ? localService : dataService;
      
      const [measurements, scans, cardio] = await Promise.all([
        service.progress.getMeasurementLogs(userId),
        service.progress.getPhysiqueScans(userId),
        service.progress.getCardioLogs(userId),
      ]);

      // Set all data at once (replacing existing data with fresh data from server)
      setMeasurementLogs(measurements);
      setPhysiqueScans(scans);
      setCardioLogs(cardio);

      if (__DEV__) {
        console.log('✅ Progress data loaded:', {
          measurements: measurements.length,
          scans: scans.length,
          cardio: cardio.length,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load progress data';
      setError(errorMessage);
      console.error('❌ Progress data error:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    userId,
    isGuest,
    setMeasurementLogs,
    setPhysiqueScans,
    setCardioLogs,
  ]);

  return {
    isLoading,
    error,
    loadProgressData,
  };
}
