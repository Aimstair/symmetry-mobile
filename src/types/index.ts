/**
 * Type Definitions for Symmetry App
 * 
 * 3NF Normalized Structure:
 * - CatalogExercise: Master exercise catalog (synced & cached)
 * - PlanExercise: Exercise prescription within a workout day
 * - WorkoutDay: Day within a workout plan
 * - WorkoutPlan: User's workout plans
 * - WorkoutSession/SessionExercise/SessionSet: Workout history
 * - MeasurementLog: Atomic body measurements
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // Always stored in cm
  weight: number; // Always stored in kg
  goal: 'bulk' | 'cut' | 'recomp' | 'maintenance';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  trainingDays: string[]; // e.g., ['Monday', 'Wednesday', 'Friday']
  createdAt: Date;
  updatedAt: Date;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  tdee: number;
}

export interface EquipmentProfile {
  hasBarbell: boolean;
  hasDumbbells: boolean;
  hasCableStation: boolean;
  hasMachines: boolean;
  hasBands: boolean;
  customEquipment: string[];
}

// ============================================================================
// EXERCISE CATALOG TYPES (Sync & Cache)
// ============================================================================

export type ExerciseEnvironment = 'gym' | 'home' | 'any';

/**
 * Master exercise from the catalog
 * Synced from database and cached locally
 */
export interface CatalogExercise {
  id: string; // e.g., 'bench_press', 'squats'
  name: string;
  description: string;
  environment: ExerciseEnvironment;
  equipment: string[];
  muscleGroups: string[];
  tips: string[];
  formCues: string[];
  videoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alternative exercise reference
 */
export interface ExerciseAlternative {
  exerciseId: string;
  alternativeId: string;
  reason: string;
}

/**
 * Exercise cache metadata
 */
export interface ExerciseCacheMetadata {
  lastSyncedAt: Date;
  exerciseCount: number;
}

// ============================================================================
// WORKOUT PLAN TYPES (Normalized 3NF)
// ============================================================================

/**
 * Exercise prescription within a workout day
 * References CatalogExercise by ID
 */
export interface PlanExercise {
  id: string;
  workoutDayId: string;
  exerciseId: string; // FK to CatalogExercise
  orderIndex: number;
  targetSets: number;
  targetReps: string; // e.g., "8-12", "12", "AMRAP"
  restSeconds: number;
  notes?: string;
  // Hydrated from cache (optional, for UI convenience)
  exercise?: CatalogExercise;
}

/**
 * Day within a workout plan
 */
export interface WorkoutDay {
  id: string;
  planId: string;
  orderIndex: number;
  name: string;
  dayName?: string; // Day of week this workout belongs to (e.g., 'Monday', 'Tuesday')
  muscleGroups: string[];
  exercises: PlanExercise[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User's workout plan
 */
export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: 'push-pull-legs' | 'upper-lower' | 'full-body' | 'custom';
  daysPerWeek: number;
  workoutDays: WorkoutDay[];
  createdAt: Date;
  updatedAt: Date;
}

// Legacy Exercise interface for backwards compatibility during migration
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
}

// ============================================================================
// WORKOUT HISTORY TYPES (Session Tracking)
// ============================================================================

/**
 * A completed workout session
 */
export interface WorkoutSession {
  id: string;
  userId: string;
  planId?: string; // Optional: Source plan
  workoutDayId?: string; // Optional: Source day
  name: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
  warmupMode: boolean;
  deloadMode: boolean;
  exercises: SessionExercise[];
  createdAt: Date;
}

/**
 * Exercise performed in a session
 */
export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string; // FK to CatalogExercise
  orderIndex: number;
  notes?: string;
  sets: SessionSet[];
  // Hydrated from cache (optional)
  exercise?: CatalogExercise;
}

/**
 * Individual set performed
 */
export interface SessionSet {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  weight: number; // Always stored in kg
  reps: number;
  rpe?: number; // Rate of Perceived Exertion (0-10)
  isWarmup: boolean;
  isCompleted: boolean;
  restTakenSeconds?: number;
  createdAt: Date;
}

// ============================================================================
// ACTIVE WORKOUT STATE (In-Progress Tracking)
// ============================================================================

export interface ActiveWorkoutState {
  isActive: boolean;
  workoutId: string | null;
  sessionId: string | null; // ID of current WorkoutSession being recorded
  startTime: Date | null;
  currentExerciseIndex: number;
  warmupMode: boolean;
  deloadMode: boolean;
  restTimer: RestTimer;
  // In-progress sets for each exercise
  exerciseSets: Record<string, SessionSet[]>;
}

export interface RestTimer {
  isRunning: boolean;
  targetSeconds: number;
  elapsedSeconds: number;
}

// ============================================================================
// PROGRESS & MEASUREMENT TYPES (Normalized)
// ============================================================================

/**
 * Atomic body measurements (replaces JSONB measurements)
 * All values stored in metric (cm/kg)
 */
export interface MeasurementLog {
  id: string;
  userId: string;
  date: Date;
  weightKg?: number;
  bodyFatPct?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  leftArmCm?: number;
  rightArmCm?: number;
  leftThighCm?: number;
  rightThighCm?: number;
  leftCalfCm?: number;
  rightCalfCm?: number;
  neckCm?: number;
  shouldersCm?: number;
  notes?: string;
  createdAt: Date;
}

/**
 * Legacy BodyMeasurement for backwards compatibility
 * @deprecated Use MeasurementLog instead
 */
export interface BodyMeasurement {
  id: string;
  userId: string;
  date: Date;
  weight: number;
  bodyFat?: number;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
}

export interface PhysiqueScan {
  id: string;
  userId: string;
  date: Date;
  images: {
    front?: string;
    back?: string;
    side?: string;
  };
  symmetryScore: number;
  muscleScores: {
    chest: number;
    back: number;
    shoulders: number;
    arms: number;
    legs: number;
  };
  notes?: string;
}

export interface CardioLog {
  id: string;
  userId: string;
  date: Date;
  type: 'running' | 'cycling' | 'swimming' | 'walking' | 'other';
  duration: number; // in minutes
  distance?: number;
  calories?: number;
  notes?: string;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  unit: 'lbs' | 'kg';
  measurementUnit: 'in' | 'cm';
  notifications: {
    workoutReminders: boolean;
    restTimerSound: boolean;
    progressUpdates: boolean;
  };
  subscription: 'free' | 'premium';
  blacklistedExercises: string[];
}

// ============================================================================
// ONBOARDING TYPES
// ============================================================================

export interface OnboardingData {
  step: number;
  completed: boolean;
  age?: string;
  gender?: 'male' | 'female' | 'other';
  height?: string;
  weight?: string;
  goal?: 'bulk' | 'cut' | 'recomp' | 'maintenance';
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  equipment?: EquipmentProfile;
}

// ============================================================================
// CHART DATA TYPES
// ============================================================================

export interface ChartDataPoint {
  x: number;
  y: number;
  date?: string;
  label?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Input type for creating a new workout plan
 * Used by the service layer
 */
export interface CreateWorkoutPlanInput {
  userId: string;
  name: string;
  description: string;
  type: WorkoutPlan['type'];
  daysPerWeek: number;
  workoutDays: {
    name: string;
    muscleGroups: string[];
    exercises: {
      exerciseId: string;
      targetSets: number;
      targetReps: string;
      restSeconds: number;
      notes?: string;
    }[];
  }[];
}

/**
 * Input type for saving a workout session
 */
export interface SaveWorkoutSessionInput {
  userId: string;
  planId?: string;
  workoutDayId?: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  notes?: string;
  warmupMode: boolean;
  deloadMode: boolean;
  exercises: {
    exerciseId: string;
    notes?: string;
    sets: {
      weight: number; // kg
      reps: number;
      rpe?: number;
      isWarmup: boolean;
      isCompleted: boolean;
      restTakenSeconds?: number;
    }[];
  }[];
}
