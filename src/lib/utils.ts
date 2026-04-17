import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind classes with proper precedence
 * Same as web version - works identically with NativeWind
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format numbers for display
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toFixed(decimals);
}

/**
 * Get percentage
 */
export function getPercentage(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.min((current / max) * 100, 100);
}

/**
 * Detects expected request-cancellation errors across fetch/Supabase wrappers.
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;

  const normalized = String(
    typeof error === 'object' && error !== null
      ? ((error as { name?: unknown }).name ?? (error as { message?: unknown }).message ?? '')
      : error
  ).toLowerCase();

  if (normalized.includes('abort')) return true;
  if (normalized.includes('cancel')) return true;

  if (typeof error === 'object' && error !== null) {
    const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
    return message.includes('abort') || message.includes('cancel');
  }

  return false;
}

/**
 * Format workout duration for UI.
 * - Under 1 hour: MM:SS
 * - 1 hour or more: HH:MM:SS
 */
export function formatWorkoutDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format label text to title case for consistent UI presentation.
 */
export function formatTitleCaseLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/**
 * Convert an exercise id or slug to a user-friendly display name.
 */
export function formatExerciseDisplayName(value: string): string {
  const normalized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Exercise';

  return formatTitleCaseLabel(normalized);
}

/**
 * Format muscle group arrays for consistent display across scan/custom plans.
 */
export function formatMuscleGroups(muscleGroups: string[], separator = ' • '): string {
  if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
    return '';
  }

  return muscleGroups
    .map((muscle) => formatTitleCaseLabel(String(muscle)))
    .join(separator);
}

/**
 * Default freshness window used for focus-driven screen refresh.
 */
export const DEFAULT_FRESHNESS_WINDOW_MS = 60_000;

/**
 * Returns true when the last successful fetch timestamp is stale.
 */
export function isStaleTimestamp(
  lastFetchedAtMs: number | null | undefined,
  freshnessWindowMs: number = DEFAULT_FRESHNESS_WINDOW_MS
): boolean {
  if (!lastFetchedAtMs || !Number.isFinite(lastFetchedAtMs)) {
    return true;
  }

  return Date.now() - lastFetchedAtMs >= freshnessWindowMs;
}

/**
 * Unit conversion utilities
 * Always store in metric (kg/cm), display/input in user's preferred unit
 */
export const convert = {
  /**
   * Convert pounds to kilograms
   * @param lbs Weight in pounds
   * @returns Weight in kilograms (1 decimal place)
   */
  toKg(lbs: number): number {
    return Number((lbs * 0.453592).toFixed(1));
  },

  /**
   * Convert kilograms to pounds
   * @param kg Weight in kilograms
   * @returns Weight in pounds (1 decimal place)
   */
  toLbs(kg: number): number {
    return Number((kg * 2.20462).toFixed(1));
  },

  /**
   * Convert inches to centimeters
   * @param inches Height in inches
   * @returns Height in centimeters (1 decimal place)
   */
  toCm(inches: number): number {
    return Number((inches * 2.54).toFixed(1));
  },

  /**
   * Convert centimeters to inches
   * @param cm Height in centimeters
   * @returns Height in inches (1 decimal place)
   */
  toIn(cm: number): number {
    return Number((cm / 2.54).toFixed(1));
  },
};
