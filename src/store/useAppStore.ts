import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';
import { dataService } from '@/services/dataServiceProvider';
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
 * - Added async action wrappers for cloud sync
 * - Added loading states
 * - Maintains exact same API
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

  // Loading States
  isLoading: boolean;
  loadingMessage: string | null;

  // Actions - User
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setNutritionTargets: (targets: NutritionTargets) => void;
  setEquipment: (equipment: EquipmentProfile) => void;

  // Actions - Workout
  setWorkoutPlans: (plans: WorkoutPlan[]) => void;
  addWorkoutPlan: (plan: WorkoutPlan) => void;
  updateWorkoutPlan: (id: string, updates: Partial<WorkoutPlan>) => void;
  deleteWorkoutPlan: (id: string) => void;
  startWorkout: (workoutId: string) => void;
  endWorkout: () => void;
  toggleWarmupMode: () => void;
  toggleDeloadMode: () => void;
  setCurrentExercise: (index: number) => void;
  startRestTimer: (seconds: number) => void;
  updateRestTimer: (elapsed: number) => void;
  stopRestTimer: () => void;

  // Actions - Progress
  setBodyMeasurements: (measurements: BodyMeasurement[]) => void;
  addBodyMeasurement: (measurement: BodyMeasurement) => void;
  setPhysiqueScans: (scans: PhysiqueScan[]) => void;
  addPhysiqueScan: (scan: PhysiqueScan) => void;
  setCardioLogs: (logs: CardioLog[]) => void;
  addCardioLog: (log: CardioLog) => void;

  // Actions - Settings
  updateSettings: (updates: Partial<AppSettings>) => void;
  addBlacklistedExercise: (exerciseId: string) => void;
  removeBlacklistedExercise: (exerciseId: string) => void;

  // Actions - Onboarding
  updateOnboarding: (updates: Partial<OnboardingData>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Actions - Loading
  setLoading: (isLoading: boolean, message?: string) => void;

  // Actions - Reset
  resetStore: () => void;

  // Async Actions - These sync with the data service
  syncWorkoutPlanToCloud: (plan: WorkoutPlan) => Promise<WorkoutPlan>;
  syncUpdateWorkoutPlanToCloud: (id: string, updates: Partial<WorkoutPlan>) => Promise<WorkoutPlan>;
  syncDeleteWorkoutPlanFromCloud: (id: string) => Promise<void>;
  syncUserToCloud: (user: User) => Promise<User>;
  syncUpdateUserToCloud: (userId: string, updates: Partial<User>) => Promise<User>;
  
  // Async Actions - Progress Data
  syncAddBodyMeasurement: (measurement: BodyMeasurement) => Promise<BodyMeasurement>;
  syncAddPhysiqueScan: (scan: PhysiqueScan) => Promise<PhysiqueScan>;
  syncAddCardioLog: (log: CardioLog) => Promise<CardioLog>;
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
    (set, get) => ({
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
      isLoading: false,
      loadingMessage: null,

      // Loading Actions
      setLoading: (isLoading, message) => set({ isLoading, loadingMessage: message || null }),

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
      deleteWorkoutPlan: (id) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.filter((p) => p.id !== id),
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
      setBodyMeasurements: (measurements) => set({ bodyMeasurements: measurements }),
      addBodyMeasurement: (measurement) =>
        set((state) => ({
          bodyMeasurements: [...state.bodyMeasurements, measurement],
        })),
      setPhysiqueScans: (scans) => set({ physiqueScans: scans }),
      addPhysiqueScan: (scan) =>
        set((state) => ({
          physiqueScans: [...state.physiqueScans, scan],
        })),
      setCardioLogs: (logs) => set({ cardioLogs: logs }),
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
          isLoading: false,
          loadingMessage: null,
        }),

      // Async Actions - Cloud Sync
      // These call the data service first, then update the store
      syncWorkoutPlanToCloud: async (plan) => {
        set({ isLoading: true, loadingMessage: 'Saving workout plan...' });
        try {
          const savedPlan = await dataService.workout.createWorkoutPlan(plan);
          set((state) => ({
            workoutPlans: [...state.workoutPlans, savedPlan],
            isLoading: false,
            loadingMessage: null,
          }));
          if (__DEV__) console.log('✅ Workout plan synced to cloud:', savedPlan.id);
          return savedPlan;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to sync workout plan:', error);
          throw error;
        }
      },

      syncUpdateWorkoutPlanToCloud: async (id, updates) => {
        set({ isLoading: true, loadingMessage: 'Updating workout plan...' });
        try {
          const updatedPlan = await dataService.workout.updateWorkoutPlan(id, updates);
          set((state) => ({
            workoutPlans: state.workoutPlans.map((p) =>
              p.id === id ? updatedPlan : p
            ),
            isLoading: false,
            loadingMessage: null,
          }));
          if (__DEV__) console.log('✅ Workout plan updated in cloud:', id);
          return updatedPlan;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to update workout plan:', error);
          throw error;
        }
      },

      syncDeleteWorkoutPlanFromCloud: async (id) => {
        set({ isLoading: true, loadingMessage: 'Deleting workout plan...' });
        try {
          await dataService.workout.deleteWorkoutPlan(id);
          set((state) => ({
            workoutPlans: state.workoutPlans.filter((p) => p.id !== id),
            isLoading: false,
            loadingMessage: null,
          }));
          if (__DEV__) console.log('✅ Workout plan deleted from cloud:', id);
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to delete workout plan:', error);
          throw error;
        }
      },

      syncUserToCloud: async (user) => {
        set({ isLoading: true, loadingMessage: 'Creating profile...' });
        try {
          const savedUser = await dataService.user.createUser(user);
          set({
            user: savedUser,
            isLoading: false,
            loadingMessage: null,
          });
          if (__DEV__) console.log('✅ User synced to cloud:', savedUser.id);
          return savedUser;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to sync user:', error);
          throw error;
        }
      },

      syncUpdateUserToCloud: async (userId, updates) => {
        set({ isLoading: true, loadingMessage: 'Updating profile...' });
        try {
          const updatedUser = await dataService.user.updateUser(userId, updates);
          set({
            user: updatedUser,
            isLoading: false,
            loadingMessage: null,
          });
          if (__DEV__) console.log('✅ User updated in cloud:', userId);
          return updatedUser;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to update user:', error);
          throw error;
        }
      },

      // Progress Sync Actions
      syncAddBodyMeasurement: async (measurement) => {
        set({ isLoading: true, loadingMessage: 'Saving measurement...' });
        try {
          const savedMeasurement = await dataService.progress.addBodyMeasurement(measurement);
          set((state) => ({
            bodyMeasurements: [...state.bodyMeasurements, savedMeasurement],
            isLoading: false,
            loadingMessage: null,
          }));
          if (__DEV__) console.log('✅ Body measurement synced:', savedMeasurement.id);
          return savedMeasurement;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to sync body measurement:', error);
          throw error;
        }
      },

      syncAddPhysiqueScan: async (scan) => {
        set({ isLoading: true, loadingMessage: 'Saving scan results...' });
        try {
          const savedScan = await dataService.progress.addPhysiqueScan(scan);
          set((state) => ({
            physiqueScans: [...state.physiqueScans, savedScan],
            isLoading: false,
            loadingMessage: null,
          }));
          if (__DEV__) console.log('✅ Physique scan synced:', savedScan.id);
          return savedScan;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to sync physique scan:', error);
          throw error;
        }
      },

      syncAddCardioLog: async (log) => {
        set({ isLoading: true, loadingMessage: 'Saving cardio session...' });
        try {
          const savedLog = await dataService.progress.addCardioLog(log);
          set((state) => ({
            cardioLogs: [...state.cardioLogs, savedLog],
            isLoading: false,
            loadingMessage: null,
          }));
          if (__DEV__) console.log('✅ Cardio log synced:', savedLog.id);
          return savedLog;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to sync cardio log:', error);
          throw error;
        }
      },
    }),
    {
      name: 'symmetry-storage',
      storage: createJSONStorage(() => storageAdapter),
      // Don't persist loading states
      partialize: (state) => ({
        user: state.user,
        nutritionTargets: state.nutritionTargets,
        equipment: state.equipment,
        workoutPlans: state.workoutPlans,
        activeWorkout: state.activeWorkout,
        bodyMeasurements: state.bodyMeasurements,
        physiqueScans: state.physiqueScans,
        cardioLogs: state.cardioLogs,
        settings: state.settings,
        onboarding: state.onboarding,
      }),
    }
  )
);
