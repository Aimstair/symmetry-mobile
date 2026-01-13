import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';
import { dataService } from '@/services/dataServiceProvider';
import { isUsingCloudService } from '@/services/dataServiceProvider';
import { localService } from '@/services/LocalService';
import { subscriptionService } from '@/services/SubscriptionService';
import { supabase } from '@/lib/supabase';
import type {
  User,
  NutritionTargets,
  EquipmentProfile,
  WorkoutPlan,
  WorkoutDay,
  PlanExercise,
  // BodyMeasurement, // Removed
  MeasurementLog, // Added
  PhysiqueScan,
  CardioLog,
  AppSettings,
  OnboardingData,
  ActiveWorkoutState,
} from '@/types';

/**
 * Zustand Store - Offline-First Architecture
 */

// ... (Helper functions isOnline, trySyncToCloud remain the same) ...
async function isOnline(): Promise<boolean> {
  if (!isUsingCloudService()) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch('https://www.google.com/generate_204', { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

async function trySyncToCloud<T>(
  syncFn: () => Promise<T>,
  onError?: (error: unknown) => void,
  isGuest?: boolean
): Promise<T | null> {
  // For guest users, execute the function (which uses LocalService) but don't treat failures as sync errors
  // For authenticated users, execute and sync to cloud
  try {
    return await syncFn();
  } catch (error) {
    // Only log sync failures for authenticated users
    if (!isGuest) {
      if (onError) onError(error);
      else if (__DEV__) console.log('📴 Sync failed (will retry later):', error);
    }
    return null;
  }
}

interface AppState {
  // User & Profile
  user: User | null;
  nutritionTargets: NutritionTargets | null;
  equipment: EquipmentProfile | null;

  // Guest Mode
  isGuest: boolean;

  // Subscription
  isPro: boolean;
  nextScanDate: string | null; // Cached next scan date for instant UI updates

  // Workout Data
  workoutPlans: WorkoutPlan[];
  activeWorkout: ActiveWorkoutState;
  workoutHistory: any[];

  // Progress Data
  measurementLogs: MeasurementLog[]; // ✅ Renamed from measurementLogs
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
  incrementWorkoutsCompleted: () => number; // Returns the new count
  setNutritionTargets: (targets: NutritionTargets) => void;
  setEquipment: (equipment: EquipmentProfile) => void;
  setIsPro: (isPro: boolean) => void;
  setNextScanDate: (date: string | null) => void;
  fetchSubscriptionStatus: () => Promise<void>;
  refreshNextScanDate: () => Promise<void>;

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
  setMeasurementLogs: (logs: MeasurementLog[]) => void;
  addMeasurementLog: (log: MeasurementLog) => void; // ✅ Updated
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

  // Actions - Guest Mode
  setIsGuest: (isGuest: boolean) => void;

  // Actions - Loading
  setLoading: (isLoading: boolean, message?: string) => void;

  // Actions - Reset
  resetStore: () => void;

  // Async Actions - Sync
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
  syncAddMeasurementLog: (log: MeasurementLog) => Promise<void>; // ✅ Updated
  syncAddPhysiqueScan: (scan: PhysiqueScan) => Promise<PhysiqueScan>;
  syncAddCardioLog: (log: CardioLog) => Promise<CardioLog>;

  syncUpdateNutritionTargets: (targets: NutritionTargets) => Promise<void>;
  
  syncSaveWorkoutSession: (sessionData: any) => Promise<string | undefined>;
  syncMarkTodayWorkoutCompleted: (sessionId: string) => Promise<void>;
  syncEnsureTodaySchedule: (planId: string, daySnapshot: any) => Promise<void>;
  syncFetchWorkoutHistory: () => Promise<void>;
  syncGuestDataToCloud: (authenticatedUser: { id: string; email: string }) => Promise<void>;
  
  updateActiveWorkout: (updates: Partial<ActiveWorkoutState>) => void;
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
      isGuest: true,
      isPro: false,
      nextScanDate: null,
      workoutPlans: [],
      activeWorkout: initialActiveWorkout,
      workoutHistory: [],
      measurementLogs: [], // ✅ Renamed
      physiqueScans: [],
      cardioLogs: [],
      settings: initialSettings,
      onboarding: initialOnboarding,
      isLoading: false,
      loadingMessage: null,

      // Loading Actions
      setLoading: (isLoading, message) => set({ isLoading, loadingMessage: message || null }),

      // User Actions
      setUser: (user) => {
        set({ user });
        // Fetch subscription status and next scan date when user is set
        if (user?.id) {
          get().fetchSubscriptionStatus();
          get().refreshNextScanDate();
        }
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      incrementWorkoutsCompleted: () => {
        const state = get();
        const currentCount = state.user?.workoutsCompleted ?? 0;
        const newCount = currentCount + 1;
        
        if (state.user) {
          set({
            user: { ...state.user, workoutsCompleted: newCount },
          });
        }
        
        return newCount;
      },
      setNutritionTargets: (targets) => set({ nutritionTargets: targets }),
      setEquipment: (equipment) => set({ equipment }),
      setIsPro: (isPro) => set({ isPro }),
      setNextScanDate: (date) => set({ nextScanDate: date }),
      
      /**
       * Fetch the next scan date from the server and cache it locally
       * This enables instant UI updates without network calls
       */
      refreshNextScanDate: async () => {
        const user = get().user;
        if (!user?.id) return;
        
        try {
          const { data, error } = await supabase.rpc('get_next_scan_date', {
            p_user_id: user.id,
          });
          
          if (!error && data) {
            set({ nextScanDate: data });
            if (__DEV__) {
              console.log('📅 Next scan date cached:', data);
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Failed to refresh next scan date:', error);
          }
        }
      },
      
      fetchSubscriptionStatus: async () => {
        try {
          const user = get().user;
          if (user?.id) {
            await subscriptionService.initialize(user.id);
          }
          const isPro = await subscriptionService.isProUser();
          set({ isPro });
          if (__DEV__) {
            console.log('📦 Subscription status fetched:', isPro ? 'Pro' : 'Free');
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Failed to fetch subscription status:', error);
          }
          set({ isPro: false });
        }
      },

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
            const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const updatedDays = [...plan.workoutDays.map(d => ({ ...d })), { ...workoutDay }];
            updatedDays.sort((a, b) => {
              const dayA = a.dayName || '';
              const dayB = b.dayName || '';
              return dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
            });
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
            const updatedDays = plan.workoutDays
              .filter((day) => day.id !== dayId)
              .map((day) => ({ ...day })); 
            return {
              ...plan,
              workoutDays: updatedDays,
              updatedAt: new Date(),
            };
          }),
        })),
      startWorkout: (workoutId) =>
        set((state) => {
          if (state.activeWorkout.isActive && state.activeWorkout.workoutId === workoutId) {
            return { activeWorkout: state.activeWorkout };
          }
          return {
            activeWorkout: {
              ...initialActiveWorkout,
              isActive: true,
              workoutId,
              startTime: new Date(),
            },
          };
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

      setMeasurementLogs: (logs) => set({ measurementLogs: logs }),
      // Progress Actions
      addMeasurementLog: (log) =>
        set((state) => ({
          measurementLogs: [...state.measurementLogs, log],
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
          // Initialize workoutsCompleted if user exists
          user: state.user ? { ...state.user, workoutsCompleted: state.user.workoutsCompleted ?? 0 } : state.user,
        })),
      resetOnboarding: () => set({ onboarding: initialOnboarding }),

      // Guest Mode Actions
      setIsGuest: (isGuest) => set({ isGuest }),

      // Reset
      resetStore: () =>
        set({
          user: null,
          nutritionTargets: null,
          equipment: null,
          isGuest: true,
          workoutPlans: [],
          activeWorkout: initialActiveWorkout,
          workoutHistory: [],
          measurementLogs: [], // ✅ Reset renamed field
          physiqueScans: [],
          cardioLogs: [],
          settings: initialSettings,
          onboarding: initialOnboarding,
          isLoading: false,
          loadingMessage: null,
        }),

      // Async Actions
      syncWorkoutPlanToCloud: async (plan) => {
        set((state) => ({
          workoutPlans: [...state.workoutPlans, plan],
        }));
        const isGuest = get().isGuest;
        const result = await trySyncToCloud(async () => {
          const savedPlan = await dataService.workout.createWorkoutPlan(plan);
          if (savedPlan.id !== plan.id) {
            set((state) => ({
              workoutPlans: state.workoutPlans.map((p) =>
                p.id === plan.id ? savedPlan : p
              ),
            }));
          }
          return savedPlan;
        }, undefined, isGuest);
        return result || plan;
      },

      syncUpdateWorkoutPlanToCloud: async (id, updates) => {
        const originalPlan = get().workoutPlans.find((p) => p.id === id);
        set((state) => ({
          workoutPlans: state.workoutPlans.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          ),
        }));
        const isGuest = get().isGuest;
        const result = await trySyncToCloud(async () => {
          return await dataService.workout.updateWorkoutPlan(id, updates);
        }, undefined, isGuest);
        return result || { ...originalPlan!, ...updates };
      },

      syncDeleteWorkoutPlanFromCloud: async (id) => {
        set((state) => ({
          workoutPlans: state.workoutPlans.filter((p) => p.id !== id),
        }));
        const isGuest = get().isGuest;
        await trySyncToCloud(async () => {
          await dataService.workout.deleteWorkoutPlan(id);
        }, undefined, isGuest);
      },

      syncSwapExerciseToCloud: async (planId, dayId, exerciseId, newExerciseId) => {
        get().swapExercise(planId, dayId, exerciseId, newExerciseId);
        const isGuest = get().isGuest;
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        }, undefined, isGuest);
      },

      syncAddExerciseToDayCloud: async (planId, dayId, exercise) => {
        get().addExerciseToDay(planId, dayId, exercise);
        const isGuest = get().isGuest;
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        }, undefined, isGuest);
      },

      syncRemoveExerciseFromDayCloud: async (planId, dayId, exerciseId) => {
        get().removeExerciseFromDay(planId, dayId, exerciseId);
        const isGuest = get().isGuest;
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        }, undefined, isGuest);
      },

      syncAddWorkoutDayToCloud: async (planId, workoutDay) => {
        get().addWorkoutDay(planId, workoutDay);
        const isGuest = get().isGuest;
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        }, undefined, isGuest);
        return workoutDay;
      },

      syncRemoveWorkoutDayFromCloud: async (planId, dayId) => {
        get().removeWorkoutDay(planId, dayId);
        const isGuest = get().isGuest;
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        }, undefined, isGuest);
      },

      syncUserToCloud: async (user) => {
        set({ user });
        const isGuest = get().isGuest;
        const result = await trySyncToCloud(async () => {
          return await dataService.user.createUser(user);
        }, undefined, isGuest);
        if (result) {
          set({ user: result });
          return result;
        }
        return user;
      },

      syncUpdateUserToCloud: async (userId, updates) => {
        const originalUser = get().user;
        set((state) => ({
          user: state.user ? { ...state.user, ...updates, updatedAt: new Date() } : null,
        }));
        
        const isGuest = get().isGuest;
        const result = await trySyncToCloud(async () => {
          return await dataService.user.updateUser(userId, updates);
        }, undefined, isGuest);
        
        if (result) {
          set({ user: result });
        }
        
        // Auto-insert weight history when weight is updated
        if (updates.weight !== undefined) {
          const newWeight = updates.weight;
          trySyncToCloud(async () => {
            const measurementLog: MeasurementLog = {
              id: `log-weight-${Date.now()}`,
              userId,
              date: new Date(),
              weightKg: newWeight,
              createdAt: new Date()
            };
            // Note: service must be updated to use addMeasurementLog
            const savedLog = await dataService.progress.addMeasurementLog(measurementLog);
            set((state) => ({
              measurementLogs: [...state.measurementLogs, savedLog], // ✅ Fixed: using measurementLogs
            }));
          });
        }
        
        return result || { ...originalUser!, ...updates };
      },

      // ✅ Updated Progress Sync Action
      syncAddMeasurementLog: async (log) => {
        set((state) => ({ measurementLogs: [...state.measurementLogs, log] }));
        
        const isGuest = get().isGuest;
        
        // Use LocalService directly for guests to avoid UUID errors
        if (isGuest) {
          try {
            await localService.progress.addMeasurementLog(log);
            if (__DEV__) console.log('💾 Measurement saved locally (guest mode)');
          } catch (error) {
            if (__DEV__) console.error('Failed to save measurement locally:', error);
          }
          return;
        }
        
        // For authenticated users, sync to cloud
        await trySyncToCloud(async () => {
          // Destructure to remove 'id' and 'createdAt' which the service generates/omits
          const { id, createdAt, ...logData } = log;
          
          // Pass the CamelCase object to the service. 
          return await dataService.progress.addMeasurementLog(logData);
        }, undefined, isGuest);
      },

      syncAddPhysiqueScan: async (scan) => {
        set((state) => ({
          physiqueScans: [...state.physiqueScans, scan],
        }));
        const isGuest = get().isGuest;
        
        // Use LocalService directly for guests to avoid UUID errors
        if (isGuest) {
          try {
            await localService.progress.addPhysiqueScan(scan);
            if (__DEV__) console.log('💾 Scan saved locally (guest mode)');
          } catch (error) {
            if (__DEV__) console.error('Failed to save scan locally:', error);
          }
          return scan;
        }
        
        // For authenticated users, sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.progress.addPhysiqueScan(scan);
        }, undefined, isGuest);
        return result || scan;
      },

      syncAddCardioLog: async (log) => {
        set((state) => ({
          cardioLogs: [...state.cardioLogs, log],
        }));
        const isGuest = get().isGuest;
        
        // Use LocalService directly for guests to avoid UUID errors
        if (isGuest) {
          try {
            await localService.progress.addCardioLog(log);
            if (__DEV__) console.log('💾 Cardio log saved locally (guest mode)');
          } catch (error) {
            if (__DEV__) console.error('Failed to save cardio log locally:', error);
          }
          return log;
        }
        
        // For authenticated users, sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.progress.addCardioLog(log);
        }, undefined, isGuest);
        return result || log;
      },

      syncUpdateNutritionTargets: async (targets) => {
        set({ nutritionTargets: targets });
        const userId = get().user?.id;
        const isGuest = get().isGuest;
        if (userId) {
          await trySyncToCloud(async () => {
            await dataService.user.updateNutritionTargets(userId, targets);
          }, undefined, isGuest);
        }
      },

      syncSaveWorkoutSession: async (sessionData) => {
        const state = get();
        // 1. Destructure needed variables from state
        const { user, activeWorkout } = state;
        
        if (!user?.id || !activeWorkout.startTime) {
          if (__DEV__) console.error('❌ Cannot save session: no user or start time');
          return undefined;
        }

        const sessionInput = {
          userId: user.id,
          planId: activeWorkout.workoutId || undefined,
          workoutDayId: undefined,
          name: sessionData.name,
          startedAt: activeWorkout.startTime!,
          endedAt: new Date(),
          warmupMode: activeWorkout.warmupMode,
          deloadMode: activeWorkout.deloadMode,
          exercises: sessionData.exercises,
        };

        const isGuest = state.isGuest;
        const result = await trySyncToCloud(async () => {
          return await dataService.history.saveWorkoutSession(sessionInput);
        }, undefined, isGuest);
        
        if (result) {
          set((state) => ({ workoutHistory: [result, ...state.workoutHistory] }));
          return result.id;
        }
        
        const localSessionId = `local-session-${Date.now()}`;
        const localSession: any = {
          ...sessionInput,
          id: localSessionId,
          durationSeconds: Math.floor((sessionInput.endedAt.getTime() - sessionInput.startedAt.getTime()) / 1000),
          
          // 2. Added explicit types to map parameters
          exercises: sessionInput.exercises.map((ex: any, exIndex: number) => ({
            id: `local-ex-${Date.now()}-${exIndex}`,
            sessionId: localSessionId,
            exerciseId: ex.exerciseId,
            orderIndex: exIndex,
            notes: ex.notes,
            sets: ex.sets.map((s: any, setIndex: number) => ({
              id: `local-set-${Date.now()}-${exIndex}-${setIndex}`,
              sessionExerciseId: `local-ex-${Date.now()}-${exIndex}`,
              setNumber: setIndex + 1,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              isWarmup: s.isWarmup,
              isCompleted: s.isCompleted,
              restTakenSeconds: s.restTakenSeconds,
              createdAt: new Date(),
            })),
          })),
          createdAt: new Date(),
        };
        
        set((state) => ({ workoutHistory: [localSession, ...state.workoutHistory] }));
        return localSessionId;
      },

      syncMarkTodayWorkoutCompleted: async (sessionId) => {
        const state = get();
        const user = state.user;
        if (!user?.id) return;

        const isGuest = state.isGuest;
        await trySyncToCloud(async () => {
          const today = new Date();
          const scheduledWorkout = await dataService.schedule.getScheduledWorkout(user.id, today);
          if (scheduledWorkout) {
            await dataService.schedule.updateScheduleStatus(
              scheduledWorkout.id,
              'completed',
              sessionId
            );
          }
        }, undefined, isGuest);
      },

      syncEnsureTodaySchedule: async (planId, daySnapshot) => {
        const state = get();
        const user = state.user;
        if (!user?.id) return;

        const isGuest = state.isGuest;
        await trySyncToCloud(async () => {
          const today = new Date();
          const existingSchedule = await dataService.schedule.getScheduledWorkout(user.id, today);
          if (!existingSchedule) {
            await dataService.schedule.scheduleWorkout(
              user.id,
              today,
              planId,
              daySnapshot
            );
          }
        }, undefined, isGuest);
      },

      syncFetchWorkoutHistory: async () => {
        const state = get();
        const user = state.user;
        if (!user?.id) return;
        if (user.id.startsWith('guest-')) return;

        const isGuest = state.isGuest;
        await trySyncToCloud(async () => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 90);
          const history = await dataService.history.getWorkoutHistory(user.id, {
            startDate,
            limit: 100,
          });
          set({ workoutHistory: history });
        }, undefined, isGuest);
      },

      syncGuestDataToCloud: async (authenticatedUser) => {
        const state = get();
        const guestUser = state.user;
        
        const updatedUser = guestUser ? {
          ...guestUser,
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          updatedAt: new Date(),
        } : null;

        if (updatedUser) {
          await trySyncToCloud(async () => {
            try {
              await dataService.user.createUser(updatedUser);
            } catch (error: any) {
              if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
                await dataService.user.updateUser(updatedUser.id, updatedUser);
              } else {
                throw error;
              }
            }
          });
        }

        if (state.nutritionTargets && updatedUser) {
          await trySyncToCloud(async () => {
            await dataService.user.updateNutritionTargets(updatedUser.id, state.nutritionTargets!);
          });
        }

        for (const plan of state.workoutPlans) {
          const { id: localId, ...planData } = plan;
          const cloudPlan = { ...planData, userId: authenticatedUser.id };
          await trySyncToCloud(async () => {
            await dataService.workout.createWorkoutPlan(cloudPlan as any);
          });
        }

        // ✅ Updated: Sync Measurement Logs instead of old measurementLogs
        for (const log of state.measurementLogs) {
          const { id: localId, ...data } = log;
          const cloudLog = { 
            ...data, 
            userId: authenticatedUser.id,
            user_id: authenticatedUser.id, // For raw insert
          };
          await trySyncToCloud(async () => {
            await dataService.progress.addMeasurementLog(cloudLog as any);
          });
        }

        for (const scan of state.physiqueScans) {
          const { id: localId, ...scanData } = scan;
          const cloudScan = { ...scanData, userId: authenticatedUser.id };
          await trySyncToCloud(async () => {
            await dataService.progress.addPhysiqueScan(cloudScan as any);
          });
        }

        set({
          user: updatedUser,
          isGuest: false,
        });
      },

      updateActiveWorkout: (updates) =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            ...updates,
            exerciseSets: updates.exerciseSets 
              ? { ...state.activeWorkout.exerciseSets, ...updates.exerciseSets }
              : state.activeWorkout.exerciseSets
          },
        })),
    }),
    {
      name: 'symmetry-storage',
      storage: createJSONStorage(() => storageAdapter),
      partialize: (state) => ({
        user: state.user,
        nutritionTargets: state.nutritionTargets,
        equipment: state.equipment,
        isGuest: state.isGuest,
        workoutPlans: state.workoutPlans,
        activeWorkout: state.activeWorkout,
        workoutHistory: state.workoutHistory,
        measurementLogs: state.measurementLogs, // ✅ Renamed
        physiqueScans: state.physiqueScans,
        cardioLogs: state.cardioLogs,
        settings: state.settings,
        onboarding: state.onboarding,
      }),
    }
  )
);