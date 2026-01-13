-- Migration: Secure Subscription Architecture
-- Purpose: Move subscription tier to server-side to prevent client-side manipulation
-- Date: 2026-01-20

-- ============================================================================
-- PHASE 1: ADD SUBSCRIPTION TIER TO USERS TABLE
-- ============================================================================

-- Add subscription_tier column to users table
-- This is the "source of truth" for subscription status
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
CHECK (subscription_tier IN ('free', 'pro'));

-- Add index for fast tier lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);

-- ============================================================================
-- PHASE 2: SECURE CHECK_SCAN_AVAILABILITY FUNCTION
-- ============================================================================

-- Drop the old function that accepts interval_days from client (SECURITY RISK!)
DROP FUNCTION IF EXISTS check_scan_availability(UUID, INT);

-- Create new secure function that determines interval server-side
CREATE OR REPLACE FUNCTION check_scan_availability(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  interval_days INT;
  last_scan_date TIMESTAMPTZ;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- Get the user's subscription tier from the database (SERVER-SIDE TRUTH)
  SELECT subscription_tier INTO user_tier
  FROM public.users
  WHERE id = p_user_id;
  
  -- If user not found, deny access
  IF user_tier IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Determine interval based on tier (SERVER-SIDE LOGIC)
  IF user_tier = 'pro' THEN
    interval_days := 7;  -- Pro: 1 scan per week
  ELSE
    interval_days := 30; -- Free: 1 scan per month
  END IF;
  
  -- Calculate the cutoff date
  cutoff_date := NOW() - (interval_days || ' days')::INTERVAL;
  
  -- Find the most recent scan for this user
  SELECT created_at INTO last_scan_date
  FROM scan_logs
  WHERE user_id = p_user_id
    AND scan_type = 'physique'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no scans exist, user can scan
  IF last_scan_date IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- If last scan was before the cutoff, user can scan
  IF last_scan_date < cutoff_date THEN
    RETURN TRUE;
  END IF;
  
  -- User has scanned recently, cannot scan again
  RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_scan_availability(UUID) TO authenticated;

-- ============================================================================
-- PHASE 3: SECURE GET_DAYS_UNTIL_NEXT_SCAN FUNCTION
-- ============================================================================

-- Drop the old function that accepts interval_days from client
DROP FUNCTION IF EXISTS get_days_until_next_scan(UUID, INT);

-- Create new secure function
CREATE OR REPLACE FUNCTION get_days_until_next_scan(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  interval_days INT;
  last_scan_date TIMESTAMPTZ;
  next_scan_date TIMESTAMPTZ;
  days_remaining INT;
BEGIN
  -- Get the user's subscription tier from the database
  SELECT subscription_tier INTO user_tier
  FROM public.users
  WHERE id = p_user_id;
  
  -- If user not found, return -1 to indicate error
  IF user_tier IS NULL THEN
    RETURN -1;
  END IF;
  
  -- Determine interval based on tier
  IF user_tier = 'pro' THEN
    interval_days := 7;
  ELSE
    interval_days := 30;
  END IF;
  
  -- Find the most recent scan
  SELECT created_at INTO last_scan_date
  FROM scan_logs
  WHERE user_id = p_user_id
    AND scan_type = 'physique'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no scans exist, user can scan now (0 days)
  IF last_scan_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate when the next scan is available
  next_scan_date := last_scan_date + (interval_days || ' days')::INTERVAL;
  
  -- Calculate days remaining (0 if already available)
  days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (next_scan_date - NOW())) / 86400));
  
  RETURN days_remaining;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_days_until_next_scan(UUID) TO authenticated;

-- ============================================================================
-- PHASE 4: GET NEXT SCAN DATE FUNCTION (for caching)
-- ============================================================================

-- Function to get the actual next scan date (for UI caching)
CREATE OR REPLACE FUNCTION get_next_scan_date(p_user_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  interval_days INT;
  last_scan_date TIMESTAMPTZ;
BEGIN
  -- Get the user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM public.users
  WHERE id = p_user_id;
  
  -- If user not found, return NULL
  IF user_tier IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Determine interval based on tier
  IF user_tier = 'pro' THEN
    interval_days := 7;
  ELSE
    interval_days := 30;
  END IF;
  
  -- Find the most recent scan
  SELECT created_at INTO last_scan_date
  FROM scan_logs
  WHERE user_id = p_user_id
    AND scan_type = 'physique'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no scans exist, user can scan now
  IF last_scan_date IS NULL THEN
    RETURN NOW();
  END IF;
  
  -- Return next available scan date
  RETURN last_scan_date + (interval_days || ' days')::INTERVAL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_scan_date(UUID) TO authenticated;

-- ============================================================================
-- PHASE 5: COMPOSITE INDEX FOR PERFORMANCE
-- ============================================================================

-- Drop old index if exists (we'll create a better one)
DROP INDEX IF EXISTS idx_scan_logs_user_created;

-- Create optimized composite index for quota checking
-- This makes the quota check instant even with millions of rows
CREATE INDEX idx_scan_logs_user_created_desc 
ON scan_logs(user_id, created_at DESC);

-- Partial index for physique scans specifically (even faster)
CREATE INDEX idx_scan_logs_physique_user_created 
ON scan_logs(user_id, created_at DESC) 
WHERE scan_type = 'physique';

-- ============================================================================
-- PHASE 6: HELPER FUNCTION TO GET USER TIER
-- ============================================================================

-- Function to get user's subscription tier (useful for client sync)
CREATE OR REPLACE FUNCTION get_user_subscription_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT subscription_tier INTO user_tier
  FROM public.users
  WHERE id = p_user_id;
  
  RETURN COALESCE(user_tier, 'free');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_subscription_tier(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.users.subscription_tier IS 'User subscription tier (free or pro). Updated via RevenueCat webhook.';
COMMENT ON FUNCTION check_scan_availability(UUID) IS 'Securely checks if user can scan. Tier is determined server-side to prevent manipulation.';
COMMENT ON FUNCTION get_days_until_next_scan(UUID) IS 'Returns days until next scan is available. Tier determined server-side.';
COMMENT ON FUNCTION get_next_scan_date(UUID) IS 'Returns the timestamp when the next scan will be available.';
COMMENT ON FUNCTION get_user_subscription_tier(UUID) IS 'Returns user subscription tier for client sync.';
