-- Add Workout Schedule for Date-Specific Workout Planning
-- This decouples the "Weekly Template" from "Specific Dates"
-- 
-- Design:
-- - workout_plans: Contains the weekly TEMPLATE (e.g., "Monday = Push Day")
-- - workout_schedule: Maps specific DATES to workout sessions (e.g., "2026-01-06 = Push Day")
-- - workout_sessions: Contains actual COMPLETED workout history
--
-- This allows:
-- 1. Changing the current plan without affecting past history
-- 2. Scheduling specific workouts on specific dates
-- 3. Viewing what was PLANNED vs what was DONE

-- ============================================================================
-- WORKOUT SCHEDULE TABLE
-- Maps specific dates to planned workouts (before they're completed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workout_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- The specific date this workout is scheduled for
  scheduled_date DATE NOT NULL,
  
  -- Reference to the workout plan template (optional - can be ad-hoc)
  workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
  
  -- Snapshot of what was planned (stored as JSONB so it doesn't change if template changes)
  -- This preserves what was actually scheduled on this date
  workout_snapshot JSONB NOT NULL DEFAULT '{}',
  -- Example: { "name": "Push Day", "muscleGroups": ["Chest", "Shoulders"], "exercises": [...] }
  
  -- Status of this scheduled workout
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped', 'rest')),
  
  -- Reference to the completed session (if status = 'completed')
  session_id UUID, -- Will reference workout_sessions when that table is created
  
  -- Notes or modifications for this specific date
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one schedule entry per date
  UNIQUE(user_id, scheduled_date)
);

-- Indexes for efficient queries
CREATE INDEX idx_workout_schedule_user_date ON workout_schedule(user_id, scheduled_date);
CREATE INDEX idx_workout_schedule_date_range ON workout_schedule(scheduled_date);
CREATE INDEX idx_workout_schedule_status ON workout_schedule(status);

-- ============================================================================
-- TRAINING DAYS HISTORY TABLE
-- Tracks what training days were active on what dates
-- This prevents retroactive changes from affecting past weeks
-- ============================================================================
CREATE TABLE IF NOT EXISTS training_days_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- The week this configuration was active (stores the Monday of that week)
  week_start DATE NOT NULL,
  
  -- Snapshot of training days that were active during this week
  training_days TEXT[] NOT NULL DEFAULT '{}',
  -- Example: ['Monday', 'Wednesday', 'Friday']
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one training config per week
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_training_days_history_user_week ON training_days_history(user_id, week_start);

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================
CREATE TRIGGER update_workout_schedule_updated_at 
  BEFORE UPDATE ON workout_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE workout_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_days_history ENABLE ROW LEVEL SECURITY;

-- Workout Schedule: Users can manage their own
CREATE POLICY "Users can view own workout schedule" ON workout_schedule
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout schedule" ON workout_schedule
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout schedule" ON workout_schedule
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout schedule" ON workout_schedule
  FOR DELETE USING (auth.uid() = user_id);

-- Training Days History: Users can manage their own
CREATE POLICY "Users can view own training days history" ON training_days_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training days history" ON training_days_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training days history" ON training_days_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own training days history" ON training_days_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTION: Get scheduled workout for a specific date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_scheduled_workout(
  p_user_id UUID,
  p_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_schedule RECORD;
BEGIN
  SELECT * INTO v_schedule
  FROM workout_schedule
  WHERE user_id = p_user_id
    AND scheduled_date = p_date;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_schedule.id,
      'date', v_schedule.scheduled_date,
      'status', v_schedule.status,
      'workout', v_schedule.workout_snapshot,
      'notes', v_schedule.notes
    );
  END IF;
  
  -- No specific schedule found - return null (caller should use weekly template)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Save training days snapshot for current week
-- Called when user changes their training days to preserve history
-- ============================================================================
CREATE OR REPLACE FUNCTION save_training_days_snapshot(
  p_user_id UUID,
  p_training_days TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_week_start DATE;
BEGIN
  -- Get Monday of current week
  v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  
  -- Upsert the training days for this week
  INSERT INTO training_days_history (user_id, week_start, training_days)
  VALUES (p_user_id, v_week_start, p_training_days)
  ON CONFLICT (user_id, week_start) 
  DO UPDATE SET training_days = p_training_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
