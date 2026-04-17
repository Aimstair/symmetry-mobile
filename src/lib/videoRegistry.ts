// src/lib/videoRegistry.ts

/**
 * Exercise Video Registry
 *
 * Supports both bundled local assets and remote CDN URLs.
 * - Local assets load instantly via require(...)
 * - Remote URLs can be cached by useCachedVideo
 */

export type ExerciseVideoSource = number | string;

/**
 * Normalize keys for resilient lookup.
 * Examples: "Bench Press" -> "bench_press", "bench-press" -> "bench_press"
 */
const normalizeVideoKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Bundled local exercise videos that ship with the app.
const localExerciseVideoRegistry: Record<string, number> = {
  bench_press: require('../../assets/video/exercises/bench-press.mp4'),
};

// Base URL for video storage (update with your CDN/storage URL)
const VIDEO_BASE_URL = 'https://your-cdn.com/exercise-videos';

export const exerciseVideoRegistry: Record<string, string> = {
  // Chest
  'bench_press': `${VIDEO_BASE_URL}/bench-press.mp4`,
  'incline_db_press': `${VIDEO_BASE_URL}/incline-db-press.mp4`,
  'cable_flyes': `${VIDEO_BASE_URL}/cable-flyes.mp4`,
  'dumbbell_flyes': `${VIDEO_BASE_URL}/dumbbell-flyes.mp4`,
  'incline_bench_press': `${VIDEO_BASE_URL}/incline-bench-press.mp4`,
  'decline_bench_press': `${VIDEO_BASE_URL}/decline-bench-press.mp4`,
  'chest_dips': `${VIDEO_BASE_URL}/chest-dips.mp4`,
  'push_ups': `${VIDEO_BASE_URL}/push-ups.mp4`,
  
  // Back
  'pull_ups': `${VIDEO_BASE_URL}/pull-ups.mp4`,
  'lat_pulldowns': `${VIDEO_BASE_URL}/lat-pulldowns.mp4`,
  'barbell_rows': `${VIDEO_BASE_URL}/barbell-rows.mp4`,
  'dumbbell_rows': `${VIDEO_BASE_URL}/dumbbell-rows.mp4`,
  'seated_cable_rows': `${VIDEO_BASE_URL}/seated-cable-rows.mp4`,
  't_bar_rows': `${VIDEO_BASE_URL}/t-bar-rows.mp4`,
  'face_pulls': `${VIDEO_BASE_URL}/face-pulls.mp4`,
  
  // Legs
  'squats': `${VIDEO_BASE_URL}/squats.mp4`,
  'leg_press': `${VIDEO_BASE_URL}/leg-press.mp4`,
  'deadlifts': `${VIDEO_BASE_URL}/deadlifts.mp4`,
  'romanian_deadlifts': `${VIDEO_BASE_URL}/romanian-deadlifts.mp4`,
  'leg_curls': `${VIDEO_BASE_URL}/leg-curls.mp4`,
  'leg_extensions': `${VIDEO_BASE_URL}/leg-extensions.mp4`,
  'lunges': `${VIDEO_BASE_URL}/lunges.mp4`,
  'hip_thrusts': `${VIDEO_BASE_URL}/hip-thrusts.mp4`,
  'calf_raises': `${VIDEO_BASE_URL}/calf-raises.mp4`,
  
  // Shoulders
  'overhead_press': `${VIDEO_BASE_URL}/overhead-press.mp4`,
  'lateral_raises': `${VIDEO_BASE_URL}/lateral-raises.mp4`,
  'front_raises': `${VIDEO_BASE_URL}/front-raises.mp4`,
  'rear_delt_flyes': `${VIDEO_BASE_URL}/rear-delt-flyes.mp4`,
  'arnold_press': `${VIDEO_BASE_URL}/arnold-press.mp4`,
  'upright_rows': `${VIDEO_BASE_URL}/upright-rows.mp4`,
  
  // Arms - Biceps
  'barbell_curls': `${VIDEO_BASE_URL}/barbell-curls.mp4`,
  'dumbbell_curls': `${VIDEO_BASE_URL}/dumbbell-curls.mp4`,
  'hammer_curls': `${VIDEO_BASE_URL}/hammer-curls.mp4`,
  'preacher_curls': `${VIDEO_BASE_URL}/preacher-curls.mp4`,
  'cable_curls': `${VIDEO_BASE_URL}/cable-curls.mp4`,
  
  // Arms - Triceps
  'tricep_pushdowns': `${VIDEO_BASE_URL}/tricep-pushdowns.mp4`,
  'skull_crushers': `${VIDEO_BASE_URL}/skull-crushers.mp4`,
  'overhead_tricep_extension': `${VIDEO_BASE_URL}/overhead-tricep-extension.mp4`,
  'tricep_dips': `${VIDEO_BASE_URL}/tricep-dips.mp4`,
  'close_grip_bench_press': `${VIDEO_BASE_URL}/close-grip-bench-press.mp4`,
  
  // Core
  'planks': `${VIDEO_BASE_URL}/planks.mp4`,
  'crunches': `${VIDEO_BASE_URL}/crunches.mp4`,
  'leg_raises': `${VIDEO_BASE_URL}/leg-raises.mp4`,
  'russian_twists': `${VIDEO_BASE_URL}/russian-twists.mp4`,
  'cable_woodchops': `${VIDEO_BASE_URL}/cable-woodchops.mp4`,
  'ab_wheel_rollouts': `${VIDEO_BASE_URL}/ab-wheel-rollouts.mp4`,
};

/**
 * Get video source for an exercise key or name.
 * Returns local asset (number) or remote URL (string), or null when missing.
 */
export const getVideoForExercise = (exerciseId: string): ExerciseVideoSource | null => {
  const exactLocal = localExerciseVideoRegistry[exerciseId];
  if (exactLocal) return exactLocal;

  const exactRemote = exerciseVideoRegistry[exerciseId];
  if (exactRemote) return exactRemote;

  const normalized = normalizeVideoKey(exerciseId);

  const normalizedLocal = localExerciseVideoRegistry[normalized];
  if (normalizedLocal) return normalizedLocal;

  return exerciseVideoRegistry[normalized] || null;
};

/**
 * Get all video URLs for preloading
 */
export const getAllVideoUrls = (): string[] => {
  return Object.values(exerciseVideoRegistry);
};

/**
 * Check if an exercise has a video
 */
export const hasVideo = (exerciseId: string): boolean => {
  return getVideoForExercise(exerciseId) !== null;
};