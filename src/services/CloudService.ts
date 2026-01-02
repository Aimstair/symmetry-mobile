/**
 * Cloud Data Service Implementation (FUTURE)
 * 
 * When ready for production with Supabase/Firebase:
 * 1. Implement this file with real API calls
 * 2. Swap in app/_layout.tsx: 
 *    const dataService = __DEV__ ? localService : cloudService;
 * 3. UI code doesn't change - same interface
 * 
 * Example implementation structure:
 */

import type {
  IDataService,
  IWorkoutService,
  IProgressService,
  IUserService,
} from './interfaces';

/**
 * Workout Service - Cloud Implementation
 */
class CloudWorkoutService implements IWorkoutService {
  // TODO: Implement with Supabase/Firebase
  async getWorkoutPlans(userId: string): Promise<any[]> {
    // const { data } = await supabase
    //   .from('workout_plans')
    //   .select('*')
    //   .eq('user_id', userId);
    // return data;
    throw new Error('CloudService not implemented yet');
  }

  async getWorkoutPlan(id: string): Promise<any | null> {
    throw new Error('CloudService not implemented yet');
  }

  async createWorkoutPlan(plan: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async updateWorkoutPlan(id: string, updates: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    throw new Error('CloudService not implemented yet');
  }
}

/**
 * Progress Service - Cloud Implementation
 */
class CloudProgressService implements IProgressService {
  // TODO: Implement with Supabase/Firebase
  async getBodyMeasurements(userId: string): Promise<any[]> {
    throw new Error('CloudService not implemented yet');
  }

  async addBodyMeasurement(measurement: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async getPhysiqueScans(userId: string): Promise<any[]> {
    throw new Error('CloudService not implemented yet');
  }

  async addPhysiqueScan(scan: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async getCardioLogs(userId: string): Promise<any[]> {
    throw new Error('CloudService not implemented yet');
  }

  async addCardioLog(log: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }
}

/**
 * User Service - Cloud Implementation
 */
class CloudUserService implements IUserService {
  // TODO: Implement with Supabase/Firebase
  async getUser(userId: string): Promise<any | null> {
    throw new Error('CloudService not implemented yet');
  }

  async getNutritionTargets(userId: string): Promise<any | null> {
    throw new Error('CloudService not implemented yet');
  }

  async getEquipment(userId: string): Promise<any | null> {
    throw new Error('CloudService not implemented yet');
  }

  async createUser(user: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async updateUser(userId: string, updates: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async updateNutritionTargets(userId: string, targets: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }

  async updateEquipment(userId: string, equipment: any): Promise<any> {
    throw new Error('CloudService not implemented yet');
  }
}

/**
 * Main Cloud Service
 */
export class CloudDataService implements IDataService {
  workout: IWorkoutService;
  progress: IProgressService;
  user: IUserService;

  constructor() {
    this.workout = new CloudWorkoutService();
    this.progress = new CloudProgressService();
    this.user = new CloudUserService();
  }
}

// Singleton
export const cloudService = new CloudDataService();
