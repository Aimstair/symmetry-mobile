/**
 * Health Service - Unified Health Ecosystem Integration
 * 
 * Abstracts platform differences between:
 * - Apple HealthKit (iOS)
 * - Google Health Connect (Android)
 * 
 * Provides unified API for:
 * - Permission management
 * - Workout export
 * - Biometric import (weight, etc.)
 */

import { Platform } from 'react-native';
import type { WorkoutSession, MeasurementLog } from '@/types';

// ============================================================================
// iOS: Apple HealthKit
// ============================================================================

let AppleHealthKit: typeof import('react-native-health').default | null = null;

if (Platform.OS === 'ios') {
  try {
    const healthModule = require('react-native-health');
    AppleHealthKit = healthModule.default;
  } catch (e) {
    console.warn('react-native-health not available on iOS');
  }
}

// ============================================================================
// Android: Google Health Connect
// ============================================================================

let HealthConnect: typeof import('react-native-health-connect') | null = null;

if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
  } catch (e) {
    console.warn('react-native-health-connect not available on Android');
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface HealthPermissionStatus {
  granted: boolean;
  workouts: boolean;
  bodyMass: boolean;
  activeEnergy: boolean;
}

export interface HealthSyncResult {
  success: boolean;
  message: string;
  importedCount?: number;
}

export interface WeightEntry {
  date: Date;
  weightKg: number;
}

// ============================================================================
// HEALTH SERVICE CLASS
// ============================================================================

class HealthService {
  private isInitialized: boolean = false;
  private hasPermissions: boolean = false;

  /**
   * Check if health services are available on this device
   */
  isAvailable(): boolean {
    if (Platform.OS === 'ios') {
      return AppleHealthKit !== null;
    }
    if (Platform.OS === 'android') {
      return HealthConnect !== null;
    }
    return false;
  }

  /**
   * Request permissions for health data access
   * Requests read/write access to: Workouts, Body Mass, Active Energy
   */
  async requestPermissions(): Promise<HealthPermissionStatus> {
    const result: HealthPermissionStatus = {
      granted: false,
      workouts: false,
      bodyMass: false,
      activeEnergy: false,
    };

    if (Platform.OS === 'ios') {
      return this.requestiOSPermissions();
    }

    if (Platform.OS === 'android') {
      return this.requestAndroidPermissions();
    }

    return result;
  }

  /**
   * iOS: Request HealthKit permissions
   */
  private async requestiOSPermissions(): Promise<HealthPermissionStatus> {
    return new Promise((resolve) => {
      if (!AppleHealthKit) {
        resolve({
          granted: false,
          workouts: false,
          bodyMass: false,
          activeEnergy: false,
        });
        return;
      }

      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.Weight,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.Workout,
          ],
          write: [
            AppleHealthKit.Constants.Permissions.Weight,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.Workout,
          ],
        },
      };

      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.error('HealthKit init error:', error);
          resolve({
            granted: false,
            workouts: false,
            bodyMass: false,
            activeEnergy: false,
          });
          return;
        }

        this.isInitialized = true;
        this.hasPermissions = true;

        resolve({
          granted: true,
          workouts: true,
          bodyMass: true,
          activeEnergy: true,
        });
      });
    });
  }

  /**
   * Android: Request Health Connect permissions
   */
  private async requestAndroidPermissions(): Promise<HealthPermissionStatus> {
    if (!HealthConnect) {
      return {
        granted: false,
        workouts: false,
        bodyMass: false,
        activeEnergy: false,
      };
    }

    try {
      // Initialize Health Connect
      const isInitialized = await HealthConnect.initialize();
      if (!isInitialized) {
        return {
          granted: false,
          workouts: false,
          bodyMass: false,
          activeEnergy: false,
        };
      }

      // Request permissions
      const grantedPermissions = await HealthConnect.requestPermission([
        { accessType: 'read', recordType: 'Weight' },
        { accessType: 'write', recordType: 'Weight' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'ExerciseSession' },
      ]);

      this.isInitialized = true;
      this.hasPermissions = grantedPermissions.length > 0;

      return {
        granted: grantedPermissions.length > 0,
        workouts: grantedPermissions.some((p: any) => p.recordType === 'ExerciseSession'),
        bodyMass: grantedPermissions.some((p: any) => p.recordType === 'Weight'),
        activeEnergy: grantedPermissions.some((p: any) => p.recordType === 'ActiveCaloriesBurned'),
      };
    } catch (error) {
      console.error('Health Connect permission error:', error);
      return {
        granted: false,
        workouts: false,
        bodyMass: false,
        activeEnergy: false,
      };
    }
  }

  /**
   * Save a completed workout to the health store
   * Exports workout with duration, estimated calories, and title
   */
  async saveWorkout(session: WorkoutSession): Promise<HealthSyncResult> {
    if (!this.isAvailable()) {
      return { success: false, message: 'Health services not available' };
    }

    if (!this.hasPermissions) {
      const perms = await this.requestPermissions();
      if (!perms.granted) {
        return { success: false, message: 'Health permissions not granted' };
      }
    }

    const durationMinutes = session.durationSeconds 
      ? Math.round(session.durationSeconds / 60) 
      : 60;
    
    // Estimate calories: ~5-8 cal/min for strength training
    const estimatedCalories = durationMinutes * 6;

    if (Platform.OS === 'ios') {
      return this.saveiOSWorkout(session, durationMinutes, estimatedCalories);
    }

    if (Platform.OS === 'android') {
      return this.saveAndroidWorkout(session, durationMinutes, estimatedCalories);
    }

    return { success: false, message: 'Platform not supported' };
  }

  /**
   * iOS: Save workout to HealthKit
   */
  private async saveiOSWorkout(
    session: WorkoutSession,
    durationMinutes: number,
    estimatedCalories: number
  ): Promise<HealthSyncResult> {
    return new Promise((resolve) => {
      if (!AppleHealthKit) {
        resolve({ success: false, message: 'HealthKit not available' });
        return;
      }

      const startDate = new Date(session.startedAt);
      const endDate = session.endedAt 
        ? new Date(session.endedAt) 
        : new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      const workoutOptions = {
        type: AppleHealthKit.Constants.Activities.TraditionalStrengthTraining,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        energyBurned: estimatedCalories,
        energyBurnedUnit: 'calorie',
      };

      AppleHealthKit.saveWorkout(workoutOptions, (error: string | null, result: any) => {
        if (error) {
          console.error('HealthKit save workout error:', error);
          resolve({ success: false, message: error });
          return;
        }

        if (__DEV__) {
          console.log('✅ Workout saved to HealthKit:', session.name);
        }

        resolve({
          success: true,
          message: `Workout "${session.name}" saved to Apple Health`,
        });
      });
    });
  }

  /**
   * Android: Save workout to Health Connect
   */
  private async saveAndroidWorkout(
    session: WorkoutSession,
    durationMinutes: number,
    estimatedCalories: number
  ): Promise<HealthSyncResult> {
    if (!HealthConnect) {
      return { success: false, message: 'Health Connect not available' };
    }

    try {
      const startDate = new Date(session.startedAt);
      const endDate = session.endedAt 
        ? new Date(session.endedAt) 
        : new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      // Insert exercise session
      await HealthConnect.insertRecords([
        {
          recordType: 'ExerciseSession',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          exerciseType: HealthConnect.ExerciseType?.STRENGTH_TRAINING || 58, // 58 = Strength Training
          title: session.name,
        },
      ]);

      // Insert active calories burned
      await HealthConnect.insertRecords([
        {
          recordType: 'ActiveCaloriesBurned',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          energy: {
            value: estimatedCalories,
            unit: 'kilocalories',
          },
        },
      ]);

      if (__DEV__) {
        console.log('✅ Workout saved to Health Connect:', session.name);
      }

      return {
        success: true,
        message: `Workout "${session.name}" saved to Health Connect`,
      };
    } catch (error) {
      console.error('Health Connect save workout error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save workout',
      };
    }
  }

  /**
   * Import body metrics (weight) from health store
   * Reads the latest weight entries and returns them for sync
   */
  async syncBodyMetrics(since?: Date): Promise<{ entries: WeightEntry[]; result: HealthSyncResult }> {
    if (!this.isAvailable()) {
      return {
        entries: [],
        result: { success: false, message: 'Health services not available' },
      };
    }

    if (!this.hasPermissions) {
      const perms = await this.requestPermissions();
      if (!perms.granted) {
        return {
          entries: [],
          result: { success: false, message: 'Health permissions not granted' },
        };
      }
    }

    const startDate = since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Last 90 days

    if (Platform.OS === 'ios') {
      return this.synciOSBodyMetrics(startDate);
    }

    if (Platform.OS === 'android') {
      return this.syncAndroidBodyMetrics(startDate);
    }

    return {
      entries: [],
      result: { success: false, message: 'Platform not supported' },
    };
  }

  /**
   * iOS: Get weight samples from HealthKit
   */
  private async synciOSBodyMetrics(startDate: Date): Promise<{ entries: WeightEntry[]; result: HealthSyncResult }> {
    return new Promise((resolve) => {
      if (!AppleHealthKit) {
        resolve({
          entries: [],
          result: { success: false, message: 'HealthKit not available' },
        });
        return;
      }

      const options = {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        ascending: false,
        limit: 100,
      };

      AppleHealthKit.getWeightSamples(options, (error: string, results: any[]) => {
        if (error) {
          console.error('HealthKit get weight error:', error);
          resolve({
            entries: [],
            result: { success: false, message: error },
          });
          return;
        }

        const entries: WeightEntry[] = results.map((sample) => ({
          date: new Date(sample.startDate),
          weightKg: sample.value * 0.453592, // Convert lbs to kg if needed
        }));

        if (__DEV__) {
          console.log(`✅ Imported ${entries.length} weight entries from HealthKit`);
        }

        resolve({
          entries,
          result: {
            success: true,
            message: `Imported ${entries.length} weight entries from Apple Health`,
            importedCount: entries.length,
          },
        });
      });
    });
  }

  /**
   * Android: Get weight records from Health Connect
   */
  private async syncAndroidBodyMetrics(startDate: Date): Promise<{ entries: WeightEntry[]; result: HealthSyncResult }> {
    if (!HealthConnect) {
      return {
        entries: [],
        result: { success: false, message: 'Health Connect not available' },
      };
    }

    try {
      const result = await HealthConnect.readRecords('Weight', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: new Date().toISOString(),
        },
      });

      const entries: WeightEntry[] = (result.records || []).map((record: any) => ({
        date: new Date(record.time),
        weightKg: record.weight?.inKilograms || record.weight?.value || 0,
      }));

      if (__DEV__) {
        console.log(`✅ Imported ${entries.length} weight entries from Health Connect`);
      }

      return {
        entries,
        result: {
          success: true,
          message: `Imported ${entries.length} weight entries from Health Connect`,
          importedCount: entries.length,
        },
      };
    } catch (error) {
      console.error('Health Connect get weight error:', error);
      return {
        entries: [],
        result: {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to read weight data',
        },
      };
    }
  }

  /**
   * Get platform-specific health app name
   */
  getHealthAppName(): string {
    if (Platform.OS === 'ios') {
      return 'Apple Health';
    }
    if (Platform.OS === 'android') {
      return 'Health Connect';
    }
    return 'Health App';
  }
}

// Export singleton instance
export const healthService = new HealthService();
export default healthService;
