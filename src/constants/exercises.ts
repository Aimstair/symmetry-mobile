/**
 * Exercise Seed Data
 *
 * ⚠️ IMPORTANT: This file is for DATABASE SEEDING ONLY.
 *
 * DO NOT import from this file in UI components!
 * Instead, use the hooks from '@/hooks/useExercises':
 *   - useExercises() - Get all exercises from cache
 *   - useExercise(id) - Get a single exercise
 *   - useExerciseSearch(query) - Search exercises
 *   - getExerciseInfo(name) - Sync lookup with fallback
 *
 * The data in this file is used to:
 * 1. Seed the `exercises` table in Supabase
 * 2. Seed the `exercise_alternatives` table in Supabase
 *
 * Migration: supabase/migrations/20260105000000_normalize_schema.sql
 *
 * @deprecated Use '@/hooks/useExercises' for runtime exercise access
 */

export type ExerciseEnvironment = 'gym' | 'home' | 'any';

export interface ExerciseAlternative {
  id: string;
  name: string;
  reason: string;
}

export interface ExerciseDetail {
  id: string;
  name: string;
  description: string;
  environment: ExerciseEnvironment;
  equipment: string[];
  muscleGroups: string[];
  tips: string[];
  formCues: string[];
  videoPlaceholder: string;
  alternatives: ExerciseAlternative[];
}

/**
 * Seed Data for Exercises Table
 * @deprecated Use CloudExerciseService for runtime access
 */
export const EXERCISE_DATABASE: Record<string, ExerciseDetail> = {
  // --- CHEST ---
  'Bench Press': {
    id: 'bench_press',
    name: 'Bench Press',
    description: 'The standard for upper body pressing power. Targets the entire chest with heavy load potential.',
    environment: 'gym',
    equipment: ['Barbell', 'Bench', 'Rack'],
    muscleGroups: ['Chest', 'Front Delts', 'Triceps'],
    tips: [
      'Keep feet planted firmly',
      'Retract shoulder blades into the bench',
      'Touch bar to mid-chest',
      'Drive up without flaring elbows'
    ],
    formCues: [
      'Grip: Just outside shoulders',
      'Arch: Slight natural arch',
      'Path: Slight diagonal line',
      'Tempo: Control down, explode up'
    ],
    videoPlaceholder: 'bench-press',
    alternatives: [
      { id: 'dumbbell_bench_press', name: 'Dumbbell Bench Press', reason: 'Better range of motion' },
      { id: 'push_ups', name: 'Push-Ups', reason: 'Bodyweight alternative' },
      { id: 'machine_chest_press', name: 'Machine Chest Press', reason: 'Safer/Easier setup' }
    ]
  },
  'Incline Dumbbell Press': {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    description: 'Targets the upper clavicular head of the pecs to fill out the upper chest.',
    environment: 'any',
    equipment: ['Dumbbells', 'Adjustable Bench'],
    muscleGroups: ['Upper Chest', 'Front Delts', 'Triceps'],
    tips: [
      'Set bench angle to 30-45 degrees',
      'Keep wrists straight',
      'Lower dumbbells until chest stretch is felt',
      'Press up and slightly in'
    ],
    formCues: [
      'Angle: 30-45 degrees',
      'Elbows: Tucked 45 degrees',
      'Range: Full stretch',
      'Top: Do not clang weights'
    ],
    videoPlaceholder: 'incline-db-press',
    alternatives: [
      { id: 'incline_barbell_press', name: 'Incline Barbell Press', reason: 'Heavier loading potential' },
      { id: 'low_to_high_fly', name: 'Low-to-High Cable Fly', reason: 'Constant tension isolation' },
      { id: 'reverse_grip_bench', name: 'Reverse Grip Bench', reason: 'Barbell alternative' }
    ]
  },
  'Cable Flyes': {
    id: 'cable_flyes',
    name: 'Cable Flyes',
    description: 'Isolation movement providing constant tension across the entire range of motion.',
    environment: 'gym',
    equipment: ['Cable Machine'],
    muscleGroups: ['Chest', 'Front Delts'],
    tips: [
      'Maintain a slight bend in elbows',
      'Focus on the squeeze at the center',
      'Control the eccentric (opening) phase',
      'Keep chest up and shoulders back'
    ],
    formCues: [
      'Stance: Staggered for stability',
      'Path: Hug a large tree',
      'Shoulders: Retracted',
      'Tempo: Slow and controlled'
    ],
    videoPlaceholder: 'cable-flyes',
    alternatives: [
      { id: 'dumbbell_flyes', name: 'Dumbbell Flyes', reason: 'Free weight alternative' },
      { id: 'pec_deck', name: 'Pec Deck', reason: 'Machine stability' },
      { id: 'band_flyes', name: 'Band Flyes', reason: 'Home/Travel option' }
    ]
  },
  'Dumbbell Flyes': {
    id: 'dumbbell_flyes',
    name: 'Dumbbell Flyes',
    description: 'Classic old-school chest isolator focusing on the stretched position.',
    environment: 'any',
    equipment: ['Dumbbells', 'Bench'],
    muscleGroups: ['Chest', 'Front Delts'],
    tips: [
      'Do not go too heavy',
      'Focus on the deep stretch at bottom',
      'Visualize bringing biceps together',
      'Keep elbows locked in slight bend'
    ],
    formCues: [
      'Arc: Wide sweeping motion',
      'Bottom: Hands level with chest',
      'Wrists: Neutral',
      'Shoulders: Pinched back'
    ],
    videoPlaceholder: 'dumbbell-flyes',
    alternatives: [
      { id: 'cable_flyes', name: 'Cable Flyes', reason: 'Better tension profile' },
      { id: 'pec_deck', name: 'Pec Deck', reason: 'Safer on shoulders' },
      { id: 'floor_flyes', name: 'Floor Flyes', reason: 'Shoulder-safe floor limit' }
    ]
  },
  'Chest Dips': {
    id: 'chest_dips',
    name: 'Chest Dips',
    description: 'The "squat of the upper body". Hits lower chest and triceps hard.',
    environment: 'any',
    equipment: ['Dip Station' || 'Parallel Bars'],
    muscleGroups: ['Lower Chest', 'Triceps', 'Front Delts'],
    tips: [
      'Lean forward to target chest',
      'Go to 90 degrees at elbow',
      'Do not shrug shoulders',
      'Control the descent'
    ],
    formCues: [
      'Torso: Leaning forward 30°',
      'Elbows: Slight flare allowed',
      'Head: Neutral or looking down',
      'Legs: Crossed/Bent behind'
    ],
    videoPlaceholder: 'chest-dips',
    alternatives: [
      { id: 'decline_press', name: 'Decline Press', reason: 'Weighted alternative' },
      { id: 'high_to_low_fly', name: 'High-to-Low Cable Fly', reason: 'Isolation alternative' },
      { id: 'push_ups', name: 'Push-Ups', reason: 'Easier bodyweight move' }
    ]
  },

  // --- SHOULDERS ---
  'Overhead Press': {
    id: 'overhead_press',
    name: 'Overhead Press',
    description: 'The ultimate test of shoulder and core strength. Builds complete delts.',
    environment: 'gym',
    equipment: ['Barbell', 'Rack'],
    muscleGroups: ['Front Delts', 'Side Delts', 'Triceps', 'Core'],
    tips: [
      'Squeeze glutes and abs tight',
      'Move head out of bar path',
      'Lock out elbows at top',
      'Do not lean back excessively'
    ],
    formCues: [
      'Grip: Just outside shoulders',
      'Elbows: Slightly in front of bar',
      'Path: Vertical line',
      'Breath: Big brace at bottom'
    ],
    videoPlaceholder: 'overhead-press',
    alternatives: [
      { id: 'dumbbell_shoulder_press', name: 'Dumbbell Shoulder Press', reason: 'Unilateral stability' },
      { id: 'seated_barbell_press', name: 'Seated Press', reason: 'Less core involvement' },
      { id: 'pike_pushups', name: 'Pike Pushups', reason: 'Bodyweight alternative' }
    ]
  },
  'Dumbbell Shoulder Press': {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    description: 'Great for hypertrophy and fixing strength imbalances between sides.',
    environment: 'any',
    equipment: ['Dumbbells', 'Bench' || 'Chair'],
    muscleGroups: ['Front Delts', 'Side Delts', 'Triceps'],
    tips: [
      'Keep core braced',
      'Press in a slight arc inwards',
      'Don\'t bang weights at top',
      'Lower to ear level'
    ],
    formCues: [
      'Back: Supported or rigid',
      'Elbows: Not fully flared (60°)',
      'Wrists: Stacked over elbows',
      'Tempo: Controlled negative'
    ],
    videoPlaceholder: 'db-shoulder-press',
    alternatives: [
      { id: 'overhead_press', name: 'Overhead Press', reason: 'Heavy compound' },
      { id: 'arnold_press', name: 'Arnold Press', reason: 'Hits all 3 heads' },
      { id: 'machine_press', name: 'Machine Press', reason: 'Fixed path safety' }
    ]
  },
  'Lateral Raises': {
    id: 'lateral_raises',
    name: 'Lateral Raises',
    description: 'The key to broad shoulders. Isolates the medial delt cap.',
    environment: 'any',
    equipment: ['Dumbbells'],
    muscleGroups: ['Side Delts'],
    tips: [
      'Lead with elbows, not hands',
      'Pour the pitcher motion',
      'Do not use momentum/swinging',
      'Stop just at shoulder height'
    ],
    formCues: [
      'Elbows: Slight bend',
      'Torso: Slight forward lean',
      'Hands: Lower than elbows',
      'Speed: No swinging'
    ],
    videoPlaceholder: 'lateral-raises',
    alternatives: [
      { id: 'cable_lateral_raises', name: 'Cable Lateral Raises', reason: 'Constant tension' },
      { id: 'upright_rows', name: 'Upright Rows', reason: 'Compound alternative' },
      { id: 'band_pull_aparts', name: 'Band Pull Aparts', reason: 'Home alternative' }
    ]
  },
  'Face Pulls': {
    id: 'face_pulls',
    name: 'Face Pulls',
    description: 'Crucial for shoulder health and posture. Hits rear delts and rotator cuff.',
    environment: 'any',
    equipment: ['Cable Machine' || 'Bands'],
    muscleGroups: ['Rear Delts', 'Rhomboids', 'Rotator Cuff'],
    tips: [
      'Pull towards forehead/eyes',
      'Externally rotate at end',
      'Squeeze rear delts hard',
      'Keep elbows high'
    ],
    formCues: [
      'Grip: Rope (thumbs back)',
      'Stance: Athletic/Staggered',
      'Elbows: High and wide',
      'Finish: "Double bicep" pose'
    ],
    videoPlaceholder: 'face-pulls',
    alternatives: [
      { id: 'rear_delt_fly', name: 'Rear Delt Fly', reason: 'Dumbbell alternative' },
      { id: 'band_pull_aparts', name: 'Band Pull Aparts', reason: 'Home/Warmup option' },
      { id: 'reverse_pec_deck', name: 'Reverse Pec Deck', reason: 'Machine isolation' }
    ]
  },

  // --- BACK ---
  'Pull-Ups': {
    id: 'pull_ups',
    name: 'Pull-Ups',
    description: 'The best bodyweight exercise for back width and vertical pulling strength.',
    environment: 'any',
    equipment: ['Pull-Up Bar'],
    muscleGroups: ['Lats', 'Biceps', 'Rear Delts'],
    tips: [
      'Full hang at bottom',
      'Chin over bar at top',
      'Drive elbows down to hips',
      'Engage core, no swinging'
    ],
    formCues: [
      'Grip: Just outside shoulders',
      'Shoulders: Depressed (down)',
      'Body: Hollow body position',
      'Range: Full extension'
    ],
    videoPlaceholder: 'pull-ups',
    alternatives: [
      { id: 'lat_pulldowns', name: 'Lat Pulldowns', reason: 'Adjustable weight' },
      { id: 'assisted_pullups', name: 'Assisted Pull-Ups', reason: 'Easier variation' },
      { id: 'inverted_rows', name: 'Inverted Rows', reason: 'Horizontal alternative' }
    ]
  },
  'Lat Pulldowns': {
    id: 'lat_pulldowns',
    name: 'Lat Pulldowns',
    description: 'Vertical pulling for back width, accessible to all strength levels.',
    environment: 'gym',
    equipment: ['Cable Machine', 'Lat Bar'],
    muscleGroups: ['Lats', 'Biceps', 'Rear Delts'],
    tips: [
      'Lean back slightly',
      'Pull bar to upper chest',
      'Do not use momentum',
      'Control the stretch up'
    ],
    formCues: [
      'Shoulders: Down and back',
      'Elbows: Drive straight down',
      'Grip: Wide but comfortable',
      'Torso: Fixed position'
    ],
    videoPlaceholder: 'lat-pulldowns',
    alternatives: [
      { id: 'pull_ups', name: 'Pull-Ups', reason: 'Bodyweight standard' },
      { id: 'straight_arm_pulldown', name: 'Straight Arm Pulldown', reason: 'Lat isolation' },
      { id: 'single_arm_pulldown', name: 'Single Arm Pulldown', reason: 'Unilateral focus' }
    ]
  },
  'Barbell Rows': {
    id: 'barbell_rows',
    name: 'Barbell Rows',
    description: 'Heavy compound movement for back thickness and raw power.',
    environment: 'gym',
    equipment: ['Barbell'],
    muscleGroups: ['Lats', 'Rhomboids', 'Traps', 'Biceps'],
    tips: [
      'Keep back flat/neutral',
      'Pull to lower chest/abs',
      'Keep knees slightly bent',
      'Do not jerk the weight'
    ],
    formCues: [
      'Torso: 45 to 90 degrees',
      'Grip: Double overhand',
      'Elbows: Tucked or slight flare',
      'Spine: Neutral alignment'
    ],
    videoPlaceholder: 'barbell-rows',
    alternatives: [
      { id: 'dumbbell_rows', name: 'Dumbbell Rows', reason: 'Unilateral/Back support' },
      { id: 'seated_cable_row', name: 'Seated Cable Row', reason: 'Constant tension' },
      { id: 'chest_supported_row', name: 'Chest Supported Row', reason: 'Lower back safe' }
    ]
  },
  'Dumbbell Rows': {
    id: 'dumbbell_rows',
    name: 'Dumbbell Rows',
    description: 'Unilateral row to fix imbalances and allow for a greater range of motion.',
    environment: 'any',
    equipment: ['Dumbbells', 'Bench'],
    muscleGroups: ['Lats', 'Rhomboids', 'Biceps'],
    tips: [
      'Use bench for support',
      'Pull elbow to hip pocket',
      'Stretch arm forward at bottom',
      'Keep torso parallel to floor'
    ],
    formCues: [
      'Back: Flat table top',
      'Motion: Sawing motion',
      'Head: Neutral',
      'Core: Braced'
    ],
    videoPlaceholder: 'dumbbell-rows',
    alternatives: [
      { id: 'barbell_rows', name: 'Barbell Rows', reason: 'Heavy bilateral' },
      { id: 'cable_rows', name: 'Cable Rows', reason: 'Constant tension' },
      { id: 'meadows_row', name: 'Meadows Row', reason: 'Different angle' }
    ]
  },
  'Deadlifts': {
    id: 'deadlifts',
    name: 'Deadlifts',
    description: 'The king of posterior chain exercises. Builds total body mass and strength.',
    environment: 'gym',
    equipment: ['Barbell'],
    muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back', 'Traps'],
    tips: [
      'Bar starts over mid-foot',
      'Pull slack out of bar',
      'Drive floor away with legs',
      'Keep bar close to body'
    ],
    formCues: [
      'Spine: Neutral',
      'Hips: Higher than knees',
      'Lats: Engaged (protect armpits)',
      'Lockout: Glutes squeezed'
    ],
    videoPlaceholder: 'deadlifts',
    alternatives: [
      { id: 'romanian_deadlift', name: 'Romanian Deadlift', reason: 'Hypertrophy focus' },
      { id: 'trap_bar_deadlift', name: 'Trap Bar Deadlift', reason: 'Easier mechanics' },
      { id: 'rack_pulls', name: 'Rack Pulls', reason: 'Back focus' }
    ]
  },

  // --- TRICEPS ---
  'Tricep Pushdowns': {
    id: 'tricep_pushdowns',
    name: 'Tricep Pushdowns',
    description: 'Staple isolation exercise for the lateral and medial heads of the triceps.',
    environment: 'gym',
    equipment: ['Cable Machine', 'Rope' || 'Bar'],
    muscleGroups: ['Triceps'],
    tips: [
      'Keep elbows pinned to sides',
      'Only move forearms',
      'Squeeze hard at bottom',
      'Control the way up'
    ],
    formCues: [
      'Stance: Athletic base',
      'Elbows: Fixed hinge',
      'Shoulders: Down',
      'Range: Full extension'
    ],
    videoPlaceholder: 'tricep-pushdowns',
    alternatives: [
      { id: 'skull_crushers', name: 'Skull Crushers', reason: 'Free weight alternative' },
      { id: 'diamond_pushups', name: 'Diamond Pushups', reason: 'Bodyweight alternative' },
      { id: 'kickbacks', name: 'Tricep Kickbacks', reason: 'Dumbbell alternative' }
    ]
  },
  'Skull Crushers': {
    id: 'skull_crushers',
    name: 'Skull Crushers',
    description: 'Targets the long head of the triceps for arm size.',
    environment: 'any',
    equipment: ['Barbell' || 'EZ Bar' || 'Dumbbells', 'Bench'],
    muscleGroups: ['Triceps'],
    tips: [
      'Lower bar to forehead or behind head',
      'Keep elbows pointing up',
      'Do not flare elbows too wide',
      'Drive weight back up'
    ],
    formCues: [
      'Grip: Shoulder width',
      'Elbows: Tucked in',
      'Path: Arc to forehead',
      'Wrists: Strong/Straight'
    ],
    videoPlaceholder: 'skull-crushers',
    alternatives: [
      { id: 'overhead_extension', name: 'Overhead Extension', reason: 'Similar stretch' },
      { id: 'close_grip_bench', name: 'Close Grip Bench', reason: 'Compound mass' },
      { id: 'cable_overhead', name: 'Cable Overhead', reason: 'Joint friendly' }
    ]
  },

  // --- BICEPS ---
  'Barbell Curls': {
    id: 'barbell_curls',
    name: 'Barbell Curls',
    description: 'The standard mass builder for biceps.',
    environment: 'any',
    equipment: ['Barbell'],
    muscleGroups: ['Biceps'],
    tips: [
      'Keep elbows at sides',
      'Do not swing body',
      'Squeeze at top',
      'Lower all the way down'
    ],
    formCues: [
      'Grip: Shoulder width',
      'Elbows: Fixed',
      'Torso: Upright',
      'Wrists: Supinated (Palms up)'
    ],
    videoPlaceholder: 'barbell-curls',
    alternatives: [
      { id: 'dumbbell_curls', name: 'Dumbbell Curls', reason: 'Unilateral freedom' },
      { id: 'cable_curls', name: 'Cable Curls', reason: 'Constant tension' },
      { id: 'chin_ups', name: 'Chin Ups', reason: 'Compound builder' }
    ]
  },
  'Hammer Curls': {
    id: 'hammer_curls',
    name: 'Hammer Curls',
    description: 'Targets the brachialis and brachioradialis for arm thickness.',
    environment: 'any',
    equipment: ['Dumbbells'],
    muscleGroups: ['Biceps', 'Brachialis', 'Forearms'],
    tips: [
      'Palms face each other',
      'Keep elbows pinned',
      'Control the swing',
      'Squeeze forearm at top'
    ],
    formCues: [
      'Grip: Neutral (Hammer)',
      'Motion: Arc to shoulder',
      'Elbows: Stationary',
      'Tempo: Controlled'
    ],
    videoPlaceholder: 'hammer-curls',
    alternatives: [
      { id: 'reverse_curls', name: 'Reverse Curls', reason: 'Forearm focus' },
      { id: 'rope_hammer_curls', name: 'Rope Hammer Curls', reason: 'Cable version' },
      { id: 'cross_body_curls', name: 'Cross Body Curls', reason: 'Brachialis focus' }
    ]
  },

  // --- LEGS ---
  'Squats': {
    id: 'squats',
    name: 'Squats',
    description: 'The king of all exercises. Builds massive legs and core strength.',
    environment: 'gym',
    equipment: ['Barbell', 'Rack'],
    muscleGroups: ['Quads', 'Glutes', 'Core', 'Hamstrings'],
    tips: [
      'Keep chest up',
      'Drive knees out',
      'Break parallel depth',
      'Brace core hard'
    ],
    formCues: [
      'Feet: Shoulder width',
      'Spine: Neutral',
      'Path: Vertical bar path',
      'Heels: Planted'
    ],
    videoPlaceholder: 'squats',
    alternatives: [
      { id: 'leg_press', name: 'Leg Press', reason: 'Back friendly' },
      { id: 'goblet_squats', name: 'Goblet Squats', reason: 'Beginner friendly' },
      { id: 'split_squats', name: 'Split Squats', reason: 'Unilateral' }
    ]
  },
  'Leg Press': {
    id: 'leg_press',
    name: 'Leg Press',
    description: 'Heavy leg builder that removes spinal loading.',
    environment: 'gym',
    equipment: ['Leg Press Machine'],
    muscleGroups: ['Quads', 'Glutes'],
    tips: [
      'Do not lock out knees',
      'Lower sled as deep as possible',
      'Keep lower back on pad',
      'Drive through heels'
    ],
    formCues: [
      'Feet: Shoulder width on platform',
      'Knees: Tracking over toes',
      'Back: Flat against seat',
      'Depth: 90 degrees or more'
    ],
    videoPlaceholder: 'leg-press',
    alternatives: [
      { id: 'squats', name: 'Squats', reason: 'Free weight king' },
      { id: 'hack_squat', name: 'Hack Squat', reason: 'Machine alternative' },
      { id: 'lunges', name: 'Lunges', reason: 'Functional alternative' }
    ]
  },
  'Romanian Deadlifts': {
    id: 'romanian_deadlifts',
    name: 'Romanian Deadlifts',
    description: 'Hip-hinge movement that builds flexible, strong hamstrings and glutes.',
    environment: 'any',
    equipment: ['Barbell' || 'Dumbbells'],
    muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'],
    tips: [
      'Soft bend in knees',
      'Push hips back as far as possible',
      'Keep back flat',
      'Feel the hamstring stretch'
    ],
    formCues: [
      'Hinge: Hips go back',
      'Spine: Neutral',
      'Bar: Slides down legs',
      'Range: Until hamstrings tight'
    ],
    videoPlaceholder: 'romanian-deadlifts',
    alternatives: [
      { id: 'leg_curls', name: 'Leg Curls', reason: 'Machine isolation' },
      { id: 'good_mornings', name: 'Good Mornings', reason: 'Barbell variation' },
      { id: 'kettlebell_swing', name: 'Kettlebell Swing', reason: 'Dynamic hinge' }
    ]
  },
  'Leg Curls': {
    id: 'leg_curls',
    name: 'Leg Curls',
    description: 'Isolates the hamstrings through knee flexion.',
    environment: 'gym',
    equipment: ['Leg Curl Machine'],
    muscleGroups: ['Hamstrings'],
    tips: [
      'Keep hips down on pad',
      'Control the negative',
      'Squeeze hamstrings at contraction',
      'Do not use momentum'
    ],
    formCues: [
      'Hips: Pressed into bench',
      'Knees: Aligned with pivot',
      'Toes: Dorsiflexed (up)',
      'Tempo: Slow'
    ],
    videoPlaceholder: 'leg-curls',
    alternatives: [
      { id: 'romanian_deadlifts', name: 'RDLs', reason: 'Compound stretch' },
      { id: 'nordic_curls', name: 'Nordic Curls', reason: 'Bodyweight advanced' },
      { id: 'ball_curls', name: 'Swiss Ball Curls', reason: 'Home option' }
    ]
  },
  'Leg Extensions': {
    id: 'leg_extensions',
    name: 'Leg Extensions',
    description: 'Isolation exercise for quad definition and strength.',
    environment: 'gym',
    equipment: ['Leg Extension Machine'],
    muscleGroups: ['Quads'],
    tips: [
      'Squeeze quads at top',
      'Control weight down',
      'Keep butt in seat',
      'Adjust pad to ankle'
    ],
    formCues: [
      'Back: Against pad',
      'Pivot: Aligned with knee',
      'Toes: Up',
      'Top: Brief pause'
    ],
    videoPlaceholder: 'leg-extensions',
    alternatives: [
      { id: 'sissy_squats', name: 'Sissy Squats', reason: 'Bodyweight isolation' },
      { id: 'lunges', name: 'Lunges', reason: 'Compound functional' },
      { id: 'goblet_squats', name: 'Goblet Squats', reason: 'Free weight' }
    ]
  },
  'Calf Raises': {
    id: 'calf_raises',
    name: 'Calf Raises',
    description: 'Essential for lower leg development.',
    environment: 'any',
    equipment: ['Machine' || 'Dumbbell' || 'Bodyweight'],
    muscleGroups: ['Calves'],
    tips: [
      'Full stretch at bottom',
      'Full contraction at top',
      'Pause at the top',
      'Do not bounce'
    ],
    formCues: [
      'Knees: Straight (standing) / Bent (seated)',
      'Ankles: Full ROM',
      'Tempo: Slow',
      'Balance: Hold support if needed'
    ],
    videoPlaceholder: 'calf-raises',
    alternatives: [
      { id: 'seated_calf_raises', name: 'Seated Calf Raises', reason: 'Soleus focus' },
      { id: 'donkey_calf_raises', name: 'Donkey Calf Raises', reason: 'Stretch focus' },
      { id: 'jump_rope', name: 'Jump Rope', reason: 'Athletic/Cardio' }
    ]
  },
  'Lunges': {
    id: 'lunges',
    name: 'Lunges',
    description: 'Functional unilateral leg exercise for balance and glutes.',
    environment: 'any',
    equipment: ['Dumbbells' || 'Bodyweight'],
    muscleGroups: ['Quads', 'Glutes', 'Hamstrings'],
    tips: [
      'Keep torso upright',
      'Knee touches floor gently',
      'Drive through front heel',
      'Keep core braced'
    ],
    formCues: [
      'Step: Long stride',
      'Knees: 90 degree angles',
      'Chest: Up',
      'Width: Hip width'
    ],
    videoPlaceholder: 'lunges',
    alternatives: [
      { id: 'split_squats', name: 'Bulgarian Split Squats', reason: 'Stationary intensity' },
      { id: 'step_ups', name: 'Step Ups', reason: 'Glute focus' },
      { id: 'reverse_lunges', name: 'Reverse Lunges', reason: 'Knee friendly' }
    ]
  }
};

/**
 * Helper to safely get exercise info
 *
 * @deprecated Use `getExerciseInfo` from '@/hooks/useExercises' instead.
 *             This function uses static data and doesn't reflect database updates.
 *             The hook-based version uses cached data from CloudExerciseService.
 */
export function getExerciseInfo(exerciseName: string): ExerciseDetail {
  console.warn(
    '[DEPRECATED] getExerciseInfo from constants/exercises.ts is deprecated. ' +
    'Use getExerciseInfo from @/hooks/useExercises instead.'
  );
  
  // Direct lookup
  if (EXERCISE_DATABASE[exerciseName]) {
    return EXERCISE_DATABASE[exerciseName];
  }

  // Case-insensitive lookup
  const lowerName = exerciseName.toLowerCase();
  const matchedKey = Object.keys(EXERCISE_DATABASE).find(
    key => key.toLowerCase() === lowerName
  );
  
  if (matchedKey) {
    return EXERCISE_DATABASE[matchedKey];
  }

  // Default fallback
  return {
    id: 'unknown',
    name: exerciseName,
    description: 'Exercise details not found.',
    environment: 'any',
    equipment: [],
    muscleGroups: ['General'],
    tips: ['Maintain good form'],
    formCues: [],
    videoPlaceholder: 'placeholder',
    alternatives: []
  };
}