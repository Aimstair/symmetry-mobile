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
