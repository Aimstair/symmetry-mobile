/**
 * Type Definitions for Symmetry App
 */

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // in inches or cm depending on settings
  weight: number; // in lbs or kg depending on settings
  goal: 'bulk' | 'cut' | 'recomp' | 'maintenance';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
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

// Workout Types
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

export interface WorkoutDay {
  id: string;
  name: string;
  muscleGroups: string[];
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  sets: number;
  reps: string; // e.g., "8-12", "12", "AMRAP"
  restSeconds: number;
  notes?: string;
}

export interface ActiveWorkoutState {
  isActive: boolean;
  workoutId: string | null;
  startTime: Date | null;
  currentExerciseIndex: number;
  warmupMode: boolean;
  deloadMode: boolean;
  restTimer: RestTimer;
}

export interface RestTimer {
  isRunning: boolean;
  targetSeconds: number;
  elapsedSeconds: number;
}

// Progress Types
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

// Settings Types
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

// Onboarding Types
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

// Chart Data Types
export interface ChartDataPoint {
  x: number;
  y: number;
  date?: string;
  label?: string;
}
