-- ============================================================================
-- User Feedback Table Migration
-- ============================================================================
-- This migration creates the user_feedback table for collecting in-app feedback.
-- Users can submit feedback directly from the Settings screen.
-- ============================================================================

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  device_model TEXT,
  device_os TEXT,
  app_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for querying by user and date
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON user_feedback(category);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can submit feedback"
  ON user_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON user_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Anonymous users can also submit feedback (for guest users)
CREATE POLICY "Anonymous users can submit feedback"
  ON user_feedback
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Policy: Service role can read all feedback for admin dashboard
CREATE POLICY "Service role can read all feedback"
  ON user_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment describing the table
COMMENT ON TABLE user_feedback IS 'User feedback submissions from the mobile app';
COMMENT ON COLUMN user_feedback.category IS 'Feedback category: general, bug, feature, support';
COMMENT ON COLUMN user_feedback.device_model IS 'Device model name (e.g., iPhone 14 Pro, Pixel 8)';
COMMENT ON COLUMN user_feedback.device_os IS 'Operating system and version (e.g., iOS 17.2, Android 14)';
