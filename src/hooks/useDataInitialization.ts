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
import { DEFAULT_FRESHNESS_WINDOW_MS, isAbortError, isStaleTimestamp } from '@/lib/utils';

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
 * Uses "stale-while-revalidate" pattern:
 * - If data exists in store, show it immediately (no loading spinner)
 * - Silently refresh in the background
 * - Only show loading spinner if store is completely empty
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
  
  // Check if we already have data in store (for stale-while-revalidate)
  const existingUserId = useAppStore((s) => s.user?.id ?? null);
  const existingPlansCount = useAppStore((s) => s.workoutPlans.length);
  const hasExistingData = existingUserId !== null || existingPlansCount > 0;
  
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

    // Stale-while-revalidate: Only show loading if we have NO data
    // If we have cached data, show it immediately and refresh silently
    if (!hasExistingData) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    } else {
      // We have data, mark as initialized immediately, refresh in background
      setState((prev) => ({ ...prev, isLoading: false, isInitialized: true, error: null }));
    }

    try {
      if (__DEV__) {
        console.log('📥 Initializing data for user:', userId, hasExistingData ? '(background refresh)' : '(initial load)');
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
      if (isAbortError(error)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isInitialized: prev.isInitialized || hasExistingData,
          error: null,
        }));
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      console.error('❌ Data initialization error:', errorMessage);
      
      setState({
        isLoading: false,
        isInitialized: false,
        error: errorMessage,
      });
    }
  }, [userId, isGuest, hasExistingData, setUser, setNutritionTargets, setEquipment, setWorkoutPlans]);

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
 * 
 * Uses "stale-while-revalidate" pattern:
 * - If data exists in store, show it immediately (no loading spinner)
 * - Silently refresh in the background
 * - Only show loading spinner if store is completely empty
 */
export function useProgressDataInitialization(userId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadAtRef = useRef(0);

  // Use the bulk set methods instead of individual add methods
  const setMeasurementLogs = useAppStore((s) => s.setMeasurementLogs);
  const setPhysiqueScans = useAppStore((s) => s.setPhysiqueScans);
  const setCardioLogs = useAppStore((s) => s.setCardioLogs);
  const isGuest = useAppStore((s) => s.isGuest);
  
  // Check if we already have data in store (for stale-while-revalidate)
  const measurementCount = useAppStore((s) => s.measurementLogs.length);
  const physiqueScanCount = useAppStore((s) => s.physiqueScans.length);
  const cardioCount = useAppStore((s) => s.cardioLogs.length);

  const hasExistingData = measurementCount > 0 || physiqueScanCount > 0 || cardioCount > 0;

  const loadProgressData = useCallback(async (options?: { force?: boolean; staleMs?: number }) => {
    if (!userId) return;

    const now = Date.now();
    const force = options?.force ?? false;
    const staleMs = options?.staleMs ?? DEFAULT_FRESHNESS_WINDOW_MS;
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    // Prevent near-duplicate refreshes from focus + mount effects.
    if (!force && !isStaleTimestamp(lastLoadAtRef.current, staleMs)) {
      return;
    }

    const run = async () => {
      setIsRefreshing(true);

      // Stale-while-revalidate: Only show loading if we have NO data
      // If we have cached data, show it immediately and refresh silently
      if (!hasExistingData) {
        setIsLoading(true);
      }
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
        if (isAbortError(err)) {
          setError(null);
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Failed to load progress data';
        setError(errorMessage);
        console.error('❌ Progress data error:', errorMessage);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    const promise = run().finally(() => {
      inFlightRef.current = null;
      lastLoadAtRef.current = Date.now();
    });

    inFlightRef.current = promise;
    return promise;
  }, [
    userId,
    isGuest,
    hasExistingData,
    setMeasurementLogs,
    setPhysiqueScans,
    setCardioLogs,
  ]);

  return {
    isLoading,
    isRefreshing,
    error,
    loadProgressData,
  };
}
