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
 */

import type {
  User,
  WorkoutPlan,
  BodyMeasurement,
  PhysiqueScan,
  CardioLog,
  NutritionTargets,
  EquipmentProfile,
} from '@/types';

export interface IWorkoutService {
  // Fetch
  getWorkoutPlans(userId: string): Promise<WorkoutPlan[]>;
  getWorkoutPlan(id: string): Promise<WorkoutPlan | null>;
  
  // Mutate
  createWorkoutPlan(plan: WorkoutPlan): Promise<WorkoutPlan>;
  updateWorkoutPlan(id: string, updates: Partial<WorkoutPlan>): Promise<WorkoutPlan>;
  deleteWorkoutPlan(id: string): Promise<void>;
}

export interface IProgressService {
  // Body Measurements
  getBodyMeasurements(userId: string): Promise<BodyMeasurement[]>;
  addBodyMeasurement(measurement: BodyMeasurement): Promise<BodyMeasurement>;
  
  // Physique Scans
  getPhysiqueScans(userId: string): Promise<PhysiqueScan[]>;
  addPhysiqueScan(scan: PhysiqueScan): Promise<PhysiqueScan>;
  
  // Cardio Logs
  getCardioLogs(userId: string): Promise<CardioLog[]>;
  addCardioLog(log: CardioLog): Promise<CardioLog>;
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
}

/**
 * Main Service Interface
 * Compose all services here
 */
export interface IDataService {
  workout: IWorkoutService;
  progress: IProgressService;
  user: IUserService;
}
