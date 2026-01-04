/**
 * Exercise Hooks
 *
 * These hooks provide access to the cached exercise catalog from CloudExerciseService.
 * Use these hooks in UI components instead of importing from constants/exercises.ts.
 */

import { useState, useEffect, useCallback } from 'react';
import { cloudService } from '@/services/CloudService';
import type { CatalogExercise } from '@/types';

/**
 * Hook to get all cached exercises
 */
export function useExercises() {
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchExercises = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await cloudService.exercise.getExercises();
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exercises'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const forceRefresh = useCallback(async () => {
    await cloudService.exercise.forceSync();
    await fetchExercises();
  }, [fetchExercises]);

  return { exercises, isLoading, error, refresh: forceRefresh };
}

/**
 * Hook to get a single exercise by ID
 */
export function useExercise(exerciseId: string | null) {
  const [exercise, setExercise] = useState<CatalogExercise | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!exerciseId) {
      setExercise(null);
      return;
    }

    const fetchExercise = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await cloudService.exercise.getExercise(exerciseId);
        setExercise(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch exercise'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchExercise();
  }, [exerciseId]);

  return { exercise, isLoading, error };
}

/**
 * Hook to search exercises
 */
export function useExerciseSearch(query: string) {
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const data = await cloudService.exercise.searchExercises(query);
        setResults(data);
      } catch (err) {
        console.error('Exercise search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return { results, isLoading };
}

/**
 * Hook to filter exercises by criteria
 */
export function useExerciseFilter(filters: {
  muscleGroups?: string[];
  equipment?: string[];
  environment?: 'gym' | 'home' | 'any';
}) {
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const filter = async () => {
      setIsLoading(true);
      try {
        const data = await cloudService.exercise.filterExercises(filters);
        setResults(data);
      } catch (err) {
        console.error('Exercise filter error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    filter();
  }, [filters.muscleGroups, filters.equipment, filters.environment]);

  return { results, isLoading };
}

/**
 * Hook to get exercise alternatives
 */
export function useExerciseAlternatives(exerciseId: string | null) {
  const [alternatives, setAlternatives] = useState<CatalogExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!exerciseId) {
      setAlternatives([]);
      return;
    }

    const fetchAlternatives = async () => {
      setIsLoading(true);
      try {
        const data = await cloudService.exercise.getAlternatives(exerciseId);
        setAlternatives(data);
      } catch (err) {
        console.error('Failed to fetch alternatives:', err);
        setAlternatives([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlternatives();
  }, [exerciseId]);

  return { alternatives, isLoading };
}

/**
 * Get cache metadata (for debugging/sync status)
 */
export function useExerciseCacheMetadata() {
  const [metadata, setMetadata] = useState<{
    lastSyncedAt: Date | null;
    exerciseCount: number;
  }>({ lastSyncedAt: null, exerciseCount: 0 });

  useEffect(() => {
    const meta = cloudService.exercise.getCacheMetadata();
    if (meta) {
      setMetadata({
        lastSyncedAt: meta.lastSyncedAt,
        exerciseCount: meta.exerciseCount,
      });
    }
  }, []);

  return metadata;
}

// =============================================================================
// SYNC LOOKUP HELPERS (for use outside React components)
// =============================================================================

/**
 * Exercise lookup cache (populated from CloudExerciseService)
 * This is used by the legacy getExerciseInfo function for backwards compatibility.
 */
let exerciseLookupCache: Map<string, CatalogExercise> = new Map();
let lookupCacheInitialized = false;

/**
 * Initialize the lookup cache (call once on app start)
 */
export async function initializeExerciseLookup(): Promise<void> {
  if (lookupCacheInitialized) return;

  try {
    const exercises = await cloudService.exercise.getExercises();
    exerciseLookupCache.clear();

    exercises.forEach((ex) => {
      // Store by ID
      exerciseLookupCache.set(ex.id, ex);
      // Store by name (lowercase for case-insensitive lookup)
      exerciseLookupCache.set(ex.name.toLowerCase(), ex);
    });

    lookupCacheInitialized = true;
  } catch (err) {
    console.error('Failed to initialize exercise lookup:', err);
  }
}

/**
 * Get exercise info by name or ID (sync helper for backwards compatibility)
 * Note: This requires initializeExerciseLookup() to have been called first.
 * Returns a fallback if exercise not found.
 */
export function getExerciseFromCache(nameOrId: string): CatalogExercise | null {
  // Try direct lookup by ID or exact name
  if (exerciseLookupCache.has(nameOrId)) {
    return exerciseLookupCache.get(nameOrId) || null;
  }

  // Try case-insensitive lookup
  const lowerName = nameOrId.toLowerCase();
  if (exerciseLookupCache.has(lowerName)) {
    return exerciseLookupCache.get(lowerName) || null;
  }

  return null;
}

/**
 * Get exercise info with fallback (for backwards compatibility with old code)
 * This provides the same signature as the old getExerciseInfo from constants/exercises.ts
 */
export function getExerciseInfo(exerciseName: string): {
  id: string;
  name: string;
  description: string;
  environment: 'gym' | 'home' | 'any';
  equipment: string[];
  muscleGroups: string[];
  tips: string[];
  formCues: string[];
} {
  const cached = getExerciseFromCache(exerciseName);

  if (cached) {
    return {
      id: cached.id,
      name: cached.name,
      description: cached.description,
      environment: cached.environment,
      equipment: cached.equipment,
      muscleGroups: cached.muscleGroups,
      tips: cached.tips,
      formCues: cached.formCues,
    };
  }

  // Fallback for unknown exercises
  return {
    id: 'unknown',
    name: exerciseName,
    description: 'Exercise details not found.',
    environment: 'any',
    equipment: [],
    muscleGroups: ['General'],
    tips: ['Maintain good form'],
    formCues: [],
  };
}
