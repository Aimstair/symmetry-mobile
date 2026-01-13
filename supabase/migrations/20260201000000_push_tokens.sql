-- Migration: Push Notification Tokens & AI Job Notification Trigger
-- Purpose: Store push tokens and trigger notifications on AI job completion
-- Date: 2026-02-01

-- ============================================================================
-- USER PUSH TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One token per user (upsert on conflict)
  UNIQUE(user_id)
);

-- Index for fast token lookups by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);

-- Index for token lookups (useful for server-side sending)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON user_push_tokens(token);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_push_token_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_tokens_updated_at ON user_push_tokens;
CREATE TRIGGER trigger_push_tokens_updated_at
  BEFORE UPDATE ON user_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_token_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert own push tokens"
  ON user_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own tokens
CREATE POLICY "Users can view own push tokens"
  ON user_push_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update own push tokens"
  ON user_push_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete own push tokens"
  ON user_push_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATION QUEUE TABLE (for async processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Index for processing pending notifications
CREATE INDEX IF NOT EXISTS idx_notification_queue_status 
ON notification_queue(status) 
WHERE status = 'pending';

-- ============================================================================
-- AI JOB COMPLETION TRIGGER
-- ============================================================================

-- Function to queue a notification when AI job completes
CREATE OR REPLACE FUNCTION notify_ai_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  push_token TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Only fire when status changes TO 'completed' or 'failed'
  IF (OLD.status IS DISTINCT FROM NEW.status) AND 
     (NEW.status = 'completed' OR NEW.status = 'failed') THEN
    
    -- Get user's push token
    SELECT token INTO push_token
    FROM user_push_tokens
    WHERE user_id = NEW.user_id;
    
    -- Only queue notification if user has a push token
    IF push_token IS NOT NULL THEN
      IF NEW.status = 'completed' THEN
        notification_title := 'Analysis Complete! 🎯';
        notification_body := 'Your physique scan has been analyzed. Tap to view your symmetry score.';
      ELSE
        notification_title := 'Analysis Issue';
        notification_body := 'We encountered an issue analyzing your scan. Please try again.';
      END IF;
      
      -- Insert into notification queue
      INSERT INTO notification_queue (
        user_id,
        push_token,
        title,
        body,
        data
      ) VALUES (
        NEW.user_id,
        push_token,
        notification_title,
        notification_body,
        jsonb_build_object(
          'type', 'ai_job_complete',
          'jobId', NEW.id,
          'status', NEW.status
        )
      );
      
      -- Note: An Edge Function or cron job will process the notification_queue
      -- and send to Expo Push Service
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on ai_analysis_jobs table
DROP TRIGGER IF EXISTS trigger_ai_job_completion ON ai_analysis_jobs;
CREATE TRIGGER trigger_ai_job_completion
  AFTER UPDATE ON ai_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_ai_job_completion();

-- ============================================================================
-- HELPER FUNCTION: Get pending notifications for Edge Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_notifications(batch_size INT DEFAULT 100)
RETURNS TABLE (
  notification_id UUID,
  push_token TEXT,
  title TEXT,
  body TEXT,
  data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nq.id,
    nq.push_token,
    nq.title,
    nq.body,
    nq.data
  FROM notification_queue nq
  WHERE nq.status = 'pending'
  ORDER BY nq.created_at ASC
  LIMIT batch_size;
END;
$$;

-- Function to mark notifications as sent
CREATE OR REPLACE FUNCTION mark_notifications_sent(notification_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE notification_queue
  SET 
    status = 'sent',
    sent_at = NOW()
  WHERE id = ANY(notification_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Function to mark notification as failed
CREATE OR REPLACE FUNCTION mark_notification_failed(notification_id UUID, error_msg TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notification_queue
  SET 
    status = 'failed',
    error_message = error_msg
  WHERE id = notification_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_push_tokens IS 'Stores Expo Push Tokens for sending push notifications';
COMMENT ON COLUMN user_push_tokens.token IS 'Expo Push Token (format: ExponentPushToken[xxx])';
COMMENT ON COLUMN user_push_tokens.platform IS 'Device platform (ios, android, web)';

COMMENT ON TABLE notification_queue IS 'Queue for pending push notifications to be sent by Edge Function';
COMMENT ON COLUMN notification_queue.status IS 'pending = waiting to send, sent = delivered, failed = error';

COMMENT ON FUNCTION notify_ai_job_completion() IS 'Trigger function that queues a notification when AI analysis completes';
COMMENT ON FUNCTION get_pending_notifications(INT) IS 'Get batch of pending notifications for Edge Function processing';
COMMENT ON FUNCTION mark_notifications_sent(UUID[]) IS 'Mark notifications as successfully sent';
COMMENT ON FUNCTION mark_notification_failed(UUID, TEXT) IS 'Mark notification as failed with error message';
