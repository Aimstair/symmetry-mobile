-- Symmetry Fitness App - Schema Normalization Migration (3NF)
-- Generated: 2026-01-05
-- Description: Transforms JSONB-heavy structure to fully normalized 3NF relational database
-- Includes: Exercises catalog, Normalized workout plans, Workout history, Atomic body measurements

-- ============================================================================
-- EXERCISES CATALOG (Master Table with Sync Support)
-- ============================================================================
CREATE TABLE exercises (
  id TEXT PRIMARY KEY, -- e.g., 'bench_press', 'squats'
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('gym', 'home', 'any')),
  equipment TEXT[] NOT NULL DEFAULT '{}',
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  tips TEXT[] NOT NULL DEFAULT '{}',
  form_cues TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient incremental sync
CREATE INDEX idx_exercises_updated_at ON exercises(updated_at);

-- Trigger for updated_at
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Exercise Alternatives (normalized from embedded array)
CREATE TABLE exercise_alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  alternative_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  UNIQUE(exercise_id, alternative_id)
);

CREATE INDEX idx_exercise_alternatives_exercise_id ON exercise_alternatives(exercise_id);

-- ============================================================================
-- WORKOUT DAYS (Normalized from JSONB)
-- ============================================================================
CREATE TABLE workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  name TEXT NOT NULL,
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, order_index)
);

CREATE INDEX idx_workout_days_plan_id ON workout_days(plan_id);

CREATE TRIGGER update_workout_days_updated_at BEFORE UPDATE ON workout_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PLAN EXERCISES (Prescription for each day)
-- ============================================================================
CREATE TABLE plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  target_sets INTEGER NOT NULL CHECK (target_sets > 0),
  target_reps TEXT NOT NULL, -- e.g., "8-12", "12", "AMRAP"
  rest_seconds INTEGER NOT NULL DEFAULT 90 CHECK (rest_seconds >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workout_day_id, order_index)
);

CREATE INDEX idx_plan_exercises_workout_day_id ON plan_exercises(workout_day_id);
CREATE INDEX idx_plan_exercises_exercise_id ON plan_exercises(exercise_id);

CREATE TRIGGER update_plan_exercises_updated_at BEFORE UPDATE ON plan_exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- WORKOUT SESSIONS (Completed Workout History)
-- ============================================================================
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL, -- Optional link to source plan
  workout_day_id UUID REFERENCES workout_days(id) ON DELETE SET NULL, -- Optional link to source day
  name TEXT NOT NULL, -- Customizable session name
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER, -- Computed from started_at/ended_at or manual
  notes TEXT,
  warmup_mode BOOLEAN NOT NULL DEFAULT false,
  deload_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_started_at ON workout_sessions(started_at DESC);

-- ============================================================================
-- SESSION EXERCISES (Exercises performed in a session)
-- ============================================================================
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_exercises_session_id ON session_exercises(session_id);
CREATE INDEX idx_session_exercises_exercise_id ON session_exercises(exercise_id);

-- ============================================================================
-- SESSION SETS (Individual sets performed)
-- ============================================================================
CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id UUID NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  weight NUMERIC NOT NULL CHECK (weight >= 0), -- Always stored in kg
  reps INTEGER NOT NULL CHECK (reps >= 0),
  rpe NUMERIC CHECK (rpe >= 0 AND rpe <= 10), -- Rate of Perceived Exertion
  is_warmup BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  rest_taken_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_exercise_id, set_number)
);

CREATE INDEX idx_session_sets_session_exercise_id ON session_sets(session_exercise_id);

-- ============================================================================
-- MEASUREMENT LOGS (Atomic Body Measurements - Replaces JSONB)
-- ============================================================================
CREATE TABLE measurement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- All measurements stored in metric (cm/kg)
  weight_kg NUMERIC CHECK (weight_kg > 0),
  body_fat_pct NUMERIC CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  chest_cm NUMERIC CHECK (chest_cm > 0),
  waist_cm NUMERIC CHECK (waist_cm > 0),
  hips_cm NUMERIC CHECK (hips_cm > 0),
  left_arm_cm NUMERIC CHECK (left_arm_cm > 0),
  right_arm_cm NUMERIC CHECK (right_arm_cm > 0),
  left_thigh_cm NUMERIC CHECK (left_thigh_cm > 0),
  right_thigh_cm NUMERIC CHECK (right_thigh_cm > 0),
  left_calf_cm NUMERIC CHECK (left_calf_cm > 0),
  right_calf_cm NUMERIC CHECK (right_calf_cm > 0),
  neck_cm NUMERIC CHECK (neck_cm > 0),
  shoulders_cm NUMERIC CHECK (shoulders_cm > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_measurement_logs_user_id ON measurement_logs(user_id);
CREATE INDEX idx_measurement_logs_date ON measurement_logs(date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

-- Exercises: Public read, admin write (for now, allow all reads)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exercises" ON exercises FOR SELECT USING (true);

-- Exercise Alternatives: Public read
ALTER TABLE exercise_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exercise alternatives" ON exercise_alternatives FOR SELECT USING (true);

-- Workout Days: Users can manage days of their own plans
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workout days" ON workout_days
  FOR SELECT USING (
    plan_id IN (SELECT id FROM workout_plans WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own workout days" ON workout_days
  FOR INSERT WITH CHECK (
    plan_id IN (SELECT id FROM workout_plans WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can update own workout days" ON workout_days
  FOR UPDATE USING (
    plan_id IN (SELECT id FROM workout_plans WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete own workout days" ON workout_days
  FOR DELETE USING (
    plan_id IN (SELECT id FROM workout_plans WHERE user_id = auth.uid())
  );

-- Plan Exercises: Users can manage exercises of their own days
ALTER TABLE plan_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plan exercises" ON plan_exercises
  FOR SELECT USING (
    workout_day_id IN (
      SELECT wd.id FROM workout_days wd
      JOIN workout_plans wp ON wd.plan_id = wp.id
      WHERE wp.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own plan exercises" ON plan_exercises
  FOR INSERT WITH CHECK (
    workout_day_id IN (
      SELECT wd.id FROM workout_days wd
      JOIN workout_plans wp ON wd.plan_id = wp.id
      WHERE wp.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own plan exercises" ON plan_exercises
  FOR UPDATE USING (
    workout_day_id IN (
      SELECT wd.id FROM workout_days wd
      JOIN workout_plans wp ON wd.plan_id = wp.id
      WHERE wp.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own plan exercises" ON plan_exercises
  FOR DELETE USING (
    workout_day_id IN (
      SELECT wd.id FROM workout_days wd
      JOIN workout_plans wp ON wd.plan_id = wp.id
      WHERE wp.user_id = auth.uid()
    )
  );

-- Workout Sessions: Users manage their own
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workout sessions" ON workout_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workout sessions" ON workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workout sessions" ON workout_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workout sessions" ON workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Session Exercises: Users manage their own
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own session exercises" ON session_exercises
  FOR SELECT USING (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own session exercises" ON session_exercises
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can update own session exercises" ON session_exercises
  FOR UPDATE USING (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete own session exercises" ON session_exercises
  FOR DELETE USING (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  );

-- Session Sets: Users manage their own
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own session sets" ON session_sets
  FOR SELECT USING (
    session_exercise_id IN (
      SELECT se.id FROM session_exercises se
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own session sets" ON session_sets
  FOR INSERT WITH CHECK (
    session_exercise_id IN (
      SELECT se.id FROM session_exercises se
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own session sets" ON session_sets
  FOR UPDATE USING (
    session_exercise_id IN (
      SELECT se.id FROM session_exercises se
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own session sets" ON session_sets
  FOR DELETE USING (
    session_exercise_id IN (
      SELECT se.id FROM session_exercises se
      JOIN workout_sessions ws ON se.session_id = ws.id
      WHERE ws.user_id = auth.uid()
    )
  );

-- Measurement Logs: Users manage their own
ALTER TABLE measurement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own measurement logs" ON measurement_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own measurement logs" ON measurement_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own measurement logs" ON measurement_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own measurement logs" ON measurement_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SEED EXERCISES CATALOG
-- ============================================================================
INSERT INTO exercises (id, name, description, environment, equipment, muscle_groups, tips, form_cues, video_url) VALUES
-- CHEST
('bench_press', 'Bench Press', 'The standard for upper body pressing power. Targets the entire chest with heavy load potential.', 'gym', ARRAY['Barbell', 'Bench', 'Rack'], ARRAY['Chest', 'Front Delts', 'Triceps'], ARRAY['Keep feet planted firmly', 'Retract shoulder blades into the bench', 'Touch bar to mid-chest', 'Drive up without flaring elbows'], ARRAY['Grip: Just outside shoulders', 'Arch: Slight natural arch', 'Path: Slight diagonal line', 'Tempo: Control down, explode up'], 'bench-press'),
('incline_db_press', 'Incline Dumbbell Press', 'Targets the upper clavicular head of the pecs to fill out the upper chest.', 'any', ARRAY['Dumbbells', 'Adjustable Bench'], ARRAY['Upper Chest', 'Front Delts', 'Triceps'], ARRAY['Set bench angle to 30-45 degrees', 'Keep wrists straight', 'Lower dumbbells until chest stretch is felt', 'Press up and slightly in'], ARRAY['Angle: 30-45 degrees', 'Elbows: Tucked 45 degrees', 'Range: Full stretch', 'Top: Do not clang weights'], 'incline-db-press'),
('cable_flyes', 'Cable Flyes', 'Isolation movement providing constant tension across the entire range of motion.', 'gym', ARRAY['Cable Machine'], ARRAY['Chest', 'Front Delts'], ARRAY['Maintain a slight bend in elbows', 'Focus on the squeeze at the center', 'Control the eccentric (opening) phase', 'Keep chest up and shoulders back'], ARRAY['Stance: Staggered for stability', 'Path: Hug a large tree', 'Shoulders: Retracted', 'Tempo: Slow and controlled'], 'cable-flyes'),
('dumbbell_flyes', 'Dumbbell Flyes', 'Classic old-school chest isolator focusing on the stretched position.', 'any', ARRAY['Dumbbells', 'Bench'], ARRAY['Chest', 'Front Delts'], ARRAY['Do not go too heavy', 'Focus on the deep stretch at bottom', 'Visualize bringing biceps together', 'Keep elbows locked in slight bend'], ARRAY['Arc: Wide sweeping motion', 'Bottom: Hands level with chest', 'Wrists: Neutral', 'Shoulders: Pinched back'], 'dumbbell-flyes'),
('chest_dips', 'Chest Dips', 'The squat of the upper body. Hits lower chest and triceps hard.', 'any', ARRAY['Dip Station'], ARRAY['Lower Chest', 'Triceps', 'Front Delts'], ARRAY['Lean forward to target chest', 'Go to 90 degrees at elbow', 'Do not shrug shoulders', 'Control the descent'], ARRAY['Torso: Leaning forward 30°', 'Elbows: Slight flare allowed', 'Head: Neutral or looking down', 'Legs: Crossed/Bent behind'], 'chest-dips'),

-- SHOULDERS
('overhead_press', 'Overhead Press', 'The ultimate test of shoulder and core strength. Builds complete delts.', 'gym', ARRAY['Barbell', 'Rack'], ARRAY['Front Delts', 'Side Delts', 'Triceps', 'Core'], ARRAY['Squeeze glutes and abs tight', 'Move head out of bar path', 'Lock out elbows at top', 'Do not lean back excessively'], ARRAY['Grip: Just outside shoulders', 'Elbows: Slightly in front of bar', 'Path: Vertical line', 'Breath: Big brace at bottom'], 'overhead-press'),
('db_shoulder_press', 'Dumbbell Shoulder Press', 'Great for hypertrophy and fixing strength imbalances between sides.', 'any', ARRAY['Dumbbells', 'Bench'], ARRAY['Front Delts', 'Side Delts', 'Triceps'], ARRAY['Keep core braced', 'Press in a slight arc inwards', 'Do not bang weights at top', 'Lower to ear level'], ARRAY['Back: Supported or rigid', 'Elbows: Not fully flared (60°)', 'Wrists: Stacked over elbows', 'Tempo: Controlled negative'], 'db-shoulder-press'),
('lateral_raises', 'Lateral Raises', 'The key to broad shoulders. Isolates the medial delt cap.', 'any', ARRAY['Dumbbells'], ARRAY['Side Delts'], ARRAY['Lead with elbows, not hands', 'Pour the pitcher motion', 'Do not use momentum/swinging', 'Stop just at shoulder height'], ARRAY['Elbows: Slight bend', 'Torso: Slight forward lean', 'Hands: Lower than elbows', 'Speed: No swinging'], 'lateral-raises'),
('face_pulls', 'Face Pulls', 'Crucial for shoulder health and posture. Hits rear delts and rotator cuff.', 'any', ARRAY['Cable Machine', 'Bands'], ARRAY['Rear Delts', 'Rhomboids', 'Rotator Cuff'], ARRAY['Pull towards forehead/eyes', 'Externally rotate at end', 'Squeeze rear delts hard', 'Keep elbows high'], ARRAY['Grip: Rope (thumbs back)', 'Stance: Athletic/Staggered', 'Elbows: High and wide', 'Finish: Double bicep pose'], 'face-pulls'),

-- BACK
('pull_ups', 'Pull-Ups', 'The best bodyweight exercise for back width and vertical pulling strength.', 'any', ARRAY['Pull-Up Bar'], ARRAY['Lats', 'Biceps', 'Rear Delts'], ARRAY['Full hang at bottom', 'Chin over bar at top', 'Drive elbows down to hips', 'Engage core, no swinging'], ARRAY['Grip: Just outside shoulders', 'Shoulders: Depressed (down)', 'Body: Hollow body position', 'Range: Full extension'], 'pull-ups'),
('lat_pulldowns', 'Lat Pulldowns', 'Vertical pulling for back width, accessible to all strength levels.', 'gym', ARRAY['Cable Machine', 'Lat Bar'], ARRAY['Lats', 'Biceps', 'Rear Delts'], ARRAY['Lean back slightly', 'Pull bar to upper chest', 'Do not use momentum', 'Control the stretch up'], ARRAY['Shoulders: Down and back', 'Elbows: Drive straight down', 'Grip: Wide but comfortable', 'Torso: Fixed position'], 'lat-pulldowns'),
('barbell_rows', 'Barbell Rows', 'Heavy compound movement for back thickness and raw power.', 'gym', ARRAY['Barbell'], ARRAY['Lats', 'Rhomboids', 'Traps', 'Biceps'], ARRAY['Keep back flat/neutral', 'Pull to lower chest/abs', 'Keep knees slightly bent', 'Do not jerk the weight'], ARRAY['Torso: 45 to 90 degrees', 'Grip: Double overhand', 'Elbows: Tucked or slight flare', 'Spine: Neutral alignment'], 'barbell-rows'),
('dumbbell_rows', 'Dumbbell Rows', 'Unilateral row to fix imbalances and allow for a greater range of motion.', 'any', ARRAY['Dumbbells', 'Bench'], ARRAY['Lats', 'Rhomboids', 'Biceps'], ARRAY['Use bench for support', 'Pull elbow to hip pocket', 'Stretch arm forward at bottom', 'Keep torso parallel to floor'], ARRAY['Back: Flat table top', 'Motion: Sawing motion', 'Head: Neutral', 'Core: Braced'], 'dumbbell-rows'),
('deadlifts', 'Deadlifts', 'The king of posterior chain exercises. Builds total body mass and strength.', 'gym', ARRAY['Barbell'], ARRAY['Hamstrings', 'Glutes', 'Lower Back', 'Traps'], ARRAY['Bar starts over mid-foot', 'Pull slack out of bar', 'Drive floor away with legs', 'Keep bar close to body'], ARRAY['Spine: Neutral', 'Hips: Higher than knees', 'Lats: Engaged (protect armpits)', 'Lockout: Glutes squeezed'], 'deadlifts'),

-- TRICEPS
('tricep_pushdowns', 'Tricep Pushdowns', 'Staple isolation exercise for the lateral and medial heads of the triceps.', 'gym', ARRAY['Cable Machine', 'Rope'], ARRAY['Triceps'], ARRAY['Keep elbows pinned to sides', 'Only move forearms', 'Squeeze hard at bottom', 'Control the way up'], ARRAY['Stance: Athletic base', 'Elbows: Fixed hinge', 'Shoulders: Down', 'Range: Full extension'], 'tricep-pushdowns'),
('skull_crushers', 'Skull Crushers', 'Targets the long head of the triceps for arm size.', 'any', ARRAY['Barbell', 'EZ Bar', 'Dumbbells', 'Bench'], ARRAY['Triceps'], ARRAY['Lower bar to forehead or behind head', 'Keep elbows pointing up', 'Do not flare elbows too wide', 'Drive weight back up'], ARRAY['Grip: Shoulder width', 'Elbows: Tucked in', 'Path: Arc to forehead', 'Wrists: Strong/Straight'], 'skull-crushers'),

-- BICEPS
('barbell_curls', 'Barbell Curls', 'The standard mass builder for biceps.', 'any', ARRAY['Barbell'], ARRAY['Biceps'], ARRAY['Keep elbows at sides', 'Do not swing body', 'Squeeze at top', 'Lower all the way down'], ARRAY['Grip: Shoulder width', 'Elbows: Fixed', 'Torso: Upright', 'Wrists: Supinated (Palms up)'], 'barbell-curls'),
('hammer_curls', 'Hammer Curls', 'Targets the brachialis and brachioradialis for arm thickness.', 'any', ARRAY['Dumbbells'], ARRAY['Biceps', 'Brachialis', 'Forearms'], ARRAY['Palms face each other', 'Keep elbows pinned', 'Control the swing', 'Squeeze forearm at top'], ARRAY['Grip: Neutral (Hammer)', 'Motion: Arc to shoulder', 'Elbows: Stationary', 'Tempo: Controlled'], 'hammer-curls'),

-- LEGS
('squats', 'Squats', 'The king of all exercises. Builds massive legs and core strength.', 'gym', ARRAY['Barbell', 'Rack'], ARRAY['Quads', 'Glutes', 'Core', 'Hamstrings'], ARRAY['Keep chest up', 'Drive knees out', 'Break parallel depth', 'Brace core hard'], ARRAY['Feet: Shoulder width', 'Spine: Neutral', 'Path: Vertical bar path', 'Heels: Planted'], 'squats'),
('leg_press', 'Leg Press', 'Heavy leg builder that removes spinal loading.', 'gym', ARRAY['Leg Press Machine'], ARRAY['Quads', 'Glutes'], ARRAY['Do not lock out knees', 'Lower sled as deep as possible', 'Keep lower back on pad', 'Drive through heels'], ARRAY['Feet: Shoulder width on platform', 'Knees: Tracking over toes', 'Back: Flat against seat', 'Depth: 90 degrees or more'], 'leg-press'),
('romanian_deadlifts', 'Romanian Deadlifts', 'Hip-hinge movement that builds flexible, strong hamstrings and glutes.', 'any', ARRAY['Barbell', 'Dumbbells'], ARRAY['Hamstrings', 'Glutes', 'Lower Back'], ARRAY['Soft bend in knees', 'Push hips back as far as possible', 'Keep back flat', 'Feel the hamstring stretch'], ARRAY['Hinge: Hips go back', 'Spine: Neutral', 'Bar: Slides down legs', 'Range: Until hamstrings tight'], 'romanian-deadlifts'),
('leg_curls', 'Leg Curls', 'Isolates the hamstrings through knee flexion.', 'gym', ARRAY['Leg Curl Machine'], ARRAY['Hamstrings'], ARRAY['Keep hips down on pad', 'Control the negative', 'Squeeze hamstrings at contraction', 'Do not use momentum'], ARRAY['Hips: Pressed into bench', 'Knees: Aligned with pivot', 'Toes: Dorsiflexed (up)', 'Tempo: Slow'], 'leg-curls'),
('leg_extensions', 'Leg Extensions', 'Isolation exercise for quad definition and strength.', 'gym', ARRAY['Leg Extension Machine'], ARRAY['Quads'], ARRAY['Squeeze quads at top', 'Control weight down', 'Keep butt in seat', 'Adjust pad to ankle'], ARRAY['Back: Against pad', 'Pivot: Aligned with knee', 'Toes: Up', 'Top: Brief pause'], 'leg-extensions'),
('calf_raises', 'Calf Raises', 'Essential for lower leg development.', 'any', ARRAY['Machine', 'Dumbbell'], ARRAY['Calves'], ARRAY['Full stretch at bottom', 'Full contraction at top', 'Pause at the top', 'Do not bounce'], ARRAY['Knees: Straight (standing) / Bent (seated)', 'Ankles: Full ROM', 'Tempo: Slow', 'Balance: Hold support if needed'], 'calf-raises'),
('lunges', 'Lunges', 'Functional unilateral leg exercise for balance and glutes.', 'any', ARRAY['Dumbbells'], ARRAY['Quads', 'Glutes', 'Hamstrings'], ARRAY['Keep torso upright', 'Knee touches floor gently', 'Drive through front heel', 'Keep core braced'], ARRAY['Step: Long stride', 'Knees: 90 degree angles', 'Chest: Up', 'Width: Hip width'], 'lunges');

-- Insert exercise alternatives (after exercises exist)
INSERT INTO exercise_alternatives (exercise_id, alternative_id, reason) VALUES
-- Bench Press alternatives
('bench_press', 'incline_db_press', 'Better range of motion'),
('bench_press', 'chest_dips', 'Bodyweight alternative'),
-- Incline DB Press alternatives
('incline_db_press', 'bench_press', 'Heavy compound'),
('incline_db_press', 'cable_flyes', 'Constant tension isolation'),
-- Cable Flyes alternatives
('cable_flyes', 'dumbbell_flyes', 'Free weight alternative'),
-- Dumbbell Flyes alternatives
('dumbbell_flyes', 'cable_flyes', 'Better tension profile'),
-- Chest Dips alternatives
('chest_dips', 'bench_press', 'Weighted alternative'),
-- Overhead Press alternatives
('overhead_press', 'db_shoulder_press', 'Unilateral stability'),
-- DB Shoulder Press alternatives
('db_shoulder_press', 'overhead_press', 'Heavy compound'),
-- Lateral Raises alternatives
('lateral_raises', 'face_pulls', 'Rear delt focus'),
-- Face Pulls alternatives
('face_pulls', 'lateral_raises', 'Side delt focus'),
-- Pull-Ups alternatives
('pull_ups', 'lat_pulldowns', 'Adjustable weight'),
-- Lat Pulldowns alternatives
('lat_pulldowns', 'pull_ups', 'Bodyweight standard'),
-- Barbell Rows alternatives
('barbell_rows', 'dumbbell_rows', 'Unilateral/Back support'),
-- Dumbbell Rows alternatives
('dumbbell_rows', 'barbell_rows', 'Heavy bilateral'),
-- Deadlifts alternatives
('deadlifts', 'romanian_deadlifts', 'Hypertrophy focus'),
-- Tricep Pushdowns alternatives
('tricep_pushdowns', 'skull_crushers', 'Free weight alternative'),
-- Skull Crushers alternatives
('skull_crushers', 'tricep_pushdowns', 'Joint friendly'),
-- Barbell Curls alternatives
('barbell_curls', 'hammer_curls', 'Brachialis focus'),
-- Hammer Curls alternatives
('hammer_curls', 'barbell_curls', 'Mass builder'),
-- Squats alternatives
('squats', 'leg_press', 'Back friendly'),
-- Leg Press alternatives
('leg_press', 'squats', 'Free weight king'),
('leg_press', 'lunges', 'Functional alternative'),
-- Romanian Deadlifts alternatives
('romanian_deadlifts', 'leg_curls', 'Machine isolation'),
('romanian_deadlifts', 'deadlifts', 'Compound power'),
-- Leg Curls alternatives
('leg_curls', 'romanian_deadlifts', 'Compound stretch'),
-- Leg Extensions alternatives
('leg_extensions', 'lunges', 'Compound functional'),
('leg_extensions', 'squats', 'Free weight'),
-- Calf Raises - no alternatives in DB yet
-- Lunges alternatives
('lunges', 'squats', 'Bilateral power'),
('lunges', 'leg_press', 'Machine alternative');

-- ============================================================================
-- DATA MIGRATION: Convert existing JSONB to normalized tables
-- ============================================================================

-- Migrate workout_days from JSONB (if data exists)
DO $$
DECLARE
  plan_record RECORD;
  day_data JSONB;
  day_idx INTEGER;
  exercise_data JSONB;
  ex_idx INTEGER;
  new_day_id UUID;
BEGIN
  -- Loop through existing workout plans with JSONB data
  FOR plan_record IN 
    SELECT id, workout_days 
    FROM workout_plans 
    WHERE workout_days IS NOT NULL 
      AND jsonb_array_length(workout_days) > 0
  LOOP
    day_idx := 0;
    -- Loop through each day in the JSONB array
    FOR day_data IN SELECT * FROM jsonb_array_elements(plan_record.workout_days)
    LOOP
      -- Insert the workout day
      INSERT INTO workout_days (plan_id, order_index, name, muscle_groups)
      VALUES (
        plan_record.id,
        day_idx,
        COALESCE(day_data->>'name', 'Day ' || (day_idx + 1)),
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(day_data->'muscleGroups')),
          '{}'::TEXT[]
        )
      )
      RETURNING id INTO new_day_id;
      
      -- Insert exercises for this day
      IF day_data->'exercises' IS NOT NULL THEN
        ex_idx := 0;
        FOR exercise_data IN SELECT * FROM jsonb_array_elements(day_data->'exercises')
        LOOP
          -- Try to match exercise by name to get the exercise_id
          -- If no match, we'll use the name as a fallback (though this shouldn't happen with proper data)
          INSERT INTO plan_exercises (
            workout_day_id,
            exercise_id,
            order_index,
            target_sets,
            target_reps,
            rest_seconds,
            notes
          )
          SELECT
            new_day_id,
            COALESCE(e.id, 'unknown'),
            ex_idx,
            COALESCE((exercise_data->>'sets')::INTEGER, 3),
            COALESCE(exercise_data->>'reps', '8-12'),
            COALESCE((exercise_data->>'restSeconds')::INTEGER, 90),
            exercise_data->>'notes'
          FROM (SELECT 1) AS dummy
          LEFT JOIN exercises e ON LOWER(e.name) = LOWER(exercise_data->>'name')
          WHERE exercise_data->>'name' IS NOT NULL;
          
          ex_idx := ex_idx + 1;
        END LOOP;
      END IF;
      
      day_idx := day_idx + 1;
    END LOOP;
  END LOOP;
END $$;

-- Migrate body measurements JSONB to measurement_logs
INSERT INTO measurement_logs (
  user_id,
  date,
  weight_kg,
  body_fat_pct,
  chest_cm,
  waist_cm,
  hips_cm,
  left_arm_cm,
  right_arm_cm,
  left_thigh_cm,
  right_thigh_cm
)
SELECT
  user_id,
  date,
  weight,
  body_fat,
  (measurements->>'chest')::NUMERIC,
  (measurements->>'waist')::NUMERIC,
  (measurements->>'hips')::NUMERIC,
  (measurements->>'arms')::NUMERIC, -- Legacy: arms goes to left_arm
  (measurements->>'arms')::NUMERIC, -- Legacy: arms goes to right_arm
  (measurements->>'thighs')::NUMERIC, -- Legacy: thighs goes to left_thigh
  (measurements->>'thighs')::NUMERIC  -- Legacy: thighs goes to right_thigh
FROM body_measurements
WHERE measurements IS NOT NULL AND measurements != '{}'::JSONB;

-- ============================================================================
-- DROP DEPRECATED COLUMNS (Optional - uncomment when ready)
-- ============================================================================
-- After verifying migration, you can remove the JSONB columns:
-- ALTER TABLE workout_plans DROP COLUMN workout_days;
-- ALTER TABLE body_measurements DROP COLUMN measurements;

-- Add comment noting the column is deprecated
COMMENT ON COLUMN workout_plans.workout_days IS 'DEPRECATED: Use workout_days table instead. Will be removed in future migration.';
COMMENT ON COLUMN body_measurements.measurements IS 'DEPRECATED: Use measurement_logs table instead. Will be removed in future migration.';
