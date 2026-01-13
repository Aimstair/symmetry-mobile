-- Migration: Add Scan Tracking for Subscription Quotas
-- Purpose: Track physique scan usage for free/pro tier enforcement

-- ============================================================================
-- SCAN LOGS TABLE
-- ============================================================================

-- Create table to track scan usage per user
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL DEFAULT 'physique',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient quota checking
CREATE INDEX idx_scan_logs_user_created ON scan_logs(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on scan_logs
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own scan logs
CREATE POLICY "Users can view own scan logs"
  ON scan_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own scan logs
CREATE POLICY "Users can insert own scan logs"
  ON scan_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- QUOTA CHECK FUNCTION
-- ============================================================================

-- Function to check if a user can perform a scan based on interval
-- Returns true if the user hasn't scanned in the last X days
CREATE OR REPLACE FUNCTION check_scan_availability(
  p_user_id UUID,
  p_interval_days INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_scan_date TIMESTAMPTZ;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- Calculate the cutoff date (X days ago)
  cutoff_date := NOW() - (p_interval_days || ' days')::INTERVAL;
  
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_scan_availability(UUID, INT) TO authenticated;

-- ============================================================================
-- HELPER FUNCTION: Get days until next scan
-- ============================================================================

CREATE OR REPLACE FUNCTION get_days_until_next_scan(
  p_user_id UUID,
  p_interval_days INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_scan_date TIMESTAMPTZ;
  next_scan_date TIMESTAMPTZ;
  days_remaining INT;
BEGIN
  -- Find the most recent scan for this user
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
  next_scan_date := last_scan_date + (p_interval_days || ' days')::INTERVAL;
  
  -- Calculate days remaining (0 if already available)
  days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (next_scan_date - NOW())) / 86400));
  
  RETURN days_remaining;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_days_until_next_scan(UUID, INT) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE scan_logs IS 'Tracks physique scan usage for subscription quota enforcement';
COMMENT ON COLUMN scan_logs.user_id IS 'The user who performed the scan';
COMMENT ON COLUMN scan_logs.scan_type IS 'Type of scan (currently only physique)';
COMMENT ON COLUMN scan_logs.created_at IS 'When the scan was performed';
COMMENT ON FUNCTION check_scan_availability IS 'Returns true if user can scan (no scan in last X days)';
COMMENT ON FUNCTION get_days_until_next_scan IS 'Returns days until user can scan again (0 if available now)';
