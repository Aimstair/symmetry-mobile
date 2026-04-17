/**
 * Cloud Data Service Implementation with Supabase (3NF Normalized)
 * 
 * This service implements the IDataService interface using Supabase as the backend.
 * 
 * Features:
 * - Exercise Catalog: Sync & Cache strategy for minimal DB reads
 * - Workout Plans: Deep relational queries with nested data
 * - Workout History: Full session tracking with exercises and sets
 * - Body Measurements: Atomic normalized columns
 * - Type-safe queries with TypeScript
 * - Offline-first: Queue operations when offline
 * 
 * Configuration:
 * - Local: http://127.0.0.1:54321 (via EXPO_PUBLIC_SUPABASE_URL)
 * - Production: https://your-project.supabase.co (via EXPO_PUBLIC_SUPABASE_URL)
 */

import { supabase } from '@/lib/supabase';
import { storageAdapter } from '@/lib/storage';
import { syncManager } from '@/lib/syncManager';
import { isAbortError } from '@/lib/utils';
import type {
  IDataService,
  IExerciseService,
  IWorkoutService,
  IHistoryService,
  IProgressService,
  IUserService,
  IScheduleService,
  FeedbackSubmission,
} from './interfaces';
import type {
  User,
  WorkoutPlan,
  WorkoutDay,
  PlanExercise,
  WorkoutSession,
  SessionExercise,
  SessionSet,
  BodyMeasurement,
  MeasurementLog,
  PhysiqueScan,
  CardioLog,
  NutritionTargets,
  EquipmentProfile,
  CatalogExercise,
  ExerciseCacheMetadata,
  CreateWorkoutPlanInput,
  SaveWorkoutSessionInput,
  ScheduledWorkout,
  WorkoutDaySnapshot,
  ScheduleStatus,
} from '@/types';

// ============================================================================
// UUID GENERATION HELPER
// ============================================================================

/**
 * Generate a UUID v4 for offline operations
 * Uses crypto.randomUUID when available, falls back to manual implementation
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// CACHE KEYS
// ============================================================================
const CACHE_KEYS = {
  EXERCISES: 'cache:exercises',
  EXERCISES_METADATA: 'cache:exercises:metadata',
  ALTERNATIVES: 'cache:alternatives',
} as const;

// ============================================================================
// EXERCISE SERVICE (Sync & Cache Strategy)
// ============================================================================

class CloudExerciseService implements IExerciseService {
  private exerciseCache: Map<string, CatalogExercise> = new Map();
  private alternativesCache: Map<string, string[]> = new Map();
  private cacheMetadata: ExerciseCacheMetadata | null = null;
  private isInitialized = false;

  private toDate(value: unknown, fallback: Date): Date {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return fallback;
  }

  /**
   * Initialize cache from storage
   */
  private async initializeCache(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const cachedData = await storageAdapter.getItem(CACHE_KEYS.EXERCISES);
      if (cachedData) {
        const exercises: CatalogExercise[] = JSON.parse(cachedData);
        exercises.forEach((ex) => {
          this.exerciseCache.set(ex.id, {
            ...ex,
            createdAt: this.toDate(ex.createdAt, new Date()),
            updatedAt: this.toDate(ex.updatedAt, new Date()),
          });
        });
      }

      const cachedAlternatives = await storageAdapter.getItem(CACHE_KEYS.ALTERNATIVES);
      if (cachedAlternatives) {
        const alternatives: Record<string, string[]> = JSON.parse(cachedAlternatives);
        Object.entries(alternatives).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            this.alternativesCache.set(key, value);
          }
        });
      }

      const metadataStr = await storageAdapter.getItem(CACHE_KEYS.EXERCISES_METADATA);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        this.cacheMetadata = {
          lastSyncedAt: this.toDate(metadata.lastSyncedAt, new Date(0)),
          exerciseCount: Number(metadata.exerciseCount) || this.exerciseCache.size,
        };
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize exercise cache:', error);
      this.exerciseCache.clear();
      this.alternativesCache.clear();
      this.cacheMetadata = null;
    }
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      const exercises = Array.from(this.exerciseCache.values());
      await storageAdapter.setItem(CACHE_KEYS.EXERCISES, JSON.stringify(exercises));

      const alternatives: Record<string, string[]> = {};
      this.alternativesCache.forEach((value, key) => {
        alternatives[key] = value;
      });
      await storageAdapter.setItem(CACHE_KEYS.ALTERNATIVES, JSON.stringify(alternatives));

      const metadata: ExerciseCacheMetadata = {
        lastSyncedAt: new Date(),
        exerciseCount: exercises.length,
      };
      this.cacheMetadata = metadata;
      await storageAdapter.setItem(CACHE_KEYS.EXERCISES_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save exercise cache:', error);
    }
  }

  async getExercises(): Promise<CatalogExercise[]> {
    await this.initializeCache();

    const metadata = this.getCacheMetadata();
    const lastSyncedAt = metadata?.lastSyncedAt;

    try {
      if (this.exerciseCache.size === 0) {
        // Cache is empty - fetch ALL exercises
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .order('name');

        if (error) throw new Error(`Failed to fetch exercises: ${error.message}`);

        (data || []).forEach((row) => {
          this.exerciseCache.set(row.id, this.mapExerciseRow(row));
        });

        // Fetch alternatives
        await this.fetchAlternatives();
      } else if (lastSyncedAt) {
        // Cache exists - fetch only updates
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .gt('updated_at', lastSyncedAt.toISOString());

        if (error) {
          if (!isAbortError(error)) {
            console.warn('Failed to fetch exercise updates:', error.message);
          }
        } else if (data && data.length > 0) {
          // Merge updates into cache
          data.forEach((row) => {
            this.exerciseCache.set(row.id, this.mapExerciseRow(row));
          });
          // Refresh alternatives if exercises updated
          await this.fetchAlternatives();
        }
      }

      await this.saveCache();
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Exercise sync error:', error);
      }
      // Return cached data even if sync fails
    }

    return Array.from(this.exerciseCache.values());
  }

  async getExercise(id: string): Promise<CatalogExercise | null> {
    await this.initializeCache();

    if (this.exerciseCache.has(id)) {
      return this.exerciseCache.get(id) || null;
    }

    // Not in cache - try to fetch
    await this.getExercises();
    return this.exerciseCache.get(id) || null;
  }

  async searchExercises(query: string): Promise<CatalogExercise[]> {
    const exercises = await this.getExercises();
    const lowerQuery = query.toLowerCase();

    return exercises.filter((ex) =>
      ex.name.toLowerCase().includes(lowerQuery) ||
      ex.description.toLowerCase().includes(lowerQuery) ||
      ex.muscleGroups.some((mg) => mg.toLowerCase().includes(lowerQuery)) ||
      ex.equipment.some((eq) => eq.toLowerCase().includes(lowerQuery))
    );
  }

  async filterExercises(filters: {
    muscleGroups?: string[];
    equipment?: string[];
    environment?: 'gym' | 'home' | 'any';
  }): Promise<CatalogExercise[]> {
    const exercises = await this.getExercises();

    return exercises.filter((ex) => {
      // Environment filter
      if (filters.environment && filters.environment !== 'any') {
        if (ex.environment !== filters.environment && ex.environment !== 'any') {
          return false;
        }
      }

      // Muscle groups filter (any match)
      if (filters.muscleGroups && filters.muscleGroups.length > 0) {
        const hasMatch = filters.muscleGroups.some((mg) =>
          ex.muscleGroups.some((emg) => emg.toLowerCase().includes(mg.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      // Equipment filter (any match)
      if (filters.equipment && filters.equipment.length > 0) {
        const hasMatch = filters.equipment.some((eq) =>
          ex.equipment.some((eeq) => eeq.toLowerCase().includes(eq.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }

  async getAlternatives(exerciseId: string): Promise<CatalogExercise[]> {
    await this.initializeCache();

    const alternativeIds = this.alternativesCache.get(exerciseId) || [];
    const alternatives: CatalogExercise[] = [];

    for (const altId of alternativeIds) {
      const exercise = this.exerciseCache.get(altId);
      if (exercise) {
        alternatives.push(exercise);
      }
    }

    return alternatives;
  }

  async forceSync(): Promise<void> {
    // Clear cache
    this.exerciseCache.clear();
    this.alternativesCache.clear();
    this.cacheMetadata = null;
    await storageAdapter.removeItem(CACHE_KEYS.EXERCISES);
    await storageAdapter.removeItem(CACHE_KEYS.ALTERNATIVES);
    await storageAdapter.removeItem(CACHE_KEYS.EXERCISES_METADATA);

    // Fetch fresh
    await this.getExercises();
  }

  getCacheMetadata(): ExerciseCacheMetadata | null {
    if (this.cacheMetadata) {
      return this.cacheMetadata;
    }

    try {
      const metadataStr = storageAdapter.getItem(CACHE_KEYS.EXERCISES_METADATA);
      if (typeof metadataStr !== 'string') return null;
      if (!metadataStr) return null;

      const metadata = JSON.parse(metadataStr);
      this.cacheMetadata = {
        lastSyncedAt: new Date(metadata.lastSyncedAt),
        exerciseCount: metadata.exerciseCount,
      };
      return this.cacheMetadata;
    } catch {
      return null;
    }
  }

  private async fetchAlternatives(): Promise<void> {
    const { data, error } = await supabase
      .from('exercise_alternatives')
      .select('exercise_id, alternative_id');

    if (error) {
      if (!isAbortError(error)) {
        console.warn('Failed to fetch alternatives:', error.message);
      }
      return;
    }

    this.alternativesCache.clear();
    (data || []).forEach((row) => {
      const existing = this.alternativesCache.get(row.exercise_id) || [];
      existing.push(row.alternative_id);
      this.alternativesCache.set(row.exercise_id, existing);
    });
  }

  private mapExerciseRow(row: any): CatalogExercise {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      environment: row.environment,
      equipment: row.equipment || [],
      muscleGroups: row.muscle_groups || [],
      tips: row.tips || [],
      formCues: row.form_cues || [],
      videoUrl: row.video_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ============================================================================
// WORKOUT SERVICE (Deep Relations)
// ============================================================================

class CloudWorkoutService implements IWorkoutService {
  async getWorkoutPlans(userId: string): Promise<WorkoutPlan[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    // Deep select: Plan -> Days -> Exercises (with exercise catalog data)
    const { data, error } = await supabase
      .from('workout_plans')
      .select(`
        *,
        workout_days (
          *,
          plan_exercises (
            *,
            exercises (*)
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch workout plans: ${error.message}`);

    return (data || []).map((row) => this.mapWorkoutPlanRow(row));
  }

  async getWorkoutPlan(id: string): Promise<WorkoutPlan | null> {
    const { data, error } = await supabase
      .from('workout_plans')
      .select(`
        *,
        workout_days (
          *,
          plan_exercises (
            *,
            exercises (*)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch workout plan: ${error.message}`);
    }

    return data ? this.mapWorkoutPlanRow(data) : null;
  }

  async createWorkoutPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan> {
    // Skip cloud insert for guest users - return a local plan
    if (input.userId.startsWith('guest-')) {
      const planId = `plan-${Date.now()}`;
      const localPlan: WorkoutPlan = {
        id: planId,
        userId: input.userId,
        name: input.name,
        description: input.description,
        type: input.type,
        daysPerWeek: input.daysPerWeek,
        workoutDays: input.workoutDays.map((day, dayIndex) => {
          const dayId = `day-${Date.now()}-${dayIndex}`;
          return {
            id: dayId,
            planId: planId,
            orderIndex: dayIndex,
            name: day.name,
            muscleGroups: day.muscleGroups,
            exercises: day.exercises.map((ex, exIndex) => ({
              id: `ex-${Date.now()}-${exIndex}`,
              workoutDayId: dayId,
              exerciseId: ex.exerciseId,
              orderIndex: exIndex,
              targetSets: ex.targetSets,
              targetReps: ex.targetReps,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return localPlan;
    }
    
    // Check if offline - queue operation and return optimistic result
    if (!syncManager.isNetworkOnline()) {
      const tempPlanId = generateUUID();
      const now = new Date();
      
      // Build optimistic plan with temporary UUIDs
      const optimisticPlan: WorkoutPlan = {
        id: tempPlanId,
        userId: input.userId,
        name: input.name,
        description: input.description,
        type: input.type,
        daysPerWeek: input.daysPerWeek,
        workoutDays: input.workoutDays.map((day, dayIndex) => {
          const dayId = generateUUID();
          return {
            id: dayId,
            planId: tempPlanId,
            orderIndex: dayIndex,
            name: day.name,
            muscleGroups: day.muscleGroups,
            exercises: day.exercises.map((ex, exIndex) => ({
              id: generateUUID(),
              workoutDayId: dayId,
              exerciseId: ex.exerciseId,
              orderIndex: exIndex,
              targetSets: ex.targetSets,
              targetReps: ex.targetReps,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              createdAt: now,
              updatedAt: now,
            })),
            createdAt: now,
            updatedAt: now,
          };
        }),
        createdAt: now,
        updatedAt: now,
      };
      
      // Queue the plan insert
      await syncManager.queueOperation('INSERT', 'workout_plans', tempPlanId, {
        id: tempPlanId,
        user_id: input.userId,
        name: input.name,
        description: input.description,
        type: input.type,
        days_per_week: input.daysPerWeek,
        workout_days: [],
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
      
      // Queue days and exercises
      for (const day of optimisticPlan.workoutDays) {
        await syncManager.queueOperation('INSERT', 'workout_days', day.id, {
          id: day.id,
          plan_id: tempPlanId,
          order_index: day.orderIndex,
          name: day.name,
          muscle_groups: day.muscleGroups,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
        
        for (const ex of day.exercises) {
          await syncManager.queueOperation('INSERT', 'plan_exercises', ex.id, {
            id: ex.id,
            workout_day_id: day.id,
            exercise_id: ex.exerciseId,
            order_index: ex.orderIndex,
            target_sets: ex.targetSets,
            target_reps: ex.targetReps,
            rest_seconds: ex.restSeconds,
            notes: ex.notes,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
        }
      }
      
      if (__DEV__) {
        console.log('📴 Offline: Queued workout plan for sync:', tempPlanId);
      }
      
      return optimisticPlan;
    }
    
    // ONLINE: Use bulk inserts for better performance
    
    // 1. Create the plan
    const { data: planData, error: planError } = await supabase
      .from('workout_plans')
      .insert({
        user_id: input.userId,
        name: input.name,
        description: input.description,
        type: input.type,
        days_per_week: input.daysPerWeek,
        workout_days: [], // Legacy column, kept empty
      })
      .select()
      .single();

    if (planError) throw new Error(`Failed to create workout plan: ${planError.message}`);

    // 2. Bulk insert workout days
    const daysToInsert = input.workoutDays.map((dayInput, dayIndex) => ({
      plan_id: planData.id,
      order_index: dayIndex,
      name: dayInput.name,
      muscle_groups: dayInput.muscleGroups,
    }));
    
    const { data: daysData, error: daysError } = await supabase
      .from('workout_days')
      .insert(daysToInsert)
      .select();

    if (daysError) throw new Error(`Failed to create workout days: ${daysError.message}`);
    
    // Sort days by order_index to ensure correct mapping
    const sortedDays = (daysData || []).sort((a, b) => a.order_index - b.order_index);

    // 3. Bulk insert all exercises with correct day ID mappings
    const exercisesToInsert: any[] = [];
    for (let dayIndex = 0; dayIndex < input.workoutDays.length; dayIndex++) {
      const dayInput = input.workoutDays[dayIndex];
      const dayId = sortedDays[dayIndex]?.id;
      
      if (!dayId) continue;
      
      for (let exIndex = 0; exIndex < dayInput.exercises.length; exIndex++) {
        const exInput = dayInput.exercises[exIndex];
        exercisesToInsert.push({
          workout_day_id: dayId,
          exercise_id: exInput.exerciseId,
          order_index: exIndex,
          target_sets: exInput.targetSets,
          target_reps: exInput.targetReps,
          rest_seconds: exInput.restSeconds,
          notes: exInput.notes,
        });
      }
    }
    
    if (exercisesToInsert.length > 0) {
      const { error: exError } = await supabase
        .from('plan_exercises')
        .insert(exercisesToInsert);

      if (exError) throw new Error(`Failed to create plan exercises: ${exError.message}`);
    }

    // Fetch the complete plan with nested data
    return (await this.getWorkoutPlan(planData.id))!;
  }

  async updateWorkoutPlan(id: string, updates: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
    // Skip cloud update for guest users - return merged updates
    if (id.startsWith('plan-')) {
      // Guest plan - return a fake updated plan (would be handled by local store)
      return {
        id,
        ...updates,
        createdAt: updates.createdAt || new Date(),
        updatedAt: new Date(),
      } as WorkoutPlan;
    }
    
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.daysPerWeek) dbUpdates.days_per_week = updates.daysPerWeek;

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();

      await syncManager.queueOperation(
        'UPDATE',
        'workout_plans',
        id,
        {
          id,
          ...dbUpdates,
          updated_at: now.toISOString(),
        },
        {
          priority: 'high',
          clientUpdatedAt: now,
        }
      );

      if (updates.workoutDays) {
        for (let dayIndex = 0; dayIndex < updates.workoutDays.length; dayIndex++) {
          const day = updates.workoutDays[dayIndex];
          const dayId = day.id || generateUUID();

          await syncManager.queueOperation(
            'UPDATE',
            'workout_days',
            dayId,
            {
              id: dayId,
              plan_id: id,
              order_index: dayIndex,
              name: day.name,
              day_name: day.dayName || null,
              muscle_groups: day.muscleGroups,
              updated_at: now.toISOString(),
            },
            {
              priority: 'high',
              clientUpdatedAt: now,
            }
          );

          for (let exIndex = 0; exIndex < day.exercises.length; exIndex++) {
            const ex = day.exercises[exIndex];
            const exerciseId = ex.id || generateUUID();

            await syncManager.queueOperation(
              'UPDATE',
              'plan_exercises',
              exerciseId,
              {
                id: exerciseId,
                workout_day_id: dayId,
                exercise_id: ex.exerciseId,
                order_index: exIndex,
                target_sets: ex.targetSets,
                target_reps: ex.targetReps,
                rest_seconds: ex.restSeconds,
                notes: ex.notes,
                updated_at: now.toISOString(),
              },
              {
                priority: 'high',
                clientUpdatedAt: now,
              }
            );
          }
        }
      }

      return {
        id,
        userId: updates.userId || '',
        name: updates.name || 'Workout Plan',
        description: updates.description || '',
        type: updates.type || 'custom',
        daysPerWeek: updates.daysPerWeek || updates.workoutDays?.length || 0,
        workoutDays: updates.workoutDays || [],
        createdAt: updates.createdAt || now,
        updatedAt: now,
      };
    }

    const { error } = await supabase
      .from('workout_plans')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw new Error(`Failed to update workout plan: ${error.message}`);

    // If workoutDays are being updated, handle the nested update
    if (updates.workoutDays) {
      // Delete existing days (cascades to exercises)
      await supabase.from('workout_days').delete().eq('plan_id', id);

      // Recreate days and exercises
      for (let dayIndex = 0; dayIndex < updates.workoutDays.length; dayIndex++) {
        const day = updates.workoutDays[dayIndex];

        const { data: dayData, error: dayError } = await supabase
          .from('workout_days')
          .insert({
            plan_id: id,
            order_index: dayIndex,
            name: day.name,
            muscle_groups: day.muscleGroups,
          })
          .select()
          .single();

        if (dayError) throw new Error(`Failed to create workout day: ${dayError.message}`);

        for (let exIndex = 0; exIndex < day.exercises.length; exIndex++) {
          const ex = day.exercises[exIndex];

          const { error: exError } = await supabase
            .from('plan_exercises')
            .insert({
              workout_day_id: dayData.id,
              exercise_id: ex.exerciseId,
              order_index: exIndex,
              target_sets: ex.targetSets,
              target_reps: ex.targetReps,
              rest_seconds: ex.restSeconds,
              notes: ex.notes,
            });

          if (exError) throw new Error(`Failed to create plan exercise: ${exError.message}`);
        }
      }
    }

    return (await this.getWorkoutPlan(id))!;
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    // Skip cloud delete for guest users
    if (id.startsWith('plan-')) {
      return;
    }
    
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation('DELETE', 'workout_plans', id, { id }, {
        priority: 'high',
        clientUpdatedAt: new Date(),
      });
      return;
    }

    const { error } = await supabase
      .from('workout_plans')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete workout plan: ${error.message}`);
  }

  async addWorkoutDay(planId: string, day: Omit<WorkoutDay, 'id' | 'planId' | 'createdAt' | 'updatedAt'>): Promise<WorkoutDay> {
    // Skip cloud insert for guest users
    if (planId.startsWith('plan-')) {
      const localDay: WorkoutDay = {
        id: `day-${Date.now()}`,
        planId: planId,
        orderIndex: day.orderIndex,
        name: day.name,
        muscleGroups: day.muscleGroups,
        exercises: day.exercises || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return localDay;
    }
    
    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      const dayId = generateUUID();
      const optimisticExercises: PlanExercise[] = (day.exercises || []).map((ex, exIndex) => ({
        id: generateUUID(),
        workoutDayId: dayId,
        exerciseId: ex.exerciseId,
        orderIndex: exIndex,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
      }));

      await syncManager.queueOperation(
        'INSERT',
        'workout_days',
        dayId,
        {
          id: dayId,
          plan_id: planId,
          order_index: day.orderIndex,
          name: day.name,
          day_name: day.dayName || null,
          muscle_groups: day.muscleGroups,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        {
          priority: 'high',
          clientUpdatedAt: now,
        }
      );

      for (let exIndex = 0; exIndex < optimisticExercises.length; exIndex++) {
        const ex = optimisticExercises[exIndex];
        await syncManager.queueOperation(
          'INSERT',
          'plan_exercises',
          ex.id,
          {
            id: ex.id,
            workout_day_id: dayId,
            exercise_id: ex.exerciseId,
            order_index: exIndex,
            target_sets: ex.targetSets,
            target_reps: ex.targetReps,
            rest_seconds: ex.restSeconds,
            notes: ex.notes,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
          {
            priority: 'high',
            clientUpdatedAt: now,
          }
        );
      }

      return {
        id: dayId,
        planId,
        orderIndex: day.orderIndex,
        name: day.name,
        dayName: day.dayName,
        muscleGroups: day.muscleGroups,
        exercises: optimisticExercises,
        createdAt: now,
        updatedAt: now,
      };
    }

    const { data, error } = await supabase
      .from('workout_days')
      .insert({
        plan_id: planId,
        order_index: day.orderIndex,
        name: day.name,
        day_name: day.dayName || null,
        muscle_groups: day.muscleGroups,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add workout day: ${error.message}`);

    return {
      id: data.id,
      planId: data.plan_id,
      orderIndex: data.order_index,
      name: data.name,
      dayName: data.day_name || undefined,
      muscleGroups: data.muscle_groups || [],
      exercises: [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateWorkoutDay(dayId: string, updates: Partial<WorkoutDay>): Promise<WorkoutDay> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.orderIndex !== undefined) dbUpdates.order_index = updates.orderIndex;
    if (updates.muscleGroups) dbUpdates.muscle_groups = updates.muscleGroups;
    if (updates.dayName !== undefined) dbUpdates.day_name = updates.dayName;

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();

      await syncManager.queueOperation(
        'UPDATE',
        'workout_days',
        dayId,
        {
          id: dayId,
          ...dbUpdates,
          updated_at: now.toISOString(),
        },
        {
          priority: 'high',
          clientUpdatedAt: now,
        }
      );

      if (updates.exercises) {
        for (let exIndex = 0; exIndex < updates.exercises.length; exIndex++) {
          const ex = updates.exercises[exIndex];
          const exerciseId = ex.id || generateUUID();
          await syncManager.queueOperation(
            'UPDATE',
            'plan_exercises',
            exerciseId,
            {
              id: exerciseId,
              workout_day_id: dayId,
              exercise_id: ex.exerciseId,
              order_index: exIndex,
              target_sets: ex.targetSets,
              target_reps: ex.targetReps,
              rest_seconds: ex.restSeconds,
              notes: ex.notes,
              updated_at: now.toISOString(),
            },
            {
              priority: 'high',
              clientUpdatedAt: now,
            }
          );
        }
      }

      return {
        id: dayId,
        planId: updates.planId || '',
        orderIndex: updates.orderIndex || 0,
        name: updates.name || '',
        dayName: updates.dayName,
        muscleGroups: updates.muscleGroups || [],
        exercises: updates.exercises || [],
        createdAt: updates.createdAt || now,
        updatedAt: now,
      };
    }

    const { data, error } = await supabase
      .from('workout_days')
      .update(dbUpdates)
      .eq('id', dayId)
      .select(`
        *,
        plan_exercises (
          *,
          exercises (*)
        )
      `)
      .single();

    if (error) throw new Error(`Failed to update workout day: ${error.message}`);

    return this.mapWorkoutDayRow(data);
  }

  async deleteWorkoutDay(dayId: string): Promise<void> {
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation('DELETE', 'workout_days', dayId, { id: dayId }, {
        priority: 'high',
        clientUpdatedAt: new Date(),
      });
      return;
    }

    const { error } = await supabase
      .from('workout_days')
      .delete()
      .eq('id', dayId);

    if (error) throw new Error(`Failed to delete workout day: ${error.message}`);
  }

  async addPlanExercise(dayId: string, exercise: Omit<PlanExercise, 'id' | 'workoutDayId'>): Promise<PlanExercise> {
    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      const exerciseId = generateUUID();

      await syncManager.queueOperation(
        'INSERT',
        'plan_exercises',
        exerciseId,
        {
          id: exerciseId,
          workout_day_id: dayId,
          exercise_id: exercise.exerciseId,
          order_index: exercise.orderIndex,
          target_sets: exercise.targetSets,
          target_reps: exercise.targetReps,
          rest_seconds: exercise.restSeconds,
          notes: exercise.notes,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        {
          priority: 'high',
          clientUpdatedAt: now,
        }
      );

      return {
        id: exerciseId,
        workoutDayId: dayId,
        exerciseId: exercise.exerciseId,
        orderIndex: exercise.orderIndex,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
      };
    }

    const { data, error } = await supabase
      .from('plan_exercises')
      .insert({
        workout_day_id: dayId,
        exercise_id: exercise.exerciseId,
        order_index: exercise.orderIndex,
        target_sets: exercise.targetSets,
        target_reps: exercise.targetReps,
        rest_seconds: exercise.restSeconds,
        notes: exercise.notes,
      })
      .select(`
        *,
        exercises (*)
      `)
      .single();

    if (error) throw new Error(`Failed to add plan exercise: ${error.message}`);

    return this.mapPlanExerciseRow(data);
  }

  async updatePlanExercise(exerciseId: string, updates: Partial<PlanExercise>): Promise<PlanExercise> {
    const dbUpdates: any = {};
    if (updates.orderIndex !== undefined) dbUpdates.order_index = updates.orderIndex;
    if (updates.targetSets !== undefined) dbUpdates.target_sets = updates.targetSets;
    if (updates.targetReps !== undefined) dbUpdates.target_reps = updates.targetReps;
    if (updates.restSeconds !== undefined) dbUpdates.rest_seconds = updates.restSeconds;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      await syncManager.queueOperation(
        'UPDATE',
        'plan_exercises',
        exerciseId,
        {
          id: exerciseId,
          ...dbUpdates,
          updated_at: now.toISOString(),
        },
        {
          priority: 'high',
          clientUpdatedAt: now,
        }
      );

      return {
        id: exerciseId,
        workoutDayId: updates.workoutDayId || '',
        exerciseId: updates.exerciseId || '',
        orderIndex: updates.orderIndex || 0,
        targetSets: updates.targetSets || 0,
        targetReps: updates.targetReps || '',
        restSeconds: updates.restSeconds || 0,
        notes: updates.notes,
      };
    }

    const { data, error } = await supabase
      .from('plan_exercises')
      .update(dbUpdates)
      .eq('id', exerciseId)
      .select(`
        *,
        exercises (*)
      `)
      .single();

    if (error) throw new Error(`Failed to update plan exercise: ${error.message}`);

    return this.mapPlanExerciseRow(data);
  }

  async deletePlanExercise(exerciseId: string): Promise<void> {
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation('DELETE', 'plan_exercises', exerciseId, { id: exerciseId }, {
        priority: 'high',
        clientUpdatedAt: new Date(),
      });
      return;
    }

    const { error } = await supabase
      .from('plan_exercises')
      .delete()
      .eq('id', exerciseId);

    if (error) throw new Error(`Failed to delete plan exercise: ${error.message}`);
  }

  async reorderPlanExercises(dayId: string, exerciseIds: string[]): Promise<void> {
    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      for (let i = 0; i < exerciseIds.length; i++) {
        await syncManager.queueOperation(
          'UPDATE',
          'plan_exercises',
          exerciseIds[i],
          {
            id: exerciseIds[i],
            workout_day_id: dayId,
            order_index: i,
            updated_at: now.toISOString(),
          },
          {
            priority: 'high',
            clientUpdatedAt: now,
          }
        );
      }
      return;
    }

    // Update order_index for each exercise
    for (let i = 0; i < exerciseIds.length; i++) {
      const { error } = await supabase
        .from('plan_exercises')
        .update({ order_index: i })
        .eq('id', exerciseIds[i]);

      if (error) throw new Error(`Failed to reorder exercises: ${error.message}`);
    }
  }

  private mapWorkoutPlanRow(row: any): WorkoutPlan {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      daysPerWeek: row.days_per_week,
      workoutDays: (row.workout_days || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((day: any) => this.mapWorkoutDayRow(day)),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapWorkoutDayRow(row: any): WorkoutDay {
    return {
      id: row.id,
      planId: row.plan_id,
      orderIndex: row.order_index,
      name: row.name,
      dayName: row.day_name || undefined,
      muscleGroups: row.muscle_groups || [],
      exercises: (row.plan_exercises || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((ex: any) => this.mapPlanExerciseRow(ex)),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapPlanExerciseRow(row: any): PlanExercise {
    return {
      id: row.id,
      workoutDayId: row.workout_day_id,
      exerciseId: row.exercise_id,
      orderIndex: row.order_index,
      targetSets: row.target_sets,
      targetReps: row.target_reps,
      restSeconds: row.rest_seconds,
      notes: row.notes,
      exercise: row.exercises ? {
        id: row.exercises.id,
        name: row.exercises.name,
        description: row.exercises.description,
        environment: row.exercises.environment,
        equipment: row.exercises.equipment || [],
        muscleGroups: row.exercises.muscle_groups || [],
        tips: row.exercises.tips || [],
        formCues: row.exercises.form_cues || [],
        videoUrl: row.exercises.video_url,
        createdAt: new Date(row.exercises.created_at),
        updatedAt: new Date(row.exercises.updated_at),
      } : undefined,
    };
  }
}

// ============================================================================
// HISTORY SERVICE (Workout Sessions)
// ============================================================================

class CloudHistoryService implements IHistoryService {
  async saveWorkoutSession(input: SaveWorkoutSessionInput): Promise<WorkoutSession> {
    const startedAt = input.startedAt instanceof Date ? input.startedAt : new Date(input.startedAt as any);
    const endedAt = input.endedAt
      ? (input.endedAt instanceof Date ? input.endedAt : new Date(input.endedAt as any))
      : undefined;

    if (Number.isNaN(startedAt.getTime())) {
      throw new Error('Invalid workout start time');
    }

    if (endedAt && Number.isNaN(endedAt.getTime())) {
      throw new Error('Invalid workout end time');
    }

    // Skip cloud save for guest users - return a local session
    if (input.userId.startsWith('guest-')) {
      const sessionId = `session-${Date.now()}`;
      const localSession: WorkoutSession = {
        id: sessionId,
        userId: input.userId,
        planId: input.planId,
        workoutDayId: input.workoutDayId,
        name: input.name,
        startedAt,
        endedAt,
        durationSeconds: endedAt ? Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000) : undefined,
        notes: input.notes,
        warmupMode: input.warmupMode,
        deloadMode: input.deloadMode,
        exercises: input.exercises.map((ex, exIndex) => {
          const sessionExId = `session-ex-${Date.now()}-${exIndex}`;
          return {
            id: sessionExId,
            sessionId: sessionId,
            exerciseId: ex.exerciseId,
            orderIndex: exIndex,
            notes: ex.notes,
            sets: ex.sets.map((set, setIndex) => ({
              id: `set-${Date.now()}-${exIndex}-${setIndex}`,
              sessionExerciseId: sessionExId,
              setNumber: setIndex + 1,
              weight: set.weight,
              reps: set.reps,
              rpe: set.rpe,
              isWarmup: set.isWarmup,
              isCompleted: set.isCompleted,
              restTakenSeconds: set.restTakenSeconds,
              createdAt: new Date(),
            })),
          };
        }),
        createdAt: new Date(),
      };
      return localSession;
    }
    
    // Calculate duration if both times provided
    let durationSeconds: number | undefined;
    if (endedAt) {
      durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    }

    // Check if offline - queue operation and return optimistic result
    if (!syncManager.isNetworkOnline()) {
      const tempSessionId = generateUUID();
      const now = new Date();
      
      // Build optimistic session with temporary UUIDs
      const optimisticSession: WorkoutSession = {
        id: tempSessionId,
        userId: input.userId,
        planId: input.planId,
        workoutDayId: input.workoutDayId,
        name: input.name,
        startedAt,
        endedAt,
        durationSeconds: durationSeconds,
        notes: input.notes,
        warmupMode: input.warmupMode,
        deloadMode: input.deloadMode,
        exercises: input.exercises.map((ex, exIndex) => {
          const sessionExId = generateUUID();
          return {
            id: sessionExId,
            sessionId: tempSessionId,
            exerciseId: ex.exerciseId,
            orderIndex: exIndex,
            notes: ex.notes,
            sets: ex.sets.map((set, setIndex) => ({
              id: generateUUID(),
              sessionExerciseId: sessionExId,
              setNumber: setIndex + 1,
              weight: set.weight,
              reps: set.reps,
              rpe: set.rpe,
              isWarmup: set.isWarmup,
              isCompleted: set.isCompleted,
              restTakenSeconds: set.restTakenSeconds,
              createdAt: now,
            })),
          };
        }),
        createdAt: now,
      };
      
      // Queue the session insert
      await syncManager.queueOperation('INSERT', 'workout_sessions', tempSessionId, {
        id: tempSessionId,
        user_id: input.userId,
        plan_id: input.planId,
        workout_day_id: input.workoutDayId,
        name: input.name,
        started_at: startedAt.toISOString(),
        ended_at: endedAt?.toISOString(),
        duration_seconds: durationSeconds,
        notes: input.notes,
        warmup_mode: input.warmupMode,
        deload_mode: input.deloadMode,
        created_at: now.toISOString(),
      });
      
      // Queue exercises and sets
      for (const ex of optimisticSession.exercises) {
        await syncManager.queueOperation('INSERT', 'session_exercises', ex.id, {
          id: ex.id,
          session_id: tempSessionId,
          exercise_id: ex.exerciseId,
          order_index: ex.orderIndex,
          notes: ex.notes,
          created_at: now.toISOString(),
        });
        
        for (const set of ex.sets) {
          await syncManager.queueOperation('INSERT', 'session_sets', set.id, {
            id: set.id,
            session_exercise_id: ex.id,
            set_number: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
            is_warmup: set.isWarmup,
            is_completed: set.isCompleted,
            rest_taken_seconds: set.restTakenSeconds,
            created_at: now.toISOString(),
          });
        }
      }
      
      if (__DEV__) {
        console.log('📴 Offline: Queued workout session for sync:', tempSessionId);
      }
      
      return optimisticSession;
    }

    // ONLINE: Use bulk inserts for better performance
    
    // 1. Create session
    const { data: sessionData, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: input.userId,
        plan_id: input.planId,
        workout_day_id: input.workoutDayId,
        name: input.name,
        started_at: startedAt.toISOString(),
        ended_at: endedAt?.toISOString(),
        duration_seconds: durationSeconds,
        notes: input.notes,
        warmup_mode: input.warmupMode,
        deload_mode: input.deloadMode,
      })
      .select()
      .single();

    if (sessionError) throw new Error(`Failed to save workout session: ${sessionError.message}`);

    // 2. Bulk insert session exercises
    const exercisesToInsert = input.exercises.map((exInput, exIndex) => ({
      session_id: sessionData.id,
      exercise_id: exInput.exerciseId,
      order_index: exIndex,
      notes: exInput.notes,
    }));
    
    const { data: exercisesData, error: exError } = await supabase
      .from('session_exercises')
      .insert(exercisesToInsert)
      .select();

    if (exError) throw new Error(`Failed to save session exercises: ${exError.message}`);
    
    // Sort exercises by order_index to ensure correct mapping
    const sortedExercises = (exercisesData || []).sort((a, b) => a.order_index - b.order_index);

    // 3. Bulk insert all sets with correct exercise ID mappings
    const setsToInsert: any[] = [];
    for (let exIndex = 0; exIndex < input.exercises.length; exIndex++) {
      const exInput = input.exercises[exIndex];
      const exerciseId = sortedExercises[exIndex]?.id;
      
      if (!exerciseId) continue;
      
      for (let setIndex = 0; setIndex < exInput.sets.length; setIndex++) {
        const setInput = exInput.sets[setIndex];
        setsToInsert.push({
          session_exercise_id: exerciseId,
          set_number: setIndex + 1,
          weight: setInput.weight,
          reps: setInput.reps,
          rpe: setInput.rpe,
          is_warmup: setInput.isWarmup,
          is_completed: setInput.isCompleted,
          rest_taken_seconds: setInput.restTakenSeconds,
        });
      }
    }
    
    if (setsToInsert.length > 0) {
      const { error: setError } = await supabase
        .from('session_sets')
        .insert(setsToInsert);

      if (setError) throw new Error(`Failed to save session sets: ${setError.message}`);
    }

    // Fetch complete session
    return (await this.getWorkoutSession(sessionData.id))!;
  }

  async getWorkoutHistory(
    userId: string,
    options?: { limit?: number; offset?: number; startDate?: Date; endDate?: Date }
  ): Promise<WorkoutSession[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    let query = supabase
      .from('workout_sessions')
      .select(`
        *,
        session_exercises (
          *,
          exercises (*),
          session_sets (*)
        )
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('started_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('started_at', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch workout history: ${error.message}`);

    return (data || []).map((row) => this.mapSessionRow(row));
  }

  async getWorkoutSession(sessionId: string): Promise<WorkoutSession | null> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        session_exercises (
          *,
          exercises (*),
          session_sets (*)
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch workout session: ${error.message}`);
    }

    return data ? this.mapSessionRow(data) : null;
  }

  async getExerciseHistory(
    userId: string,
    exerciseId: string,
    limit = 10
  ): Promise<{ date: Date; sets: SessionSet[] }[]> {
    const { data, error } = await supabase
      .from('session_exercises')
      .select(`
        session_id,
        session_sets (*),
        workout_sessions!inner (
          user_id,
          started_at
        )
      `)
      .eq('exercise_id', exerciseId)
      .eq('workout_sessions.user_id', userId)
      .order('workout_sessions(started_at)', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch exercise history: ${error.message}`);

    return (data || []).map((row: any) => ({
      date: new Date(row.workout_sessions.started_at),
      sets: (row.session_sets || [])
        .sort((a: any, b: any) => a.set_number - b.set_number)
        .map((s: any) => this.mapSetRow(s)),
    }));
  }

  async getExercisePRs(
    userId: string,
    exerciseId: string
  ): Promise<{ maxWeight: number; maxReps: number; maxVolume: number } | null> {
    const { data, error } = await supabase
      .from('session_sets')
      .select(`
        weight,
        reps,
        session_exercises!inner (
          exercise_id,
          workout_sessions!inner (
            user_id
          )
        )
      `)
      .eq('session_exercises.exercise_id', exerciseId)
      .eq('session_exercises.workout_sessions.user_id', userId)
      .eq('is_completed', true)
      .eq('is_warmup', false);

    if (error) throw new Error(`Failed to fetch exercise PRs: ${error.message}`);

    if (!data || data.length === 0) return null;

    let maxWeight = 0;
    let maxReps = 0;
    let maxVolume = 0;

    data.forEach((row: any) => {
      if (row.weight > maxWeight) maxWeight = row.weight;
      if (row.reps > maxReps) maxReps = row.reps;
      const volume = row.weight * row.reps;
      if (volume > maxVolume) maxVolume = volume;
    });

    return { maxWeight, maxReps, maxVolume };
  }

  async deleteWorkoutSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw new Error(`Failed to delete workout session: ${error.message}`);
  }

  private mapSessionRow(row: any): WorkoutSession {
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      workoutDayId: row.workout_day_id,
      name: row.name,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      durationSeconds: row.duration_seconds,
      notes: row.notes,
      warmupMode: row.warmup_mode,
      deloadMode: row.deload_mode,
      exercises: (row.session_exercises || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((ex: any) => this.mapSessionExerciseRow(ex)),
      createdAt: new Date(row.created_at),
    };
  }

  private mapSessionExerciseRow(row: any): SessionExercise {
    return {
      id: row.id,
      sessionId: row.session_id,
      exerciseId: row.exercise_id,
      orderIndex: row.order_index,
      notes: row.notes,
      sets: (row.session_sets || [])
        .sort((a: any, b: any) => a.set_number - b.set_number)
        .map((s: any) => this.mapSetRow(s)),
      exercise: row.exercises ? {
        id: row.exercises.id,
        name: row.exercises.name,
        description: row.exercises.description,
        environment: row.exercises.environment,
        equipment: row.exercises.equipment || [],
        muscleGroups: row.exercises.muscle_groups || [],
        tips: row.exercises.tips || [],
        formCues: row.exercises.form_cues || [],
        videoUrl: row.exercises.video_url,
        createdAt: new Date(row.exercises.created_at),
        updatedAt: new Date(row.exercises.updated_at),
      } : undefined,
    };
  }

  private mapSetRow(row: any): SessionSet {
    return {
      id: row.id,
      sessionExerciseId: row.session_exercise_id,
      setNumber: row.set_number,
      weight: row.weight,
      reps: row.reps,
      rpe: row.rpe,
      isWarmup: row.is_warmup,
      isCompleted: row.is_completed,
      restTakenSeconds: row.rest_taken_seconds,
      createdAt: new Date(row.created_at),
    };
  }
}

// ============================================================================
// PROGRESS SERVICE
// ============================================================================

class CloudProgressService implements IProgressService {
  async getMeasurementLogs(userId: string): Promise<MeasurementLog[]> {
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('measurement_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch measurement logs: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      weightKg: row.weight_kg,
      bodyFatPct: row.body_fat_pct,
      chestCm: row.chest_cm,
      waistCm: row.waist_cm,
      hipsCm: row.hips_cm,
      leftArmCm: row.left_arm_cm,
      rightArmCm: row.right_arm_cm,
      leftThighCm: row.left_thigh_cm,
      rightThighCm: row.right_thigh_cm,
      leftCalfCm: row.left_calf_cm,
      rightCalfCm: row.right_calf_cm,
      neckCm: row.neck_cm,
      shouldersCm: row.shoulders_cm,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    }));
  }

  async addMeasurementLog(log: Omit<MeasurementLog, 'id' | 'createdAt'>): Promise<MeasurementLog> {
    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      const id = generateUUID();
      await syncManager.queueOperation(
        'INSERT',
        'measurement_logs',
        id,
        {
          id,
          user_id: log.userId,
          date: log.date.toISOString(),
          weight_kg: log.weightKg,
          body_fat_pct: log.bodyFatPct,
          chest_cm: log.chestCm,
          waist_cm: log.waistCm,
          hips_cm: log.hipsCm,
          left_arm_cm: log.leftArmCm,
          right_arm_cm: log.rightArmCm,
          left_thigh_cm: log.leftThighCm,
          right_thigh_cm: log.rightThighCm,
          left_calf_cm: log.leftCalfCm,
          right_calf_cm: log.rightCalfCm,
          neck_cm: log.neckCm,
          shoulders_cm: log.shouldersCm,
          notes: log.notes,
          created_at: now.toISOString(),
        },
        {
          priority: 'normal',
          clientUpdatedAt: now,
        }
      );

      return {
        id,
        ...log,
        createdAt: now,
      };
    }

    const { data, error } = await supabase
      .from('measurement_logs')
      .insert({
        user_id: log.userId,
        date: log.date.toISOString(),
        weight_kg: log.weightKg,
        body_fat_pct: log.bodyFatPct,
        chest_cm: log.chestCm,
        waist_cm: log.waistCm,
        hips_cm: log.hipsCm,
        left_arm_cm: log.leftArmCm,
        right_arm_cm: log.rightArmCm,
        left_thigh_cm: log.leftThighCm,
        right_thigh_cm: log.rightThighCm,
        left_calf_cm: log.leftCalfCm,
        right_calf_cm: log.rightCalfCm,
        neck_cm: log.neckCm,
        shoulders_cm: log.shouldersCm,
        notes: log.notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add measurement log: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      weightKg: data.weight_kg,
      bodyFatPct: data.body_fat_pct,
      chestCm: data.chest_cm,
      waistCm: data.waist_cm,
      hipsCm: data.hips_cm,
      leftArmCm: data.left_arm_cm,
      rightArmCm: data.right_arm_cm,
      leftThighCm: data.left_thigh_cm,
      rightThighCm: data.right_thigh_cm,
      leftCalfCm: data.left_calf_cm,
      rightCalfCm: data.right_calf_cm,
      neckCm: data.neck_cm,
      shouldersCm: data.shoulders_cm,
      notes: data.notes,
      createdAt: new Date(data.created_at),
    };
  }

  async updateMeasurementLog(id: string, updates: Partial<MeasurementLog>): Promise<MeasurementLog> {
    const dbUpdates: any = {};
    if (updates.date) dbUpdates.date = updates.date.toISOString();
    if (updates.weightKg !== undefined) dbUpdates.weight_kg = updates.weightKg;
    if (updates.bodyFatPct !== undefined) dbUpdates.body_fat_pct = updates.bodyFatPct;
    if (updates.chestCm !== undefined) dbUpdates.chest_cm = updates.chestCm;
    if (updates.waistCm !== undefined) dbUpdates.waist_cm = updates.waistCm;
    if (updates.hipsCm !== undefined) dbUpdates.hips_cm = updates.hipsCm;
    if (updates.leftArmCm !== undefined) dbUpdates.left_arm_cm = updates.leftArmCm;
    if (updates.rightArmCm !== undefined) dbUpdates.right_arm_cm = updates.rightArmCm;
    if (updates.leftThighCm !== undefined) dbUpdates.left_thigh_cm = updates.leftThighCm;
    if (updates.rightThighCm !== undefined) dbUpdates.right_thigh_cm = updates.rightThighCm;
    if (updates.leftCalfCm !== undefined) dbUpdates.left_calf_cm = updates.leftCalfCm;
    if (updates.rightCalfCm !== undefined) dbUpdates.right_calf_cm = updates.rightCalfCm;
    if (updates.neckCm !== undefined) dbUpdates.neck_cm = updates.neckCm;
    if (updates.shouldersCm !== undefined) dbUpdates.shoulders_cm = updates.shouldersCm;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      await syncManager.queueOperation(
        'UPDATE',
        'measurement_logs',
        id,
        {
          id,
          ...dbUpdates,
        },
        {
          priority: 'normal',
          clientUpdatedAt: now,
        }
      );

      return {
        id,
        userId: updates.userId || '',
        date: updates.date || now,
        weightKg: updates.weightKg,
        bodyFatPct: updates.bodyFatPct,
        chestCm: updates.chestCm,
        waistCm: updates.waistCm,
        hipsCm: updates.hipsCm,
        leftArmCm: updates.leftArmCm,
        rightArmCm: updates.rightArmCm,
        leftThighCm: updates.leftThighCm,
        rightThighCm: updates.rightThighCm,
        leftCalfCm: updates.leftCalfCm,
        rightCalfCm: updates.rightCalfCm,
        neckCm: updates.neckCm,
        shouldersCm: updates.shouldersCm,
        notes: updates.notes,
        createdAt: updates.createdAt || now,
      };
    }

    const { data, error } = await supabase
      .from('measurement_logs')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update measurement log: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      weightKg: data.weight_kg,
      bodyFatPct: data.body_fat_pct,
      chestCm: data.chest_cm,
      waistCm: data.waist_cm,
      hipsCm: data.hips_cm,
      leftArmCm: data.left_arm_cm,
      rightArmCm: data.right_arm_cm,
      leftThighCm: data.left_thigh_cm,
      rightThighCm: data.right_thigh_cm,
      leftCalfCm: data.left_calf_cm,
      rightCalfCm: data.right_calf_cm,
      neckCm: data.neck_cm,
      shouldersCm: data.shoulders_cm,
      notes: data.notes,
      createdAt: new Date(data.created_at),
    };
  }

  async deleteMeasurementLog(id: string): Promise<void> {
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation('DELETE', 'measurement_logs', id, { id }, {
        priority: 'normal',
        clientUpdatedAt: new Date(),
      });
      return;
    }

    const { error } = await supabase
      .from('measurement_logs')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete measurement log: ${error.message}`);
  }

  // Legacy methods for backwards compatibility
  async getmeasurementLogs(userId: string): Promise<BodyMeasurement[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch body measurements: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      weight: row.weight,
      bodyFat: row.body_fat,
      measurements: row.measurements || {},
    }));
  }

  async addBodyMeasurement(measurement: BodyMeasurement): Promise<BodyMeasurement> {
    // Skip cloud insert for guest users - return the input as-is
    if (measurement.userId.startsWith('guest-')) {
      return measurement;
    }
    
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation(
        'INSERT',
        'body_measurements',
        measurement.id,
        {
          id: measurement.id,
          user_id: measurement.userId,
          date: measurement.date.toISOString(),
          weight: measurement.weight,
          body_fat: measurement.bodyFat,
          measurements: measurement.measurements,
        },
        {
          priority: 'normal',
          clientUpdatedAt: measurement.date,
        }
      );

      return measurement;
    }

    const { data, error } = await supabase
      .from('body_measurements')
      .insert({
        id: measurement.id,
        user_id: measurement.userId,
        date: measurement.date.toISOString(),
        weight: measurement.weight,
        body_fat: measurement.bodyFat,
        measurements: measurement.measurements,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add body measurement: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      weight: data.weight,
      bodyFat: data.body_fat,
      measurements: data.measurements || {},
    };
  }

  async getPhysiqueScans(userId: string): Promise<PhysiqueScan[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('physique_scans')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch physique scans: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      images: row.images || {},
      symmetryScore: row.symmetry_score,
      muscleScores: row.muscle_scores || {},
      notes: row.notes,
    }));
  }

  async addPhysiqueScan(scan: PhysiqueScan): Promise<PhysiqueScan> {
    // Skip cloud insert for guest users - return the input as-is
    if (scan.userId.startsWith('guest-')) {
      return scan;
    }
    
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation(
        'INSERT',
        'physique_scans',
        scan.id,
        {
          id: scan.id,
          user_id: scan.userId,
          date: scan.date.toISOString(),
          images: scan.images,
          symmetry_score: scan.symmetryScore,
          muscle_scores: scan.muscleScores,
          notes: scan.notes,
        },
        {
          priority: 'normal',
          clientUpdatedAt: scan.date,
        }
      );

      return scan;
    }

    const { data, error } = await supabase
      .from('physique_scans')
      .insert({
        id: scan.id,
        user_id: scan.userId,
        date: scan.date.toISOString(),
        images: scan.images,
        symmetry_score: scan.symmetryScore,
        muscle_scores: scan.muscleScores,
        notes: scan.notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add physique scan: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      images: data.images || {},
      symmetryScore: data.symmetry_score,
      muscleScores: data.muscle_scores || {},
      notes: data.notes,
    };
  }

  async getCardioLogs(userId: string): Promise<CardioLog[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('cardio_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch cardio logs: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      type: row.type,
      duration: row.duration,
      distance: row.distance,
      calories: row.calories,
      notes: row.notes,
    }));
  }

  async addCardioLog(log: CardioLog): Promise<CardioLog> {
    // Skip cloud insert for guest users - return the input as-is
    if (log.userId.startsWith('guest-')) {
      return log;
    }
    
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation(
        'INSERT',
        'cardio_logs',
        log.id,
        {
          id: log.id,
          user_id: log.userId,
          date: log.date.toISOString(),
          type: log.type,
          duration: log.duration,
          distance: log.distance,
          calories: log.calories,
          notes: log.notes,
        },
        {
          priority: 'normal',
          clientUpdatedAt: log.date,
        }
      );

      return log;
    }

    const { data, error } = await supabase
      .from('cardio_logs')
      .insert({
        id: log.id,
        user_id: log.userId,
        date: log.date.toISOString(),
        type: log.type,
        duration: log.duration,
        distance: log.distance,
        calories: log.calories,
        notes: log.notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add cardio log: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      type: data.type,
      duration: data.duration,
      distance: data.distance,
      calories: data.calories,
      notes: data.notes,
    };
  }
}

// ============================================================================
// USER SERVICE
// ============================================================================

class CloudUserService implements IUserService {
  async getUser(userId: string): Promise<User | null> {
    if (__DEV__) {
      console.log('☁️ CloudService.getUser called for:', userId);
    }
    
    // Skip cloud query for guest users (they only exist locally)
    if (userId.startsWith('guest-')) {
      if (__DEV__) {
        console.log('☁️ Guest user detected - skipping cloud query');
      }
      return null;
    }
    
    try {
      // Add timeout to prevent hanging queries
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 2s')), 2000);
      });
      
      // Race between query and timeout
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (__DEV__) {
        console.log('☁️ CloudService.getUser result:', { 
          hasData: !!data, 
          error: error?.message || null,
          errorCode: error?.code || null,
          queriedUserId: userId,
          foundUserId: data?.id || null,
          foundEmail: data?.email || null
        });
      }

      if (error) {
        console.error('☁️ CloudService.getUser error:', error);
        // Return null instead of throwing to allow onboarding flow
        return null;
      }

      if (data) {
        return this.mapUserRow(data);
      }

      // User not found - this is a new user who needs onboarding
      if (__DEV__) {
        console.log('☁️ No user found in database - new user needs onboarding');
      }
      return null;
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('☁️ Query timeout - database may be slow or unreachable');
      } else if (__DEV__) {
        console.error('☁️ CloudService.getUser error:', error);
      }
      // Return null to allow onboarding flow instead of throwing
      return null;
    }
  }

  /**
   * Helper to map database row to User type
   */
  private mapUserRow(data: any): User {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      experienceLevel: data.experience_level,
      trainingDays: data.training_days || [],
      workoutsCompleted: data.workouts_completed ?? 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async getNutritionTargets(userId: string): Promise<NutritionTargets | null> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return null;
    }
    
    const { data, error } = await supabase
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch nutrition targets: ${error.message}`);
    }

    if (!data) return null;

    return {
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fats: data.fats,
      tdee: data.tdee,
    };
  }

  async getEquipment(userId: string): Promise<EquipmentProfile | null> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return null;
    }
    
    const { data, error } = await supabase
      .from('equipment_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch equipment: ${error.message}`);
    }

    if (!data) return null;

    return {
      hasBarbell: data.has_barbell,
      hasDumbbells: data.has_dumbbells,
      hasCableStation: data.has_cable_station,
      hasMachines: data.has_machines,
      hasBands: data.has_bands,
      customEquipment: data.custom_equipment || [],
    };
  }

  async createUser(user: User): Promise<User> {
    // CRITICAL: Validate that user.id matches the current auth session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      throw new Error('No authenticated session found. Please sign in first.');
    }
    
    if (user.id !== session.user.id) {
      console.error('❌ User ID mismatch!', {
        providedId: user.id,
        authUserId: session.user.id,
        email: user.email,
      });
      throw new Error(
        `User ID mismatch: Provided ID (${user.id}) does not match authenticated user ID (${session.user.id}). ` +
        `The user.id MUST be set to the Supabase auth.uid().`
      );
    }
    
    if (__DEV__) {
      console.log('☁️ Creating user with auth.uid():', user.id);
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id, // This MUST match auth.uid() - enforced by trigger
        name: user.name,
        email: user.email,
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        goal: user.goal,
        experience_level: user.experienceLevel,
        training_days: user.trainingDays || [],
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
    
    if (__DEV__) {
      console.log('✅ User created successfully:', data.id);
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      experienceLevel: data.experience_level,
      trainingDays: data.training_days || [],
      workoutsCompleted: data.workouts_completed ?? 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    // Skip cloud update for guest users - return merged updates
    if (userId.startsWith('guest-')) {
      return {
        id: userId,
        name: updates.name || '',
        email: updates.email || '',
        age: updates.age || 0,
        gender: updates.gender || 'male',
        height: updates.height || 0,
        weight: updates.weight || 0,
        goal: updates.goal || 'maintenance',
        experienceLevel: updates.experienceLevel || 'beginner',
        trainingDays: updates.trainingDays || [],
        workoutsCompleted: updates.workoutsCompleted ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.age) dbUpdates.age = updates.age;
    if (updates.gender) dbUpdates.gender = updates.gender;
    if (updates.height) dbUpdates.height = updates.height;
    if (updates.weight) dbUpdates.weight = updates.weight;
    if (updates.goal) dbUpdates.goal = updates.goal;
    if (updates.experienceLevel) dbUpdates.experience_level = updates.experienceLevel;
    if (updates.trainingDays) dbUpdates.training_days = updates.trainingDays;

    // Check if offline - queue operation and return optimistic result
    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      
      // Queue the update
      await syncManager.queueOperation('UPDATE', 'users', userId, {
        id: userId,
        ...dbUpdates,
        updated_at: now.toISOString(),
      });
      
      if (__DEV__) {
        console.log('📴 Offline: Queued user update for sync:', userId);
      }
      
      // Return optimistic result
      return {
        id: userId,
        name: updates.name || '',
        email: updates.email || '',
        age: updates.age || 0,
        gender: updates.gender || 'male',
        height: updates.height || 0,
        weight: updates.weight || 0,
        goal: updates.goal || 'maintenance',
        experienceLevel: updates.experienceLevel || 'beginner',
        trainingDays: updates.trainingDays || [],
        workoutsCompleted: updates.workoutsCompleted ?? 0,
        createdAt: now,
        updatedAt: now,
      };
    }

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update user: ${error.message}`);

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      experienceLevel: data.experience_level,
      trainingDays: data.training_days || [],
      workoutsCompleted: data.workouts_completed ?? 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateNutritionTargets(userId: string, targets: NutritionTargets): Promise<NutritionTargets> {
    // Skip cloud update for guest users - return the input as-is
    if (userId.startsWith('guest-')) {
      return targets;
    }

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      await syncManager.queueOperation(
        'UPDATE',
        'nutrition_targets',
        userId,
        {
          user_id: userId,
          calories: targets.calories,
          protein: targets.protein,
          carbs: targets.carbs,
          fats: targets.fats,
          tdee: targets.tdee,
        },
        {
          priority: 'normal',
          conflictTarget: 'user_id',
          clientUpdatedAt: now,
        }
      );

      return targets;
    }
    
    const { data, error } = await supabase
      .from('nutrition_targets')
      .upsert({
        user_id: userId,
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fats: targets.fats,
        tdee: targets.tdee,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to update nutrition targets: ${error.message}`);

    return {
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fats: data.fats,
      tdee: data.tdee,
    };
  }

  async updateEquipment(userId: string, equipment: EquipmentProfile): Promise<EquipmentProfile> {
    if (userId.startsWith('guest-')) {
      return equipment;
    }

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      await syncManager.queueOperation(
        'UPDATE',
        'equipment_profiles',
        userId,
        {
          user_id: userId,
          has_barbell: equipment.hasBarbell,
          has_dumbbells: equipment.hasDumbbells,
          has_cable_station: equipment.hasCableStation,
          has_machines: equipment.hasMachines,
          has_bands: equipment.hasBands,
          custom_equipment: equipment.customEquipment,
        },
        {
          priority: 'normal',
          conflictTarget: 'user_id',
          clientUpdatedAt: now,
        }
      );

      return equipment;
    }

    const { data, error } = await supabase
      .from('equipment_profiles')
      .upsert({
        user_id: userId,
        has_barbell: equipment.hasBarbell,
        has_dumbbells: equipment.hasDumbbells,
        has_cable_station: equipment.hasCableStation,
        has_machines: equipment.hasMachines,
        has_bands: equipment.hasBands,
        custom_equipment: equipment.customEquipment,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to update equipment: ${error.message}`);

    return {
      hasBarbell: data.has_barbell,
      hasDumbbells: data.has_dumbbells,
      hasCableStation: data.has_cable_station,
      hasMachines: data.has_machines,
      hasBands: data.has_bands,
      customEquipment: data.custom_equipment || [],
    };
  }

  async submitFeedback(userId: string | null, feedback: FeedbackSubmission): Promise<void> {
    const { error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userId && !userId.startsWith('guest-') ? userId : null,
        email: feedback.email || null,
        message: feedback.message,
        category: feedback.category || 'general',
        device_model: feedback.deviceModel || null,
        device_os: feedback.deviceOs || null,
        app_version: feedback.appVersion || null,
      });

    if (error) {
      console.error('Failed to submit feedback:', error);
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }

    if (__DEV__) {
      console.log('✅ Feedback submitted successfully');
    }
  }
}

// ============================================================================
// SCHEDULE SERVICE (Date-Specific Workout Planning)
// ============================================================================

class CloudScheduleService implements IScheduleService {
  /**
   * Get scheduled workouts for a date range
   */
  async getScheduledWorkouts(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledWorkout[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('workout_schedule')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Failed to fetch scheduled workouts:', error);
      throw new Error(`Failed to fetch scheduled workouts: ${error.message}`);
    }

    return (data || []).map(this.mapScheduleRow);
  }

  /**
   * Get scheduled workout for a specific date
   */
  async getScheduledWorkout(userId: string, date: Date): Promise<ScheduledWorkout | null> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return null;
    }
    
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('workout_schedule')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', dateStr)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch scheduled workout:', error);
      throw new Error(`Failed to fetch scheduled workout: ${error.message}`);
    }

    return data ? this.mapScheduleRow(data) : null;
  }

  /**
   * Schedule a workout on a specific date
   */
  async scheduleWorkout(
    userId: string,
    date: Date,
    workoutPlanId: string | null,
    workoutSnapshot: WorkoutDaySnapshot
  ): Promise<ScheduledWorkout> {
    // Skip cloud save for guest users - return local schedule
    if (userId.startsWith('guest-')) {
      const localSchedule: ScheduledWorkout = {
        id: `schedule-${Date.now()}`,
        userId: userId,
        scheduledDate: date,
        workoutPlanId: workoutPlanId ?? undefined,
        workoutSnapshot: workoutSnapshot,
        status: 'scheduled' as ScheduleStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return localSchedule;
    }
    
    const dateStr = date.toISOString().split('T')[0];

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      await syncManager.queueOperation(
        'UPDATE',
        'workout_schedule',
        `${userId}:${dateStr}`,
        {
          user_id: userId,
          scheduled_date: dateStr,
          workout_plan_id: workoutPlanId,
          workout_snapshot: workoutSnapshot,
          status: 'scheduled',
        },
        {
          priority: 'high',
          conflictTarget: 'user_id,scheduled_date',
          clientUpdatedAt: now,
        }
      );

      return {
        id: `offline-schedule-${Date.now()}`,
        userId,
        scheduledDate: date,
        workoutPlanId: workoutPlanId ?? undefined,
        workoutSnapshot,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      };
    }

    const { data, error } = await supabase
      .from('workout_schedule')
      .upsert({
        user_id: userId,
        scheduled_date: dateStr,
        workout_plan_id: workoutPlanId,
        workout_snapshot: workoutSnapshot,
        status: 'scheduled',
      }, { onConflict: 'user_id,scheduled_date' })
      .select()
      .single();

    if (error) {
      console.error('Failed to schedule workout:', error);
      throw new Error(`Failed to schedule workout: ${error.message}`);
    }

    if (__DEV__) {
      console.log('✅ Workout scheduled for:', dateStr);
    }

    return this.mapScheduleRow(data);
  }

  /**
   * Update scheduled workout status
   */
  async updateScheduleStatus(
    scheduleId: string,
    status: ScheduleStatus,
    sessionId?: string
  ): Promise<ScheduledWorkout> {
    // Skip cloud update for guest users
    if (scheduleId.startsWith('schedule-')) {
      // Return a fake updated schedule for guest
      const localSchedule: ScheduledWorkout = {
        id: scheduleId,
        userId: 'guest-unknown',
        scheduledDate: new Date(),
        status: status,
        sessionId: sessionId,
        workoutSnapshot: { name: '', muscleGroups: [], exercises: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return localSchedule;
    }
    
    const updates: any = { status };
    if (sessionId) {
      updates.session_id = sessionId;
    }

    if (!syncManager.isNetworkOnline()) {
      const now = new Date();
      await syncManager.queueOperation(
        'UPDATE',
        'workout_schedule',
        scheduleId,
        {
          id: scheduleId,
          ...updates,
          updated_at: now.toISOString(),
        },
        {
          priority: 'high',
          clientUpdatedAt: now,
        }
      );

      return {
        id: scheduleId,
        userId: 'offline-user',
        scheduledDate: new Date(),
        status,
        sessionId,
        workoutSnapshot: { name: '', muscleGroups: [], exercises: [] },
        createdAt: now,
        updatedAt: now,
      };
    }

    const { data, error } = await supabase
      .from('workout_schedule')
      .update(updates)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update schedule status:', error);
      throw new Error(`Failed to update schedule status: ${error.message}`);
    }

    return this.mapScheduleRow(data);
  }

  /**
   * Delete a scheduled workout
   */
  async deleteScheduledWorkout(scheduleId: string): Promise<void> {
    // Skip cloud delete for guest users
    if (scheduleId.startsWith('schedule-')) {
      return;
    }
    
    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation('DELETE', 'workout_schedule', scheduleId, { id: scheduleId }, {
        priority: 'high',
        clientUpdatedAt: new Date(),
      });
      return;
    }

    const { error } = await supabase
      .from('workout_schedule')
      .delete()
      .eq('id', scheduleId);

    if (error) {
      console.error('Failed to delete scheduled workout:', error);
      throw new Error(`Failed to delete scheduled workout: ${error.message}`);
    }
  }

  /**
   * Get training days history for a specific week
   */
  async getTrainingDaysForWeek(userId: string, weekStart: Date): Promise<string[]> {
    // Skip cloud query for guest users
    if (userId.startsWith('guest-')) {
      return [];
    }
    
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('training_days_history')
      .select('training_days')
      .eq('user_id', userId)
      .eq('week_start', weekStartStr)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch training days history:', error);
      // Return empty array on error - will fall back to current training days
      return [];
    }

    return data?.training_days || [];
  }

  /**
   * Save training days snapshot for current week
   */
  async saveTrainingDaysSnapshot(userId: string, trainingDays: string[]): Promise<void> {
    // Skip cloud save for guest users
    if (userId.startsWith('guest-')) {
      return;
    }
    
    // Get Monday of current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    if (!syncManager.isNetworkOnline()) {
      await syncManager.queueOperation(
        'UPDATE',
        'training_days_history',
        `${userId}:${weekStartStr}`,
        {
          user_id: userId,
          week_start: weekStartStr,
          training_days: trainingDays,
        },
        {
          priority: 'normal',
          conflictTarget: 'user_id,week_start',
          clientUpdatedAt: new Date(),
        }
      );
      return;
    }

    const { error } = await supabase
      .from('training_days_history')
      .upsert({
        user_id: userId,
        week_start: weekStartStr,
        training_days: trainingDays,
      }, { onConflict: 'user_id,week_start' });

    if (error) {
      console.error('Failed to save training days snapshot:', error);
      throw new Error(`Failed to save training days snapshot: ${error.message}`);
    }

    if (__DEV__) {
      console.log('✅ Training days snapshot saved for week:', weekStartStr);
    }
  }

  private mapScheduleRow(row: any): ScheduledWorkout {
    return {
      id: row.id,
      userId: row.user_id,
      scheduledDate: new Date(row.scheduled_date),
      workoutPlanId: row.workout_plan_id,
      workoutSnapshot: row.workout_snapshot || { name: '', muscleGroups: [], exercises: [] },
      status: row.status,
      sessionId: row.session_id,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ============================================================================
// MAIN CLOUD SERVICE
// ============================================================================

export class CloudDataService implements IDataService {
  exercise: IExerciseService;
  workout: IWorkoutService;
  history: IHistoryService;
  progress: IProgressService;
  user: IUserService;
  schedule: IScheduleService;

  constructor() {
    this.exercise = new CloudExerciseService();
    this.workout = new CloudWorkoutService();
    this.history = new CloudHistoryService();
    this.progress = new CloudProgressService();
    this.user = new CloudUserService();
    this.schedule = new CloudScheduleService();
  }
}

// Singleton
export const cloudService = new CloudDataService();
