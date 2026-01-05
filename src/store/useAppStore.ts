import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';
import { dataService } from '@/services/dataServiceProvider';
import type {
  User,
  NutritionTargets,
  EquipmentProfile,
  WorkoutPlan,
  WorkoutDay,
  PlanExercise,
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
  swapExercise: (planId: string, dayId: string, exerciseId: string, newExerciseId: string) => void;
  addExerciseToDay: (planId: string, dayId: string, exercise: PlanExercise) => void;
  removeExerciseFromDay: (planId: string, dayId: string, exerciseId: string) => void;
  addWorkoutDay: (planId: string, workoutDay: WorkoutDay) => void;
  removeWorkoutDay: (planId: string, dayId: string) => void;
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
  syncSwapExerciseToCloud: (planId: string, dayId: string, exerciseId: string, newExerciseId: string) => Promise<void>;
  syncAddExerciseToDayCloud: (planId: string, dayId: string, exercise: PlanExercise) => Promise<void>;
  syncRemoveExerciseFromDayCloud: (planId: string, dayId: string, exerciseId: string) => Promise<void>;
  syncAddWorkoutDayToCloud: (planId: string, workoutDay: WorkoutDay) => Promise<WorkoutDay>;
  syncRemoveWorkoutDayFromCloud: (planId: string, dayId: string) => Promise<void>;
  syncUserToCloud: (user: User) => Promise<User>;
  syncUpdateUserToCloud: (userId: string, updates: Partial<User>) => Promise<User>;
  
  // Async Actions - Progress Data
  syncAddBodyMeasurement: (measurement: BodyMeasurement) => Promise<BodyMeasurement>;
  syncAddPhysiqueScan: (scan: PhysiqueScan) => Promise<PhysiqueScan>;
  syncAddCardioLog: (log: CardioLog) => Promise<CardioLog>;

  syncUpdateNutritionTargets: (targets: NutritionTargets) => Promise<void>;
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
  sessionId: null,
  startTime: null,
  currentExerciseIndex: 0,
  warmupMode: false,
  deloadMode: false,
  restTimer: {
    isRunning: false,
    targetSeconds: 90,
    elapsedSeconds: 0,
  },
  exerciseSets: {},
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
      swapExercise: (planId, dayId, exerciseId, newExerciseId) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            return {
              ...plan,
              workoutDays: plan.workoutDays.map((day) => {
                if (day.id !== dayId) return day;
                return {
                  ...day,
                  exercises: day.exercises.map((ex) => {
                    if (ex.id !== exerciseId) return ex;
                    return {
                      ...ex,
                      exerciseId: newExerciseId,
                      // Clear hydrated exercise so it gets re-fetched
                      exercise: undefined,
                    };
                  }),
                };
              }),
            };
          }),
        })),
      
      addExerciseToDay: (planId, dayId, exercise) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            return {
              ...plan,
              workoutDays: plan.workoutDays.map((day) => {
                if (day.id !== dayId) return day;
                // Add the exercise at the end with proper order index
                const newOrderIndex = day.exercises.length;
                return {
                  ...day,
                  exercises: [
                    ...day.exercises,
                    { ...exercise, orderIndex: newOrderIndex },
                  ],
                };
              }),
            };
          }),
        })),
      
      removeExerciseFromDay: (planId, dayId, exerciseId) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            return {
              ...plan,
              workoutDays: plan.workoutDays.map((day) => {
                if (day.id !== dayId) return day;
                // Remove the exercise and reindex remaining exercises
                const updatedExercises = day.exercises
                  .filter((ex) => ex.id !== exerciseId)
                  .map((ex, idx) => ({ ...ex, orderIndex: idx }));
                return {
                  ...day,
                  exercises: updatedExercises,
                };
              }),
            };
          }),
        })),
      
      addWorkoutDay: (planId, workoutDay) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            
            // Add the new day - use dayName for sorting, not name parsing
            const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const updatedDays = [...plan.workoutDays.map(d => ({ ...d })), { ...workoutDay }];
            
            // Sort by dayName (the actual day of week this workout belongs to)
            updatedDays.sort((a, b) => {
              const dayA = a.dayName || '';
              const dayB = b.dayName || '';
              return dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
            });
            
            // Update orderIndex immutably after sorting
            const sortedDays = updatedDays.map((day, idx) => ({
              ...day,
              orderIndex: idx,
            }));
            
            return {
              ...plan,
              workoutDays: sortedDays,
              updatedAt: new Date(),
            };
          }),
        })),
      removeWorkoutDay: (planId, dayId) =>
        set((state) => ({
          workoutPlans: state.workoutPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            
            // Filter out the removed day - do NOT re-index!
            // Each workout day is tied to a specific dayName (e.g., 'Monday')
            // Re-indexing would shift assignments to wrong days
            const updatedDays = plan.workoutDays
              .filter((day) => day.id !== dayId)
              .map((day) => ({ ...day })); // Create new objects to avoid mutation
            
            return {
              ...plan,
              workoutDays: updatedDays,
              updatedAt: new Date(),
            };
          }),
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

      syncSwapExerciseToCloud: async (planId, dayId, exerciseId, newExerciseId) => {
        set({ isLoading: true, loadingMessage: 'Swapping exercise...' });
        try {
          // Update local state first
          get().swapExercise(planId, dayId, exerciseId, newExerciseId);
          
          // Get the updated plan and sync to cloud
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
          
          set({ isLoading: false, loadingMessage: null });
          if (__DEV__) console.log('✅ Exercise swapped:', exerciseId, '->', newExerciseId);
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to swap exercise:', error);
          throw error;
        }
      },

      syncAddExerciseToDayCloud: async (planId, dayId, exercise) => {
        set({ isLoading: true, loadingMessage: 'Adding exercise...' });
        try {
          // Update local state first
          get().addExerciseToDay(planId, dayId, exercise);
          
          // Get the updated plan and sync to cloud
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
          
          set({ isLoading: false, loadingMessage: null });
          if (__DEV__) console.log('✅ Exercise added:', exercise.exerciseId);
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to add exercise:', error);
          throw error;
        }
      },

      syncRemoveExerciseFromDayCloud: async (planId, dayId, exerciseId) => {
        set({ isLoading: true, loadingMessage: 'Removing exercise...' });
        try {
          // Update local state first
          get().removeExerciseFromDay(planId, dayId, exerciseId);
          
          // Get the updated plan and sync to cloud
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
          
          set({ isLoading: false, loadingMessage: null });
          if (__DEV__) console.log('✅ Exercise removed:', exerciseId);
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to remove exercise:', error);
          throw error;
        }
      },

      syncAddWorkoutDayToCloud: async (planId, workoutDay) => {
        set({ isLoading: true, loadingMessage: 'Adding workout day...' });
        try {
          // Update local state first
          get().addWorkoutDay(planId, workoutDay);
          
          // Get the updated plan and sync to cloud
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
          
          set({ isLoading: false, loadingMessage: null });
          if (__DEV__) console.log('✅ Workout day added:', workoutDay.name);
          return workoutDay;
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to add workout day:', error);
          throw error;
        }
      },

      syncRemoveWorkoutDayFromCloud: async (planId, dayId) => {
        set({ isLoading: true, loadingMessage: 'Removing workout day...' });
        try {
          // Update local state first
          get().removeWorkoutDay(planId, dayId);
          
          // Get the updated plan and sync to cloud
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
          
          set({ isLoading: false, loadingMessage: null });
          if (__DEV__) console.log('✅ Workout day removed:', dayId);
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to remove workout day:', error);
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
          
          // **FIX: Immediately update local store to ensure UI refresh**
          set({
            user: updatedUser,
          });
          
          // Auto-insert weight history when weight is updated
          if (updates.weight !== undefined) {
            try {
              const weightMeasurement: BodyMeasurement = {
                id: `bm-weight-${Date.now()}`,
                userId,
                date: new Date(),
                weight: updates.weight,
                measurements: {},
              };
              const savedMeasurement = await dataService.progress.addBodyMeasurement(weightMeasurement);
              set((state) => ({
                bodyMeasurements: [...state.bodyMeasurements, savedMeasurement],
              }));
              if (__DEV__) console.log('✅ Weight history auto-logged:', updates.weight);
            } catch (weightError) {
              // Don't fail the whole update if weight logging fails
              console.error('⚠️ Failed to auto-log weight history:', weightError);
            }
          }
          
          set({
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

      syncUpdateNutritionTargets: async (targets) => {
        set({ isLoading: true, loadingMessage: 'Updating macros...' });
        try {
          const userId = get().user?.id;
          if (!userId) throw new Error('No user found');

          // Update Cloud
          await dataService.user.updateNutritionTargets(userId, targets);

          // Update Local
          set({
            nutritionTargets: targets,
            isLoading: false,
            loadingMessage: null,
          });
          
          if (__DEV__) console.log('✅ Nutrition targets recalculated and synced');
        } catch (error) {
          set({ isLoading: false, loadingMessage: null });
          console.error('❌ Failed to sync nutrition:', error);
          throw error; // Rethrow so UI can show error if needed
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
