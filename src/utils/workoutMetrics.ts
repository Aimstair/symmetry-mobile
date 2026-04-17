type DateLike = Date | string | number | null | undefined;

function toDate(value: DateLike): Date | null {
  if (value == null) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function toStartOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Convert a date-like input to a stable local calendar key (YYYY-MM-DD).
 */
export function toLocalDateKey(value: DateLike): string | null {
  const date = toDate(value);
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Count consecutive workout days ending at anchorDate in local timezone.
 * Duplicate sessions on the same day are automatically de-duplicated.
 */
export function calculateWorkoutStreak(dates: DateLike[], anchorDate: DateLike): number {
  const anchor = toDate(anchorDate);
  if (!anchor) return 0;

  const uniqueWorkoutDays = new Set<string>();
  dates.forEach((date) => {
    const key = toLocalDateKey(date);
    if (key) uniqueWorkoutDays.add(key);
  });

  let streak = 0;
  const cursor = toStartOfLocalDay(anchor);

  while (true) {
    const key = toLocalDateKey(cursor);
    if (!key || !uniqueWorkoutDays.has(key)) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export interface SymmetryScoreEntry {
  date?: DateLike;
  symmetryScore?: number | null;
}

/**
 * Select the most relevant symmetry score for a workout date.
 * Preference order:
 * 1) Latest scan on the same day or earlier
 * 2) Latest available scan if no prior scan exists
 */
export function getSymmetryScoreForDate(
  scans: SymmetryScoreEntry[],
  workoutDate: DateLike
): number | null {
  const anchor = toDate(workoutDate);
  if (!anchor || scans.length === 0) return null;

  const normalizedScans = scans
    .map((scan) => {
      const date = toDate(scan.date);
      const score = scan.symmetryScore;
      if (!date || typeof score !== 'number' || Number.isNaN(score)) return null;
      return { date, score };
    })
    .filter((scan): scan is { date: Date; score: number } => scan !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (normalizedScans.length === 0) return null;

  const anchorEnd = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59, 999);

  let candidate: { date: Date; score: number } | null = null;
  normalizedScans.forEach((scan) => {
    if (scan.date.getTime() <= anchorEnd.getTime()) {
      candidate = scan;
    }
  });

  const selected = candidate || normalizedScans[normalizedScans.length - 1];
  return Number(selected.score.toFixed(1));
}
