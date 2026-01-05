-- Fix: Ensure public.users.id uses auth.users.id
-- This migration fixes the ID mismatch between auth.users and public.users
-- 
-- CRITICAL: Run this migration AFTER running the one-time fix below in Supabase SQL Editor

-- ============================================================================
-- ONE-TIME FIX (Run in Supabase SQL Editor as admin BEFORE applying this migration)
-- ============================================================================
/*
-- Step 1: Disable RLS temporarily for the fix
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 2: Fix existing mismatched users by matching on email
UPDATE public.users p
SET id = a.id
FROM auth.users a
WHERE LOWER(p.email) = LOWER(a.email)
  AND p.id != a.id;

-- Step 3: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the fix
SELECT 
  p.id as public_id, 
  a.id as auth_id, 
  p.email,
  CASE WHEN p.id = a.id THEN '✅ MATCH' ELSE '❌ MISMATCH' END as status
FROM public.users p
LEFT JOIN auth.users a ON LOWER(p.email) = LOWER(a.email);
*/

-- ============================================================================
-- SCHEMA FIX: Prevent future ID mismatches
-- ============================================================================

-- Drop the default UUID generation - we want to use auth.uid() explicitly
ALTER TABLE users 
ALTER COLUMN id DROP DEFAULT;

-- Add a comment explaining the ID should come from auth.users
COMMENT ON COLUMN users.id IS 'Must match auth.users.id - set explicitly during INSERT using auth.uid()';

-- Create or replace a trigger to validate that the inserted user ID matches auth.uid()
CREATE OR REPLACE FUNCTION validate_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify the ID matches the current authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No authenticated user session - cannot insert user record';
  END IF;
  
  IF NEW.id != auth.uid() THEN
    RAISE EXCEPTION 'User ID (%) must match authenticated user ID (%)', NEW.id, auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger for new inserts
DROP TRIGGER IF EXISTS ensure_user_id_matches_auth ON users;
CREATE TRIGGER ensure_user_id_matches_auth
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id();

-- ============================================================================
-- RPC FUNCTION: Auto-fix user ID mismatch (called from app)
-- This allows the app to fix mismatched IDs when detected
-- Uses SECURITY DEFINER to bypass RLS for the fix operation
-- ============================================================================
CREATE OR REPLACE FUNCTION fix_user_id_mismatch(
  old_id UUID,
  new_id UUID,
  user_email TEXT
)
RETURNS VOID AS $$
DECLARE
  v_auth_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Get the current authenticated user's ID
  v_auth_id := auth.uid();
  
  -- Verify the new_id matches the authenticated user
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user session';
  END IF;
  
  IF v_auth_id != new_id THEN
    RAISE EXCEPTION 'New ID (%) must match authenticated user ID (%)', new_id, v_auth_id;
  END IF;
  
  -- Check if user with old_id and matching email exists
  -- This SELECT bypasses RLS because of SECURITY DEFINER
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = old_id AND LOWER(email) = LOWER(user_email)
  ) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User with old ID (%) and email (%) not found', old_id, user_email;
  END IF;
  
  -- Temporarily disable the trigger that would block ID update
  ALTER TABLE public.users DISABLE TRIGGER ensure_user_id_matches_auth;
  
  -- Update the user's ID in the main users table
  UPDATE public.users 
  SET id = new_id, updated_at = NOW() 
  WHERE id = old_id AND LOWER(email) = LOWER(user_email);
  
  -- Re-enable the trigger
  ALTER TABLE public.users ENABLE TRIGGER ensure_user_id_matches_auth;
  
  -- Update all related tables' foreign key references
  UPDATE public.nutrition_targets SET user_id = new_id WHERE user_id = old_id;
  UPDATE public.equipment_profiles SET user_id = new_id WHERE user_id = old_id;
  UPDATE public.workout_plans SET user_id = new_id WHERE user_id = old_id;
  UPDATE public.body_measurements SET user_id = new_id WHERE user_id = old_id;
  UPDATE public.physique_scans SET user_id = new_id WHERE user_id = old_id;
  UPDATE public.cardio_logs SET user_id = new_id WHERE user_id = old_id;
  
  -- Also update schedule tables if they exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workout_schedule') THEN
    UPDATE public.workout_schedule SET user_id = new_id WHERE user_id = old_id;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'training_days_history') THEN
    UPDATE public.training_days_history SET user_id = new_id WHERE user_id = old_id;
  END IF;
  
  -- Log success (optional, for debugging)
  RAISE NOTICE 'Successfully updated user ID from % to % for %', old_id, new_id, user_email;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;