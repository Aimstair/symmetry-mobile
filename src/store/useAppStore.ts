import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';
import type {
  User,
  NutritionTargets,
  EquipmentProfile,
  WorkoutPlan,
  BodyMeasurement,
  PhysiqueScan,
  CardioLog,
  AppSettings,
  OnboardingData,
  ActiveWorkoutState,
} from '@/types';

/**
 * Zustand Store - React Native Migration
 * 
 * Changes from web version:
 * - localStorage → MMKV (via storageAdapter)
 * - Maintains exact same API
 * - All actions remain unchanged
 * - State shape identical
 */

interface AppState {
  // User & Profile
  user: User | null;
  nutritionTargets: NutritionTargets | null;
  equipment: EquipmentProfile | null;

  // Workout Data
  workoutPlans: WorkoutPlan[];
  activeWorkout: ActiveWorkoutState;

  // Progress Data
  bodyMeasurements: BodyMeasurement[];
  physiqueScans: PhysiqueScan[];
  cardioLogs: CardioLog[];

  // Settings
  settings: AppSettings;

  // Onboarding
  onboarding: OnboardingData;

  // Actions - User
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setNutritionTargets: (targets: NutritionTargets) => void;
  setEquipment: (equipment: EquipmentProfile) => void;

  // Actions - Workout
  setWorkoutPlans: (plans: WorkoutPlan[]) => void;
  addWorkoutPlan: (plan: WorkoutPlan) => void;
  updateWorkoutPlan: (id: string, updates: Partial<WorkoutPlan>) => void;
  startWorkout: (workoutId: string) => void;
  endWorkout: () => void;
  toggleWarmupMode: () => void;
  toggleDeloadMode: () => void;
  setCurrentExercise: (index: number) => void;
  startRestTimer: (seconds: number) => void;
  updateRestTimer: (elapsed: number) => void;
  stopRestTimer: () => void;

  // Actions - Progress
  addBodyMeasurement: (measurement: BodyMeasurement) => void;
  addPhysiqueScan: (scan: PhysiqueScan) => void;
  addCardioLog: (log: CardioLog) => void;

  // Actions - Settings
  updateSettings: (updates: Partial<AppSettings>) => void;
  addBlacklistedExercise: (exerciseId: string) => void;
  removeBlacklistedExercise: (exerciseId: string) => void;

  // Actions - Onboarding
  updateOnboarding: (updates: Partial<OnboardingData>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Actions - Reset
  resetStore: () => void;
}

const initialSettings: AppSettings = {
  theme: 'dark',
  unit: 'lbs',
  measurementUnit: 'in',
  notifications: {
    workoutReminders: true,
    restTimerSound: true,
    progressUpdates: true,
  },
  subscription: 'free',
  blacklistedExercises: [],
};

const initialOnboarding: OnboardingData = {
  step: 1,
  completed: false,
};

const initialActiveWorkout: ActiveWorkoutState = {
  isActive: false,
  workoutId: null,
  startTime: null,
  currentExerciseIndex: 0,
  warmupMode: false,
  deloadMode: false,
  restTimer: {
    isRunning: false,
    targetSeconds: 90,
    elapsedSeconds: 0,
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial State
      user: null,
      nutritionTargets: null,
      equipment: null,
      workoutPlans: [],
      activeWorkout: initialActiveWorkout,
      bodyMeasurements: [],
      physiqueScans: [],
      cardioLogs: [],
      settings: initialSettings,
      onboarding: initialOnboarding,

      // User Actions
      setUser: (user) => set({ user }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setNutritionTargets: (targets) => set({ nutritionTargets: targets }),
      setEquipment: (equipment) => set({ equipment }),

      // Workout Actions
      setWorkoutPlans: (plans) => set({ workoutPlans: plans }),
      addWorkoutPlan: (plan) =>
        set((state) => ({ workoutPlans: [...state.workoutPlans, plan] })),
      updateWorkoutPlan: (id, updates) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      startWorkout: (workoutId) =>
        set({
          activeWorkout: {
            ...initialActiveWorkout,
            isActive: true,
            workoutId,
            startTime: new Date(),
          },
        }),
      endWorkout: () => set({ activeWorkout: initialActiveWorkout }),
      toggleWarmupMode: () =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            warmupMode: !state.activeWorkout.warmupMode,
          },
        })),
      toggleDeloadMode: () =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            deloadMode: !state.activeWorkout.deloadMode,
          },
        })),
      setCurrentExercise: (index) =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            currentExerciseIndex: index,
          },
        })),
      startRestTimer: (seconds) =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            restTimer: {
              isRunning: true,
              targetSeconds: seconds,
              elapsedSeconds: 0,
            },
          },
        })),
      updateRestTimer: (elapsed) =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            restTimer: {
              ...state.activeWorkout.restTimer,
              elapsedSeconds: elapsed,
            },
          },
        })),
      stopRestTimer: () =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            restTimer: {
              ...state.activeWorkout.restTimer,
              isRunning: false,
            },
          },
        })),

      // Progress Actions
      addBodyMeasurement: (measurement) =>
        set((state) => ({
          bodyMeasurements: [...state.bodyMeasurements, measurement],
        })),
      addPhysiqueScan: (scan) =>
        set((state) => ({
          physiqueScans: [...state.physiqueScans, scan],
        })),
      addCardioLog: (log) =>
        set((state) => ({
          cardioLogs: [...state.cardioLogs, log],
        })),

      // Settings Actions
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
      addBlacklistedExercise: (exerciseId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            blacklistedExercises: [
              ...state.settings.blacklistedExercises,
              exerciseId,
            ],
          },
        })),
      removeBlacklistedExercise: (exerciseId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            blacklistedExercises: state.settings.blacklistedExercises.filter(
              (id: string) => id !== exerciseId
            ),
          },
        })),

      // Onboarding Actions
      updateOnboarding: (updates) =>
        set((state) => ({
          onboarding: { ...state.onboarding, ...updates },
        })),
      completeOnboarding: () =>
        set((state) => ({
          onboarding: { ...state.onboarding, completed: true },
        })),
      resetOnboarding: () => set({ onboarding: initialOnboarding }),

      // Reset
      resetStore: () =>
        set({
          user: null,
          nutritionTargets: null,
          equipment: null,
          workoutPlans: [],
          activeWorkout: initialActiveWorkout,
          bodyMeasurements: [],
          physiqueScans: [],
          cardioLogs: [],
          settings: initialSettings,
          onboarding: initialOnboarding,
        }),
    }),
    {
      name: 'symmetry-storage',
      storage: createJSONStorage(() => storageAdapter),
    }
  )
);
