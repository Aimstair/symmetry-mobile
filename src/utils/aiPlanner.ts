/**
 * AI Planner Utility
 * 
 * Generates intelligent workout plans based on PhysiqueScan results.
 * Features:
 * - Smart Volume Modulation (3-tier system based on muscle scores)
 * - Date-Aware Scheduling (only generates for upcoming days)
 * - Dynamic exercise selection based on muscle tier
 */

import {
  PhysiqueScan,
  WorkoutPlan,
  WorkoutDay,
  PlanExercise,
  User,
} from '@/types';
import { getExerciseFromCache } from '@/hooks/useExercises';

// ============================================================================
// TYPES
// ============================================================================

/** Muscle tier based on physique scan score */
type MuscleTier = 'strong' | 'balanced' | 'lacking';

interface MuscleAnalysisData {
  muscle: string;
  score: number;
  tier: MuscleTier;
}

/** Volume and intensity settings per tier */
interface TierSettings {
  sets: number;
  reps: string;
  restSeconds: number;
  rpe: number;
  notes: string;
  /** Number of exercises to include for this muscle */
  exerciseCount: number;
  /** Whether to include isolation exercises */
  includeIsolation: boolean;
}

interface GeneratePlanOptions {
  /** User profile for training days and preferences */
  user: User;
}

/** Split day template */
interface SplitDay {
  name: string;
  /** Muscle groups targeted (keys from EXERCISE_CATALOG) */
  targetMuscles: (keyof typeof EXERCISE_CATALOG)[];
}

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

/**
 * Smart Volume Settings per Tier
 * 
 * Strong (>85): Maintenance Mode - Low volume, compounds only
 * Balanced (70-85): Growth Mode - Standard volume
 * Lacking (<70): Priority Mode - High volume, extra isolation, higher intensity
 */
const TIER_SETTINGS: Record<MuscleTier, TierSettings> = {
  strong: {
    sets: 2,
    reps: '8-10',
    restSeconds: 90,
    rpe: 7,
    notes: 'Maintenance - focus on form, save energy for priority muscles',
    exerciseCount: 1, // Compound only
    includeIsolation: false,
  },
  balanced: {
    sets: 3,
    reps: '10-12',
    restSeconds: 90,
    rpe: 8,
    notes: '',
    exerciseCount: 2, // Compound + 1 accessory
    includeIsolation: true,
  },
  lacking: {
    sets: 4,
    reps: '8-10',
    restSeconds: 120,
    rpe: 9,
    notes: 'Priority muscle - push hard, consider dropsets on final set',
    exerciseCount: 3, // Compound + isolation work
    includeIsolation: true,
  },
};

// ============================================================================
// EXERCISE CATALOG
// ============================================================================

/**
 * Exercise catalog organized by muscle group
 * Each muscle has compound exercises listed first, then isolation
 * IDs must match the exercises table in the database
 */
const EXERCISE_CATALOG = {
  chest: {
    compounds: ['bench_press', 'incline_db_press', 'chest_dips'],
    isolation: ['cable_flyes', 'dumbbell_flyes'],
  },
  back: {
    compounds: ['barbell_rows', 'lat_pulldowns', 'pull_ups', 'deadlifts'],
    isolation: ['dumbbell_rows', 'face_pulls'],
  },
  shoulders: {
    compounds: ['overhead_press', 'db_shoulder_press'],
    isolation: ['lateral_raises', 'face_pulls'],
  },
  arms: {
    compounds: ['tricep_pushdowns', 'barbell_curls'],
    isolation: ['hammer_curls', 'skull_crushers'],
  },
  legs: {
    compounds: ['squats', 'leg_press', 'romanian_deadlifts', 'lunges'],
    isolation: ['leg_curls', 'leg_extensions', 'calf_raises'],
  },
} as const;

/**
 * Maps PhysiqueScan muscle names to EXERCISE_CATALOG keys
 */
const SCAN_TO_CATALOG_MAP: Record<string, keyof typeof EXERCISE_CATALOG> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  arms: 'arms',
  legs: 'legs',
};

// ============================================================================
// SPLIT TEMPLATES
// ============================================================================

/** Push/Pull/Legs split template */
const PPL_SPLIT: SplitDay[] = [
  { name: 'Push', targetMuscles: ['chest', 'shoulders', 'arms'] },
  { name: 'Pull', targetMuscles: ['back', 'arms'] },
  { name: 'Legs', targetMuscles: ['legs'] },
];

/** Upper/Lower split template */
const UPPER_LOWER_SPLIT: SplitDay[] = [
  { name: 'Upper Body', targetMuscles: ['chest', 'back', 'shoulders', 'arms'] },
  { name: 'Lower Body', targetMuscles: ['legs'] },
];

/** Full Body split template */
const FULL_BODY_SPLIT: SplitDay[] = [
  { name: 'Full Body', targetMuscles: ['chest', 'back', 'shoulders', 'arms', 'legs'] },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Gets the day name from a date
 */
function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Analyzes muscle scores and assigns tiers
 * 
 * Strong (>85): Maintenance Mode
 * Balanced (70-85): Growth Mode
 * Lacking (<70): Priority Mode
 */
function analyzeMuscleScores(muscleScores: PhysiqueScan['muscleScores']): Map<string, MuscleAnalysisData> {
  const analysis = new Map<string, MuscleAnalysisData>();
  
  for (const [muscle, score] of Object.entries(muscleScores)) {
    let tier: MuscleTier;
    
    if (score > 85) {
      tier = 'strong';
    } else if (score >= 70) {
      tier = 'balanced';
    } else {
      tier = 'lacking';
    }
    
    analysis.set(muscle, { muscle, score, tier });
  }
  
  return analysis;
}

/**
 * Gets the upcoming training days from today until end of week (Saturday)
 * 
 * @param startDate - The date to start from (usually today)
 * @param trainingDays - Array of day names user trains (e.g., ['Monday', 'Wednesday', 'Friday'])
 * @returns Array of upcoming training day names
 */
function getUpcomingTrainingDays(startDate: Date, trainingDays: string[]): string[] {
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDayIndex = startDate.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Filter training days to only include today and future days (up to Saturday)
  const upcomingDays = trainingDays.filter(day => {
    const dayIndex = dayOrder.indexOf(day);
    // Include if day is today or later, and before or on Saturday
    return dayIndex >= startDayIndex && dayIndex <= 6;
  });
  
  // Sort by day order
  upcomingDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  
  return upcomingDays;
}

/**
 * Selects exercises for a muscle group based on its tier
 */
function selectExercisesForMuscle(
  muscle: keyof typeof EXERCISE_CATALOG,
  tier: MuscleTier,
  alreadyUsed: Set<string>
): string[] {
  const catalog = EXERCISE_CATALOG[muscle];
  const settings = TIER_SETTINGS[tier];
  const selected: string[] = [];
  
  // Always start with compounds
  for (const exercise of catalog.compounds) {
    if (!alreadyUsed.has(exercise) && selected.length < settings.exerciseCount) {
      selected.push(exercise);
      alreadyUsed.add(exercise);
    }
  }
  
  // Add isolation if tier allows and we need more exercises
  if (settings.includeIsolation && selected.length < settings.exerciseCount) {
    for (const exercise of catalog.isolation) {
      if (!alreadyUsed.has(exercise) && selected.length < settings.exerciseCount) {
        selected.push(exercise);
        alreadyUsed.add(exercise);
      }
    }
  }
  
  return selected;
}

/**
 * Creates a PlanExercise with tier-appropriate settings
 */
function createPlanExercise(
  exerciseId: string,
  workoutDayId: string,
  orderIndex: number,
  tier: MuscleTier
): PlanExercise {
  const settings = TIER_SETTINGS[tier];
  
  // Hydrate exercise data from cache
  const exercise = getExerciseFromCache(exerciseId);
  
  return {
    id: generateId(),
    workoutDayId,
    exerciseId,
    orderIndex,
    targetSets: settings.sets,
    targetReps: settings.reps,
    restSeconds: settings.restSeconds,
    notes: settings.notes || undefined,
    exercise: exercise || undefined, // Populate exercise field for UI
  };
}

/**
 * Builds exercises for a workout day based on target muscles and their tiers
 */
function buildDayExercises(
  splitDay: SplitDay,
  muscleAnalysis: Map<string, MuscleAnalysisData>,
  workoutDayId: string
): PlanExercise[] {
  const exercises: PlanExercise[] = [];
  const usedExercises = new Set<string>();
  
  // Process each target muscle for this split day
  for (const muscle of splitDay.targetMuscles) {
    // Get the scan muscle name that maps to this catalog muscle
    const scanMuscle = Object.entries(SCAN_TO_CATALOG_MAP)
      .find(([_, catalogMuscle]) => catalogMuscle === muscle)?.[0];
    
    // Get the tier for this muscle (default to balanced if not found)
    const analysis = scanMuscle ? muscleAnalysis.get(scanMuscle) : null;
    const tier: MuscleTier = analysis?.tier || 'balanced';
    
    // Select exercises based on tier
    const selectedExercises = selectExercisesForMuscle(muscle, tier, usedExercises);
    
    // Create PlanExercise entries
    for (const exerciseId of selectedExercises) {
      exercises.push(createPlanExercise(
        exerciseId,
        workoutDayId,
        exercises.length,
        tier
      ));
    }
  }
  
  return exercises;
}

/**
 * Determines the appropriate split template based on training frequency
 */
function getSplitTemplate(daysPerWeek: number): SplitDay[] {
  if (daysPerWeek >= 5) {
    return PPL_SPLIT;
  } else if (daysPerWeek >= 3) {
    return UPPER_LOWER_SPLIT;
  } else {
    return FULL_BODY_SPLIT;
  }
}

/**
 * Gets the split type for the plan
 */
function getSplitType(daysPerWeek: number): WorkoutPlan['type'] {
  if (daysPerWeek >= 5) {
    return 'push-pull-legs';
  } else if (daysPerWeek >= 3) {
    return 'upper-lower';
  } else {
    return 'full-body';
  }
}

/**
 * Generates a description for the plan based on muscle analysis
 */
function generatePlanDescription(
  muscleAnalysis: Map<string, MuscleAnalysisData>,
  scanDate: Date
): string {
  const lacking: string[] = [];
  const strong: string[] = [];
  
  for (const [muscle, analysis] of muscleAnalysis) {
    if (analysis.tier === 'lacking') {
      lacking.push(muscle);
    } else if (analysis.tier === 'strong') {
      strong.push(muscle);
    }
  }
  
  const parts: string[] = [];
  
  if (lacking.length > 0) {
    parts.push(`Priority focus: ${lacking.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}`);
  }
  
  if (strong.length > 0) {
    parts.push(`Maintenance: ${strong.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}`);
  }
  
  parts.push(`Based on scan from ${scanDate.toLocaleDateString()}`);
  
  return parts.join('. ') + '.';
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generates a smart workout plan based on PhysiqueScan results
 * 
 * Features:
 * 1. Smart Volume Modulation - 3 tiers (Strong/Balanced/Lacking)
 * 2. Date-Aware Scheduling - Only generates for upcoming days this week
 * 3. Dynamic exercise selection based on muscle tier
 * 
 * @param scanResults - The physique scan with muscle scores
 * @param startDate - The start date (usually today) for the plan
 * @param options - Options including user profile
 * @returns A new WorkoutPlan optimized for the user's physique
 * 
 * @example
 * ```typescript
 * const scan = await cloudService.getLatestPhysiqueScan(userId);
 * const plan = generatePlanFromScan(scan, new Date(), { user });
 * await cloudService.createWorkoutPlan(plan);
 * ```
 */
export function generatePlanFromScan(
  scanResults: PhysiqueScan,
  startDate: Date,
  options: GeneratePlanOptions
): WorkoutPlan {
  const { user } = options;
  const allTrainingDays = user.trainingDays || [];
  
  // Analyze muscle scores to determine tiers
  const muscleAnalysis = analyzeMuscleScores(scanResults.muscleScores);
  
  // Sort training days by day order (Monday first for consistent mapping)
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sortedTrainingDays = [...allTrainingDays].sort((a, b) => 
    dayOrder.indexOf(a) - dayOrder.indexOf(b)
  );
  
  if (__DEV__) {
    console.log('🤖 AI Planner:', {
      allTrainingDays,
      sortedTrainingDays,
      muscleAnalysis: Object.fromEntries(muscleAnalysis),
    });
  }
  
  // Generate workouts for ALL training days (not just upcoming)
  // This ensures the plan covers the full week
  const daysPerWeek = allTrainingDays.length;
  
  // Get split template based on total training frequency
  const splitTemplate = getSplitTemplate(daysPerWeek);
  const splitType = getSplitType(daysPerWeek);
  
  // Create the plan
  const planId = generateId();
  const now = new Date();
  
  // Generate workout days for ALL training days
  const workoutDays: WorkoutDay[] = sortedTrainingDays.map((trainingDayName, index) => {
    // Cycle through split template
    const splitDay = splitTemplate[index % splitTemplate.length];
    const workoutDayId = generateId();
    
    // Build exercises dynamically based on muscle tiers
    const exercises = buildDayExercises(splitDay, muscleAnalysis, workoutDayId);
    
    // Determine muscle groups being worked
    const muscleGroups = splitDay.targetMuscles.map(m => 
      m.charAt(0).toUpperCase() + m.slice(1)
    );
    
    return {
      id: workoutDayId,
      planId,
      orderIndex: index,
      dayName: trainingDayName, // IMPORTANT: Set dayName for calendar matching
      name: splitDay.name, // Workout name (e.g., "Upper Body", "Lower Body")
      muscleGroups,
      exercises,
      createdAt: now,
      updatedAt: now,
    };
  });
  
  // Generate description
  const description = generatePlanDescription(muscleAnalysis, scanResults.date);
  
  // Build plan name with date context
  const planName = `AI Plan - ${startDate.toLocaleDateString()}`;
  
  return {
    id: planId,
    userId: user.id,
    name: planName,
    description,
    type: splitType,
    daysPerWeek,
    workoutDays,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// ANALYSIS EXPORTS
// ============================================================================

/**
 * Gets a summary of which muscles are in each tier based on scan
 */
export function getMuscleAnalysis(scanResults: PhysiqueScan): {
  lacking: string[];
  balanced: string[];
  strong: string[];
} {
  const analysis = analyzeMuscleScores(scanResults.muscleScores);
  
  const result = {
    lacking: [] as string[],
    balanced: [] as string[],
    strong: [] as string[],
  };
  
  for (const [muscle, data] of analysis) {
    result[data.tier].push(muscle);
  }
  
  return result;
}

/**
 * Gets tier-specific recommendations for a muscle
 */
export function getTierRecommendations(tier: MuscleTier): TierSettings {
  return { ...TIER_SETTINGS[tier] };
}

/**
 * Suggests exercises for a specific muscle group based on tier
 */
export function suggestExercisesForMuscle(
  muscleGroup: keyof typeof EXERCISE_CATALOG,
  tier: MuscleTier = 'balanced'
): string[] {
  const usedExercises = new Set<string>();
  return selectExercisesForMuscle(muscleGroup, tier, usedExercises);
}

// ============================================================================
// PLAN MERGE FUNCTIONS (Preserve Past Workouts)
// ============================================================================

/**
 * Gets the day index (0-6) from a day name
 */
function getDayIndex(dayName: string): number {
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayOrder.indexOf(dayName);
}

/**
 * Extracts the day name from a WorkoutDay name (e.g., "Monday - Push" -> "Monday")
 */
function extractDayName(workoutDayName: string): string {
  const parts = workoutDayName.split(' - ');
  return parts[0] || workoutDayName;
}

/**
 * Merges a new AI-generated plan with an existing plan, preserving past workouts.
 * 
 * This implements a "Future-Only" update strategy:
 * - Past days (before today): Keep existing workouts unchanged
 * - Today and future days: Use new AI-generated workouts
 * 
 * @param existingPlan - The current workout plan with history
 * @param newPlan - The freshly AI-generated plan
 * @param today - The current date (for determining past vs future)
 * @returns A merged plan preserving past workouts
 * 
 * @example
 * ```typescript
 * const newPlan = generatePlanFromScan(scan, new Date(), { user });
 * const mergedPlan = mergePlanPreservingHistory(existingPlan, newPlan, new Date());
 * await cloudService.updateWorkoutPlan(mergedPlan.id, mergedPlan);
 * ```
 */
export function mergePlanPreservingHistory(
  existingPlan: WorkoutPlan,
  newPlan: WorkoutPlan,
  today: Date
): WorkoutPlan {
  const todayDayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Build a map of new workouts by day name
  const newWorkoutsByDay = new Map<string, WorkoutDay>();
  for (const workoutDay of newPlan.workoutDays) {
    const dayName = extractDayName(workoutDay.name);
    newWorkoutsByDay.set(dayName, workoutDay);
  }
  
  // Build merged workout days
  const mergedWorkoutDays: WorkoutDay[] = [];
  const processedDays = new Set<string>();
  
  // First, preserve existing past workouts
  for (const existingDay of existingPlan.workoutDays) {
    const dayName = extractDayName(existingDay.name);
    const dayIndex = getDayIndex(dayName);
    
    if (dayIndex < todayDayIndex) {
      // Past day - keep existing workout
      mergedWorkoutDays.push({
        ...existingDay,
        orderIndex: mergedWorkoutDays.length,
      });
      processedDays.add(dayName);
      
      if (__DEV__) {
        console.log(`📅 Preserving past workout: ${dayName}`);
      }
    }
  }
  
  // Then add new workouts for today and future days
  for (const newDay of newPlan.workoutDays) {
    const dayName = extractDayName(newDay.name);
    const dayIndex = getDayIndex(dayName);
    
    if (dayIndex >= todayDayIndex && !processedDays.has(dayName)) {
      // Today or future - use new AI workout
      mergedWorkoutDays.push({
        ...newDay,
        planId: existingPlan.id, // Keep the existing plan ID
        orderIndex: mergedWorkoutDays.length,
      });
      processedDays.add(dayName);
      
      if (__DEV__) {
        console.log(`🔄 Updating future workout: ${dayName}`);
      }
    }
  }
  
  // Sort by day order
  mergedWorkoutDays.sort((a, b) => {
    const dayA = getDayIndex(extractDayName(a.name));
    const dayB = getDayIndex(extractDayName(b.name));
    return dayA - dayB;
  });
  
  // Re-index after sorting
  mergedWorkoutDays.forEach((day, index) => {
    day.orderIndex = index;
  });
  
  return {
    ...existingPlan,
    name: newPlan.name,
    description: newPlan.description,
    type: newPlan.type,
    workoutDays: mergedWorkoutDays,
    updatedAt: new Date(),
  };
}

/**
 * Generates a single workout day for a specific day name.
 * Useful when converting a rest day to an active day.
 * 
 * @param scanResults - The physique scan with muscle scores
 * @param dayName - The day name (e.g., "Thursday")
 * @param planId - The plan ID this day belongs to
 * @param options - Options including user profile
 * @returns A single WorkoutDay for the specified day
 */
export function generateSingleDayWorkout(
  scanResults: PhysiqueScan,
  dayName: string,
  planId: string,
  options: GeneratePlanOptions
): WorkoutDay {
  const { user } = options;
  const daysPerWeek = user.trainingDays?.length || 3;
  
  // Analyze muscle scores
  const muscleAnalysis = analyzeMuscleScores(scanResults.muscleScores);
  
  // Get split template
  const splitTemplate = getSplitTemplate(daysPerWeek);
  
  // Determine which split day to use based on day position in the week
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = dayOrder.indexOf(dayName);
  
  // Count how many training days come before this one
  const trainingDaysBefore = (user.trainingDays || []).filter(d => {
    return dayOrder.indexOf(d) < dayIndex;
  }).length;
  
  // Use that to pick the split day
  const splitDay = splitTemplate[trainingDaysBefore % splitTemplate.length];
  
  const workoutDayId = generateId();
  const now = new Date();
  
  // Build exercises
  const exercises = buildDayExercises(splitDay, muscleAnalysis, workoutDayId);
  
  // Determine muscle groups
  const muscleGroups = splitDay.targetMuscles.map(m => 
    m.charAt(0).toUpperCase() + m.slice(1)
  );
  
  return {
    id: workoutDayId,
    planId,
    orderIndex: 0, // Will be set correctly when inserting into plan
    name: `${dayName} - ${splitDay.name}`,
    muscleGroups,
    exercises,
    createdAt: now,
    updatedAt: now,
  };
}

