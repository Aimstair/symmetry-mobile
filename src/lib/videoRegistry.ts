// src/lib/videoRegistry.ts

// Map your Exercise IDs (from your database/catalog) to the require statement
export const exerciseVideoRegistry: Record<string, any> = {
  // 'exercise-id': require('path-to-video')
  'ex-1767873026690-lkhuu3zi7': require('../../assets/video/exercises/bench-press.mp4'),
};

// Helper to safely get video
export const getVideoForExercise = (exerciseId: string) => {
  return exerciseVideoRegistry[exerciseId] || null;
};