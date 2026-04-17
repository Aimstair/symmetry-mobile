/**
 * Workout Calendar Utilities
 * 
 * Helper functions to map workout plan templates to calendar dates.
 * Handles the transformation from "Day 1: Push" template format
 * to "Mon 23: Push Day" calendar view format.
 */

import type { WorkoutPlan, WorkoutDay } from '@/types';
import { formatTitleCaseLabel } from '@/lib/utils';

/**
 * Day status for calendar display
 */
export type DayStatus = 'completed' | 'today' | 'upcoming' | 'rest' | 'skipped' | 'no-workout';

/**
 * Day name mapping for normalization
 * Converts any form (abbreviated or full) to full day name
 */
const DAY_NAME_MAP: Record<string, string> = {
  'sun': 'Sunday', 'sunday': 'Sunday',
  'mon': 'Monday', 'monday': 'Monday',
  'tue': 'Tuesday', 'tues': 'Tuesday', 'tuesday': 'Tuesday',
  'wed': 'Wednesday', 'wednesday': 'Wednesday',
  'thu': 'Thursday', 'thur': 'Thursday', 'thurs': 'Thursday', 'thursday': 'Thursday',
  'fri': 'Friday', 'friday': 'Friday',
  'sat': 'Saturday', 'saturday': 'Saturday',
};

/**
 * Normalize day name to full format (e.g., 'Thu' -> 'Thursday')
 * This ensures consistency between user.trainingDays and workoutDay.dayName
 */
export function normalizeDayName(dayName: string): string {
  const normalized = DAY_NAME_MAP[dayName.toLowerCase().trim()];
  if (normalized) return normalized;
  // If not found, return original with first letter capitalized
  return dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
}

/**
 * Calendar day representation for UI
 */
export interface CalendarDay {
  day: string; // 'Mon', 'Tue', etc.
  date: number; // Day of month (1-31)
  fullDate: Date; // Full date object
  name: string; // 'Push Day', 'Rest', 'No Workout', etc.
  muscles: string[]; // ['Chest', 'Shoulders', 'Triceps']
  status: DayStatus;
  exercises: number; // Number of exercises
  workoutDay: WorkoutDay | null; // Reference to the workout day template
  isRestDay: boolean;
  isTrainingDay: boolean; // Whether user designated this as a training day
}

/**
 * Get the start of the week (Monday) for a given date
 * Uses local timezone to avoid date shifting
 */
export function getWeekStart(date: Date): Date {
  // Create date in local timezone
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust: Sunday -> -6, Monday -> 0, Tuesday -> -1, etc.
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get all dates for a week starting from Monday
 */
export function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
}

/**
 * Format day of week abbreviation
 */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  // Validate both dates are valid Date objects
  if (!date1 || !date2 || !(date1 instanceof Date) || !(date2 instanceof Date)) {
    return false;
  }
  // Check if dates are valid (not NaN)
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
    return false;
  }
  
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is before today
 */
export function isBeforeToday(date: Date, today: Date): boolean {
  // Validate both dates
  if (!date || !today || !(date instanceof Date) || !(today instanceof Date)) {
    return false;
  }
  if (isNaN(date.getTime()) || isNaN(today.getTime())) {
    return false;
  }
  
  const d1 = new Date(date);
  const d2 = new Date(today);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1 < d2;
}

/**
 * Determine the status of a calendar day
 * 
 * FIXED: No longer auto-completes past days. Past training days are:
 * - 'completed' only if in completedDates set
 * - 'skipped' if it was a training day but not completed
 * - 'rest' if it was a rest day
 */
export function getDayStatus(
  date: Date,
  today: Date,
  isRestDay: boolean,
  completedDates?: Set<string>
): DayStatus {
  // Use local timezone for date string to match completedDates format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  
  // Rest days are always 'rest' regardless of past/present/future
  if (isRestDay) {
    return 'rest';
  }
  
  // Check if this training day was actually completed
  if (completedDates?.has(dateString)) {
    return 'completed';
  }
  
  // Today's training day
  if (isSameDay(date, today)) {
    return 'today';
  }
  
  // Past training day that was NOT completed = skipped
  if (isBeforeToday(date, today)) {
    return 'skipped';
  }
  
  // Future training day
  return 'upcoming';
}

/**
 * Map a workout plan to a week's calendar view
 * 
 * Strategy:
 * 1. Use trainingDays from user to determine which days are training days
 * 2. For CURRENT and FUTURE weeks: Map each calendar training day to the appropriate workout day
 * 3. For PAST weeks: Only show actual completed sessions, not the plan template
 * 4. Training days without a workout show "No Workout Planned"
 * 5. Non-training days are rest days
 * 
 * @param plan - The workout plan template (can be null)
 * @param weekStart - The Monday of the week to generate
 * @param trainingDays - User's selected training days (e.g., ['Monday', 'Wednesday', 'Friday'])
 * @param completedDates - Set of ISO date strings for completed workouts
 * @param completedSessions - Map of date strings to workout names (for past weeks history)
 */
export function mapWorkoutPlanToWeek(
  plan: WorkoutPlan | null,
  weekStart: Date,
  trainingDays: string[] = [],
  completedDates?: Set<string>,
  completedSessions?: Map<string, { name: string; muscles: string[] }>
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekDates = getWeekDates(weekStart);
  
  // Determine if this is a past week (week ends before today)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const isPastWeek = weekEnd < today;
  
  // Normalize training days for consistent matching
  // Handles both 'Thu' and 'Thursday' formats
  const normalizedTrainingDays = trainingDays.map(d => normalizeDayName(d).toLowerCase());
  const trainingDaySet = new Set(normalizedTrainingDays);
  
  // Get workout days from plan (if exists)
  const workoutDays = plan?.workoutDays || [];
  
  // Create a map of normalized dayName -> WorkoutDay for O(1) lookup
  const workoutDayByDayName = new Map<string, typeof workoutDays[0]>();
  workoutDays.forEach(wd => {
    if (wd.dayName) {
      const normalized = normalizeDayName(wd.dayName).toLowerCase();
      workoutDayByDayName.set(normalized, wd);
    }
  });
  
  // Fallback: workouts without dayName (legacy) - assign sequentially to training days
  const unassignedWorkouts = workoutDays.filter(wd => !wd.dayName);
  let unassignedIndex = 0;
  
  return weekDates.map((date) => {
    const dayName = getFullDayName(date);
    const dayNameLower = dayName.toLowerCase();
    // Use local timezone for date string to avoid UTC shifting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const isTrainingDay = trainingDaySet.has(dayNameLower);
    const wasCompleted = completedDates?.has(dateString) || false;
    const sessionInfo = completedSessions?.get(dateString);
    
    // For past weeks, we don't show the plan template
    // Only show actual completed sessions
    if (isPastWeek) {
      if (wasCompleted && sessionInfo) {
        // Past day with a completed session - show what was actually done
        return {
          day: getDayName(date),
          date: date.getDate(),
          fullDate: date,
          name: sessionInfo.name,
          muscles: (sessionInfo.muscles || []).map((muscle) => formatTitleCaseLabel(muscle)),
          status: 'completed' as DayStatus,
          exercises: 0, // We don't have exercise count for past sessions
          workoutDay: null,
          isRestDay: false,
          isTrainingDay: true,
        };
      } else if (wasCompleted) {
        // Past day was completed but we don't have session details
        return {
          day: getDayName(date),
          date: date.getDate(),
          fullDate: date,
          name: 'Workout Completed',
          muscles: [],
          status: 'completed' as DayStatus,
          exercises: 0,
          workoutDay: null,
          isRestDay: false,
          isTrainingDay: true,
        };
      } else {
        // Past day with no completed session - show as rest (blank)
        return {
          day: getDayName(date),
          date: date.getDate(),
          fullDate: date,
          name: 'Rest',
          muscles: [],
          status: 'rest' as DayStatus,
          exercises: 0,
          workoutDay: null,
          isRestDay: true,
          isTrainingDay: false,
        };
      }
    }
    
    // Current/future week logic - use the plan template
    if (!isTrainingDay) {
      // Rest day (user didn't select this day for training)
      return {
        day: getDayName(date),
        date: date.getDate(),
        fullDate: date,
        name: 'Rest',
        muscles: [],
        status: getDayStatus(date, today, true, completedDates),
        exercises: 0,
        workoutDay: null,
        isRestDay: true,
        isTrainingDay: false,
      };
    }
    
    // This is a training day - find the matching workout
    // Use normalized day name for consistent matching
    let workoutDay = workoutDayByDayName.get(dayNameLower) || null;
    
    // Fallback: use unassigned workouts sequentially (for legacy data)
    if (!workoutDay && unassignedWorkouts.length > 0 && unassignedIndex < unassignedWorkouts.length) {
      workoutDay = unassignedWorkouts[unassignedIndex];
      unassignedIndex++;
    }
    
    if (!workoutDay) {
      // Training day but no workout scheduled
      return {
        day: getDayName(date),
        date: date.getDate(),
        fullDate: date,
        name: 'No Workout',
        muscles: [],
        status: isSameDay(date, today) ? 'today' : isBeforeToday(date, today) ? 'skipped' : 'no-workout',
        exercises: 0,
        workoutDay: null,
        isRestDay: false,
        isTrainingDay: true,
      };
    }
    
    return {
      day: getDayName(date),
      date: date.getDate(),
      fullDate: date,
      name: workoutDay.name,
      muscles: (workoutDay.muscleGroups || []).map((muscle) => formatTitleCaseLabel(muscle)),
      status: getDayStatus(date, today, false, completedDates),
      exercises: workoutDay.exercises?.length || 0,
      workoutDay,
      isRestDay: false,
      isTrainingDay: true,
    };
  });
}

/**
 * Get full day name from date
 */
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getFullDayName(date: Date): string {
  const dayIndex = date.getDay();
  return FULL_DAY_NAMES[dayIndex];
}

/**
 * Get the current week's calendar days for a workout plan
 */
export function getCurrentWeekCalendar(
  plan: WorkoutPlan | null,
  trainingDays: string[] = [],
  completedDates?: Set<string>
): CalendarDay[] {
  const today = new Date();
  const weekStart = getWeekStart(today);
  return mapWorkoutPlanToWeek(plan, weekStart, trainingDays, completedDates);
}

/**
 * Navigate to previous/next week
 */
export function navigateWeek(currentWeekStart: Date, direction: 'prev' | 'next'): Date {
  const newDate = new Date(currentWeekStart);
  newDate.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
  return newDate;
}

/**
 * Format month/year header for calendar
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Find today's index in the calendar (0-6 for Mon-Sun)
 */
export function findTodayIndex(calendarDays: CalendarDay[]): number {
  const today = new Date();
  return calendarDays.findIndex((day) => isSameDay(day.fullDate, today));
}
