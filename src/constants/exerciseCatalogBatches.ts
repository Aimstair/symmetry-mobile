/**
 * Comprehensive exercise catalog batches for bulk seeding.
 *
 * Notes:
 * - This file is schema-aligned to the `exercises` and `exercise_alternatives` tables.
 * - It is intended for content generation/import workflows, not direct UI rendering.
 * - Alternatives are generated automatically to ensure complete coverage.
 */

export type ExerciseEnvironment = 'gym' | 'home' | 'any';

export interface ExerciseSeed {
  id: string;
  name: string;
  description: string;
  environment: ExerciseEnvironment;
  equipment: string[];
  muscleGroups: string[];
  tips: string[];
  formCues: string[];
  videoUrl: string;
  family: string;
}

export interface ExerciseAlternativeSeed {
  exerciseId: string;
  alternativeId: string;
  reason: string;
}

export interface ExerciseBatch {
  id: 'batch1' | 'batch2' | 'batch3' | 'batch4';
  title: string;
  scope: string;
  exercises: ExerciseSeed[];
}

type ExerciseInput = Omit<ExerciseSeed, 'tips' | 'formCues' | 'videoUrl'> & {
  tips?: string[];
  formCues?: string[];
  videoUrl?: string;
};

const DEFAULT_TIPS = [
  'Use a controlled eccentric and avoid momentum.',
  'Brace your core before every rep.',
  'Stop each set with 1-2 reps in reserve unless otherwise programmed.',
  'Use full range of motion that you can control pain-free.',
];

const DEFAULT_FORM_CUES = [
  'Set your base before initiating each rep.',
  'Keep joints stacked through the movement path.',
  'Maintain neutral spine and stable ribcage.',
  'Own the top and bottom positions briefly.',
];

const makeExercise = (input: ExerciseInput): ExerciseSeed => ({
  ...input,
  tips: input.tips && input.tips.length > 0 ? input.tips : DEFAULT_TIPS,
  formCues: input.formCues && input.formCues.length > 0 ? input.formCues : DEFAULT_FORM_CUES,
  videoUrl: input.videoUrl || input.id.replace(/_/g, '-'),
});

const BATCH_1_EXERCISES: ExerciseSeed[] = [
  // Chest: all common equipment + angle/grip variants
  makeExercise({ id: 'bench_press_barbell_flat', name: 'Bench Press (Barbell Flat)', description: 'Primary horizontal press for global chest and triceps strength.', environment: 'gym', equipment: ['Barbell', 'Flat Bench', 'Rack'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'bench_press_barbell_incline_30', name: 'Bench Press (Barbell Incline 30°)', description: 'Upper chest focused barbell press using a shallow incline.', environment: 'gym', equipment: ['Barbell', 'Incline Bench', 'Rack'], muscleGroups: ['Upper Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'bench_press_barbell_decline', name: 'Bench Press (Barbell Decline)', description: 'Decline pressing pattern emphasizing lower chest fibers.', environment: 'gym', equipment: ['Barbell', 'Decline Bench', 'Rack'], muscleGroups: ['Lower Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'bench_press_dumbbell_flat', name: 'Bench Press (Dumbbell Flat)', description: 'Unilateral-friendly chest press with greater ROM than barbell.', environment: 'any', equipment: ['Dumbbells', 'Flat Bench'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'bench_press_dumbbell_incline_30', name: 'Bench Press (Dumbbell Incline 30°)', description: 'Upper chest hypertrophy press with independent arm path.', environment: 'any', equipment: ['Dumbbells', 'Incline Bench'], muscleGroups: ['Upper Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'bench_press_dumbbell_decline', name: 'Bench Press (Dumbbell Decline)', description: 'Decline dumbbell press for lower chest focus and adduction.', environment: 'gym', equipment: ['Dumbbells', 'Decline Bench'], muscleGroups: ['Lower Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'bench_press_smith_flat', name: 'Bench Press (Smith Flat)', description: 'Guided chest press pattern for stability and fatigue sets.', environment: 'gym', equipment: ['Smith Machine', 'Flat Bench'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'chest_press_machine', name: 'Chest Press (Machine)', description: 'Stable fixed-path chest press ideal for hypertrophy volume.', environment: 'gym', equipment: ['Chest Press Machine'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'incline_chest_press_machine', name: 'Incline Chest Press (Machine)', description: 'Machine incline press variant for upper chest emphasis.', environment: 'gym', equipment: ['Incline Press Machine'], muscleGroups: ['Upper Chest', 'Triceps', 'Front Delts'], family: 'chest_press' }),
  makeExercise({ id: 'push_up_standard', name: 'Push-Up (Standard)', description: 'Foundational bodyweight horizontal pressing movement.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Chest', 'Triceps', 'Front Delts', 'Core'], family: 'push_up' }),
  makeExercise({ id: 'push_up_decline', name: 'Push-Up (Decline)', description: 'Decline push-up variation to bias upper chest and delts.', environment: 'home', equipment: ['Bodyweight', 'Bench or Box'], muscleGroups: ['Upper Chest', 'Triceps', 'Front Delts', 'Core'], family: 'push_up' }),
  makeExercise({ id: 'push_up_deficit', name: 'Push-Up (Deficit)', description: 'Deficit push-up for increased chest stretch and ROM.', environment: 'home', equipment: ['Bodyweight', 'Parallettes or Blocks'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'push_up' }),
  makeExercise({ id: 'push_up_diamond', name: 'Push-Up (Diamond)', description: 'Close-hand push-up emphasizing triceps and inner chest.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Triceps', 'Chest', 'Front Delts'], family: 'push_up' }),
  makeExercise({ id: 'dip_chest', name: 'Dip (Chest Lean)', description: 'Forward-lean dip to emphasize lower chest pressing.', environment: 'any', equipment: ['Dip Bars'], muscleGroups: ['Lower Chest', 'Triceps', 'Front Delts'], family: 'dip' }),
  makeExercise({ id: 'pec_deck_fly', name: 'Pec Deck Fly', description: 'Machine adduction pattern with stable shoulder position.', environment: 'gym', equipment: ['Pec Deck Machine'], muscleGroups: ['Chest', 'Front Delts'], family: 'chest_fly' }),
  makeExercise({ id: 'cable_fly_mid', name: 'Cable Fly (Midline)', description: 'Cable fly at chest-height for mid-pec adduction tension.', environment: 'gym', equipment: ['Cable Station'], muscleGroups: ['Chest', 'Front Delts'], family: 'chest_fly' }),
  makeExercise({ id: 'cable_fly_high_to_low', name: 'Cable Fly (High to Low)', description: 'Downward adduction cable fly with lower-chest bias.', environment: 'gym', equipment: ['Cable Station'], muscleGroups: ['Lower Chest', 'Front Delts'], family: 'chest_fly' }),
  makeExercise({ id: 'cable_fly_low_to_high', name: 'Cable Fly (Low to High)', description: 'Upward adduction cable fly with upper-chest bias.', environment: 'gym', equipment: ['Cable Station'], muscleGroups: ['Upper Chest', 'Front Delts'], family: 'chest_fly' }),
  makeExercise({ id: 'dumbbell_fly_flat', name: 'Dumbbell Fly (Flat)', description: 'Free-weight chest fly for lengthened pec loading.', environment: 'any', equipment: ['Dumbbells', 'Flat Bench'], muscleGroups: ['Chest', 'Front Delts'], family: 'chest_fly' }),
  makeExercise({ id: 'dumbbell_fly_incline', name: 'Dumbbell Fly (Incline)', description: 'Incline fly variation for upper chest hypertrophy.', environment: 'any', equipment: ['Dumbbells', 'Incline Bench'], muscleGroups: ['Upper Chest', 'Front Delts'], family: 'chest_fly' }),
  makeExercise({ id: 'svend_press_plate', name: 'Svend Press (Plate)', description: 'Adduction-driven pressing with plate squeeze tension.', environment: 'any', equipment: ['Weight Plate'], muscleGroups: ['Chest', 'Front Delts', 'Triceps'], family: 'chest_press' }),
  makeExercise({ id: 'landmine_press_single_arm', name: 'Landmine Press (Single Arm)', description: 'Arcing press pattern combining chest, delt, and core demand.', environment: 'gym', equipment: ['Barbell', 'Landmine Base'], muscleGroups: ['Upper Chest', 'Front Delts', 'Triceps', 'Core'], family: 'chest_press' }),

  // Back: vertical/horizontal pulling variants
  makeExercise({ id: 'pull_up_pronated', name: 'Pull-Up (Pronated)', description: 'Bodyweight vertical pull emphasizing lats and upper back.', environment: 'any', equipment: ['Pull-Up Bar'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'vertical_pull' }),
  makeExercise({ id: 'chin_up_supinated', name: 'Chin-Up (Supinated)', description: 'Supinated vertical pull with increased elbow flexor demand.', environment: 'any', equipment: ['Pull-Up Bar'], muscleGroups: ['Lats', 'Biceps', 'Upper Back'], family: 'vertical_pull' }),
  makeExercise({ id: 'pull_up_neutral_grip', name: 'Pull-Up (Neutral Grip)', description: 'Neutral grip vertical pull often easier on shoulders.', environment: 'any', equipment: ['Neutral Pull-Up Handles'], muscleGroups: ['Lats', 'Biceps', 'Upper Back'], family: 'vertical_pull' }),
  makeExercise({ id: 'pull_up_weighted', name: 'Pull-Up (Weighted)', description: 'Progressive overload pull-up variation using external load.', environment: 'gym', equipment: ['Pull-Up Bar', 'Dip Belt'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'vertical_pull' }),
  makeExercise({ id: 'assisted_pull_up_machine', name: 'Pull-Up (Assisted Machine)', description: 'Machine-assisted pull-up for scaling volume and technique.', environment: 'gym', equipment: ['Assisted Pull-Up Machine'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'vertical_pull' }),
  makeExercise({ id: 'lat_pulldown_wide_pronated', name: 'Lat Pulldown (Wide Pronated)', description: 'Wide pulldown variation targeting lat width and upper back.', environment: 'gym', equipment: ['Cable Station', 'Lat Bar'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'vertical_pull' }),
  makeExercise({ id: 'lat_pulldown_close_supinated', name: 'Lat Pulldown (Close Supinated)', description: 'Close underhand pulldown emphasizing lower lats and biceps.', environment: 'gym', equipment: ['Cable Station', 'Lat Bar'], muscleGroups: ['Lats', 'Biceps', 'Upper Back'], family: 'vertical_pull' }),
  makeExercise({ id: 'lat_pulldown_neutral_vbar', name: 'Lat Pulldown (Neutral V-Bar)', description: 'Neutral handle pulldown with balanced back and arm stimulus.', environment: 'gym', equipment: ['Cable Station', 'V-Bar Attachment'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'vertical_pull' }),
  makeExercise({ id: 'single_arm_lat_pulldown_cable', name: 'Lat Pulldown (Single Arm Cable)', description: 'Unilateral lat pulldown to improve side-to-side symmetry.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'vertical_pull' }),
  makeExercise({ id: 'barbell_row_pronated', name: 'Barbell Row (Pronated)', description: 'Hip-hinged row for mid-back thickness and pulling strength.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Upper Back', 'Lats', 'Biceps', 'Posterior Chain'], family: 'horizontal_pull' }),
  makeExercise({ id: 'barbell_row_supinated', name: 'Barbell Row (Supinated)', description: 'Underhand row variation increasing lat and biceps contribution.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'pendlay_row', name: 'Pendlay Row', description: 'Explosive dead-stop row from floor for power and back strength.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Upper Back', 'Lats', 'Biceps', 'Posterior Chain'], family: 'horizontal_pull' }),
  makeExercise({ id: 'tbar_row_chest_supported', name: 'T-Bar Row (Chest Supported)', description: 'Supported row minimizing lower-back fatigue while loading lats.', environment: 'gym', equipment: ['T-Bar Row Machine'], muscleGroups: ['Upper Back', 'Lats', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'seated_cable_row_close', name: 'Seated Cable Row (Close)', description: 'Cable row variant for lat density and scapular control.', environment: 'gym', equipment: ['Cable Station', 'V-Bar Attachment'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'seated_cable_row_wide', name: 'Seated Cable Row (Wide)', description: 'Wide cable row emphasizing upper-back retraction.', environment: 'gym', equipment: ['Cable Station', 'Wide Handle'], muscleGroups: ['Upper Back', 'Rear Delts', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'single_arm_cable_row', name: 'Cable Row (Single Arm)', description: 'Unilateral cable row for scap control and asymmetry correction.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'dumbbell_row_single_arm', name: 'Dumbbell Row (Single Arm)', description: 'Classic unilateral row with high lat stretch potential.', environment: 'any', equipment: ['Dumbbell', 'Bench'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'dumbbell_row_chest_supported', name: 'Dumbbell Row (Chest Supported)', description: 'Supported dumbbell row reducing lumbar loading.', environment: 'any', equipment: ['Dumbbells', 'Incline Bench'], muscleGroups: ['Upper Back', 'Lats', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'machine_row_plate_loaded', name: 'Machine Row (Plate Loaded)', description: 'Stable machine row for heavy controlled horizontal pulling.', environment: 'gym', equipment: ['Plate Loaded Row Machine'], muscleGroups: ['Upper Back', 'Lats', 'Biceps'], family: 'horizontal_pull' }),
  makeExercise({ id: 'straight_arm_pulldown', name: 'Straight-Arm Pulldown', description: 'Lat isolation movement focused on shoulder extension.', environment: 'gym', equipment: ['Cable Station', 'Straight Bar'], muscleGroups: ['Lats', 'Teres Major'], family: 'lat_isolation' }),
  makeExercise({ id: 'back_extension_45deg', name: 'Back Extension (45°)', description: 'Posterior-chain extension targeting spinal erectors and glutes.', environment: 'gym', equipment: ['45 Degree Back Extension Bench'], muscleGroups: ['Lower Back', 'Glutes', 'Hamstrings'], family: 'posterior_chain' }),

  // Shoulders: pressing + delt isolation variants
  makeExercise({ id: 'overhead_press_barbell_standing', name: 'Overhead Press (Barbell Standing)', description: 'Standing vertical press for delt strength and full-body bracing.', environment: 'gym', equipment: ['Barbell', 'Rack'], muscleGroups: ['Front Delts', 'Side Delts', 'Triceps', 'Core'], family: 'shoulder_press' }),
  makeExercise({ id: 'overhead_press_barbell_seated', name: 'Overhead Press (Barbell Seated)', description: 'Seated barbell shoulder press reducing lower-body contribution.', environment: 'gym', equipment: ['Barbell', 'Bench', 'Rack'], muscleGroups: ['Front Delts', 'Side Delts', 'Triceps'], family: 'shoulder_press' }),
  makeExercise({ id: 'shoulder_press_dumbbell_seated', name: 'Shoulder Press (Dumbbell Seated)', description: 'Unilateral-friendly seated press for delt hypertrophy.', environment: 'any', equipment: ['Dumbbells', 'Bench'], muscleGroups: ['Front Delts', 'Side Delts', 'Triceps'], family: 'shoulder_press' }),
  makeExercise({ id: 'shoulder_press_dumbbell_standing', name: 'Shoulder Press (Dumbbell Standing)', description: 'Standing dumbbell press with greater stabilization demand.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Front Delts', 'Side Delts', 'Triceps', 'Core'], family: 'shoulder_press' }),
  makeExercise({ id: 'arnold_press', name: 'Arnold Press', description: 'Rotational dumbbell press increasing delt ROM and control.', environment: 'any', equipment: ['Dumbbells', 'Bench'], muscleGroups: ['Front Delts', 'Side Delts', 'Triceps'], family: 'shoulder_press' }),
  makeExercise({ id: 'machine_shoulder_press', name: 'Shoulder Press (Machine)', description: 'Fixed-path vertical press for safe shoulder volume work.', environment: 'gym', equipment: ['Shoulder Press Machine'], muscleGroups: ['Front Delts', 'Side Delts', 'Triceps'], family: 'shoulder_press' }),
  makeExercise({ id: 'landmine_press_half_kneeling', name: 'Landmine Press (Half Kneeling)', description: 'Scap-friendly pressing path with anti-rotation core demand.', environment: 'gym', equipment: ['Barbell', 'Landmine Base'], muscleGroups: ['Front Delts', 'Upper Chest', 'Triceps', 'Core'], family: 'shoulder_press' }),
  makeExercise({ id: 'lateral_raise_dumbbell', name: 'Lateral Raise (Dumbbell)', description: 'Foundational side-delt isolation with free-weight resistance.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Side Delts'], family: 'side_delt' }),
  makeExercise({ id: 'lateral_raise_cable_single', name: 'Lateral Raise (Cable Single Arm)', description: 'Cable side-delt raise with continuous tension profile.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Side Delts'], family: 'side_delt' }),
  makeExercise({ id: 'lateral_raise_machine', name: 'Lateral Raise (Machine)', description: 'Machine delt raise for controlled side-delt loading.', environment: 'gym', equipment: ['Lateral Raise Machine'], muscleGroups: ['Side Delts'], family: 'side_delt' }),
  makeExercise({ id: 'upright_row_barbell', name: 'Upright Row (Barbell)', description: 'Vertical pull pattern training delts and upper traps.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Side Delts', 'Upper Traps', 'Front Delts'], family: 'upper_trap_pull' }),
  makeExercise({ id: 'upright_row_cable', name: 'Upright Row (Cable)', description: 'Cable upright row with smoother strength curve and tension.', environment: 'gym', equipment: ['Cable Station', 'Straight Bar'], muscleGroups: ['Side Delts', 'Upper Traps', 'Front Delts'], family: 'upper_trap_pull' }),
  makeExercise({ id: 'rear_delt_fly_dumbbell', name: 'Rear Delt Fly (Dumbbell)', description: 'Bent-over rear-delt isolation for posterior shoulder development.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Rear Delts', 'Upper Back'], family: 'rear_delt' }),
  makeExercise({ id: 'rear_delt_fly_reverse_pec_deck', name: 'Rear Delt Fly (Reverse Pec Deck)', description: 'Machine rear-delt pattern with stable torso support.', environment: 'gym', equipment: ['Reverse Pec Deck'], muscleGroups: ['Rear Delts', 'Upper Back'], family: 'rear_delt' }),
  makeExercise({ id: 'rear_delt_fly_cable_cross', name: 'Rear Delt Fly (Cable Cross)', description: 'Cable rear-delt fly maximizing tension in shortened position.', environment: 'gym', equipment: ['Cable Station', 'Single Handles'], muscleGroups: ['Rear Delts', 'Upper Back'], family: 'rear_delt' }),
  makeExercise({ id: 'face_pull_rope', name: 'Face Pull (Rope)', description: 'Scapular and rear-delt movement supporting shoulder health.', environment: 'any', equipment: ['Cable Station or Band', 'Rope or Band'], muscleGroups: ['Rear Delts', 'Mid Traps', 'External Rotators'], family: 'rear_delt' }),
  makeExercise({ id: 'front_raise_dumbbell', name: 'Front Raise (Dumbbell)', description: 'Anterior delt isolation movement with free weights.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Front Delts'], family: 'front_delt' }),
  makeExercise({ id: 'front_raise_plate', name: 'Front Raise (Plate)', description: 'Front-delt raise using plate for bilateral loading.', environment: 'any', equipment: ['Weight Plate'], muscleGroups: ['Front Delts'], family: 'front_delt' }),
  makeExercise({ id: 'y_raise_incline', name: 'Y Raise (Incline)', description: 'Lower trap and rear-delt biased shoulder stability raise.', environment: 'any', equipment: ['Dumbbells', 'Incline Bench'], muscleGroups: ['Lower Traps', 'Rear Delts', 'Rotator Cuff'], family: 'rear_delt' }),
];

const BATCH_2_EXERCISES: ExerciseSeed[] = [
  // Squat and knee-dominant families
  makeExercise({ id: 'back_squat_barbell', name: 'Back Squat (Barbell)', description: 'Primary bilateral squat pattern for full lower-body strength.', environment: 'gym', equipment: ['Barbell', 'Rack'], muscleGroups: ['Quads', 'Glutes', 'Adductors', 'Core'], family: 'squat' }),
  makeExercise({ id: 'front_squat_barbell', name: 'Front Squat (Barbell)', description: 'Anterior-loaded squat emphasizing quads and trunk stiffness.', environment: 'gym', equipment: ['Barbell', 'Rack'], muscleGroups: ['Quads', 'Glutes', 'Core'], family: 'squat' }),
  makeExercise({ id: 'goblet_squat_dumbbell', name: 'Goblet Squat (Dumbbell)', description: 'Accessible squat pattern with front-loaded torso support.', environment: 'any', equipment: ['Dumbbell or Kettlebell'], muscleGroups: ['Quads', 'Glutes', 'Core'], family: 'squat' }),
  makeExercise({ id: 'hack_squat_machine', name: 'Hack Squat (Machine)', description: 'Guided squat variation for quad-focused hypertrophy.', environment: 'gym', equipment: ['Hack Squat Machine'], muscleGroups: ['Quads', 'Glutes'], family: 'squat' }),
  makeExercise({ id: 'smith_squat', name: 'Smith Squat', description: 'Fixed-path squat option for controlled volume work.', environment: 'gym', equipment: ['Smith Machine'], muscleGroups: ['Quads', 'Glutes'], family: 'squat' }),
  makeExercise({ id: 'leg_press_45', name: 'Leg Press (45°)', description: 'High-load lower-body press minimizing spinal loading.', environment: 'gym', equipment: ['45 Degree Leg Press'], muscleGroups: ['Quads', 'Glutes', 'Adductors'], family: 'squat' }),
  makeExercise({ id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', description: 'Rear-foot elevated unilateral squat for quad and glute focus.', environment: 'any', equipment: ['Dumbbells', 'Bench'], muscleGroups: ['Quads', 'Glutes', 'Adductors'], family: 'single_leg_knee' }),
  makeExercise({ id: 'walking_lunge_dumbbell', name: 'Walking Lunge (Dumbbell)', description: 'Dynamic unilateral lunge for leg development and stability.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Quads', 'Glutes', 'Hamstrings', 'Core'], family: 'single_leg_knee' }),
  makeExercise({ id: 'reverse_lunge_dumbbell', name: 'Reverse Lunge (Dumbbell)', description: 'Hip-friendly lunge variation with strong glute contribution.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Glutes', 'Quads', 'Hamstrings'], family: 'single_leg_knee' }),
  makeExercise({ id: 'step_up_dumbbell', name: 'Step-Up (Dumbbell)', description: 'Unilateral step pattern with strong glute and quad demand.', environment: 'any', equipment: ['Dumbbells', 'Box'], muscleGroups: ['Glutes', 'Quads', 'Hamstrings'], family: 'single_leg_knee' }),

  // Hip-hinge and posterior chain
  makeExercise({ id: 'deadlift_conventional', name: 'Deadlift (Conventional)', description: 'Foundational hinge pattern for posterior-chain strength.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Glutes', 'Hamstrings', 'Lower Back', 'Upper Back'], family: 'hinge' }),
  makeExercise({ id: 'deadlift_sumo', name: 'Deadlift (Sumo)', description: 'Wide-stance deadlift reducing ROM and increasing adductor load.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Glutes', 'Adductors', 'Quads', 'Lower Back'], family: 'hinge' }),
  makeExercise({ id: 'trap_bar_deadlift', name: 'Deadlift (Trap Bar)', description: 'Neutral-grip deadlift with balanced knee and hip contribution.', environment: 'gym', equipment: ['Trap Bar'], muscleGroups: ['Quads', 'Glutes', 'Hamstrings', 'Upper Back'], family: 'hinge' }),
  makeExercise({ id: 'romanian_deadlift_barbell', name: 'Romanian Deadlift (Barbell)', description: 'Hip hinge emphasizing hamstring lengthened loading.', environment: 'gym', equipment: ['Barbell'], muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'], family: 'hinge' }),
  makeExercise({ id: 'romanian_deadlift_dumbbell', name: 'Romanian Deadlift (Dumbbell)', description: 'Dumbbell hinge variant improving ROM and control.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'], family: 'hinge' }),
  makeExercise({ id: 'single_leg_rdl_dumbbell', name: 'Single-Leg RDL (Dumbbell)', description: 'Unilateral hinge for hamstrings, glutes, and balance.', environment: 'any', equipment: ['Dumbbell'], muscleGroups: ['Hamstrings', 'Glutes', 'Core'], family: 'hinge' }),
  makeExercise({ id: 'good_morning_barbell', name: 'Good Morning (Barbell)', description: 'Hinge pattern training posterior-chain endurance and strength.', environment: 'gym', equipment: ['Barbell', 'Rack'], muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'], family: 'hinge' }),
  makeExercise({ id: 'hip_thrust_barbell', name: 'Hip Thrust (Barbell)', description: 'Glute-dominant hip extension with high terminal tension.', environment: 'gym', equipment: ['Barbell', 'Bench'], muscleGroups: ['Glutes', 'Hamstrings'], family: 'glute_extension' }),
  makeExercise({ id: 'glute_bridge_barbell', name: 'Glute Bridge (Barbell)', description: 'Shorter-ROM glute extension suitable for high-volume sets.', environment: 'any', equipment: ['Barbell or Dumbbell'], muscleGroups: ['Glutes', 'Hamstrings'], family: 'glute_extension' }),
  makeExercise({ id: 'cable_pull_through', name: 'Cable Pull-Through', description: 'Cable hinge emphasizing glutes through hip extension.', environment: 'gym', equipment: ['Cable Station', 'Rope'], muscleGroups: ['Glutes', 'Hamstrings'], family: 'glute_extension' }),
  makeExercise({ id: 'glute_kickback_cable', name: 'Glute Kickback (Cable)', description: 'Isolation hip-extension movement for glute maximus focus.', environment: 'gym', equipment: ['Cable Station', 'Ankle Cuff'], muscleGroups: ['Glutes'], family: 'glute_isolation' }),

  // Knee flexion/extension accessories
  makeExercise({ id: 'leg_curl_lying', name: 'Leg Curl (Lying)', description: 'Hamstring knee-flexion machine variant in prone position.', environment: 'gym', equipment: ['Lying Leg Curl Machine'], muscleGroups: ['Hamstrings'], family: 'hamstring_curl' }),
  makeExercise({ id: 'leg_curl_seated', name: 'Leg Curl (Seated)', description: 'Seated hamstring curl with lengthened-position loading.', environment: 'gym', equipment: ['Seated Leg Curl Machine'], muscleGroups: ['Hamstrings'], family: 'hamstring_curl' }),
  makeExercise({ id: 'nordic_curl', name: 'Nordic Curl', description: 'High-demand eccentric hamstring bodyweight curl pattern.', environment: 'home', equipment: ['Bodyweight', 'Anchor'], muscleGroups: ['Hamstrings', 'Glutes'], family: 'hamstring_curl' }),
  makeExercise({ id: 'leg_extension_machine', name: 'Leg Extension (Machine)', description: 'Open-chain quad isolation for terminal knee extension.', environment: 'gym', equipment: ['Leg Extension Machine'], muscleGroups: ['Quads'], family: 'quad_extension' }),
  makeExercise({ id: 'adductor_machine', name: 'Adductor Machine', description: 'Hip adduction isolation for inner thigh development.', environment: 'gym', equipment: ['Adductor Machine'], muscleGroups: ['Adductors'], family: 'adduction' }),
  makeExercise({ id: 'abductor_machine', name: 'Abductor Machine', description: 'Hip abduction isolation for glute medius/minimus.', environment: 'gym', equipment: ['Abductor Machine'], muscleGroups: ['Glute Medius', 'Glute Minimus'], family: 'abduction' }),

  // Calves and tibialis
  makeExercise({ id: 'calf_raise_standing_machine', name: 'Calf Raise (Standing Machine)', description: 'Standing plantarflexion for gastrocnemius development.', environment: 'gym', equipment: ['Standing Calf Raise Machine'], muscleGroups: ['Calves'], family: 'calf' }),
  makeExercise({ id: 'calf_raise_seated_machine', name: 'Calf Raise (Seated Machine)', description: 'Seated plantarflexion emphasizing soleus.', environment: 'gym', equipment: ['Seated Calf Raise Machine'], muscleGroups: ['Calves'], family: 'calf' }),
  makeExercise({ id: 'calf_raise_single_leg_bodyweight', name: 'Calf Raise (Single-Leg Bodyweight)', description: 'Single-leg calf raise for unilateral lower-leg loading.', environment: 'home', equipment: ['Bodyweight', 'Step'], muscleGroups: ['Calves'], family: 'calf' }),
  makeExercise({ id: 'calf_raise_donkey', name: 'Calf Raise (Donkey)', description: 'Hip-flexed calf raise variation for deep stretch loading.', environment: 'gym', equipment: ['Donkey Calf Machine or Smith'], muscleGroups: ['Calves'], family: 'calf' }),
  makeExercise({ id: 'tibialis_raise', name: 'Tibialis Raise', description: 'Anterior shin strengthening for ankle resilience and balance.', environment: 'any', equipment: ['Bodyweight or Tib Bar'], muscleGroups: ['Tibialis Anterior'], family: 'tibialis' }),

  // Additional unilateral/control variants
  makeExercise({ id: 'skater_squat_bodyweight', name: 'Skater Squat (Bodyweight)', description: 'Single-leg squat progression for knee and hip control.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Quads', 'Glutes', 'Core'], family: 'single_leg_knee' }),
  makeExercise({ id: 'sissy_squat', name: 'Sissy Squat', description: 'Quad-focused knee-over-toe bodyweight variation.', environment: 'any', equipment: ['Bodyweight', 'Support'], muscleGroups: ['Quads'], family: 'quad_extension' }),
  makeExercise({ id: 'hamstring_slide_towel', name: 'Hamstring Slide (Towel)', description: 'Floor-based hamstring curl substitute using sliders/towel.', environment: 'home', equipment: ['Bodyweight', 'Towel or Sliders'], muscleGroups: ['Hamstrings', 'Glutes'], family: 'hamstring_curl' }),
];

const BATCH_3_EXERCISES: ExerciseSeed[] = [
  // Arms: biceps
  makeExercise({ id: 'barbell_curl', name: 'Barbell Curl', description: 'Classic bilateral curl for biceps hypertrophy.', environment: 'any', equipment: ['Barbell'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'ez_bar_curl', name: 'EZ-Bar Curl', description: 'Wrist-friendly curl variation using angled bar.', environment: 'any', equipment: ['EZ Bar'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'dumbbell_curl_alternating', name: 'Dumbbell Curl (Alternating)', description: 'Alternating dumbbell curl for unilateral arm loading.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'incline_db_curl', name: 'Incline Dumbbell Curl', description: 'Long-head biased curl from stretched shoulder position.', environment: 'any', equipment: ['Dumbbells', 'Incline Bench'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'hammer_curl', name: 'Hammer Curl', description: 'Neutral-grip curl targeting brachialis and forearms.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Brachialis', 'Biceps', 'Forearms'], family: 'biceps_curl' }),
  makeExercise({ id: 'cross_body_hammer_curl', name: 'Cross-Body Hammer Curl', description: 'Cross-body neutral curl with strong brachialis emphasis.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Brachialis', 'Forearms', 'Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'preacher_curl_machine', name: 'Preacher Curl (Machine)', description: 'Supported elbow-flexion machine with strict path.', environment: 'gym', equipment: ['Preacher Curl Machine'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'preacher_curl_ez', name: 'Preacher Curl (EZ Bar)', description: 'Preacher setup to reduce shoulder cheating during curls.', environment: 'gym', equipment: ['EZ Bar', 'Preacher Bench'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'cable_curl_straight_bar', name: 'Cable Curl (Straight Bar)', description: 'Cable curl with steady resistance through range.', environment: 'gym', equipment: ['Cable Station', 'Straight Bar'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'bayesian_curl_cable', name: 'Bayesian Curl (Cable)', description: 'Cable curl from behind body for long-head tension.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'concentration_curl', name: 'Concentration Curl', description: 'Strict seated unilateral curl with peak-contraction focus.', environment: 'any', equipment: ['Dumbbell', 'Bench'], muscleGroups: ['Biceps'], family: 'biceps_curl' }),
  makeExercise({ id: 'reverse_curl_ez', name: 'Reverse Curl (EZ Bar)', description: 'Pronated curl variation targeting brachioradialis.', environment: 'any', equipment: ['EZ Bar'], muscleGroups: ['Forearms', 'Brachialis', 'Biceps'], family: 'biceps_curl' }),

  // Arms: triceps
  makeExercise({ id: 'triceps_pushdown_rope', name: 'Triceps Pushdown (Rope)', description: 'Cable triceps extension with terminal rope separation.', environment: 'gym', equipment: ['Cable Station', 'Rope'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'triceps_pushdown_straight_bar', name: 'Triceps Pushdown (Straight Bar)', description: 'Stable cable pushdown variation for triceps volume.', environment: 'gym', equipment: ['Cable Station', 'Straight Bar'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'triceps_pushdown_reverse_grip', name: 'Triceps Pushdown (Reverse Grip)', description: 'Underhand pushdown emphasizing medial triceps head.', environment: 'gym', equipment: ['Cable Station', 'Straight Bar'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'overhead_triceps_extension_cable', name: 'Overhead Triceps Extension (Cable)', description: 'Long-head focused triceps extension in overhead position.', environment: 'gym', equipment: ['Cable Station', 'Rope'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'overhead_triceps_extension_dumbbell', name: 'Overhead Triceps Extension (Dumbbell)', description: 'Single-dumbbell overhead extension for long-head bias.', environment: 'any', equipment: ['Dumbbell'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'skullcrusher_ez', name: 'Skullcrusher (EZ Bar)', description: 'Supine elbow-extension pattern for triceps hypertrophy.', environment: 'any', equipment: ['EZ Bar', 'Bench'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'close_grip_bench_press', name: 'Close-Grip Bench Press', description: 'Pressing pattern with high triceps loading.', environment: 'gym', equipment: ['Barbell', 'Bench', 'Rack'], muscleGroups: ['Triceps', 'Chest', 'Front Delts'], family: 'triceps_press' }),
  makeExercise({ id: 'triceps_dip_bench', name: 'Bench Dip (Triceps)', description: 'Bodyweight triceps dip with posterior shoulder caution.', environment: 'home', equipment: ['Bench or Chair'], muscleGroups: ['Triceps', 'Front Delts'], family: 'triceps_press' }),
  makeExercise({ id: 'triceps_kickback_dumbbell', name: 'Triceps Kickback (Dumbbell)', description: 'Triceps isolation emphasizing lockout control.', environment: 'any', equipment: ['Dumbbell'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),
  makeExercise({ id: 'triceps_kickback_cable', name: 'Triceps Kickback (Cable)', description: 'Cable kickback with smoother resistance profile.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Triceps'], family: 'triceps_extension' }),

  // Core
  makeExercise({ id: 'plank_forearm', name: 'Plank (Forearm)', description: 'Anti-extension core hold for trunk endurance.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Core', 'Transverse Abdominis'], family: 'core_anti_extension' }),
  makeExercise({ id: 'plank_side', name: 'Side Plank', description: 'Lateral core stability hold targeting obliques.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Obliques', 'Core', 'Glute Medius'], family: 'core_anti_lateral' }),
  makeExercise({ id: 'dead_bug', name: 'Dead Bug', description: 'Core coordination drill reinforcing ribcage-pelvis control.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Core', 'Deep Abdominals'], family: 'core_anti_extension' }),
  makeExercise({ id: 'hollow_body_hold', name: 'Hollow Body Hold', description: 'Gymnastic-style anti-extension trunk position hold.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Core', 'Hip Flexors'], family: 'core_anti_extension' }),
  makeExercise({ id: 'hanging_knee_raise', name: 'Hanging Knee Raise', description: 'Suspended core flexion pattern with lower-ab emphasis.', environment: 'any', equipment: ['Pull-Up Bar'], muscleGroups: ['Abs', 'Hip Flexors', 'Grip'], family: 'core_flexion' }),
  makeExercise({ id: 'hanging_leg_raise', name: 'Hanging Leg Raise', description: 'Advanced hanging core flexion with straight-leg demand.', environment: 'any', equipment: ['Pull-Up Bar'], muscleGroups: ['Abs', 'Hip Flexors', 'Grip'], family: 'core_flexion' }),
  makeExercise({ id: 'toes_to_bar', name: 'Toes-to-Bar', description: 'Dynamic hanging core movement requiring compression strength.', environment: 'any', equipment: ['Pull-Up Bar'], muscleGroups: ['Abs', 'Hip Flexors', 'Lats'], family: 'core_flexion' }),
  makeExercise({ id: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', description: 'High-demand anti-extension rollout for anterior core.', environment: 'any', equipment: ['Ab Wheel'], muscleGroups: ['Core', 'Lats', 'Shoulders'], family: 'core_anti_extension' }),
  makeExercise({ id: 'cable_crunch_kneeling', name: 'Cable Crunch (Kneeling)', description: 'Weighted spinal-flexion pattern for rectus abdominis.', environment: 'gym', equipment: ['Cable Station', 'Rope'], muscleGroups: ['Abs'], family: 'core_flexion' }),
  makeExercise({ id: 'pallof_press_cable', name: 'Pallof Press (Cable)', description: 'Anti-rotation core press improving trunk stability.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Obliques', 'Core'], family: 'core_anti_rotation' }),
  makeExercise({ id: 'wood_chop_cable_high_to_low', name: 'Wood Chop (Cable High to Low)', description: 'Rotational core pattern through diagonal chopping path.', environment: 'gym', equipment: ['Cable Station', 'Single Handle'], muscleGroups: ['Obliques', 'Abs', 'Serratus'], family: 'core_rotation' }),
  makeExercise({ id: 'reverse_crunch', name: 'Reverse Crunch', description: 'Pelvic tilt focused lower-ab bodyweight movement.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Abs', 'Hip Flexors'], family: 'core_flexion' }),
  makeExercise({ id: 'russian_twist', name: 'Russian Twist', description: 'Seated rotational trunk pattern for oblique endurance.', environment: 'home', equipment: ['Bodyweight or Plate'], muscleGroups: ['Obliques', 'Abs'], family: 'core_rotation' }),
  makeExercise({ id: 'mountain_climber', name: 'Mountain Climber', description: 'Conditioning core drill with anti-extension demand.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Core', 'Hip Flexors', 'Shoulders'], family: 'core_conditioning' }),

  // Carries
  makeExercise({ id: 'farmer_carry_dumbbell', name: 'Farmer Carry (Dumbbell)', description: 'Loaded carry for grip, trunk stiffness, and gait control.', environment: 'any', equipment: ['Dumbbells'], muscleGroups: ['Forearms', 'Upper Traps', 'Core', 'Glutes'], family: 'carry' }),
  makeExercise({ id: 'suitcase_carry_dumbbell', name: 'Suitcase Carry (Dumbbell)', description: 'Unilateral loaded carry emphasizing anti-lateral core control.', environment: 'any', equipment: ['Dumbbell'], muscleGroups: ['Obliques', 'Core', 'Grip'], family: 'carry' }),
  makeExercise({ id: 'front_rack_carry_kettlebell', name: 'Front Rack Carry (Kettlebell)', description: 'Anterior loaded carry challenging trunk and shoulder stability.', environment: 'any', equipment: ['Kettlebell'], muscleGroups: ['Core', 'Upper Back', 'Forearms'], family: 'carry' }),
  makeExercise({ id: 'overhead_carry_dumbbell', name: 'Overhead Carry (Dumbbell)', description: 'Overhead loaded carry for shoulder stability and core control.', environment: 'any', equipment: ['Dumbbell'], muscleGroups: ['Shoulders', 'Core', 'Upper Back'], family: 'carry' }),
  makeExercise({ id: 'waiter_carry_kettlebell', name: 'Waiter Carry (Kettlebell)', description: 'Single-arm overhead carry emphasizing scapular control.', environment: 'any', equipment: ['Kettlebell'], muscleGroups: ['Shoulders', 'Core', 'Forearms'], family: 'carry' }),

  // Conditioning
  makeExercise({ id: 'burpee', name: 'Burpee', description: 'Full-body conditioning movement combining squat, plank, and jump.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Full Body', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'battle_ropes_waves', name: 'Battle Ropes (Alternating Waves)', description: 'Upper-body conditioning interval using rope waves.', environment: 'gym', equipment: ['Battle Ropes'], muscleGroups: ['Shoulders', 'Arms', 'Core', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'rower_interval', name: 'Rower Interval', description: 'Row erg interval for full-body aerobic and anaerobic training.', environment: 'gym', equipment: ['Rowing Ergometer'], muscleGroups: ['Legs', 'Back', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'assault_bike_interval', name: 'Assault Bike Interval', description: 'High-output conditioning intervals on fan bike.', environment: 'gym', equipment: ['Air Bike'], muscleGroups: ['Full Body', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'sled_push', name: 'Sled Push', description: 'Concentric-dominant lower-body conditioning drill.', environment: 'gym', equipment: ['Sled'], muscleGroups: ['Quads', 'Glutes', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'sled_pull_backward', name: 'Sled Pull (Backward)', description: 'Backward sled drag emphasizing quads and knee resilience.', environment: 'gym', equipment: ['Sled', 'Straps'], muscleGroups: ['Quads', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'jump_rope', name: 'Jump Rope', description: 'Cyclic conditioning pattern improving footwork and stamina.', environment: 'any', equipment: ['Jump Rope'], muscleGroups: ['Calves', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'kettlebell_swing', name: 'Kettlebell Swing', description: 'Ballistic hinge pattern for posterior-chain power and conditioning.', environment: 'any', equipment: ['Kettlebell'], muscleGroups: ['Glutes', 'Hamstrings', 'Cardio'], family: 'conditioning' }),
  makeExercise({ id: 'box_jump', name: 'Box Jump', description: 'Explosive jump training for power and conditioning.', environment: 'any', equipment: ['Plyo Box'], muscleGroups: ['Quads', 'Glutes', 'Calves'], family: 'conditioning' }),
  makeExercise({ id: 'medicine_ball_slam', name: 'Medicine Ball Slam', description: 'Powerful total-body conditioning movement with trunk flexion.', environment: 'any', equipment: ['Medicine Ball'], muscleGroups: ['Core', 'Shoulders', 'Cardio'], family: 'conditioning' }),
];

const BATCH_4_EXERCISES: ExerciseSeed[] = [
  // Mobility and prehab
  makeExercise({ id: 'band_pull_apart', name: 'Band Pull-Apart', description: 'Scapular retraction drill for postural and shoulder support.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Rear Delts', 'Mid Traps', 'Rhomboids'], family: 'prehab_shoulder' }),
  makeExercise({ id: 'band_external_rotation', name: 'Band External Rotation', description: 'Rotator cuff strengthening for shoulder resilience.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Rotator Cuff'], family: 'prehab_shoulder' }),
  makeExercise({ id: 'shoulder_dislocate_band', name: 'Shoulder Dislocate (Band)', description: 'Dynamic shoulder mobility drill through overhead arc.', environment: 'home', equipment: ['Resistance Band or PVC'], muscleGroups: ['Shoulders', 'Upper Back'], family: 'mobility_shoulder' }),
  makeExercise({ id: 'wall_slide', name: 'Wall Slide', description: 'Scapular upward rotation and thoracic mobility drill.', environment: 'home', equipment: ['Wall'], muscleGroups: ['Shoulders', 'Serratus', 'Upper Back'], family: 'mobility_shoulder' }),
  makeExercise({ id: 'scap_push_up', name: 'Scap Push-Up', description: 'Serratus-focused scapular protraction control drill.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Serratus', 'Shoulders', 'Core'], family: 'prehab_shoulder' }),
  makeExercise({ id: 'serratus_wall_roll', name: 'Serratus Wall Roll', description: 'Wall-assisted shoulder stability drill with upward rotation.', environment: 'home', equipment: ['Foam Roller', 'Band'], muscleGroups: ['Serratus', 'Shoulders'], family: 'prehab_shoulder' }),
  makeExercise({ id: 'copenhagen_plank', name: 'Copenhagen Plank', description: 'Adductor and lateral-core stability drill.', environment: 'home', equipment: ['Bench'], muscleGroups: ['Adductors', 'Obliques', 'Core'], family: 'prehab_hip' }),
  makeExercise({ id: 'clamshell_band', name: 'Clamshell (Band)', description: 'Glute medius activation drill for hip and knee control.', environment: 'home', equipment: ['Mini Band'], muscleGroups: ['Glute Medius', 'Glute Minimus'], family: 'prehab_hip' }),
  makeExercise({ id: 'monster_walk_band', name: 'Monster Walk (Band)', description: 'Lateral hip activation pattern for glute medius endurance.', environment: 'home', equipment: ['Mini Band'], muscleGroups: ['Glute Medius', 'Glutes'], family: 'prehab_hip' }),
  makeExercise({ id: 'glute_bridge_single_leg', name: 'Glute Bridge (Single Leg)', description: 'Unilateral bridge for glute activation and pelvis control.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Glutes', 'Hamstrings', 'Core'], family: 'prehab_hip' }),
  makeExercise({ id: 'hip_airplane', name: 'Hip Airplane', description: 'Single-leg rotational hip control and stability drill.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Glute Medius', 'Glutes', 'Core'], family: 'mobility_hip' }),
  makeExercise({ id: 'hip_90_90_switch', name: '90/90 Hip Switch', description: 'Internal/external hip rotation mobility sequence.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Hips', 'Glutes'], family: 'mobility_hip' }),
  makeExercise({ id: 'worlds_greatest_stretch', name: 'World\'s Greatest Stretch', description: 'Full-chain mobility flow for hips, t-spine, and hamstrings.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Hips', 'Hamstrings', 'Thoracic Spine'], family: 'mobility_full' }),
  makeExercise({ id: 'couch_stretch', name: 'Couch Stretch', description: 'Hip-flexor and quad mobility drill for extension capacity.', environment: 'home', equipment: ['Wall', 'Bench'], muscleGroups: ['Hip Flexors', 'Quads'], family: 'mobility_hip' }),
  makeExercise({ id: 'ankle_knee_to_wall', name: 'Ankle Knee-to-Wall', description: 'Ankle dorsiflexion mobility drill for squat mechanics.', environment: 'home', equipment: ['Wall'], muscleGroups: ['Ankles', 'Calves'], family: 'mobility_ankle' }),
  makeExercise({ id: 'thoracic_open_book', name: 'Thoracic Open Book', description: 'Thoracic rotation mobility drill in side-lying position.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Thoracic Spine', 'Shoulders'], family: 'mobility_tspine' }),
  makeExercise({ id: 'cat_cow', name: 'Cat-Cow', description: 'Spinal segmentation drill for flexion-extension control.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Spine', 'Core'], family: 'mobility_spine' }),
  makeExercise({ id: 'bird_dog', name: 'Bird Dog', description: 'Contralateral stability drill for spine and hip control.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Core', 'Glutes', 'Spinal Erectors'], family: 'prehab_spine' }),
  makeExercise({ id: 'dead_hang', name: 'Dead Hang', description: 'Passive shoulder decompression and grip endurance drill.', environment: 'any', equipment: ['Pull-Up Bar'], muscleGroups: ['Grip', 'Shoulders', 'Lats'], family: 'mobility_shoulder' }),
  makeExercise({ id: 'wrist_flexor_stretch', name: 'Wrist Flexor Stretch', description: 'Forearm and wrist mobility drill for pressing tolerance.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Forearms', 'Wrists'], family: 'mobility_wrist' }),
  makeExercise({ id: 'wrist_extensor_stretch', name: 'Wrist Extensor Stretch', description: 'Wrist extensor mobility for pulling and grip tasks.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Forearms', 'Wrists'], family: 'mobility_wrist' }),

  // Home substitutions
  makeExercise({ id: 'backpack_squat', name: 'Backpack Squat', description: 'Home squat substitute using loaded backpack.', environment: 'home', equipment: ['Backpack'], muscleGroups: ['Quads', 'Glutes', 'Core'], family: 'home_sub_squat' }),
  makeExercise({ id: 'backpack_rdl', name: 'Backpack RDL', description: 'Home hinge substitute using backpack loading.', environment: 'home', equipment: ['Backpack'], muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'], family: 'home_sub_hinge' }),
  makeExercise({ id: 'chair_split_squat', name: 'Chair Split Squat', description: 'Home unilateral leg substitute requiring minimal gear.', environment: 'home', equipment: ['Chair'], muscleGroups: ['Quads', 'Glutes', 'Adductors'], family: 'home_sub_squat' }),
  makeExercise({ id: 'towel_row_door', name: 'Towel Row (Door Anchor)', description: 'Home row substitute using towel and door anchor.', environment: 'home', equipment: ['Towel', 'Door Anchor'], muscleGroups: ['Lats', 'Upper Back', 'Biceps'], family: 'home_sub_pull' }),
  makeExercise({ id: 'inverted_row_table', name: 'Inverted Row (Table)', description: 'Bodyweight row substitute using sturdy table edge.', environment: 'home', equipment: ['Table', 'Bodyweight'], muscleGroups: ['Upper Back', 'Lats', 'Biceps'], family: 'home_sub_pull' }),
  makeExercise({ id: 'pike_push_up', name: 'Pike Push-Up', description: 'Home vertical press substitute for shoulders.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Front Delts', 'Triceps', 'Upper Chest'], family: 'home_sub_press' }),
  makeExercise({ id: 'hand_release_push_up', name: 'Hand-Release Push-Up', description: 'Strict horizontal press substitute with dead-stop reps.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'home_sub_press' }),
  makeExercise({ id: 'band_chest_press', name: 'Band Chest Press', description: 'Band-resisted chest press alternative to machine/barbell press.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Chest', 'Triceps', 'Front Delts'], family: 'home_sub_press' }),
  makeExercise({ id: 'band_row', name: 'Band Row', description: 'Band-resisted row substitute for cable/machine pulling.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Upper Back', 'Lats', 'Biceps'], family: 'home_sub_pull' }),
  makeExercise({ id: 'band_lat_pulldown', name: 'Band Lat Pulldown', description: 'Anchored band pulldown substitute for vertical pulling.', environment: 'home', equipment: ['Resistance Band', 'Door Anchor'], muscleGroups: ['Lats', 'Biceps', 'Upper Back'], family: 'home_sub_pull' }),
  makeExercise({ id: 'band_face_pull', name: 'Band Face Pull', description: 'Band rear-delt and scapular stability substitution.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Rear Delts', 'Mid Traps', 'External Rotators'], family: 'home_sub_pull' }),
  makeExercise({ id: 'band_good_morning', name: 'Band Good Morning', description: 'Band-loaded hinge substitute for posterior chain.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'], family: 'home_sub_hinge' }),
  makeExercise({ id: 'band_leg_curl', name: 'Band Leg Curl', description: 'Anchored band hamstring curl substitute.', environment: 'home', equipment: ['Resistance Band'], muscleGroups: ['Hamstrings'], family: 'home_sub_hinge' }),
  makeExercise({ id: 'single_leg_box_squat', name: 'Single-Leg Box Squat', description: 'Progression-based unilateral squat using a box/chair target.', environment: 'home', equipment: ['Box or Chair'], muscleGroups: ['Quads', 'Glutes', 'Core'], family: 'home_sub_squat' }),
  makeExercise({ id: 'stairs_calf_raise', name: 'Stairs Calf Raise', description: 'Calf loading substitute using stair edge ROM.', environment: 'home', equipment: ['Stairs', 'Bodyweight'], muscleGroups: ['Calves'], family: 'home_sub_calf' }),
  makeExercise({ id: 'reverse_snow_angel', name: 'Reverse Snow Angel', description: 'Prone posterior shoulder/scap mobility and activation drill.', environment: 'home', equipment: ['Bodyweight'], muscleGroups: ['Rear Delts', 'Lower Traps', 'Upper Back'], family: 'mobility_tspine' }),
  makeExercise({ id: 'hip_hinge_dowel_drill', name: 'Hip Hinge (Dowel Drill)', description: 'Technical hinge pattern drill for neutral spine awareness.', environment: 'home', equipment: ['Dowel or Stick'], muscleGroups: ['Posterior Chain', 'Core'], family: 'mobility_hip' }),
];

export const EXERCISE_CATALOG_BATCHES: readonly ExerciseBatch[] = [
  {
    id: 'batch1',
    title: 'Batch 1: Chest, Back, Shoulders',
    scope: 'All common equipment and grip/angle variants for upper-body push/pull.',
    exercises: BATCH_1_EXERCISES,
  },
  {
    id: 'batch2',
    title: 'Batch 2: Legs and Glutes',
    scope: 'Squat, hinge, unilateral, posterior-chain, and lower-leg variants.',
    exercises: BATCH_2_EXERCISES,
  },
  {
    id: 'batch3',
    title: 'Batch 3: Arms, Core, Calves, Carries, Conditioning',
    scope: 'Direct arm work, trunk patterns, loaded carries, and conditioning movements.',
    exercises: BATCH_3_EXERCISES,
  },
  {
    id: 'batch4',
    title: 'Batch 4: Mobility, Prehab, Home Substitutions',
    scope: 'Joint-health drills and practical home-equipment alternatives.',
    exercises: BATCH_4_EXERCISES,
  },
] as const;

export const EXERCISE_SEED_EXERCISES: ExerciseSeed[] = EXERCISE_CATALOG_BATCHES.flatMap((batch) =>
  batch.exercises
);

const toAlternativeReason = (base: ExerciseSeed, alt: ExerciseSeed): string => {
  if (base.family === alt.family) {
    const equipmentShift =
      base.equipment[0] && alt.equipment[0] && base.equipment[0] !== alt.equipment[0]
        ? `Swap to ${alt.equipment[0]} for a different loading profile.`
        : 'Close variation of the same movement family.';
    return equipmentShift;
  }

  const primary = alt.muscleGroups[0] || 'target muscles';
  return `Alternative that still trains ${primary} effectively.`;
};

const buildAlternatives = (exercises: ExerciseSeed[], perExercise = 3): ExerciseAlternativeSeed[] => {
  const out: ExerciseAlternativeSeed[] = [];

  exercises.forEach((exercise) => {
    const sameFamily = exercises.filter((candidate) => candidate.id !== exercise.id && candidate.family === exercise.family);
    const samePrimaryMuscle = exercises.filter(
      (candidate) =>
        candidate.id !== exercise.id &&
        candidate.family !== exercise.family &&
        candidate.muscleGroups[0] === exercise.muscleGroups[0]
    );

    const picked = [...sameFamily.slice(0, perExercise), ...samePrimaryMuscle.slice(0, perExercise)]
      .slice(0, perExercise)
      .filter((candidate, index, arr) => arr.findIndex((x) => x.id === candidate.id) === index);

    picked.forEach((candidate) => {
      out.push({
        exerciseId: exercise.id,
        alternativeId: candidate.id,
        reason: toAlternativeReason(exercise, candidate),
      });
    });
  });

  // Deduplicate accidental duplicates
  const unique = new Map<string, ExerciseAlternativeSeed>();
  out.forEach((entry) => {
    unique.set(`${entry.exerciseId}|${entry.alternativeId}`, entry);
  });

  return Array.from(unique.values());
};

export const EXERCISE_SEED_ALTERNATIVES: ExerciseAlternativeSeed[] = buildAlternatives(
  EXERCISE_SEED_EXERCISES,
  3
);

const escapeSql = (value: string) => value.replace(/'/g, "''");

/**
 * Helper for generating an import-ready SQL upsert script.
 */
export const buildExerciseCatalogUpsertSql = (): string => {
  const exerciseRows = EXERCISE_SEED_EXERCISES.map((exercise) => {
    const equipment = `ARRAY[${exercise.equipment.map((e) => `'${escapeSql(e)}'`).join(', ')}]`;
    const muscleGroups = `ARRAY[${exercise.muscleGroups.map((m) => `'${escapeSql(m)}'`).join(', ')}]`;
    const tips = `ARRAY[${exercise.tips.map((t) => `'${escapeSql(t)}'`).join(', ')}]`;
    const formCues = `ARRAY[${exercise.formCues.map((c) => `'${escapeSql(c)}'`).join(', ')}]`;

    return `('${escapeSql(exercise.id)}', '${escapeSql(exercise.name)}', '${escapeSql(
      exercise.description
    )}', '${exercise.environment}', ${equipment}, ${muscleGroups}, ${tips}, ${formCues}, '${escapeSql(
      exercise.videoUrl
    )}')`;
  });

  const alternativeRows = EXERCISE_SEED_ALTERNATIVES.map(
    (alt) =>
      `('${escapeSql(alt.exerciseId)}', '${escapeSql(alt.alternativeId)}', '${escapeSql(alt.reason)}')`
  );

  return `-- Exercise catalog upsert generated from exerciseCatalogBatches.ts\n\nINSERT INTO exercises (id, name, description, environment, equipment, muscle_groups, tips, form_cues, video_url) VALUES\n${exerciseRows.join(
    ',\n'
  )}\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name,\n  description = EXCLUDED.description,\n  environment = EXCLUDED.environment,\n  equipment = EXCLUDED.equipment,\n  muscle_groups = EXCLUDED.muscle_groups,\n  tips = EXCLUDED.tips,\n  form_cues = EXCLUDED.form_cues,\n  video_url = EXCLUDED.video_url,\n  updated_at = NOW();\n\nINSERT INTO exercise_alternatives (exercise_id, alternative_id, reason) VALUES\n${alternativeRows.join(
    ',\n'
  )}\nON CONFLICT (exercise_id, alternative_id) DO UPDATE SET\n  reason = EXCLUDED.reason;\n`;
};
