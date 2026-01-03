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
export type DayStatus = 'completed' | 'today' | 'upcoming' | 'rest' | 'skipped';

/**
 * Calendar day representation for UI
 */
export interface CalendarDay {
  day: string; // 'Mon', 'Tue', etc.
  date: number; // Day of month (1-31)
  fullDate: Date; // Full date object
  name: string; // 'Push Day', 'Rest', etc.
  muscles: string[]; // ['Chest', 'Shoulders', 'Triceps']
  status: DayStatus;
  exercises: number; // Number of exercises
  workoutDay: WorkoutDay | null; // Reference to the workout day template
  isRestDay: boolean;
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
 * 1. Get the workout plan's workoutDays (the template)
 * 2. Map each calendar day to the appropriate workout day based on sequence
 * 3. Account for rest days (when no workout is scheduled)
 * 
 * @param plan - The workout plan template
 * @param weekStart - The Monday of the week to generate
 * @param completedDates - Set of ISO date strings for completed workouts
 */
export function mapWorkoutPlanToWeek(
  plan: WorkoutPlan | null,
  weekStart: Date,
  completedDates?: Set<string>
): CalendarDay[] {
  const today = new Date();
  const weekDates = getWeekDates(weekStart);
  
  // If no plan, return all rest days
  if (!plan || !plan.workoutDays || plan.workoutDays.length === 0) {
    return weekDates.map((date) => ({
      day: getDayName(date),
      date: date.getDate(),
      fullDate: date,
      name: 'Rest',
      muscles: [],
      status: 'rest',
      exercises: 0,
      workoutDay: null,
      isRestDay: true,
    }));
  }

  const { workoutDays, daysPerWeek } = plan;
  
  // Create a simple mapping: distribute workout days across the week
  // For a 4-day plan: Mon, Tue, Thu, Fri (with Wed, Sat, Sun as rest)
  // For a 6-day plan: Mon-Sat workout, Sun rest
  // For a 3-day plan: Mon, Wed, Fri
  const workoutSchedule = getWorkoutSchedule(daysPerWeek);
  
  return weekDates.map((date, dayIndex) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const scheduleIndex = workoutSchedule[dayOfWeek];
    
    if (scheduleIndex === null || scheduleIndex >= workoutDays.length) {
      // Rest day
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
      };
    }
    
    const workoutDay = workoutDays[scheduleIndex];
    
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
    };
  });
}

/**
 * Get workout schedule mapping: day of week (0-6) to workout day index
 * null means rest day
 */
function getWorkoutSchedule(daysPerWeek: number): (number | null)[] {
  // Index: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  switch (daysPerWeek) {
    case 1:
      return [null, 0, null, null, null, null, null]; // Monday only
    case 2:
      return [null, 0, null, null, 1, null, null]; // Mon, Thu
    case 3:
      return [null, 0, null, 1, null, 2, null]; // Mon, Wed, Fri
    case 4:
      return [null, 0, 1, null, 2, 3, null]; // Mon, Tue, Thu, Fri
    case 5:
      return [null, 0, 1, 2, 3, 4, null]; // Mon-Fri
    case 6:
      return [null, 0, 1, 2, 3, 4, 5]; // Mon-Sat
    case 7:
      return [6, 0, 1, 2, 3, 4, 5]; // Every day (Sun=day7)
    default:
      return [null, 0, 1, null, 2, 3, null]; // Default 4-day
  }
}

/**
 * Get the current week's calendar days for a workout plan
 */
export function getCurrentWeekCalendar(
  plan: WorkoutPlan | null,
  completedDates?: Set<string>
): CalendarDay[] {
  const today = new Date();
  const weekStart = getWeekStart(today);
  return mapWorkoutPlanToWeek(plan, weekStart, completedDates);
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
