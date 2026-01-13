-- Migration: Delete User Account Function
-- Date: 2026-01-15
-- Description: Creates a secure function to allow users to delete their own accounts.
-- Due to ON DELETE CASCADE in our schema, this will automatically wipe their workouts, scans, and logs.

-- ============================================================================
-- DELETE USER ACCOUNT FUNCTION
-- ============================================================================

-- Function to delete user account
-- Security: Uses auth.uid() to ensure users can only delete their own account
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the authenticated user's ID
    v_user_id := auth.uid();
    
    -- Ensure user is authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Log the deletion request for audit purposes
    INSERT INTO public.audit_log (
        user_id,
        action,
        table_name,
        old_data,
        created_at
    ) VALUES (
        v_user_id,
        'DELETE_ACCOUNT',
        'auth.users',
        jsonb_build_object('user_id', v_user_id, 'deleted_at', NOW()),
        NOW()
    ) ON CONFLICT DO NOTHING; -- If audit_log doesn't exist, silently skip
    
    -- Delete user's push tokens first (not cascaded)
    DELETE FROM public.user_push_tokens WHERE user_id = v_user_id;
    
    -- Delete user's subscription data (if exists)
    DELETE FROM public.subscriptions WHERE user_id = v_user_id;
    
    -- Delete user's scan logs
    DELETE FROM public.scan_logs WHERE user_id = v_user_id;
    
    -- Delete user's AI analysis jobs (including pending notifications)
    DELETE FROM public.ai_analysis_jobs WHERE user_id = v_user_id;
    
    -- Delete from notification queue
    DELETE FROM public.notification_queue WHERE user_id = v_user_id;
    
    -- The auth.users delete will cascade to:
    -- - physique_scans (ON DELETE CASCADE)
    -- - workout_plans (ON DELETE CASCADE)
    -- - workout_history (via workout_sessions ON DELETE CASCADE)
    -- - nutrition_targets (ON DELETE CASCADE)
    -- - users profile table (ON DELETE CASCADE)
    
    -- Finally, delete the user from auth.users
    -- This must be done last as it triggers cascading deletes
    DELETE FROM auth.users WHERE id = v_user_id;
    
    -- Note: If this function fails at any point, the transaction will roll back
    -- and no data will be deleted
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_user_account() IS 
'Allows authenticated users to permanently delete their own account and all associated data. 
This action cannot be undone. All user data including workouts, scans, plans, and history will be permanently deleted.';

-- ============================================================================
-- AUDIT LOG TABLE (Optional - for tracking account deletions)
-- ============================================================================

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    action text NOT NULL,
    table_name text,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

-- RLS for audit_log - only service role can read
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No policies = no access for authenticated users (service role bypasses RLS)
-- This ensures users cannot view their audit history

-- Add comment
COMMENT ON TABLE public.audit_log IS 
'Audit log for tracking important user actions like account deletions. Only accessible by service role.';
