-- Cleanup orphaned workout sessions that have no associated exercises
-- These were created when workout finish failed due to foreign key constraint violation

DELETE FROM workout_sessions
WHERE id NOT IN (
  SELECT DISTINCT session_id 
  FROM session_exercises
);
