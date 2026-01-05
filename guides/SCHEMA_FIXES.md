# Schema Cleanup & Workout Completion Fixes

**Date:** January 10, 2026  
**Migration:** `20260110000000_cleanup_schema.sql`

## Problems Fixed

### 1. ✅ Workout Completion Not Updating Schedule

**Problem:** When finishing a workout, the data was logged in `workout_sessions` but the schedule was not marked as completed.

**Root Cause:** 
- Schedule entry was not being created when starting a workout
- Manual update call to mark schedule as completed could fail silently

**Solution:**
- Added database trigger `trigger_auto_mark_schedule_completed` that automatically marks schedule as completed when a workout session is inserted
- Added `syncEnsureTodaySchedule()` store action that creates schedule entry when workout starts
- Updated active-workout screen to call `syncEnsureTodaySchedule()` on mount

**How it works now:**
1. User starts workout → `syncEnsureTodaySchedule()` creates schedule entry with status='scheduled'
2. User finishes workout → Session is saved to `workout_sessions`
3. Database trigger automatically updates schedule status to 'completed' and links session_id
4. No manual intervention needed, fully automatic

### 2. ✅ Redundant Tables Removed

**Removed Tables:**
- `body_measurements` - Replaced by `measurement_logs` (better normalized)
- `training_days_history` - Redundant, training_days already tracked in users table

**Why they were redundant:**
- `body_measurements`: Used JSONB for storing measurements. `measurement_logs` is properly normalized with individual columns for each measurement type
- `training_days_history`: Over-engineered. Training days can be tracked via user update history or application logs. Not critical for app functionality.

### 3. ✅ Better Table Structure

**Added Columns:**
- `workout_sessions.status` - Tracks if workout was 'completed', 'incomplete', or 'auto_saved'
- `workout_schedule.workout_day_id` - Direct link to the workout day template

**Added View:**
- `workout_calendar` - Unified view showing scheduled workouts + completed sessions in one query

**Added Functions:**
- `auto_mark_schedule_completed()` - Trigger function to auto-update schedule
- `ensure_today_schedule()` - Helper to create or get today's schedule entry

## Current Schema Structure

### Core Workout Tables (Clear Hierarchy)

```
workout_plans (Templates)
  ↓ has many
workout_days (Days in template, e.g., "Monday - Push")
  ↓ has many
plan_exercises (Exercise prescriptions, e.g., "Bench Press 4x8-12")

workout_schedule (Date-specific planning)
  ↓ references
workout_plans, workout_days (Templates)
  ↓ linked after completion
workout_sessions (Completed workouts)
  ↓ has many
session_exercises (Exercises performed)
  ↓ has many
session_sets (Individual sets logged)
```

### Table Naming Convention

| Table | Purpose | Naming Logic |
|-------|---------|--------------|
| `workout_plans` | Weekly templates | Plan = Template |
| `workout_days` | Days within plan | Day = Day of week |
| `plan_exercises` | Exercise prescription | What's PLANNED |
| `workout_schedule` | Date-specific plans | What's SCHEDULED |
| `workout_sessions` | Completed history | What was DONE |
| `session_exercises` | Exercises done | Part of session |
| `session_sets` | Sets logged | Part of session |

**Naming Pattern:**
- `workout_*` = Templates/Planning
- `session_*` = Actual history/completed

## Migration Guide

### To Apply This Migration

```bash
# Reset Supabase database (WARNING: Deletes all data)
supabase db reset

# Or apply just this migration
supabase migration up 20260110000000_cleanup_schema
```

### Required Code Updates

All code updates have been applied:

1. ✅ Added `syncEnsureTodaySchedule()` to store
2. ✅ Updated active-workout to create schedule on load
3. ✅ Database trigger handles automatic completion
4. ✅ Removed references to deleted tables

### Breaking Changes

**Removed:**
- `body_measurements` table - Use `measurement_logs` instead
- `training_days_history` table - Use `users.training_days` instead
- `IScheduleService.getTrainingDaysForWeek()` - No longer needed
- `IScheduleService.saveTrainingDaysSnapshot()` - No longer needed

**Added:**
- `workout_sessions.status` column
- `workout_schedule.workout_day_id` column
- `syncEnsureTodaySchedule()` store action

## Testing Checklist

After applying migration:

- [ ] Start a new workout
- [ ] Verify schedule entry is created in `workout_schedule` with status='scheduled'
- [ ] Complete some sets
- [ ] Finish the workout
- [ ] Verify session saved to `workout_sessions`
- [ ] Verify schedule status updated to 'completed' automatically
- [ ] Verify schedule.session_id points to the correct session
- [ ] Query `workout_calendar` view to see unified data

## Example Queries

```sql
-- View today's schedule and completion status
SELECT * FROM workout_calendar 
WHERE user_id = '...' 
  AND scheduled_date = CURRENT_DATE;

-- View all completed workouts this week
SELECT * FROM workout_calendar
WHERE user_id = '...'
  AND scheduled_date >= DATE_TRUNC('week', CURRENT_DATE)
  AND schedule_status = 'completed';

-- View workout history with full details
SELECT 
  sess.id,
  sess.name,
  sess.started_at,
  sess.status,
  COUNT(DISTINCT se.id) as exercise_count,
  COUNT(ss.id) as total_sets
FROM workout_sessions sess
LEFT JOIN session_exercises se ON se.session_id = sess.id
LEFT JOIN session_sets ss ON ss.session_exercise_id = se.id
WHERE sess.user_id = '...'
GROUP BY sess.id
ORDER BY sess.started_at DESC;
```

## Future Improvements

1. **Workout Streaks**: With proper schedule tracking, can now calculate workout streaks
2. **Adherence Tracking**: Compare scheduled vs completed workouts
3. **Auto-scheduling**: Can pre-populate schedule for entire week based on training days
4. **Smart Notifications**: Remind users of scheduled workouts
5. **Progress Calendar**: Visual calendar showing completed/missed workouts

## Rollback

If issues occur, rollback steps:

```bash
# Create rollback migration
supabase migration new rollback_schema_cleanup

# In the migration file:
# - Re-create body_measurements table
# - Re-create training_days_history table  
# - Drop new columns and triggers
# - Remove workout_calendar view
```

Note: Data in deleted tables will be lost. Backup before applying if needed.
