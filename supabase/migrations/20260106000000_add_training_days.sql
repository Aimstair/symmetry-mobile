-- Migration: Add training_days to users table
-- Date: 2026-01-06
-- Description: Stores user's preferred training days from onboarding (e.g., ['Monday', 'Wednesday', 'Friday'])

-- Add training_days column to users table
ALTER TABLE users
ADD COLUMN training_days TEXT[] DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN users.training_days IS 'User''s selected training days from onboarding (e.g., Monday, Wednesday, Friday)';
