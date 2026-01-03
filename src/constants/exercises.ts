/**
 * Exercise Information Constants
 * 
 * This file contains static exercise metadata including muscle targeting,
 * reasons for selection, and alternatives. This data is referenced by
 * exercise name/ID in the UI components.
 */

export interface ExerciseInfo {
  muscles: string[];
  reason: string;
  alternatives: { name: string; equipment: string }[];
}

/**
 * Exercise information lookup by exercise name
 */
export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  // Chest Exercises
  'Bench Press': {
    muscles: ['Chest', 'Front Delts', 'Triceps'],
    reason: 'Primary compound movement for chest development. Selected based on your goal to build upper body mass.',
    alternatives: [
      { name: 'Dumbbell Bench Press', equipment: 'Dumbbells + Bench' },
      { name: 'Push-Ups', equipment: 'Bodyweight' },
      { name: 'Floor Press', equipment: 'Dumbbells/Barbell' },
    ]
  },
  'Incline DB Press': {
    muscles: ['Upper Chest', 'Front Delts', 'Triceps'],
    reason: 'Targets upper chest to create balanced chest development and improve symmetry score.',
    alternatives: [
      { name: 'Incline Barbell Press', equipment: 'Barbell + Incline Bench' },
      { name: 'Low-to-High Cable Fly', equipment: 'Cable Machine' },
      { name: 'Incline Push-Ups', equipment: 'Bodyweight + Elevated Surface' },
    ]
  },
  'Incline Dumbbell Press': {
    muscles: ['Upper Chest', 'Front Delts', 'Triceps'],
    reason: 'Targets upper chest to create balanced chest development and improve symmetry score.',
    alternatives: [
      { name: 'Incline Barbell Press', equipment: 'Barbell + Incline Bench' },
      { name: 'Low-to-High Cable Fly', equipment: 'Cable Machine' },
      { name: 'Incline Push-Ups', equipment: 'Bodyweight + Elevated Surface' },
    ]
  },
  'Cable Flyes': {
    muscles: ['Chest', 'Front Delts'],
    reason: 'Isolation movement for chest stretch and contraction. Great for muscle definition.',
    alternatives: [
      { name: 'Dumbbell Flyes', equipment: 'Dumbbells + Bench' },
      { name: 'Pec Deck Machine', equipment: 'Pec Deck' },
      { name: 'Resistance Band Flyes', equipment: 'Resistance Bands' },
    ]
  },
  'Dumbbell Flyes': {
    muscles: ['Chest', 'Front Delts'],
    reason: 'Isolation movement for chest stretch and contraction. Great for muscle definition.',
    alternatives: [
      { name: 'Cable Flyes', equipment: 'Cable Machine' },
      { name: 'Pec Deck Machine', equipment: 'Pec Deck' },
      { name: 'Resistance Band Flyes', equipment: 'Resistance Bands' },
    ]
  },
  'Chest Dips': {
    muscles: ['Lower Chest', 'Triceps', 'Front Delts'],
    reason: 'Compound movement emphasizing lower chest and triceps.',
    alternatives: [
      { name: 'Decline Push-Ups', equipment: 'Bodyweight' },
      { name: 'Decline Dumbbell Press', equipment: 'Dumbbells + Decline Bench' },
      { name: 'Machine Dips', equipment: 'Dip Machine' },
    ]
  },

  // Shoulder Exercises
  'Shoulder Press': {
    muscles: ['Front Delts', 'Side Delts', 'Triceps'],
    reason: 'Compound shoulder builder for overall deltoid development.',
    alternatives: [
      { name: 'Dumbbell Shoulder Press', equipment: 'Dumbbells' },
      { name: 'Arnold Press', equipment: 'Dumbbells' },
      { name: 'Pike Push-Ups', equipment: 'Bodyweight' },
    ]
  },
  'Overhead Press': {
    muscles: ['Front Delts', 'Side Delts', 'Triceps'],
    reason: 'Compound shoulder builder for overall deltoid development.',
    alternatives: [
      { name: 'Dumbbell Shoulder Press', equipment: 'Dumbbells' },
      { name: 'Arnold Press', equipment: 'Dumbbells' },
      { name: 'Pike Push-Ups', equipment: 'Bodyweight' },
    ]
  },
  'Lateral Raises': {
    muscles: ['Side Delts'],
    reason: 'Isolation for side delts to create wider shoulder appearance.',
    alternatives: [
      { name: 'Cable Lateral Raises', equipment: 'Cable Machine' },
      { name: 'Resistance Band Lateral Raises', equipment: 'Resistance Bands' },
      { name: 'Leaning Lateral Raises', equipment: 'Dumbbells' },
    ]
  },
  'Face Pulls': {
    muscles: ['Rear Delts', 'Upper Back', 'Rotator Cuff'],
    reason: 'Essential for shoulder health and rear delt development.',
    alternatives: [
      { name: 'Reverse Pec Deck', equipment: 'Pec Deck Machine' },
      { name: 'Bent Over Rear Delt Raises', equipment: 'Dumbbells' },
      { name: 'Band Pull-Aparts', equipment: 'Resistance Band' },
    ]
  },
  'Rear Delt Flyes': {
    muscles: ['Rear Delts', 'Upper Back'],
    reason: 'Isolation for rear delts to balance shoulder development.',
    alternatives: [
      { name: 'Face Pulls', equipment: 'Cable Machine' },
      { name: 'Reverse Pec Deck', equipment: 'Pec Deck Machine' },
      { name: 'Band Pull-Aparts', equipment: 'Resistance Band' },
    ]
  },

  // Tricep Exercises
  'Tricep Pushdowns': {
    muscles: ['Triceps'],
    reason: 'Isolation movement for tricep definition and arm size.',
    alternatives: [
      { name: 'Overhead Tricep Extension', equipment: 'Dumbbell/Cable' },
      { name: 'Skull Crushers', equipment: 'Barbell/EZ Bar' },
      { name: 'Diamond Push-Ups', equipment: 'Bodyweight' },
    ]
  },
  'Skull Crushers': {
    muscles: ['Triceps'],
    reason: 'Excellent for tricep long head development.',
    alternatives: [
      { name: 'Tricep Pushdowns', equipment: 'Cable Machine' },
      { name: 'Overhead Tricep Extension', equipment: 'Dumbbell' },
      { name: 'Close Grip Bench Press', equipment: 'Barbell' },
    ]
  },
  'Overhead Tricep Extension': {
    muscles: ['Triceps'],
    reason: 'Targets the long head of the tricep for complete arm development.',
    alternatives: [
      { name: 'Skull Crushers', equipment: 'Barbell/EZ Bar' },
      { name: 'Tricep Pushdowns', equipment: 'Cable Machine' },
      { name: 'Diamond Push-Ups', equipment: 'Bodyweight' },
    ]
  },

  // Back Exercises
  'Pull-Ups': {
    muscles: ['Lats', 'Biceps', 'Rear Delts'],
    reason: 'King of back exercises for building a wide, V-shaped back.',
    alternatives: [
      { name: 'Lat Pulldowns', equipment: 'Cable Machine' },
      { name: 'Assisted Pull-Ups', equipment: 'Assisted Pull-Up Machine' },
      { name: 'Inverted Rows', equipment: 'Barbell/Smith Machine' },
    ]
  },
  'Lat Pulldowns': {
    muscles: ['Lats', 'Biceps', 'Rear Delts'],
    reason: 'Excellent lat builder, great for all experience levels.',
    alternatives: [
      { name: 'Pull-Ups', equipment: 'Pull-Up Bar' },
      { name: 'Straight Arm Pulldowns', equipment: 'Cable Machine' },
      { name: 'Dumbbell Pullovers', equipment: 'Dumbbell + Bench' },
    ]
  },
  'Barbell Rows': {
    muscles: ['Upper Back', 'Lats', 'Biceps'],
    reason: 'Primary compound for back thickness and strength.',
    alternatives: [
      { name: 'Dumbbell Rows', equipment: 'Dumbbells' },
      { name: 'Cable Rows', equipment: 'Cable Machine' },
      { name: 'T-Bar Rows', equipment: 'T-Bar Row Machine' },
    ]
  },
  'Seated Cable Rows': {
    muscles: ['Upper Back', 'Lats', 'Biceps'],
    reason: 'Great for building back thickness with controlled movement.',
    alternatives: [
      { name: 'Barbell Rows', equipment: 'Barbell' },
      { name: 'Dumbbell Rows', equipment: 'Dumbbells' },
      { name: 'Machine Rows', equipment: 'Row Machine' },
    ]
  },
  'Dumbbell Rows': {
    muscles: ['Upper Back', 'Lats', 'Biceps'],
    reason: 'Unilateral back builder for addressing muscle imbalances.',
    alternatives: [
      { name: 'Barbell Rows', equipment: 'Barbell' },
      { name: 'Cable Rows', equipment: 'Cable Machine' },
      { name: 'Machine Rows', equipment: 'Row Machine' },
    ]
  },
  'Deadlifts': {
    muscles: ['Lower Back', 'Hamstrings', 'Glutes', 'Traps'],
    reason: 'Foundational compound movement for overall posterior chain development.',
    alternatives: [
      { name: 'Romanian Deadlifts', equipment: 'Barbell/Dumbbells' },
      { name: 'Trap Bar Deadlifts', equipment: 'Trap Bar' },
      { name: 'Rack Pulls', equipment: 'Barbell + Rack' },
    ]
  },

  // Bicep Exercises
  'Barbell Curls': {
    muscles: ['Biceps'],
    reason: 'Classic bicep builder for overall arm size.',
    alternatives: [
      { name: 'Dumbbell Curls', equipment: 'Dumbbells' },
      { name: 'EZ Bar Curls', equipment: 'EZ Curl Bar' },
      { name: 'Cable Curls', equipment: 'Cable Machine' },
    ]
  },
  'Hammer Curls': {
    muscles: ['Biceps', 'Brachialis', 'Forearms'],
    reason: 'Targets brachialis for arm thickness and forearm development.',
    alternatives: [
      { name: 'Cross Body Hammer Curls', equipment: 'Dumbbells' },
      { name: 'Rope Hammer Curls', equipment: 'Cable Machine' },
      { name: 'Reverse Curls', equipment: 'Barbell/EZ Bar' },
    ]
  },
  'Incline Dumbbell Curls': {
    muscles: ['Biceps'],
    reason: 'Stretches the bicep for better long head development.',
    alternatives: [
      { name: 'Preacher Curls', equipment: 'Preacher Bench' },
      { name: 'Spider Curls', equipment: 'Incline Bench' },
      { name: 'Cable Curls', equipment: 'Cable Machine' },
    ]
  },

  // Leg Exercises
  'Squats': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    reason: 'King of leg exercises. Essential for lower body strength and mass.',
    alternatives: [
      { name: 'Leg Press', equipment: 'Leg Press Machine' },
      { name: 'Goblet Squats', equipment: 'Dumbbell/Kettlebell' },
      { name: 'Bulgarian Split Squats', equipment: 'Dumbbells + Bench' },
    ]
  },
  'Leg Press': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    reason: 'Excellent for building leg mass with reduced spinal load.',
    alternatives: [
      { name: 'Squats', equipment: 'Barbell + Rack' },
      { name: 'Hack Squats', equipment: 'Hack Squat Machine' },
      { name: 'Goblet Squats', equipment: 'Dumbbell/Kettlebell' },
    ]
  },
  'Romanian Deadlifts': {
    muscles: ['Hamstrings', 'Glutes', 'Lower Back'],
    reason: 'Primary hamstring builder for balanced leg development.',
    alternatives: [
      { name: 'Stiff Leg Deadlifts', equipment: 'Barbell' },
      { name: 'Leg Curls', equipment: 'Leg Curl Machine' },
      { name: 'Good Mornings', equipment: 'Barbell' },
    ]
  },
  'Leg Curls': {
    muscles: ['Hamstrings'],
    reason: 'Isolation for hamstring development.',
    alternatives: [
      { name: 'Romanian Deadlifts', equipment: 'Barbell/Dumbbells' },
      { name: 'Nordic Curls', equipment: 'Bodyweight' },
      { name: 'Glute Ham Raises', equipment: 'GHD Machine' },
    ]
  },
  'Leg Extensions': {
    muscles: ['Quads'],
    reason: 'Isolation for quad development and definition.',
    alternatives: [
      { name: 'Sissy Squats', equipment: 'Bodyweight' },
      { name: 'Front Squats', equipment: 'Barbell' },
      { name: 'Step-Ups', equipment: 'Dumbbells + Box' },
    ]
  },
  'Calf Raises': {
    muscles: ['Calves'],
    reason: 'Essential for complete lower leg development.',
    alternatives: [
      { name: 'Seated Calf Raises', equipment: 'Calf Raise Machine' },
      { name: 'Leg Press Calf Raises', equipment: 'Leg Press Machine' },
      { name: 'Donkey Calf Raises', equipment: 'Bodyweight/Machine' },
    ]
  },
  'Hip Thrusts': {
    muscles: ['Glutes', 'Hamstrings'],
    reason: 'Best exercise for glute activation and development.',
    alternatives: [
      { name: 'Glute Bridges', equipment: 'Bodyweight/Barbell' },
      { name: 'Cable Pull-Throughs', equipment: 'Cable Machine' },
      { name: 'Hip Extensions', equipment: 'GHD Machine' },
    ]
  },
  'Lunges': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    reason: 'Unilateral leg exercise for balance and coordination.',
    alternatives: [
      { name: 'Bulgarian Split Squats', equipment: 'Dumbbells + Bench' },
      { name: 'Step-Ups', equipment: 'Dumbbells + Box' },
      { name: 'Walking Lunges', equipment: 'Dumbbells' },
    ]
  },
  'Bulgarian Split Squats': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    reason: 'Excellent for addressing leg muscle imbalances.',
    alternatives: [
      { name: 'Lunges', equipment: 'Dumbbells' },
      { name: 'Step-Ups', equipment: 'Dumbbells + Box' },
      { name: 'Single Leg Press', equipment: 'Leg Press Machine' },
    ]
  },
};

/**
 * Get exercise info with fallback for unknown exercises
 */
export function getExerciseInfo(exerciseName: string): ExerciseInfo {
  // Direct lookup
  if (EXERCISE_INFO[exerciseName]) {
    return EXERCISE_INFO[exerciseName];
  }

  // Try case-insensitive lookup
  const lowerName = exerciseName.toLowerCase();
  const matchedKey = Object.keys(EXERCISE_INFO).find(
    key => key.toLowerCase() === lowerName
  );
  
  if (matchedKey) {
    return EXERCISE_INFO[matchedKey];
  }

  // Return default info for unknown exercises
  return {
    muscles: ['Multiple'],
    reason: 'Selected to support your training goals.',
    alternatives: [],
  };
}

/**
 * Default exercises for common workout types
 */
export const DEFAULT_EXERCISES = {
  push: [
    'Bench Press',
    'Incline Dumbbell Press',
    'Cable Flyes',
    'Shoulder Press',
    'Lateral Raises',
    'Tricep Pushdowns',
  ],
  pull: [
    'Pull-Ups',
    'Barbell Rows',
    'Lat Pulldowns',
    'Face Pulls',
    'Barbell Curls',
    'Hammer Curls',
  ],
  legs: [
    'Squats',
    'Romanian Deadlifts',
    'Leg Press',
    'Leg Curls',
    'Leg Extensions',
    'Calf Raises',
    'Hip Thrusts',
  ],
  upper: [
    'Bench Press',
    'Barbell Rows',
    'Shoulder Press',
    'Lat Pulldowns',
    'Barbell Curls',
    'Tricep Pushdowns',
  ],
  lower: [
    'Squats',
    'Romanian Deadlifts',
    'Leg Press',
    'Leg Curls',
    'Calf Raises',
    'Hip Thrusts',
  ],
  fullBody: [
    'Squats',
    'Bench Press',
    'Barbell Rows',
    'Shoulder Press',
    'Romanian Deadlifts',
    'Pull-Ups',
  ],
};
