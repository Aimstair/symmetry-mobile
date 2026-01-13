-- Migration: App Configuration Table
-- Date: 2026-02-10
-- Description: Creates app_config table for remote configuration like force updates and maintenance mode.

-- ============================================================================
-- APP CONFIG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.app_config IS 
'Remote app configuration for version control and feature flags.';

-- ============================================================================
-- DEFAULT CONFIGURATION VALUES
-- ============================================================================

-- Minimum supported app version (force update if below this)
INSERT INTO public.app_config (key, value, description)
VALUES ('min_supported_version', '1.0.0', 'Minimum app version required. Users below this version will see a force update screen.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Maintenance mode flag
INSERT INTO public.app_config (key, value, description)
VALUES ('maintenance_mode', 'false', 'When true, shows maintenance screen to all users.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Maintenance message (shown when maintenance_mode is true)
INSERT INTO public.app_config (key, value, description)
VALUES ('maintenance_message', 'We are currently performing scheduled maintenance. Please check back shortly.', 'Message to display during maintenance.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Latest app version (informational)
INSERT INTO public.app_config (key, value, description)
VALUES ('latest_version', '1.0.0', 'Latest available version (for soft update prompts).')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Feature flags (JSON format for flexibility)
INSERT INTO public.app_config (key, value, description)
VALUES ('feature_flags', '{"ai_analysis":true,"social_sharing":true}', 'JSON object of feature flags.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- App store URLs
INSERT INTO public.app_config (key, value, description)
VALUES ('ios_store_url', 'https://apps.apple.com/app/symmetry-fitness/id1234567890', 'iOS App Store URL for update prompts.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.app_config (key, value, description)
VALUES ('android_store_url', 'https://play.google.com/store/apps/details?id=com.symmetry.fitness', 'Google Play Store URL for update prompts.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Public read-only access (no authentication required)
CREATE POLICY "Public read access to app_config"
ON public.app_config
FOR SELECT
TO public
USING (true);

-- Only service role can modify config
-- (No INSERT/UPDATE/DELETE policies for authenticated users)

-- ============================================================================
-- HELPER FUNCTION
-- ============================================================================

-- Function to get all app config as a JSON object
CREATE OR REPLACE FUNCTION public.get_app_config()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT jsonb_object_agg(key, value)
  FROM public.app_config;
$$;

-- Grant execute to public (no auth required for config check)
GRANT EXECUTE ON FUNCTION public.get_app_config() TO public;

-- Comment
COMMENT ON FUNCTION public.get_app_config IS 
'Returns all app configuration as a JSON object. Used for version checks and feature flags.';

-- ============================================================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_app_config_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_config_timestamp();
