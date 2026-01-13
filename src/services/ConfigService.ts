/**
 * ConfigService - Remote App Configuration
 * 
 * Handles fetching and caching remote configuration.
 * Used for force updates, maintenance mode, and feature flags.
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface AppConfig {
  min_supported_version: string;
  latest_version: string;
  maintenance_mode: string;
  maintenance_message: string;
  feature_flags: string;
  ios_store_url: string;
  android_store_url: string;
  [key: string]: string;
}

export interface ConfigStatus {
  isLoaded: boolean;
  updateRequired: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  storeUrl: string;
  currentVersion: string;
  minVersion: string;
  latestVersion: string;
  featureFlags: Record<string, boolean>;
}

// ============================================================================
// VERSION COMPARISON
// ============================================================================

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  // Pad shorter version with zeros
  while (parts1.length < 3) parts1.push(0);
  while (parts2.length < 3) parts2.push(0);
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  
  return 0;
}

/**
 * Check if current version is below minimum required
 */
function isVersionBelowMinimum(currentVersion: string, minVersion: string): boolean {
  return compareVersions(currentVersion, minVersion) < 0;
}

// ============================================================================
// CONFIG SERVICE CLASS
// ============================================================================

class ConfigService {
  private config: AppConfig | null = null;
  private lastFetchTime: number = 0;
  private cacheValidityMs: number = 5 * 60 * 1000; // 5 minutes
  private isFetching: boolean = false;

  /**
   * Get the current app version
   */
  getCurrentVersion(): string {
    return Application.nativeApplicationVersion || '1.0.0';
  }

  /**
   * Get the current build number
   */
  getBuildNumber(): string {
    return Application.nativeBuildVersion || '1';
  }

  /**
   * Fetch configuration from Supabase
   */
  async fetchConfig(): Promise<AppConfig | null> {
    // Return cached config if still valid
    if (this.config && Date.now() - this.lastFetchTime < this.cacheValidityMs) {
      return this.config;
    }

    // Prevent concurrent fetches
    if (this.isFetching) {
      // Wait for current fetch to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.config;
    }

    this.isFetching = true;

    try {
      const { data, error } = await supabase.rpc('get_app_config');

      if (error) {
        console.error('Failed to fetch app config:', error);
        // Return cached config on error (fail gracefully)
        return this.config;
      }

      this.config = data as AppConfig;
      this.lastFetchTime = Date.now();

      if (__DEV__) {
        console.log('📱 App config loaded:', this.config);
      }

      return this.config;
    } catch (error) {
      console.error('Error fetching app config:', error);
      return this.config;
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Get the full configuration status
   * Includes version check and maintenance status
   */
  async getConfigStatus(): Promise<ConfigStatus> {
    const config = await this.fetchConfig();
    const currentVersion = this.getCurrentVersion();

    // Default values if config fetch fails
    if (!config) {
      return {
        isLoaded: false,
        updateRequired: false,
        maintenanceMode: false,
        maintenanceMessage: '',
        storeUrl: this.getStoreUrl(),
        currentVersion,
        minVersion: '1.0.0',
        latestVersion: '1.0.0',
        featureFlags: {},
      };
    }

    const minVersion = config.min_supported_version || '1.0.0';
    const latestVersion = config.latest_version || '1.0.0';
    const updateRequired = isVersionBelowMinimum(currentVersion, minVersion);
    const maintenanceMode = config.maintenance_mode === 'true';
    
    // Parse feature flags
    let featureFlags: Record<string, boolean> = {};
    try {
      featureFlags = JSON.parse(config.feature_flags || '{}');
    } catch (e) {
      console.warn('Failed to parse feature flags');
    }

    return {
      isLoaded: true,
      updateRequired,
      maintenanceMode,
      maintenanceMessage: config.maintenance_message || 'We are under maintenance. Please try again later.',
      storeUrl: Platform.OS === 'ios' 
        ? config.ios_store_url || this.getStoreUrl()
        : config.android_store_url || this.getStoreUrl(),
      currentVersion,
      minVersion,
      latestVersion,
      featureFlags,
    };
  }

  /**
   * Get the platform-specific store URL
   */
  getStoreUrl(): string {
    if (Platform.OS === 'ios') {
      return this.config?.ios_store_url || 'https://apps.apple.com/app/symmetry-fitness/id1234567890';
    }
    return this.config?.android_store_url || 'https://play.google.com/store/apps/details?id=com.symmetry.fitness';
  }

  /**
   * Check if a specific feature is enabled
   */
  async isFeatureEnabled(featureKey: string): Promise<boolean> {
    const status = await this.getConfigStatus();
    return status.featureFlags[featureKey] ?? false;
  }

  /**
   * Force refresh the configuration
   */
  async refresh(): Promise<AppConfig | null> {
    this.lastFetchTime = 0; // Invalidate cache
    return this.fetchConfig();
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.config = null;
    this.lastFetchTime = 0;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const configService = new ConfigService();
export default configService;
