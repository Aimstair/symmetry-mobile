-- Add day_name column to workout_days
-- This stores which day of the week a workout belongs to (e.g., 'Monday', 'Tuesday')
-- This allows workouts to be properly associated with specific days rather than cycling

ALTER TABLE workout_days 
ADD COLUMN day_name TEXT;

-- Add an index for faster lookups by day_name
CREATE INDEX idx_workout_days_day_name ON workout_days(day_name);

-- Comment for documentation
COMMENT ON COLUMN workout_days.day_name IS 'Day of the week this workout belongs to (e.g., Monday, Tuesday, etc.)';
