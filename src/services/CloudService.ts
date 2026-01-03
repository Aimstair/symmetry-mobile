/**
 * Cloud Data Service Implementation with Supabase
 * 
 * This service implements the IDataService interface using Supabase as the backend.
 * It provides full CRUD operations for all data models with proper type safety.
 * 
 * Features:
 * - Shared Supabase client across all sub-services
 * - Automatic timestamp handling (created_at, updated_at)
 * - Row Level Security (RLS) enforcement
 * - Type-safe queries with TypeScript
 * - Error handling with descriptive messages
 * 
 * Configuration:
 * - Local: http://127.0.0.1:54321 (via EXPO_PUBLIC_SUPABASE_URL)
 * - Production: https://your-project.supabase.co (via EXPO_PUBLIC_SUPABASE_URL)
 */

import { supabase } from '@/lib/supabase';
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
 * Helper: Convert snake_case DB columns to camelCase TypeScript
 */
function toCamelCase<T>(obj: any): T {
  if (!obj) return obj;
  
  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result as T;
}

/**
 * Helper: Convert camelCase TypeScript to snake_case DB columns
 */
function toSnakeCase(obj: any): any {
  if (!obj) return obj;
  
  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}

/**
 * Workout Service - Cloud Implementation
 */
class CloudWorkoutService implements IWorkoutService {
  async getWorkoutPlans(userId: string): Promise<WorkoutPlan[]> {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch workout plans: ${error.message}`);
    
    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      daysPerWeek: row.days_per_week,
      workoutDays: row.workout_days || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async getWorkoutPlan(id: string): Promise<WorkoutPlan | null> {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch workout plan: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      type: data.type,
      daysPerWeek: data.days_per_week,
      workoutDays: data.workout_days || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async createWorkoutPlan(plan: WorkoutPlan): Promise<WorkoutPlan> {
    const { data, error } = await supabase
      .from('workout_plans')
      .insert({
        id: plan.id,
        user_id: plan.userId,
        name: plan.name,
        description: plan.description,
        type: plan.type,
        days_per_week: plan.daysPerWeek,
        workout_days: plan.workoutDays,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create workout plan: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      type: data.type,
      daysPerWeek: data.days_per_week,
      workoutDays: data.workout_days || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateWorkoutPlan(id: string, updates: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.daysPerWeek) dbUpdates.days_per_week = updates.daysPerWeek;
    if (updates.workoutDays) dbUpdates.workout_days = updates.workoutDays;

    const { data, error } = await supabase
      .from('workout_plans')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update workout plan: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      type: data.type,
      daysPerWeek: data.days_per_week,
      workoutDays: data.workout_days || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    const { error } = await supabase
      .from('workout_plans')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete workout plan: ${error.message}`);
  }
}

/**
 * Progress Service - Cloud Implementation
 */
class CloudProgressService implements IProgressService {
  async getBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
    const { data, error } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch body measurements: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      weight: row.weight,
      bodyFat: row.body_fat,
      measurements: row.measurements || {},
    }));
  }

  async addBodyMeasurement(measurement: BodyMeasurement): Promise<BodyMeasurement> {
    const { data, error } = await supabase
      .from('body_measurements')
      .insert({
        id: measurement.id,
        user_id: measurement.userId,
        date: measurement.date.toISOString(),
        weight: measurement.weight,
        body_fat: measurement.bodyFat,
        measurements: measurement.measurements,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add body measurement: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      weight: data.weight,
      bodyFat: data.body_fat,
      measurements: data.measurements || {},
    };
  }

  async getPhysiqueScans(userId: string): Promise<PhysiqueScan[]> {
    const { data, error } = await supabase
      .from('physique_scans')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch physique scans: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      images: row.images || {},
      symmetryScore: row.symmetry_score,
      muscleScores: row.muscle_scores || {},
      notes: row.notes,
    }));
  }

  async addPhysiqueScan(scan: PhysiqueScan): Promise<PhysiqueScan> {
    const { data, error } = await supabase
      .from('physique_scans')
      .insert({
        id: scan.id,
        user_id: scan.userId,
        date: scan.date.toISOString(),
        images: scan.images,
        symmetry_score: scan.symmetryScore,
        muscle_scores: scan.muscleScores,
        notes: scan.notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add physique scan: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      images: data.images || {},
      symmetryScore: data.symmetry_score,
      muscleScores: data.muscle_scores || {},
      notes: data.notes,
    };
  }

  async getCardioLogs(userId: string): Promise<CardioLog[]> {
    const { data, error } = await supabase
      .from('cardio_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to fetch cardio logs: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.date),
      type: row.type,
      duration: row.duration,
      distance: row.distance,
      calories: row.calories,
      notes: row.notes,
    }));
  }

  async addCardioLog(log: CardioLog): Promise<CardioLog> {
    const { data, error } = await supabase
      .from('cardio_logs')
      .insert({
        id: log.id,
        user_id: log.userId,
        date: log.date.toISOString(),
        type: log.type,
        duration: log.duration,
        distance: log.distance,
        calories: log.calories,
        notes: log.notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add cardio log: ${error.message}`);

    return {
      id: data.id,
      userId: data.user_id,
      date: new Date(data.date),
      type: data.type,
      duration: data.duration,
      distance: data.distance,
      calories: data.calories,
      notes: data.notes,
    };
  }
}

/**
 * User Service - Cloud Implementation
 */
class CloudUserService implements IUserService {
  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      experienceLevel: data.experience_level,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async getNutritionTargets(userId: string): Promise<NutritionTargets | null> {
    const { data, error } = await supabase
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch nutrition targets: ${error.message}`);
    }

    if (!data) return null;

    return {
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fats: data.fats,
      tdee: data.tdee,
    };
  }

  async getEquipment(userId: string): Promise<EquipmentProfile | null> {
    const { data, error } = await supabase
      .from('equipment_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch equipment: ${error.message}`);
    }

    if (!data) return null;

    return {
      hasBarbell: data.has_barbell,
      hasDumbbells: data.has_dumbbells,
      hasCableStation: data.has_cable_station,
      hasMachines: data.has_machines,
      hasBands: data.has_bands,
      customEquipment: data.custom_equipment || [],
    };
  }

  async createUser(user: User): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        goal: user.goal,
        experience_level: user.experienceLevel,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      experienceLevel: data.experience_level,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.age) dbUpdates.age = updates.age;
    if (updates.gender) dbUpdates.gender = updates.gender;
    if (updates.height) dbUpdates.height = updates.height;
    if (updates.weight) dbUpdates.weight = updates.weight;
    if (updates.goal) dbUpdates.goal = updates.goal;
    if (updates.experienceLevel) dbUpdates.experience_level = updates.experienceLevel;

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update user: ${error.message}`);

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      experienceLevel: data.experience_level,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async updateNutritionTargets(userId: string, targets: NutritionTargets): Promise<NutritionTargets> {
    // Use upsert to insert or update
    const { data, error } = await supabase
      .from('nutrition_targets')
      .upsert({
        user_id: userId,
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fats: targets.fats,
        tdee: targets.tdee,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to update nutrition targets: ${error.message}`);

    return {
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fats: data.fats,
      tdee: data.tdee,
    };
  }

  async updateEquipment(userId: string, equipment: EquipmentProfile): Promise<EquipmentProfile> {
    // Use upsert to insert or update
    const { data, error } = await supabase
      .from('equipment_profiles')
      .upsert({
        user_id: userId,
        has_barbell: equipment.hasBarbell,
        has_dumbbells: equipment.hasDumbbells,
        has_cable_station: equipment.hasCableStation,
        has_machines: equipment.hasMachines,
        has_bands: equipment.hasBands,
        custom_equipment: equipment.customEquipment,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to update equipment: ${error.message}`);

    return {
      hasBarbell: data.has_barbell,
      hasDumbbells: data.has_dumbbells,
      hasCableStation: data.has_cable_station,
      hasMachines: data.has_machines,
      hasBands: data.has_bands,
      customEquipment: data.custom_equipment || [],
    };
  }
}

/**
 * Main Cloud Service
 * Shared Supabase client across all sub-services
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
