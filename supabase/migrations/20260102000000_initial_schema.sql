-- Symmetry Fitness App - Initial Schema Migration
-- Generated: 2026-01-02
-- Description: Creates all tables with proper relationships and RLS policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0 AND age < 150),
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  height NUMERIC NOT NULL CHECK (height > 0),
  weight NUMERIC NOT NULL CHECK (weight > 0),
  goal TEXT NOT NULL CHECK (goal IN ('bulk', 'cut', 'recomp', 'maintenance')),
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- NUTRITION TARGETS TABLE
-- ============================================================================
CREATE TABLE nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories NUMERIC NOT NULL CHECK (calories >= 0),
  protein NUMERIC NOT NULL CHECK (protein >= 0),
  carbs NUMERIC NOT NULL CHECK (carbs >= 0),
  fats NUMERIC NOT NULL CHECK (fats >= 0),
  tdee NUMERIC NOT NULL CHECK (tdee >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- EQUIPMENT PROFILES TABLE
-- ============================================================================
CREATE TABLE equipment_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  has_barbell BOOLEAN NOT NULL DEFAULT false,
  has_dumbbells BOOLEAN NOT NULL DEFAULT false,
  has_cable_station BOOLEAN NOT NULL DEFAULT false,
  has_machines BOOLEAN NOT NULL DEFAULT false,
  has_bands BOOLEAN NOT NULL DEFAULT false,
  custom_equipment TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- WORKOUT PLANS TABLE
-- ============================================================================
CREATE TABLE workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('push-pull-legs', 'upper-lower', 'full-body', 'custom')),
  days_per_week INTEGER NOT NULL CHECK (days_per_week > 0 AND days_per_week <= 7),
  workout_days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX idx_workout_plans_user_id ON workout_plans(user_id);

-- ============================================================================
-- BODY MEASUREMENTS TABLE
-- ============================================================================
CREATE TABLE body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight NUMERIC NOT NULL CHECK (weight > 0),
  body_fat NUMERIC CHECK (body_fat >= 0 AND body_fat <= 100),
  measurements JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster user and date queries
CREATE INDEX idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX idx_body_measurements_date ON body_measurements(date DESC);

-- ============================================================================
-- PHYSIQUE SCANS TABLE
-- ============================================================================
CREATE TABLE physique_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  images JSONB NOT NULL DEFAULT '{}',
  symmetry_score NUMERIC NOT NULL CHECK (symmetry_score >= 0 AND symmetry_score <= 100),
  muscle_scores JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster user and date queries
CREATE INDEX idx_physique_scans_user_id ON physique_scans(user_id);
CREATE INDEX idx_physique_scans_date ON physique_scans(date DESC);

-- ============================================================================
-- CARDIO LOGS TABLE
-- ============================================================================
CREATE TABLE cardio_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('running', 'cycling', 'swimming', 'walking', 'other')),
  duration NUMERIC NOT NULL CHECK (duration > 0),
  distance NUMERIC CHECK (distance > 0),
  calories NUMERIC CHECK (calories > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster user and date queries
CREATE INDEX idx_cardio_logs_user_id ON cardio_logs(user_id);
CREATE INDEX idx_cardio_logs_date ON cardio_logs(date DESC);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrition_targets_updated_at BEFORE UPDATE ON nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_profiles_updated_at BEFORE UPDATE ON equipment_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_plans_updated_at BEFORE UPDATE ON workout_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE physique_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardio_logs ENABLE ROW LEVEL SECURITY;

-- Users: Can read and update their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Nutrition Targets: Users can manage their own
CREATE POLICY "Users can view own nutrition targets" ON nutrition_targets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition targets" ON nutrition_targets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition targets" ON nutrition_targets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition targets" ON nutrition_targets
  FOR DELETE USING (auth.uid() = user_id);

-- Equipment Profiles: Users can manage their own
CREATE POLICY "Users can view own equipment" ON equipment_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own equipment" ON equipment_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own equipment" ON equipment_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own equipment" ON equipment_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Workout Plans: Users can manage their own
CREATE POLICY "Users can view own workout plans" ON workout_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout plans" ON workout_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout plans" ON workout_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout plans" ON workout_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Body Measurements: Users can manage their own
CREATE POLICY "Users can view own body measurements" ON body_measurements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own body measurements" ON body_measurements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own body measurements" ON body_measurements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own body measurements" ON body_measurements
  FOR DELETE USING (auth.uid() = user_id);

-- Physique Scans: Users can manage their own
CREATE POLICY "Users can view own physique scans" ON physique_scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own physique scans" ON physique_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own physique scans" ON physique_scans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own physique scans" ON physique_scans
  FOR DELETE USING (auth.uid() = user_id);

-- Cardio Logs: Users can manage their own
CREATE POLICY "Users can view own cardio logs" ON cardio_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cardio logs" ON cardio_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cardio logs" ON cardio_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cardio logs" ON cardio_logs
  FOR DELETE USING (auth.uid() = user_id);
