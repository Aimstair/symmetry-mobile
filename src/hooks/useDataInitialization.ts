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
 */

import { useEffect, useState, useCallback } from 'react';
import { dataService } from '@/services/dataServiceProvider';
import { useAppStore } from '@/store/useAppStore';

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

  const initializeData = useCallback(async () => {
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

      // Fetch all data in parallel
      const [user, nutritionTargets, equipment, workoutPlans] = await Promise.all([
        dataService.user.getUser(userId),
        dataService.user.getNutritionTargets(userId),
        dataService.user.getEquipment(userId),
        dataService.workout.getWorkoutPlans(userId),
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
  }, [userId, setUser, setNutritionTargets, setEquipment, setWorkoutPlans]);

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
  const [isLoaded, setIsLoaded] = useState(false);

  // Get current store state to check if data is already loaded
  const bodyMeasurements = useAppStore((s) => s.bodyMeasurements);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const cardioLogs = useAppStore((s) => s.cardioLogs);

  // We'll add these to the store
  const addBodyMeasurement = useAppStore((s) => s.addBodyMeasurement);
  const addPhysiqueScan = useAppStore((s) => s.addPhysiqueScan);
  const addCardioLog = useAppStore((s) => s.addCardioLog);

  const loadProgressData = useCallback(async () => {
    if (!userId || isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      const [measurements, scans, cardio] = await Promise.all([
        dataService.progress.getBodyMeasurements(userId),
        dataService.progress.getPhysiqueScans(userId),
        dataService.progress.getCardioLogs(userId),
      ]);

      // Add each item to store (avoiding duplicates)
      const existingMeasurementIds = new Set(bodyMeasurements.map((m) => m.id));
      measurements.forEach((m) => {
        if (!existingMeasurementIds.has(m.id)) {
          addBodyMeasurement(m);
        }
      });

      const existingScanIds = new Set(physiqueScans.map((s) => s.id));
      scans.forEach((s) => {
        if (!existingScanIds.has(s.id)) {
          addPhysiqueScan(s);
        }
      });

      const existingCardioIds = new Set(cardioLogs.map((c) => c.id));
      cardio.forEach((c) => {
        if (!existingCardioIds.has(c.id)) {
          addCardioLog(c);
        }
      });

      setIsLoaded(true);
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
    isLoaded,
    bodyMeasurements,
    physiqueScans,
    cardioLogs,
    addBodyMeasurement,
    addPhysiqueScan,
    addCardioLog,
  ]);

  return {
    isLoading,
    error,
    isLoaded,
    loadProgressData,
  };
}
