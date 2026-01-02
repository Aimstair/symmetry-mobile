/**
 * Local Data Service Implementation
 * 
 * Uses MMKV for fast, synchronous storage
 * All operations are Promise-based to match future CloudService API
 * 
 * Migration Path:
 * 1. Use this for offline-first development
 * 2. Later, swap for CloudService that hits Supabase/Firebase
 * 3. UI code doesn't change - it only knows the interface
 */

import { storage } from '@/lib/storage';
import type {
  IDataService,
  IWorkoutService,
  IProgressService,
  IUserService,
} from './interfaces';
import type {
  User,
  WorkoutPlan,
  BodyMeasurement,
  PhysiqueScan,
  CardioLog,
  NutritionTargets,
  EquipmentProfile,
} from '@/types';

/**
 * Helper: Get data from MMKV
 */
function getStorageData<T>(key: string): T[] {
  const data = storage.getString(key);
  return data ? JSON.parse(data) : [];
}

/**
 * Helper: Set data in MMKV
 */
function setStorageData<T>(key: string, data: T[]): void {
  storage.set(key, JSON.stringify(data));
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
    setStorageData(this.STORAGE_KEY, plans);
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
    setStorageData(this.STORAGE_KEY, plans);
    return plans[index];
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    const plans = getStorageData<WorkoutPlan>(this.STORAGE_KEY);
    const filtered = plans.filter((p) => p.id !== id);
    setStorageData(this.STORAGE_KEY, filtered);
  }
}

/**
 * Progress Service - Local Implementation
 */
class LocalProgressService implements IProgressService {
  private readonly BODY_KEY = 'body_measurements';
  private readonly SCAN_KEY = 'physique_scans';
  private readonly CARDIO_KEY = 'cardio_logs';

  async getBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
    const data = getStorageData<BodyMeasurement>(this.BODY_KEY);
    return data.filter((m) => m.userId === userId);
  }

  async addBodyMeasurement(measurement: BodyMeasurement): Promise<BodyMeasurement> {
    const data = getStorageData<BodyMeasurement>(this.BODY_KEY);
    data.push(measurement);
    setStorageData(this.BODY_KEY, data);
    return measurement;
  }

  async getPhysiqueScans(userId: string): Promise<PhysiqueScan[]> {
    const data = getStorageData<PhysiqueScan>(this.SCAN_KEY);
    return data.filter((s) => s.userId === userId);
  }

  async addPhysiqueScan(scan: PhysiqueScan): Promise<PhysiqueScan> {
    const data = getStorageData<PhysiqueScan>(this.SCAN_KEY);
    data.push(scan);
    setStorageData(this.SCAN_KEY, data);
    return scan;
  }

  async getCardioLogs(userId: string): Promise<CardioLog[]> {
    const data = getStorageData<CardioLog>(this.CARDIO_KEY);
    return data.filter((l) => l.userId === userId);
  }

  async addCardioLog(log: CardioLog): Promise<CardioLog> {
    const data = getStorageData<CardioLog>(this.CARDIO_KEY);
    data.push(log);
    setStorageData(this.CARDIO_KEY, data);
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
    const data = storage.getString(this.USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  async getNutritionTargets(userId: string): Promise<NutritionTargets | null> {
    const data = storage.getString(this.NUTRITION_KEY);
    return data ? JSON.parse(data) : null;
  }

  async getEquipment(userId: string): Promise<EquipmentProfile | null> {
    const data = storage.getString(this.EQUIPMENT_KEY);
    return data ? JSON.parse(data) : null;
  }

  async createUser(user: User): Promise<User> {
    storage.set(this.USER_KEY, JSON.stringify(user));
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const current = await this.getUser(userId);
    if (!current) throw new Error('User not found');
    const updated = { ...current, ...updates };
    storage.set(this.USER_KEY, JSON.stringify(updated));
    return updated;
  }

  async updateNutritionTargets(
    userId: string,
    targets: NutritionTargets
  ): Promise<NutritionTargets> {
    storage.set(this.NUTRITION_KEY, JSON.stringify(targets));
    return targets;
  }

  async updateEquipment(
    userId: string,
    equipment: EquipmentProfile
  ): Promise<EquipmentProfile> {
    storage.set(this.EQUIPMENT_KEY, JSON.stringify(equipment));
    return equipment;
  }
}

/**
 * Main Local Service
 * Export singleton instance
 */
export class LocalDataService implements IDataService {
  workout: IWorkoutService;
  progress: IProgressService;
  user: IUserService;

  constructor() {
    this.workout = new LocalWorkoutService();
    this.progress = new LocalProgressService();
    this.user = new LocalUserService();
  }
}

// Singleton
export const localService = new LocalDataService();
