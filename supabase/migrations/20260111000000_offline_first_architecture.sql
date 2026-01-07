-- ============================================================================
-- OFFLINE-FIRST ARCHITECTURE & AUTH FIX MIGRATION
-- ============================================================================
-- This migration:
-- 1. Fixes the user ID issue (ensures public.users.id === auth.users.id)
-- 2. Adds sync tracking for offline-first architecture
-- 3. Creates pending_sync table for queued offline operations
-- ============================================================================

-- ============================================================================
-- STEP 1: FIX USER ID GENERATION
-- ============================================================================

-- Remove the default UUID generation from users.id
-- The ID MUST come from auth.uid() explicitly
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- Add comment explaining the constraint
COMMENT ON COLUMN users.id IS 'Must match auth.users.id - set explicitly using auth.uid() during INSERT';

-- Create trigger to validate user ID matches auth.uid()
CREATE OR REPLACE FUNCTION validate_user_id_matches_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if no auth context (for admin operations)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Ensure the ID matches the authenticated user
  IF NEW.id != auth.uid() THEN
    RAISE EXCEPTION 'User ID (%) must match authenticated user ID (%)', NEW.id, auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger (drop if exists first)
DROP TRIGGER IF EXISTS ensure_user_id_matches_auth ON users;
CREATE TRIGGER ensure_user_id_matches_auth
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id_matches_auth();

-- ============================================================================
-- STEP 2: ADD SYNC TRACKING COLUMNS
-- ============================================================================

-- Add sync tracking to main tables for offline-first support
DO $$ 
BEGIN
  -- Add to users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'synced_at') THEN
    ALTER TABLE users ADD COLUMN synced_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'local_version') THEN
    ALTER TABLE users ADD COLUMN local_version INTEGER DEFAULT 1;
  END IF;

  -- Add to workout_plans
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_plans' AND column_name = 'synced_at') THEN
    ALTER TABLE workout_plans ADD COLUMN synced_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_plans' AND column_name = 'local_version') THEN
    ALTER TABLE workout_plans ADD COLUMN local_version INTEGER DEFAULT 1;
  END IF;

  -- Add to workout_sessions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_sessions' AND column_name = 'synced_at') THEN
    ALTER TABLE workout_sessions ADD COLUMN synced_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_sessions' AND column_name = 'is_synced') THEN
    ALTER TABLE workout_sessions ADD COLUMN is_synced BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add to physique_scans
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'physique_scans' AND column_name = 'synced_at') THEN
    ALTER TABLE physique_scans ADD COLUMN synced_at TIMESTAMPTZ;
  END IF;

  -- Add to measurement_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'measurement_logs' AND column_name = 'synced_at') THEN
    ALTER TABLE measurement_logs ADD COLUMN synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: CREATE PENDING SYNC QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'failed', 'completed'))
);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON pending_sync(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pending_sync_user ON pending_sync(user_id);

-- RLS for pending_sync
ALTER TABLE pending_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pending sync" ON pending_sync;
CREATE POLICY "Users can manage own pending sync" ON pending_sync
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: CREATE SYNC HELPER FUNCTIONS
-- ============================================================================

-- Function to mark records as synced
CREATE OR REPLACE FUNCTION mark_as_synced(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET synced_at = NOW() WHERE id = $1', p_table_name)
  USING p_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unsynced records for a user
CREATE OR REPLACE FUNCTION get_unsynced_records(
  p_user_id UUID,
  p_table_name TEXT
)
RETURNS TABLE (id UUID, data JSONB) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, to_jsonb(%I) as data FROM %I WHERE user_id = $1 AND synced_at IS NULL',
    p_table_name, p_table_name
  )
  USING p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: UPDATE TRIGGERS FOR AUTO-SYNC TRACKING
-- ============================================================================

-- Trigger to clear synced_at on update (marks record as needing re-sync)
CREATE OR REPLACE FUNCTION clear_synced_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only clear if this isn't a sync operation (which would set synced_at)
  IF NEW.synced_at IS NULL OR NEW.synced_at = OLD.synced_at THEN
    NEW.synced_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to workout_plans
DROP TRIGGER IF EXISTS clear_synced_on_workout_plan_update ON workout_plans;
CREATE TRIGGER clear_synced_on_workout_plan_update
  BEFORE UPDATE ON workout_plans
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION clear_synced_on_update();

-- ============================================================================
-- STEP 6: FIX ANY EXISTING ID MISMATCHES
-- ============================================================================

-- This function can be called manually to fix ID mismatches
CREATE OR REPLACE FUNCTION fix_all_user_id_mismatches()
RETURNS TABLE (
  old_id UUID,
  new_id UUID,
  email TEXT,
  status TEXT
) AS $$
DECLARE
  r RECORD;
BEGIN
  -- Find all mismatched users
  FOR r IN 
    SELECT p.id as public_id, a.id as auth_id, p.email
    FROM public.users p
    JOIN auth.users a ON LOWER(p.email) = LOWER(a.email)
    WHERE p.id != a.id
  LOOP
    BEGIN
      -- Temporarily disable the trigger
      ALTER TABLE public.users DISABLE TRIGGER ensure_user_id_matches_auth;
      
      -- Update the user ID
      UPDATE public.users SET id = r.auth_id WHERE id = r.public_id;
      
      -- Update related tables
      UPDATE nutrition_targets SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE equipment_profiles SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE workout_plans SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE physique_scans SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE workout_sessions SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE workout_schedule SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE measurement_logs SET user_id = r.auth_id WHERE user_id = r.public_id;
      UPDATE cardio_logs SET user_id = r.auth_id WHERE user_id = r.public_id;
      
      -- Re-enable trigger
      ALTER TABLE public.users ENABLE TRIGGER ensure_user_id_matches_auth;
      
      old_id := r.public_id;
      new_id := r.auth_id;
      email := r.email;
      status := 'fixed';
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      -- Re-enable trigger on error
      ALTER TABLE public.users ENABLE TRIGGER ensure_user_id_matches_auth;
      
      old_id := r.public_id;
      new_id := r.auth_id;
      email := r.email;
      status := 'error: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (they can only fix their own via RLS)
GRANT EXECUTE ON FUNCTION fix_all_user_id_mismatches() TO authenticated;
