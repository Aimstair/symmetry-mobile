/**
 * Local Data Service Implementation
 * 
 * Uses AsyncStorage for Expo Go compatibility
 * All operations are Promise-based to match future CloudService API
 * 
 * Migration Path:
 * 1. Use this for offline-first development
 * 2. Later, swap for CloudService that hits Supabase/Firebase
 * 3. UI code doesn't change - it only knows the interface
 */

import { getStorageItem, setStorageItem } from '@/lib/storage';
import type {
  IDataService,
  IExerciseService,
  IWorkoutService,
  IHistoryService,
  IProgressService,
  IUserService,
  IScheduleService,
} from './interfaces';
import type {
  User,
  WorkoutPlan,
  BodyMeasurement,
  PhysiqueScan,
  CardioLog,
  NutritionTargets,
  EquipmentProfile,
  CatalogExercise,
  ExerciseCacheMetadata,
  ScheduledWorkout,
  WorkoutDaySnapshot,
  ScheduleStatus,
} from '@/types';

/**
 * Helper: Get data from storage
 */
function getStorageData<T>(key: string): T[] {
  const data = getStorageItem<T[]>(key);
  return data || [];
}

/**
 * Helper: Set data in storage
 */
function setStorageDataArray<T>(key: string, data: T[]): void {
  setStorageItem(key, data);
}

/**
 * Workout Service - Local Implementation
 */
class LocalWorkoutService implements IWorkoutService {
  private readonly STORAGE_KEY = 'workout_plans';

  async getWorkoutPlans(userId: string): Promise<WorkoutPlan[]> {
    const plans = getStorageData<WorkoutPlan>(this.STORAGE_KEY);
    return plans.filter((p) => p.userId === userId);
  }

  async getWorkoutPlan(id: string): Promise<WorkoutPlan | null> {
    const plans = getStorageData<WorkoutPlan>(this.STORAGE_KEY);
    return plans.find((p) => p.id === id) ?? null;
  }

  async createWorkoutPlan(plan: WorkoutPlan): Promise<WorkoutPlan> {
    const plans = getStorageData<WorkoutPlan>(this.STORAGE_KEY);
    plans.push(plan);
    setStorageDataArray(this.STORAGE_KEY, plans);
    return plan;
  }

  async updateWorkoutPlan(
    id: string,
    updates: Partial<WorkoutPlan>
  ): Promise<WorkoutPlan> {
    const plans = getStorageData<WorkoutPlan>(this.STORAGE_KEY);
    const index = plans.findIndex((p) => p.id === id);
    if (index === -1) throw new Error(`Workout plan ${id} not found`);

    plans[index] = { ...plans[index], ...updates };
    setStorageDataArray(this.STORAGE_KEY, plans);
    return plans[index];
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    const plans = getStorageData<WorkoutPlan>(this.STORAGE_KEY);
    const filtered = plans.filter((p) => p.id !== id);
    setStorageDataArray(this.STORAGE_KEY, filtered);
  }
  
  // Day-level operations (stubs for local)
  async addWorkoutDay(planId: string, day: any): Promise<any> {
    throw new Error('addWorkoutDay not implemented in LocalService');
  }
  
  async updateWorkoutDay(dayId: string, updates: any): Promise<any> {
    throw new Error('updateWorkoutDay not implemented in LocalService');
  }
  
  async deleteWorkoutDay(dayId: string): Promise<void> {
    throw new Error('deleteWorkoutDay not implemented in LocalService');
  }
  
  // Exercise-level operations (stubs)
  async addPlanExercise(dayId: string, exercise: any): Promise<any> {
    throw new Error('addPlanExercise not implemented in LocalService');
  }
  
  async updatePlanExercise(exerciseId: string, updates: any): Promise<any> {
    throw new Error('updatePlanExercise not implemented in LocalService');
  }
  
  async deletePlanExercise(exerciseId: string): Promise<void> {
    throw new Error('deletePlanExercise not implemented in LocalService');
  }
  
  async reorderPlanExercises(dayId: string, exerciseIds: string[]): Promise<void> {
    throw new Error('reorderPlanExercises not implemented in LocalService');
  }
}

/**
 * Progress Service - Local Implementation
 */
class LocalProgressService implements IProgressService {
  private readonly BODY_KEY = 'body_measurements';
  private readonly SCAN_KEY = 'physique_scans';
  private readonly CARDIO_KEY = 'cardio_logs';
  private readonly MEASUREMENT_LOGS_KEY = 'measurement_logs';

  // New normalized measurement logs
  async getMeasurementLogs(userId: string): Promise<any[]> {
    const data = getStorageData<any>(this.MEASUREMENT_LOGS_KEY);
    return data.filter((m: any) => m.userId === userId);
  }
  
  async addMeasurementLog(log: any): Promise<any> {
    const data = getStorageData<any>(this.MEASUREMENT_LOGS_KEY);
    const newLog = { ...log, id: `ml_${Date.now()}`, createdAt: new Date() };
    data.push(newLog);
    setStorageDataArray(this.MEASUREMENT_LOGS_KEY, data);
    return newLog;
  }
  
  async updateMeasurementLog(id: string, updates: any): Promise<any> {
    const data = getStorageData<any>(this.MEASUREMENT_LOGS_KEY);
    const index = data.findIndex((m: any) => m.id === id);
    if (index === -1) throw new Error(`MeasurementLog ${id} not found`);
    data[index] = { ...data[index], ...updates };
    setStorageDataArray(this.MEASUREMENT_LOGS_KEY, data);
    return data[index];
  }
  
  async deleteMeasurementLog(id: string): Promise<void> {
    const data = getStorageData<any>(this.MEASUREMENT_LOGS_KEY);
    const filtered = data.filter((m: any) => m.id !== id);
    setStorageDataArray(this.MEASUREMENT_LOGS_KEY, filtered);
  }

  async getmeasurementLogs(userId: string): Promise<BodyMeasurement[]> {
    const data = getStorageData<BodyMeasurement>(this.BODY_KEY);
    return data.filter((m) => m.userId === userId);
  }

  async addBodyMeasurement(measurement: BodyMeasurement): Promise<BodyMeasurement> {
    const data = getStorageData<BodyMeasurement>(this.BODY_KEY);
    data.push(measurement);
    setStorageDataArray(this.BODY_KEY, data);
    return measurement;
  }

  async getPhysiqueScans(userId: string): Promise<PhysiqueScan[]> {
    const data = getStorageData<PhysiqueScan>(this.SCAN_KEY);
    return data.filter((s) => s.userId === userId);
  }

  async addPhysiqueScan(scan: PhysiqueScan): Promise<PhysiqueScan> {
    const data = getStorageData<PhysiqueScan>(this.SCAN_KEY);
    data.push(scan);
    setStorageDataArray(this.SCAN_KEY, data);
    return scan;
  }

  async getCardioLogs(userId: string): Promise<CardioLog[]> {
    const data = getStorageData<CardioLog>(this.CARDIO_KEY);
    return data.filter((l) => l.userId === userId);
  }

  async addCardioLog(log: CardioLog): Promise<CardioLog> {
    const data = getStorageData<CardioLog>(this.CARDIO_KEY);
    data.push(log);
    setStorageDataArray(this.CARDIO_KEY, data);
    return log;
  }
}

/**
 * User Service - Local Implementation
 */
class LocalUserService implements IUserService {
  private readonly USER_KEY = 'user';
  private readonly NUTRITION_KEY = 'nutrition_targets';
  private readonly EQUIPMENT_KEY = 'equipment';

  async getUser(userId: string): Promise<User | null> {
    return getStorageItem<User>(this.USER_KEY);
  }

  async getNutritionTargets(userId: string): Promise<NutritionTargets | null> {
    return getStorageItem<NutritionTargets>(this.NUTRITION_KEY);
  }

  async getEquipment(userId: string): Promise<EquipmentProfile | null> {
    return getStorageItem<EquipmentProfile>(this.EQUIPMENT_KEY);
  }

  async createUser(user: User): Promise<User> {
    setStorageItem(this.USER_KEY, user);
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const current = await this.getUser(userId);
    if (!current) throw new Error('User not found');
    const updated = { ...current, ...updates };
    setStorageItem(this.USER_KEY, updated);
    return updated;
  }

  async updateNutritionTargets(
    userId: string,
    targets: NutritionTargets
  ): Promise<NutritionTargets> {
    setStorageItem(this.NUTRITION_KEY, targets);
    return targets;
  }

  async updateEquipment(
    userId: string,
    equipment: EquipmentProfile
  ): Promise<EquipmentProfile> {
    setStorageItem(this.EQUIPMENT_KEY, equipment);
    return equipment;
  }
}

/**
 * Exercise Service - Local Stub Implementation
 * Returns empty/null for local development
 * Real data comes from CloudService when enabled
 */
class LocalExerciseService implements IExerciseService {
  async getExercises(): Promise<CatalogExercise[]> {
    return [];
  }
  
  async getExercise(id: string): Promise<CatalogExercise | null> {
    return null;
  }
  
  async searchExercises(query: string): Promise<CatalogExercise[]> {
    return [];
  }
  
  async filterExercises(filters: {
    muscleGroups?: string[];
    equipment?: string[];
    environment?: 'gym' | 'home' | 'any';
  }): Promise<CatalogExercise[]> {
    return [];
  }
  
  async getAlternatives(exerciseId: string): Promise<CatalogExercise[]> {
    return [];
  }
  
  async forceSync(): Promise<void> {
    // No-op for local
  }
  
  getCacheMetadata(): ExerciseCacheMetadata | null {
    return null;
  }
}

/**
 * History Service - Local Stub Implementation  
 * Returns empty data for local development
 */
class LocalHistoryService implements IHistoryService {
  async saveWorkoutSession(input: any): Promise<any> {
    return { ...input, id: `session_${Date.now()}` };
  }
  
  async getWorkoutHistory(userId: string, options?: any): Promise<any[]> {
    return [];
  }
  
  async getWorkoutSession(sessionId: string): Promise<any | null> {
    return null;
  }
  
  async getExerciseHistory(userId: string, exerciseId: string, limit?: number): Promise<any[]> {
    return [];
  }
  
  async getExercisePRs(userId: string, exerciseId: string): Promise<any | null> {
    return null;
  }
  
  async deleteWorkoutSession(sessionId: string): Promise<void> {
    // No-op for local
  }
}

/**
 * Schedule Service - Local Implementation (Stub)
 */
class LocalScheduleService implements IScheduleService {
  async getScheduledWorkouts(userId: string, startDate: Date, endDate: Date): Promise<ScheduledWorkout[]> {
    // Not implemented for local - return empty
    return [];
  }

  async getScheduledWorkout(userId: string, date: Date): Promise<ScheduledWorkout | null> {
    return null;
  }

  async scheduleWorkout(
    userId: string,
    date: Date,
    workoutPlanId: string | null,
    workoutSnapshot: WorkoutDaySnapshot
  ): Promise<ScheduledWorkout> {
    throw new Error('scheduleWorkout not implemented in LocalService');
  }

  async updateScheduleStatus(
    scheduleId: string,
    status: ScheduleStatus,
    sessionId?: string
  ): Promise<ScheduledWorkout> {
    throw new Error('updateScheduleStatus not implemented in LocalService');
  }

  async deleteScheduledWorkout(scheduleId: string): Promise<void> {
    // No-op
  }

  async getTrainingDaysForWeek(userId: string, weekStart: Date): Promise<string[]> {
    // Return empty - will fall back to current training days
    return [];
  }

  async saveTrainingDaysSnapshot(userId: string, trainingDays: string[]): Promise<void> {
    // No-op for local
  }
}

/**
 * Main Local Service
 * Export singleton instance
 */
export class LocalDataService implements IDataService {
  exercise: IExerciseService;
  workout: IWorkoutService;
  history: IHistoryService;
  progress: IProgressService;
  user: IUserService;
  schedule: IScheduleService;

  constructor() {
    this.exercise = new LocalExerciseService();
    this.workout = new LocalWorkoutService();
    this.history = new LocalHistoryService();
    this.progress = new LocalProgressService();
    this.user = new LocalUserService();
    this.schedule = new LocalScheduleService();
  }
}

// Singleton
export const localService = new LocalDataService();
