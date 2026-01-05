/**
 * Workout Calendar Utilities
 * 
 * Helper functions to map workout plan templates to calendar dates.
 * Handles the transformation from "Day 1: Push" template format
 * to "Mon 23: Push Day" calendar view format.
 */

import type { WorkoutPlan, WorkoutDay } from '@/types';

/**
 * Day status for calendar display
 */
export type DayStatus = 'completed' | 'today' | 'upcoming' | 'rest' | 'skipped' | 'no-workout';

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
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
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
  const d1 = new Date(date);
  const d2 = new Date(today);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1 < d2;
}

/**
 * Determine the status of a calendar day
 */
export function getDayStatus(
  date: Date,
  today: Date,
  isRestDay: boolean,
  completedDates?: Set<string>
): DayStatus {
  const dateString = date.toISOString().split('T')[0];
  
  if (isRestDay) {
    return 'rest';
  }
  
  if (completedDates?.has(dateString)) {
    return 'completed';
  }
  
  if (isSameDay(date, today)) {
    return 'today';
  }
  
  if (isBeforeToday(date, today)) {
    // Could be 'skipped' if not completed - for now, assume completed
    return 'completed';
  }
  
  return 'upcoming';
}

/**
 * Map a workout plan to a week's calendar view
 * 
 * Strategy:
 * 1. Use trainingDays from user to determine which days are training days
 * 2. Map each calendar training day to the appropriate workout day based on sequence
 * 3. Training days without a workout show "No Workout Planned"
 * 4. Non-training days are rest days
 * 
 * @param plan - The workout plan template (can be null)
 * @param weekStart - The Monday of the week to generate
 * @param trainingDays - User's selected training days (e.g., ['Monday', 'Wednesday', 'Friday'])
 * @param completedDates - Set of ISO date strings for completed workouts
 */
export function mapWorkoutPlanToWeek(
  plan: WorkoutPlan | null,
  weekStart: Date,
  trainingDays: string[] = [],
  completedDates?: Set<string>
): CalendarDay[] {
  const today = new Date();
  const weekDates = getWeekDates(weekStart);
  
  // Map day names to day of week index for matching
  const trainingDaySet = new Set(trainingDays.map(d => d.toLowerCase()));
  
  // Get workout days from plan (if exists)
  const workoutDays = plan?.workoutDays || [];
  
  // Create a map of dayName -> WorkoutDay for O(1) lookup
  const workoutDayByDayName = new Map<string, typeof workoutDays[0]>();
  workoutDays.forEach(wd => {
    if (wd.dayName) {
      workoutDayByDayName.set(wd.dayName.toLowerCase(), wd);
    }
  });
  
  // Fallback: workouts without dayName (legacy) - assign sequentially to training days
  const unassignedWorkouts = workoutDays.filter(wd => !wd.dayName);
  let unassignedIndex = 0;
  
  return weekDates.map((date) => {
    const dayName = getFullDayName(date);
    const isTrainingDay = trainingDaySet.has(dayName.toLowerCase());
    
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
    // First try to match by dayName
    let workoutDay = workoutDayByDayName.get(dayName.toLowerCase()) || null;
    
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
      muscles: workoutDay.muscleGroups || [],
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
  return FULL_DAY_NAMES[date.getDay()];
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
