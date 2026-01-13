/**
 * Data Service Interfaces
 * 
 * This file defines the contract for all data operations.
 * The UI layer should ONLY interact with these interfaces.
 * 
 * Strategy:
 * 1. Start with LocalService (MMKV/SQLite)
 * 2. When ready for cloud, implement CloudService with same interface
 * 3. Swap implementations in app/_layout.tsx provider
 * 4. UI code requires ZERO changes
 * 
 * 3NF Normalized Structure:
 * - Exercises: Sync & Cache strategy (minimize DB reads)
 * - WorkoutPlans: Deep relational queries
 * - Sessions: Workout history tracking
 * - Measurements: Atomic body measurements
 */

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
  ExerciseAlternative,
  ExerciseCacheMetadata,
  CreateWorkoutPlanInput,
  SaveWorkoutSessionInput,
  ScheduledWorkout,
  TrainingDaysHistory,
  WorkoutDaySnapshot,
  ScheduleStatus,
} from '@/types';

// ============================================================================
// EXERCISE SERVICE (Sync & Cache Strategy)
// ============================================================================

export interface IExerciseService {
  /**
   * Get all exercises (from cache, with smart sync)
   * 1. Check local cache
   * 2. If empty: Fetch ALL from DB, cache them
   * 3. If exists: Fetch only where updated_at > last_sync
   * 4. Merge updates into cache
   * 5. Return full list from cache
   */
  getExercises(): Promise<CatalogExercise[]>;
  
  /**
   * Get a single exercise by ID
   * Returns from cache (no DB call if cached)
   */
  getExercise(id: string): Promise<CatalogExercise | null>;
  
  /**
   * Search exercises by name, muscle group, or equipment
   * Performs search on cached data (no DB call)
   */
  searchExercises(query: string): Promise<CatalogExercise[]>;
  
  /**
   * Filter exercises by criteria
   * Performs filter on cached data (no DB call)
   */
  filterExercises(filters: {
    muscleGroups?: string[];
    equipment?: string[];
    environment?: 'gym' | 'home' | 'any';
  }): Promise<CatalogExercise[]>;
  
  /**
   * Get alternatives for an exercise
   */
  getAlternatives(exerciseId: string): Promise<CatalogExercise[]>;
  
  /**
   * Force a full sync of exercises from database
   * Clears cache and fetches all exercises
   */
  forceSync(): Promise<void>;
  
  /**
   * Get cache metadata (last sync time, exercise count)
   */
  getCacheMetadata(): ExerciseCacheMetadata | null;
}

// ============================================================================
// WORKOUT SERVICE (Deep Relations)
// ============================================================================

export interface IWorkoutService {
  // Fetch (with deep relations)
  getWorkoutPlans(userId: string): Promise<WorkoutPlan[]>;
  getWorkoutPlan(id: string): Promise<WorkoutPlan | null>;
  
  // Mutate (with nested transaction handling)
  createWorkoutPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan>;
  updateWorkoutPlan(id: string, updates: Partial<WorkoutPlan>): Promise<WorkoutPlan>;
  deleteWorkoutPlan(id: string): Promise<void>;
  
  // Day-level operations
  addWorkoutDay(planId: string, day: Omit<WorkoutDay, 'id' | 'planId' | 'createdAt' | 'updatedAt'>): Promise<WorkoutDay>;
  updateWorkoutDay(dayId: string, updates: Partial<WorkoutDay>): Promise<WorkoutDay>;
  deleteWorkoutDay(dayId: string): Promise<void>;
  
  // Exercise-level operations within a day
  addPlanExercise(dayId: string, exercise: Omit<PlanExercise, 'id' | 'workoutDayId'>): Promise<PlanExercise>;
  updatePlanExercise(exerciseId: string, updates: Partial<PlanExercise>): Promise<PlanExercise>;
  deletePlanExercise(exerciseId: string): Promise<void>;
  reorderPlanExercises(dayId: string, exerciseIds: string[]): Promise<void>;
}

// ============================================================================
// HISTORY SERVICE (Workout Sessions)
// ============================================================================

export interface IHistoryService {
  /**
   * Save a completed workout session
   * Creates session, exercises, and sets in a transaction
   */
  saveWorkoutSession(input: SaveWorkoutSessionInput): Promise<WorkoutSession>;
  
  /**
   * Get workout history for a user
   * Returns sessions with nested exercises and sets
   */
  getWorkoutHistory(userId: string, options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WorkoutSession[]>;
  
  /**
   * Get a single session with full details
   */
  getWorkoutSession(sessionId: string): Promise<WorkoutSession | null>;
  
  /**
   * Get exercise history (all sessions where exercise was performed)
   */
  getExerciseHistory(userId: string, exerciseId: string, limit?: number): Promise<{
    date: Date;
    sets: SessionSet[];
  }[]>;
  
  /**
   * Get personal records for an exercise
   */
  getExercisePRs(userId: string, exerciseId: string): Promise<{
    maxWeight: number;
    maxReps: number;
    maxVolume: number; // weight × reps
  } | null>;
  
  /**
   * Delete a workout session
   */
  deleteWorkoutSession(sessionId: string): Promise<void>;
}

// ============================================================================
// PROGRESS SERVICE
// ============================================================================

export interface IProgressService {
  // Measurement Logs (new normalized structure)
  getMeasurementLogs(userId: string): Promise<MeasurementLog[]>;
  addMeasurementLog(log: Omit<MeasurementLog, 'id' | 'createdAt'>): Promise<MeasurementLog>;
  updateMeasurementLog(id: string, updates: Partial<MeasurementLog>): Promise<MeasurementLog>;
  deleteMeasurementLog(id: string): Promise<void>;
  
  // Legacy Body Measurements (backwards compatibility)
  getmeasurementLogs(userId: string): Promise<BodyMeasurement[]>;
  addBodyMeasurement(measurement: BodyMeasurement): Promise<BodyMeasurement>;
  
  // Physique Scans
  getPhysiqueScans(userId: string): Promise<PhysiqueScan[]>;
  addPhysiqueScan(scan: PhysiqueScan): Promise<PhysiqueScan>;
  
  // Cardio Logs
  getCardioLogs(userId: string): Promise<CardioLog[]>;
  addCardioLog(log: CardioLog): Promise<CardioLog>;
}

// ============================================================================
// USER SERVICE
// ============================================================================

export interface FeedbackSubmission {
  message: string;
  category?: 'general' | 'bug' | 'feature' | 'support';
  email?: string;
  deviceModel?: string;
  deviceOs?: string;
  appVersion?: string;
}

export interface IUserService {
  // Fetch
  getUser(userId: string): Promise<User | null>;
  getNutritionTargets(userId: string): Promise<NutritionTargets | null>;
  getEquipment(userId: string): Promise<EquipmentProfile | null>;
  
  // Mutate
  createUser(user: User): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  updateNutritionTargets(userId: string, targets: NutritionTargets): Promise<NutritionTargets>;
  updateEquipment(userId: string, equipment: EquipmentProfile): Promise<EquipmentProfile>;
  
  // Feedback
  submitFeedback(userId: string | null, feedback: FeedbackSubmission): Promise<void>;
}

// ============================================================================
// SCHEDULE SERVICE (Date-Specific Workout Planning)
// ============================================================================

export interface IScheduleService {
  /**
   * Get scheduled workouts for a date range
   * Returns what was PLANNED for each date
   */
  getScheduledWorkouts(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledWorkout[]>;

  /**
   * Get scheduled workout for a specific date
   */
  getScheduledWorkout(userId: string, date: Date): Promise<ScheduledWorkout | null>;

  /**
   * Schedule a workout on a specific date
   * Creates a snapshot of the workout so changes to template don't affect past schedules
   */
  scheduleWorkout(
    userId: string,
    date: Date,
    workoutPlanId: string | null,
    workoutSnapshot: WorkoutDaySnapshot
  ): Promise<ScheduledWorkout>;

  /**
   * Update scheduled workout status
   */
  updateScheduleStatus(
    scheduleId: string,
    status: ScheduleStatus,
    sessionId?: string
  ): Promise<ScheduledWorkout>;

  /**
   * Delete a scheduled workout
   */
  deleteScheduledWorkout(scheduleId: string): Promise<void>;

  /**
   * Get training days history for a specific week
   * Returns what training days were active during that week
   */
  getTrainingDaysForWeek(userId: string, weekStart: Date): Promise<string[]>;

  /**
   * Save training days snapshot for current week
   * Called when user changes their training days to preserve history
   */
  saveTrainingDaysSnapshot(userId: string, trainingDays: string[]): Promise<void>;
}

// ============================================================================
// MAIN SERVICE INTERFACE
// ============================================================================

/**
 * Main Service Interface
 * Compose all services here
 */
export interface IDataService {
  exercise: IExerciseService;
  workout: IWorkoutService;
  history: IHistoryService;
  progress: IProgressService;
  user: IUserService;
  schedule: IScheduleService;
}
