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
