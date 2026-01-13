/**
 * ExportService - Data Export Functionality
 * 
 * Provides the ability to export all user data as a JSON file.
 * Uses expo-file-system to write and expo-sharing to share the file.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Application from 'expo-application';
import { useAppStore } from '@/store/useAppStore';
import { Platform } from 'react-native';

export interface ExportData {
  profile: ReturnType<typeof useAppStore.getState>['user'];
  workouts: ReturnType<typeof useAppStore.getState>['workoutHistory'];
  measurements: ReturnType<typeof useAppStore.getState>['measurementLogs'];
  workoutPlans: ReturnType<typeof useAppStore.getState>['workoutPlans'];
  nutritionTargets: ReturnType<typeof useAppStore.getState>['nutritionTargets'];
  settings: ReturnType<typeof useAppStore.getState>['settings'];
  exportedAt: string;
  appVersion: string;
  platform: string;
}

/**
 * Export all user data to a JSON file and open the share sheet
 * @returns Promise that resolves when sharing is complete or cancelled
 * @throws Error if sharing is not available or file write fails
 */
export const exportUserData = async (): Promise<void> => {
  const store = useAppStore.getState();

  // 1. Gather all relevant data
  const data: ExportData = {
    profile: store.user,
    workouts: store.workoutHistory,
    measurements: store.measurementLogs,
    workoutPlans: store.workoutPlans,
    nutritionTargets: store.nutritionTargets,
    settings: store.settings,
    exportedAt: new Date().toISOString(),
    appVersion: Application.nativeApplicationVersion || '1.0.0',
    platform: Platform.OS,
  };

  // 2. Generate a unique filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `symmetry_export_${timestamp}.json`;
  const fileUri = FileSystem.documentDirectory + fileName;

  // 3. Write data to temp file
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // 4. Check if sharing is available and open share sheet
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    // Clean up file if we can't share
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    throw new Error('Sharing is not available on this device');
  }

  try {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Symmetry Data',
      UTI: 'public.json', // iOS-specific
    });
  } finally {
    // Clean up the temp file after sharing
    // Note: We don't await this - it's a fire-and-forget cleanup
    FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {
      // Ignore cleanup errors
    });
  }
};

/**
 * Get estimated export size (useful for showing user before export)
 * @returns Approximate size in bytes
 */
export const getExportSize = (): number => {
  const store = useAppStore.getState();
  const data = {
    profile: store.user,
    workouts: store.workoutHistory,
    measurements: store.measurementLogs,
    workoutPlans: store.workoutPlans,
  };
  return JSON.stringify(data).length;
};

export default { exportUserData, getExportSize };
