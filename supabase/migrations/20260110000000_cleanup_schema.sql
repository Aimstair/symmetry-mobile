-- Schema Cleanup and Improvements
-- Date: 2026-01-10
-- 
-- Changes:
-- 1. Drop redundant tables (body_measurements, training_days_history)
-- 2. Improve workout_schedule to auto-track completion
-- 3. Add status tracking to workout_sessions
-- 4. Better naming conventions and relationships

-- ============================================================================
-- STEP 1: Drop Redundant Tables
-- ============================================================================

-- Drop body_measurements (replaced by measurement_logs which is properly normalized)
DROP TABLE IF EXISTS body_measurements CASCADE;

-- Drop training_days_history (redundant - users table already tracks this)
-- If needed, we can query user update history from audit logs
DROP TABLE IF EXISTS training_days_history CASCADE;

-- ============================================================================
-- STEP 2: Add Status Column to workout_sessions
-- ============================================================================

-- Add status column to track if session was completed, abandoned, or auto-saved
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workout_sessions' AND column_name = 'status'
  ) THEN
    ALTER TABLE workout_sessions 
    ADD COLUMN status TEXT NOT NULL DEFAULT 'completed' 
    CHECK (status IN ('completed', 'incomplete', 'auto_saved'));
    
    -- Add index for status queries
    CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add workout_day_id to workout_schedule
-- ============================================================================

-- Link schedule to actual workout day (not just plan)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workout_schedule' AND column_name = 'workout_day_id'
  ) THEN
    ALTER TABLE workout_schedule 
    ADD COLUMN workout_day_id UUID REFERENCES workout_days(id) ON DELETE SET NULL;
    
    CREATE INDEX idx_workout_schedule_workout_day_id ON workout_schedule(workout_day_id);
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add Trigger to Auto-Update Schedule When Session is Saved
-- ============================================================================

-- Function to automatically mark schedule as completed when session is created
CREATE OR REPLACE FUNCTION auto_mark_schedule_completed()
RETURNS TRIGGER AS $$
DECLARE
  schedule_record RECORD;
BEGIN
  -- Find today's schedule for this user
  SELECT * INTO schedule_record
  FROM workout_schedule
  WHERE user_id = NEW.user_id
    AND scheduled_date = DATE(NEW.started_at)
    AND status = 'scheduled'
  LIMIT 1;
  
  -- If a schedule exists, mark it as completed
  IF FOUND THEN
    UPDATE workout_schedule
    SET status = 'completed',
        session_id = NEW.id,
        updated_at = NOW()
    WHERE id = schedule_record.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_mark_schedule_completed ON workout_sessions;

-- Create trigger on workout_sessions insert
CREATE TRIGGER trigger_auto_mark_schedule_completed
  AFTER INSERT ON workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_schedule_completed();

-- ============================================================================
-- STEP 5: Function to Auto-Create Schedule for Active Workout
-- ============================================================================

-- Function to create or get today's schedule entry
CREATE OR REPLACE FUNCTION ensure_today_schedule(
  p_user_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_workout_day_id UUID DEFAULT NULL,
  p_workout_snapshot JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  schedule_id UUID;
  today_date DATE;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Try to find existing schedule
  SELECT id INTO schedule_id
  FROM workout_schedule
  WHERE user_id = p_user_id
    AND scheduled_date = today_date;
  
  -- Create if doesn't exist
  IF schedule_id IS NULL THEN
    INSERT INTO workout_schedule (
      user_id,
      scheduled_date,
      workout_plan_id,
      workout_day_id,
      workout_snapshot,
      status
    ) VALUES (
      p_user_id,
      today_date,
      p_plan_id,
      p_workout_day_id,
      p_workout_snapshot,
      'scheduled'
    )
    RETURNING id INTO schedule_id;
  END IF;
  
  RETURN schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Update RLS Policies for New Structure
-- ============================================================================

-- Ensure workout_sessions has proper RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workout_sessions' AND policyname = 'Users can view own workout sessions'
  ) THEN
    ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own workout sessions" ON workout_sessions
      FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert own workout sessions" ON workout_sessions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update own workout sessions" ON workout_sessions
      FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete own workout sessions" ON workout_sessions
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Add Comments for Better Documentation
-- ============================================================================

COMMENT ON TABLE workout_schedule IS 'Date-specific workout planning. Maps dates to planned workouts before they are completed.';
COMMENT ON TABLE workout_sessions IS 'Completed workout history. Created when user finishes a workout.';
COMMENT ON TABLE session_exercises IS 'Exercises performed in a workout session. Child of workout_sessions.';
COMMENT ON TABLE session_sets IS 'Individual sets performed in a session. Child of session_exercises.';
COMMENT ON TABLE workout_plans IS 'Workout plan templates. Defines the weekly workout structure.';
COMMENT ON TABLE workout_days IS 'Days within a workout plan template. E.g., "Monday - Push Day".';
COMMENT ON TABLE plan_exercises IS 'Exercise prescriptions within a workout day. E.g., "Bench Press: 4x8-12".';
COMMENT ON TABLE measurement_logs IS 'Body measurement history. Tracks weight, body fat, and circumference measurements over time.';

COMMENT ON COLUMN workout_schedule.status IS 'Status: scheduled (planned but not done), completed (workout finished), skipped (user skipped), rest (rest day)';
COMMENT ON COLUMN workout_sessions.status IS 'Status: completed (normally finished), incomplete (started but not finished), auto_saved (auto-saved at day end)';
COMMENT ON COLUMN workout_schedule.workout_snapshot IS 'JSONB snapshot of planned workout. Preserved even if template changes.';

-- ============================================================================
-- STEP 8: Create View for Easy Schedule + Session Queries
-- ============================================================================

CREATE OR REPLACE VIEW workout_calendar AS
SELECT 
  ws.scheduled_date,
  ws.user_id,
  ws.status as schedule_status,
  ws.workout_snapshot->>'name' as planned_workout_name,
  ws.workout_plan_id,
  ws.workout_day_id,
  sess.id as session_id,
  sess.name as session_name,
  sess.started_at,
  sess.ended_at,
  sess.duration_seconds,
  sess.status as session_status,
  wp.name as plan_name,
  wd.name as day_name
FROM workout_schedule ws
LEFT JOIN workout_sessions sess ON sess.id = ws.session_id
LEFT JOIN workout_plans wp ON wp.id = ws.workout_plan_id
LEFT JOIN workout_days wd ON wd.id = ws.workout_day_id
ORDER BY ws.scheduled_date DESC;

COMMENT ON VIEW workout_calendar IS 'Unified view of scheduled workouts and completed sessions. Shows what was planned vs what was done.';

-- Grant access to authenticated users
GRANT SELECT ON workout_calendar TO authenticated;
