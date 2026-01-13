-- Migration: AI Analysis Job Queue
-- Purpose: Async AI processing infrastructure to prevent UI blocking
-- Date: 2026-01-25

-- ============================================================================
-- STATUS ENUM TYPE
-- ============================================================================

-- Create enum for job status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_job_status') THEN
    CREATE TYPE ai_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END$$;

-- ============================================================================
-- AI ANALYSIS JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status ai_job_status NOT NULL DEFAULT 'pending',
  image_path TEXT NOT NULL,
  result_json JSONB,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for queue worker to find pending jobs quickly
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status 
ON ai_analysis_jobs(status) 
WHERE status = 'pending';

-- Index for user's job lookups
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id 
ON ai_analysis_jobs(user_id);

-- Composite index for user + status queries
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_status 
ON ai_analysis_jobs(user_id, status);

-- Index for cleanup of old completed jobs
CREATE INDEX IF NOT EXISTS idx_ai_jobs_completed_at 
ON ai_analysis_jobs(completed_at) 
WHERE status = 'completed';

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_job_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to call the function
DROP TRIGGER IF EXISTS trigger_ai_jobs_updated_at ON ai_analysis_jobs;
CREATE TRIGGER trigger_ai_jobs_updated_at
  BEFORE UPDATE ON ai_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_job_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE ai_analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can INSERT their own jobs
CREATE POLICY "Users can create own jobs"
  ON ai_analysis_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can SELECT their own jobs (to poll status)
CREATE POLICY "Users can view own jobs"
  ON ai_analysis_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users CANNOT update jobs directly
-- Status updates must come from server/worker via service role
-- This prevents client-side manipulation of job status

-- Note: The server/worker will use the service role key (bypasses RLS)
-- to update status from 'pending' -> 'processing' -> 'completed/failed'

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a new analysis job (can be called from client)
CREATE OR REPLACE FUNCTION create_analysis_job(p_image_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_job_id UUID;
BEGIN
  INSERT INTO ai_analysis_jobs (user_id, image_path)
  VALUES (auth.uid(), p_image_path)
  RETURNING id INTO new_job_id;
  
  RETURN new_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_analysis_job(TEXT) TO authenticated;

-- Function to get job status (with result if completed)
CREATE OR REPLACE FUNCTION get_job_status(p_job_id UUID)
RETURNS TABLE (
  status ai_job_status,
  result_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.status,
    j.result_json,
    j.error_message,
    j.created_at,
    j.completed_at
  FROM ai_analysis_jobs j
  WHERE j.id = p_job_id
    AND j.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION get_job_status(UUID) TO authenticated;

-- Function for worker to claim pending jobs (requires service role)
CREATE OR REPLACE FUNCTION claim_pending_job()
RETURNS TABLE (
  job_id UUID,
  user_id UUID,
  image_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_job_id UUID;
BEGIN
  -- Claim the oldest pending job atomically
  UPDATE ai_analysis_jobs
  SET 
    status = 'processing',
    started_at = NOW()
  WHERE id = (
    SELECT id 
    FROM ai_analysis_jobs 
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO claimed_job_id;
  
  -- Return the claimed job details
  IF claimed_job_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      j.id,
      j.user_id,
      j.image_path
    FROM ai_analysis_jobs j
    WHERE j.id = claimed_job_id;
  END IF;
END;
$$;

-- Note: claim_pending_job is NOT granted to authenticated users
-- Only service role (worker) can call this

-- Function for worker to complete a job (requires service role)
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result_json JSONB,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_analysis_jobs
  SET 
    status = CASE WHEN p_error_message IS NULL THEN 'completed' ELSE 'failed' END,
    result_json = p_result_json,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$;

-- Note: complete_job is NOT granted to authenticated users
-- Only service role (worker) can call this

-- ============================================================================
-- REALTIME SUBSCRIPTION SETUP
-- ============================================================================

-- Enable realtime for job status updates
-- Users can subscribe to changes on their own jobs
ALTER PUBLICATION supabase_realtime ADD TABLE ai_analysis_jobs;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_analysis_jobs IS 'Queue for async AI analysis jobs to prevent UI blocking';
COMMENT ON COLUMN ai_analysis_jobs.status IS 'Job status: pending (waiting), processing (being analyzed), completed (done), failed (error)';
COMMENT ON COLUMN ai_analysis_jobs.image_path IS 'Path to the image in Supabase Storage';
COMMENT ON COLUMN ai_analysis_jobs.result_json IS 'AI analysis result (muscle scores, symmetry score, etc.)';
COMMENT ON COLUMN ai_analysis_jobs.error_message IS 'Error message if job failed';
COMMENT ON COLUMN ai_analysis_jobs.retry_count IS 'Number of times this job has been retried';
COMMENT ON FUNCTION create_analysis_job(TEXT) IS 'Create a new AI analysis job - callable by authenticated users';
COMMENT ON FUNCTION get_job_status(UUID) IS 'Get status of an AI job - users can only see their own jobs';
COMMENT ON FUNCTION claim_pending_job() IS 'Worker function to claim and process next pending job - requires service role';
COMMENT ON FUNCTION complete_job(UUID, JSONB, TEXT) IS 'Worker function to mark job complete - requires service role';
