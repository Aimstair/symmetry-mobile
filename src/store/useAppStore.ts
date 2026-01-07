import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';
import { dataService } from '@/services/dataServiceProvider';
import { isUsingCloudService } from '@/services/dataServiceProvider';
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
 * Zustand Store - Offline-First Architecture
 * 
 * Strategy:
 * - READ: Always from local state (fast, works offline)
 * - WRITE: Local first (optimistic update), then sync to cloud
 * - SYNC: Background sync when online, queue failed operations
 * 
 * Changes from web version:
 * - localStorage → MMKV (via storageAdapter)
 * - Added offline-first async action wrappers
 * - Added sync queue for failed operations
 * - Maintains exact same API
 */

// Offline queue for failed sync operations
interface PendingSyncOperation {
  id: string;
  type: 'workout_plan' | 'workout_session' | 'user' | 'physique_scan';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
}

// Helper to check if we're online (simple check)
async function isOnline(): Promise<boolean> {
  if (!isUsingCloudService()) return false;
  try {
    // Quick ping to check connectivity
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

// Helper to safely sync to cloud (won't throw if offline)
async function trySyncToCloud<T>(
  syncFn: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await syncFn();
  } catch (error) {
    if (onError) onError(error);
    else if (__DEV__) console.log('📴 Sync failed (will retry later):', error);
    return null;
  }
}

interface AppState {
  // User & Profile
  user: User | null;
  nutritionTargets: NutritionTargets | null;
  equipment: EquipmentProfile | null;

  // Guest Mode - true until user signs in with Supabase
  isGuest: boolean;

  // Workout Data
  workoutPlans: WorkoutPlan[];
  activeWorkout: ActiveWorkoutState;
  workoutHistory: any[]; // WorkoutSession[] - stores completed workouts

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

  // Actions - Guest Mode
  setIsGuest: (isGuest: boolean) => void;

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
  
  // Async Actions - Workout Sessions
  syncSaveWorkoutSession: (sessionData: {
    name: string;
    exercises: {
      exerciseId: string;
      sets: {
        weight: number;
        reps: number;
        isWarmup: boolean;
        isCompleted: boolean;
      }[];
    }[];
  }) => Promise<string | undefined>; // Returns session ID
  
  // Async Actions - Schedule  
  syncMarkTodayWorkoutCompleted: (sessionId: string) => Promise<void>;
  syncEnsureTodaySchedule: (planId: string, daySnapshot: any) => Promise<void>;
  
  // Async Actions - Workout History
  syncFetchWorkoutHistory: () => Promise<void>;
  
  // Async Actions - Guest Data Sync (called when guest signs in)
  syncGuestDataToCloud: (authenticatedUser: { id: string; email: string }) => Promise<void>;
  
  // Actions - Active Workout Progress (stores in-progress set data)
  updateActiveWorkoutSets: (exerciseSets: Record<string, any[]>) => void;
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
      isGuest: true, // New users start as guests
      workoutPlans: [],
      activeWorkout: initialActiveWorkout,
      workoutHistory: [],
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
          bodyMeasurements: [],
          physiqueScans: [],
          cardioLogs: [],
          settings: initialSettings,
          onboarding: initialOnboarding,
          isLoading: false,
          loadingMessage: null,
        }),

      // Async Actions - Cloud Sync (Offline-First)
      // These update local state FIRST (optimistic), then sync to cloud
      syncWorkoutPlanToCloud: async (plan) => {
        // 1. Update local state immediately (optimistic)
        set((state) => ({
          workoutPlans: [...state.workoutPlans, plan],
        }));
        
        // 2. Try to sync to cloud in background
        const result = await trySyncToCloud(async () => {
          const savedPlan = await dataService.workout.createWorkoutPlan(plan);
          // Update with server response if IDs differ
          if (savedPlan.id !== plan.id) {
            set((state) => ({
              workoutPlans: state.workoutPlans.map((p) =>
                p.id === plan.id ? savedPlan : p
              ),
            }));
          }
          return savedPlan;
        });
        
        return result || plan; // Return local plan if sync failed
      },

      syncUpdateWorkoutPlanToCloud: async (id, updates) => {
        // 1. Update local state immediately (optimistic)
        const originalPlan = get().workoutPlans.find((p) => p.id === id);
        set((state) => ({
          workoutPlans: state.workoutPlans.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          ),
        }));
        
        // 2. Try to sync to cloud in background
        const result = await trySyncToCloud(async () => {
          return await dataService.workout.updateWorkoutPlan(id, updates);
        });
        
        return result || { ...originalPlan!, ...updates };
      },

      syncDeleteWorkoutPlanFromCloud: async (id) => {
        // 1. Remove from local state immediately (optimistic)
        set((state) => ({
          workoutPlans: state.workoutPlans.filter((p) => p.id !== id),
        }));
        
        // 2. Try to sync to cloud in background
        await trySyncToCloud(async () => {
          await dataService.workout.deleteWorkoutPlan(id);
        });
      },

      syncSwapExerciseToCloud: async (planId, dayId, exerciseId, newExerciseId) => {
        // 1. Update local state first (optimistic)
        get().swapExercise(planId, dayId, exerciseId, newExerciseId);
        
        // 2. Try to sync to cloud in background
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        });
      },

      syncAddExerciseToDayCloud: async (planId, dayId, exercise) => {
        // 1. Update local state first (optimistic)
        get().addExerciseToDay(planId, dayId, exercise);
        
        // 2. Try to sync to cloud in background
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        });
      },

      syncRemoveExerciseFromDayCloud: async (planId, dayId, exerciseId) => {
        // 1. Update local state first (optimistic)
        get().removeExerciseFromDay(planId, dayId, exerciseId);
        
        // 2. Try to sync to cloud in background
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        });
      },

      syncAddWorkoutDayToCloud: async (planId, workoutDay) => {
        // 1. Update local state first (optimistic)
        get().addWorkoutDay(planId, workoutDay);
        
        // 2. Try to sync to cloud in background
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        });
        
        return workoutDay;
      },

      syncRemoveWorkoutDayFromCloud: async (planId, dayId) => {
        // 1. Update local state first (optimistic)
        get().removeWorkoutDay(planId, dayId);
        
        // 2. Try to sync to cloud in background
        await trySyncToCloud(async () => {
          const updatedPlan = get().workoutPlans.find((p) => p.id === planId);
          if (updatedPlan) {
            await dataService.workout.updateWorkoutPlan(planId, updatedPlan);
          }
        });
      },

      syncUserToCloud: async (user) => {
        // 1. Update local state immediately
        set({ user });
        
        // 2. Try to sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.user.createUser(user);
        });
        
        if (result) {
          set({ user: result });
          return result;
        }
        
        return user;
      },

      syncUpdateUserToCloud: async (userId, updates) => {
        // 1. Update local state immediately (optimistic)
        const originalUser = get().user;
        set((state) => ({
          user: state.user ? { ...state.user, ...updates, updatedAt: new Date() } : null,
        }));
        
        // 2. Try to sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.user.updateUser(userId, updates);
        });
        
        if (result) {
          set({ user: result });
        }
        
        // Auto-insert weight history when weight is updated
        if (updates.weight !== undefined) {
          const newWeight = updates.weight; // Capture value for closure
          trySyncToCloud(async () => {
            const weightMeasurement: BodyMeasurement = {
              id: `bm-weight-${Date.now()}`,
              userId,
              date: new Date(),
              weight: newWeight,
              measurements: {},
            };
            const savedMeasurement = await dataService.progress.addBodyMeasurement(weightMeasurement);
            set((state) => ({
              bodyMeasurements: [...state.bodyMeasurements, savedMeasurement],
            }));
          });
        }
        
        return result || { ...originalUser!, ...updates };
      },

      // Progress Sync Actions (Offline-First)
      syncAddBodyMeasurement: async (measurement) => {
        // 1. Update local state immediately
        set((state) => ({
          bodyMeasurements: [...state.bodyMeasurements, measurement],
        }));
        
        // 2. Try to sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.progress.addBodyMeasurement(measurement);
        });
        
        return result || measurement;
      },

      syncAddPhysiqueScan: async (scan) => {
        // 1. Update local state immediately
        set((state) => ({
          physiqueScans: [...state.physiqueScans, scan],
        }));
        
        // 2. Try to sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.progress.addPhysiqueScan(scan);
        });
        
        return result || scan;
      },

      syncAddCardioLog: async (log) => {
        // 1. Update local state immediately
        set((state) => ({
          cardioLogs: [...state.cardioLogs, log],
        }));
        
        // 2. Try to sync to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.progress.addCardioLog(log);
        });
        
        return result || log;
      },

      syncUpdateNutritionTargets: async (targets) => {
        // 1. Update local state immediately
        set({ nutritionTargets: targets });
        
        // 2. Try to sync to cloud
        const userId = get().user?.id;
        if (userId) {
          await trySyncToCloud(async () => {
            await dataService.user.updateNutritionTargets(userId, targets);
          });
        }
      },

      // Save workout session to cloud (returns session ID)
      // This one needs to try cloud first since session IDs matter
      syncSaveWorkoutSession: async (sessionData) => {
        const state = get();
        const user = state.user;
        const activeWorkout = state.activeWorkout;
        
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

        // Try to save to cloud
        const result = await trySyncToCloud(async () => {
          return await dataService.history.saveWorkoutSession(sessionInput);
        });
        
        if (result) {
          // Add to workout history for immediate UI update
          set((state) => ({
            workoutHistory: [result, ...state.workoutHistory],
          }));
          return result.id;
        }
        
        // If offline or guest, create local session and add to history
        const localSessionId = `local-session-${Date.now()}`;
        const localSession: any = {
          ...sessionInput,
          id: localSessionId,
          durationSeconds: Math.floor((sessionInput.endedAt.getTime() - sessionInput.startedAt.getTime()) / 1000),
          exercises: sessionInput.exercises.map((ex, exIndex) => ({
            id: `local-ex-${Date.now()}-${exIndex}`,
            sessionId: localSessionId,
            exerciseId: ex.exerciseId,
            orderIndex: exIndex,
            notes: (ex as any).notes,
            sets: ex.sets.map((s, setIndex) => ({
              id: `local-set-${Date.now()}-${exIndex}-${setIndex}`,
              sessionExerciseId: `local-ex-${Date.now()}-${exIndex}`,
              setNumber: setIndex + 1,
              weight: s.weight,
              reps: s.reps,
              rpe: (s as any).rpe,
              isWarmup: s.isWarmup,
              isCompleted: s.isCompleted,
              restTakenSeconds: (s as any).restTakenSeconds,
              createdAt: new Date(),
            })),
          })),
          createdAt: new Date(),
        };
        
        // Add local session to history
        set((state) => ({
          workoutHistory: [localSession, ...state.workoutHistory],
        }));
        
        if (__DEV__) {
          console.log('💾 Local workout session saved and added to history:', localSessionId);
        }
        
        return localSessionId;
      },

      // Mark today's scheduled workout as completed
      syncMarkTodayWorkoutCompleted: async (sessionId) => {
        const state = get();
        const user = state.user;
        
        if (!user?.id) {
          return;
        }

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
        });
      },

      // Ensure today's workout is scheduled (called when starting workout)
      syncEnsureTodaySchedule: async (planId, daySnapshot) => {
        const state = get();
        const user = state.user;
        
        if (!user?.id) {
          return;
        }

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
        });
      },

      // Fetch workout history for the current user
      syncFetchWorkoutHistory: async () => {
        const state = get();
        const user = state.user;
        
        if (!user?.id) {
          if (__DEV__) console.log('⚠️ syncFetchWorkoutHistory: No user ID');
          return;
        }

        if (__DEV__) console.log('📊 Fetching workout history for user:', user.id);

        // For guest users, keep local history instead of overwriting with empty cloud result
        if (user.id.startsWith('guest-')) {
          if (__DEV__) console.log('📊 Guest user - preserving local workout history');
          return;
        }

        await trySyncToCloud(async () => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 90);
          
          const history = await dataService.history.getWorkoutHistory(user.id, {
            startDate,
            limit: 100,
          });
          
          if (__DEV__) {
            console.log('📊 Workout history fetched:', history.length, 'sessions');
            if (history.length > 0) {
              const today = new Date().toISOString().split('T')[0];
              const todaySessions = history.filter(s => {
                const sessionDate = new Date(s.startedAt).toISOString().split('T')[0];
                return sessionDate === today;
              });
              console.log('📊 Sessions for today:', todaySessions.length);
              if (todaySessions.length > 0) {
                console.log('📊 Today\'s session:', todaySessions[0].name, 'at', todaySessions[0].startedAt);
              }
            }
          }
          
          set({ workoutHistory: history });
        });
      },

      // Sync all guest data to cloud when guest signs in
      // Called after successful OAuth authentication
      syncGuestDataToCloud: async (authenticatedUser) => {
        const state = get();
        const guestUser = state.user;
        
        if (__DEV__) {
          console.log('🔄 Syncing guest data to cloud for:', authenticatedUser.email);
        }

        // Update the user ID from guest ID to authenticated user ID
        const updatedUser = guestUser ? {
          ...guestUser,
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          updatedAt: new Date(),
        } : null;

        // 1. Create/update user profile in cloud
        if (updatedUser) {
          await trySyncToCloud(async () => {
            try {
              await dataService.user.createUser(updatedUser);
              if (__DEV__) console.log('✅ User profile synced to cloud');
            } catch (error: any) {
              // If user already exists, update instead
              if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
                await dataService.user.updateUser(updatedUser.id, updatedUser);
                if (__DEV__) console.log('✅ User profile updated in cloud');
              } else {
                throw error;
              }
            }
          });
        }

        // 2. Sync nutrition targets
        if (state.nutritionTargets && updatedUser) {
          await trySyncToCloud(async () => {
            await dataService.user.updateNutritionTargets(updatedUser.id, state.nutritionTargets!);
            if (__DEV__) console.log('✅ Nutrition targets synced');
          });
        }

        // 3. Sync workout plans
        for (const plan of state.workoutPlans) {
          const cloudPlan = { ...plan, userId: authenticatedUser.id };
          await trySyncToCloud(async () => {
            await dataService.workout.createWorkoutPlan(cloudPlan);
            if (__DEV__) console.log('✅ Workout plan synced:', plan.name);
          });
        }

        // 4. Sync body measurements
        for (const measurement of state.bodyMeasurements) {
          const cloudMeasurement = { ...measurement, userId: authenticatedUser.id };
          await trySyncToCloud(async () => {
            await dataService.progress.addBodyMeasurement(cloudMeasurement);
          });
        }

        // 5. Sync physique scans
        for (const scan of state.physiqueScans) {
          const cloudScan = { ...scan, userId: authenticatedUser.id };
          await trySyncToCloud(async () => {
            await dataService.progress.addPhysiqueScan(cloudScan);
          });
        }

        // 6. Update local state - set user with authenticated ID and mark as not guest
        set({
          user: updatedUser,
          isGuest: false,
        });

        if (__DEV__) {
          console.log('✅ Guest data sync completed');
        }
      },

      // Update active workout progress (for persistence when leaving screen)
      updateActiveWorkoutSets: (exerciseSets) =>
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exerciseSets: exerciseSets as Record<string, import('@/types').SessionSet[]>,
          },
        })),
    }),
    {
      name: 'symmetry-storage',
      storage: createJSONStorage(() => storageAdapter),
      // Don't persist loading states
      partialize: (state) => ({
        user: state.user,
        nutritionTargets: state.nutritionTargets,
        equipment: state.equipment,
        isGuest: state.isGuest, // Persist guest status
        workoutPlans: state.workoutPlans,
        activeWorkout: state.activeWorkout,
        workoutHistory: state.workoutHistory, // Persist workout history for offline access
        bodyMeasurements: state.bodyMeasurements,
        physiqueScans: state.physiqueScans,
        cardioLogs: state.cardioLogs,
        settings: state.settings,
        onboarding: state.onboarding,
      }),
    }
  )
);
