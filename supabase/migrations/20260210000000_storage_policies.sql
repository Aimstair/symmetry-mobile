-- Migration: Storage Policies for Physique Scans
-- Date: 2026-02-10
-- Description: Creates secure storage bucket and policies for user scan images.
-- The AI worker (service_role) needs read access to process images.

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Create the scans bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scans',
  'scans',
  false,  -- Private bucket - requires authentication
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy 1: Users can upload to their own private folder
-- Path pattern: private/{user_id}/*
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scans'
  AND (storage.foldername(name))[1] = 'private'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 2: Users can read their own files
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scans'
  AND (storage.foldername(name))[1] = 'private'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 3: Users can update their own files (replace)
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scans'
  AND (storage.foldername(name))[1] = 'private'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'scans'
  AND (storage.foldername(name))[1] = 'private'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 4: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scans'
  AND (storage.foldername(name))[1] = 'private'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 5: Service role (AI Worker) can read ALL files in scans bucket
-- Note: service_role bypasses RLS by default, but this explicit policy
-- documents the intended access pattern for AI processing
CREATE POLICY "Service role can read all scan files"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'scans');

-- ============================================================================
-- HELPER FUNCTION FOR GENERATING UPLOAD PATHS
-- ============================================================================

-- Function to generate a secure upload path for a user's scan
CREATE OR REPLACE FUNCTION public.get_scan_upload_path(
  p_user_id uuid,
  p_scan_id uuid,
  p_filename text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the user is authenticated and matches the requested user_id
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot generate path for another user';
  END IF;
  
  -- Return path in format: private/{user_id}/{scan_id}/{filename}
  RETURN 'private/' || p_user_id::text || '/' || p_scan_id::text || '/' || p_filename;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_scan_upload_path(uuid, uuid, text) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.get_scan_upload_path IS 
'Generates a secure upload path for physique scan images. 
Ensures users can only generate paths for their own scans.';
