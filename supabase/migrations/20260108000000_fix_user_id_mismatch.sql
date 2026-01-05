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

