import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Dimensions, Animated, InteractionManager, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { GestureHandlerRootView, Pressable } from 'react-native-gesture-handler';
import { ExerciseHistorySheet } from '../../src/components/ui/workout/ExerciseHistorySheet';
import {
  CardioLogModal,
  MeasurementHistorySheet,
  MEASUREMENT_ITEMS,
  type MeasurementMetricKey,
} from '@/components/ui/progress';
import { useAppStore } from '@/store/useAppStore';
import { useProgressDataInitialization } from '@/hooks/useDataInitialization';
import { useConsumeSessionAnimation } from '@/hooks/useSessionAnimationGate';
import { 
  TrendingUp, 
  Scale, 
  Ruler, 
  Activity,
  Plus,
  ChevronRight,
  Search,
  Filter,
  Dumbbell
} from 'lucide-react-native';
import { showAppAlert } from '@/store/useAlertStore';
import {
  cn,
  DEFAULT_FRESHNESS_WINDOW_MS,
  formatExerciseDisplayName,
  isAbortError,
  isStaleTimestamp,
} from '@/lib/utils';
import { LineChart } from 'react-native-gifted-charts';
import { dataService } from '@/services/dataServiceProvider';
import type { PhysiqueScan, CardioLog, CatalogExercise, MeasurementLog } from '@/types';

const { width } = Dimensions.get('window');

// Memoized LineChart wrapper to prevent expensive re-renders on tab switch
const MemoizedLineChart = React.memo(LineChart);
const chartWidth = width - 64; // Account for padding
const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;
const MEASUREMENT_GROUPS: Array<{
  key: 'Core Check-In' | 'Upper Body' | 'Lower Body';
  title: string;
  subtitle: string;
}> = [
  {
    key: 'Core Check-In',
    title: 'Core Check-In',
    subtitle: 'Weight and torso anchors for your overall physique trend.',
  },
  {
    key: 'Upper Body',
    title: 'Upper Body',
    subtitle: 'Shoulders, neck, and arm growth markers.',
  },
  {
    key: 'Lower Body',
    title: 'Lower Body',
    subtitle: 'Thigh and calf development checkpoints.',
  },
];
const chartAxisTextStyle = { color: '#A1A1AA', fontSize: 10 };
const chartAxisLabelStyle = { color: '#A1A1AA', fontSize: 9 };
const chartAxisLabelStyleWide = { color: '#A1A1AA', fontSize: 10 };

const formatVolumeTick = (value: string) => {
  const num = parseInt(value, 10);
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return value;
};

// Helper functions to transform store data for display
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthYear(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Transform physique scans to symmetry chart data
function transformToSymmetryData(scans: PhysiqueScan[]) {
  if (!scans.length) return [];
  
  return scans
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-6) // Last 6 entries
    .map((s) => ({
      value: s.symmetryScore,
      label: formatMonthYear(s.date).split(' ')[0], // Just the month
    }));
}

// Transform cardio logs for display
function transformCardioLogs(logs: CardioLog[]) {
  return logs
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10) // Last 10 entries
    .map(log => ({
      id: log.id,
      type: log.type.charAt(0).toUpperCase() + log.type.slice(1),
      duration: log.duration,
      intensity: log.duration > 40 ? 'High' : log.duration > 20 ? 'Moderate' : 'Low',
      date: formatDate(log.date),
      calories: log.calories ?? Math.round(log.duration * 8),
    }));
}

function getSessionDate(session: any): Date | null {
  const rawDate = session?.startedAt || session?.createdAt || session?.date;
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getSessionDurationSeconds(session: any): number {
  if (typeof session?.durationSeconds === 'number' && Number.isFinite(session.durationSeconds) && session.durationSeconds > 0) {
    return Math.floor(session.durationSeconds);
  }

  const startedAt = session?.startedAt ? new Date(session.startedAt) : null;
  const endedAt = session?.endedAt ? new Date(session.endedAt) : null;

  if (!startedAt || !endedAt || Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  const seconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  return seconds > 0 ? seconds : 0;
}

function getCompletedWorkingSets(exercise: any): any[] {
  if (!Array.isArray(exercise?.sets)) return [];

  return exercise.sets.filter((set: any) => {
    if (!set) return false;
    if (set.isWarmup) return false;
    if (set.isCompleted === false) return false;
    return true;
  });
}

function formatMinutesTrained(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (safeMinutes < 60) return `${safeMinutes}m`;

  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatCompactNumber(value: number): string {
  const safe = Math.max(0, Math.round(value));
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(1)}M`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(1)}k`;
  return safe.toString();
}

function normalizeHydratedExerciseName(name?: string | null): string | undefined {
  if (typeof name !== 'string') return undefined;

  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const isSlugLike = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(trimmed);
  return isSlugLike ? formatExerciseDisplayName(trimmed) : trimmed;
}

export default function Progress() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('overview');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState('recent');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);
  
  // Modal states
  const [showCardioLogModal, setShowCardioLogModal] = useState(false);
  const [selectedMeasurementKey, setSelectedMeasurementKey] = useState<MeasurementMetricKey | null>(null);
  const [showMeasurementHistory, setShowMeasurementHistory] = useState(false);
  const initialLoadDoneRef = useRef(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [catalogExercises, setCatalogExercises] = useState<CatalogExercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [exerciseLoadError, setExerciseLoadError] = useState<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastDataRefreshAtRef = useRef(0);
  const animationInFlightRef = useRef<Animated.CompositeAnimation | null>(null);
  const consumeEntryAnimation = useConsumeSessionAnimation('tabs-progress');
  
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Get user and data from store
  const user = useAppStore((s) => s.user);
  const measurementLogs = useAppStore((s) => s.measurementLogs);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const cardioLogs = useAppStore((s) => s.cardioLogs);
  const workoutHistory = useAppStore((s) => s.workoutHistory);
  const weightUnit = useAppStore((s) => s.settings.unit);
  const measurementUnit = useAppStore((s) => s.settings.measurementUnit);
  const syncAddMeasurementLog = useAppStore((s) => s.syncAddMeasurementLog);
  const syncFetchWorkoutHistory = useAppStore((s) => s.syncFetchWorkoutHistory);

  // Load progress data on tab focus
  const {
    isLoading: isProgressLoading,
    isRefreshing: isProgressRefreshing,
    error: progressError,
    loadProgressData,
  } = useProgressDataInitialization(user?.id ?? null);

  const refreshProgressData = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    if (!force && !isStaleTimestamp(lastDataRefreshAtRef.current, DEFAULT_FRESHNESS_WINDOW_MS)) {
      return;
    }

    const refreshPromise = Promise.all([
      loadProgressData({ force, staleMs: DEFAULT_FRESHNESS_WINDOW_MS }),
      syncFetchWorkoutHistory({ force }),
    ]).then(() => {
      setLastRefreshedAt(new Date());
    });

    refreshInFlightRef.current = refreshPromise
      .catch(() => {
        // Errors are handled by the underlying hooks/actions.
      })
      .finally(() => {
        refreshInFlightRef.current = null;
        lastDataRefreshAtRef.current = Date.now();
      });

    return refreshInFlightRef.current;
  }, [loadProgressData, syncFetchWorkoutHistory]);

  // Reset one-time guard when user changes
  useEffect(() => {
    initialLoadDoneRef.current = false;
    setIsInitialLoadComplete(false);
    setLastRefreshedAt(null);
  }, [user?.id]);

  // Initial data load on mount (show full-screen loader only once per user session)
  useEffect(() => {
    if (!user?.id || initialLoadDoneRef.current) {
      return;
    }

    initialLoadDoneRef.current = true;
    refreshProgressData().finally(() => {
      setIsInitialLoadComplete(true);
    });
  }, [user?.id, refreshProgressData]);

  const loadExercises = useCallback(async () => {
    if (isLoadingExercises) return;

    setIsLoadingExercises(true);
    try {
      const exercises = await dataService.exercise.getExercises();
      setCatalogExercises(exercises);
      setExerciseLoadError(null);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Failed to load exercises:', error);
        setExerciseLoadError('Could not load exercise library.');
      }
    } finally {
      setIsLoadingExercises(false);
    }
  }, [isLoadingExercises]);

  // Load exercises when switching to the Exercises tab
  useEffect(() => {
    if (activeTab === 'exercises' && catalogExercises.length === 0) {
      loadExercises();
    }
  }, [activeTab, catalogExercises.length, loadExercises]);

  // Load progress data when this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshTask = InteractionManager.runAfterInteractions(() => {
        refreshProgressData();
      });

      const shouldAnimateEntry = consumeEntryAnimation();

      if (!shouldAnimateEntry) {
        if (animationInFlightRef.current) {
          animationInFlightRef.current.stop();
          animationInFlightRef.current = null;
        }

        headerAnim.setValue(1);
        contentAnim.setValue(1);

        return () => {
          refreshTask.cancel();
          if (animationInFlightRef.current) {
            animationInFlightRef.current.stop();
            animationInFlightRef.current = null;
          }
        };
      }
      
      headerAnim.setValue(0);
      contentAnim.setValue(0);

      if (animationInFlightRef.current) {
        animationInFlightRef.current.stop();
      }

      const animation = Animated.stagger(100, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]);

      animationInFlightRef.current = animation;
      animation.start(() => {
        if (animationInFlightRef.current === animation) {
          animationInFlightRef.current = null;
        }
      });

      return () => {
        refreshTask.cancel();
        animation.stop();
        if (animationInFlightRef.current === animation) {
          animationInFlightRef.current = null;
        }
      };
    }, [refreshProgressData, consumeEntryAnimation])
  );

  // Compute derived data using useMemo
  const weightChartData = useMemo(() => {
    if (activeTab !== 'overview') return [];
    if (!measurementLogs.length) return [];
    
    return measurementLogs
      .filter(m => m.weightKg !== undefined && m.weightKg !== null)
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-9)
      .map((m) => {
        // Convert Metric (DB) -> User Unit (UI)
        const val = weightUnit === 'lbs' ? (m.weightKg! * KG_TO_LBS) : m.weightKg!;
        return {
          value: parseFloat(val.toFixed(1)),
          label: formatDate(m.date).split(' ')[1],
          date: formatDate(m.date),
        };
      });
  }, [activeTab, measurementLogs, weightUnit]);

  const symmetryChartData = useMemo(() => {
    if (activeTab !== 'overview') return [];
    return transformToSymmetryData(physiqueScans);
  }, [activeTab, physiqueScans]);

  // Strength Progress: Calculate total volume per workout session
  const strengthProgressData = useMemo(() => {
    if (activeTab !== 'overview') return [];
    if (!workoutHistory.length) return [];

    const sortedHistory = [...workoutHistory]
      .map((session) => ({ session, date: getSessionDate(session) }))
      .filter((item) => item.date !== null)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime())
      .slice(-10);

    return sortedHistory.map(({ session, date }) => {
      let totalVolumeKg = 0;

      if (Array.isArray(session.exercises)) {
        session.exercises.forEach((ex: any) => {
          getCompletedWorkingSets(ex).forEach((set: any) => {
            const weight = Number(set?.weight) || 0;
            const reps = Number(set?.reps) || 0;
            if (weight > 0 && reps > 0) {
              totalVolumeKg += weight * reps;
            }
          });
        });
      }

      const volumeDisplay = weightUnit === 'lbs'
        ? Math.round(totalVolumeKg * KG_TO_LBS)
        : Math.round(totalVolumeKg);

      return {
        value: volumeDisplay,
        label: date!.getDate().toString(),
        date: formatDate(date!),
        sessionName: session.name || 'Workout',
      };
    });
  }, [activeTab, workoutHistory, weightUnit]);

  const monthlyStats = useMemo(() => {
    if (activeTab !== 'overview') {
      return { workouts: 0, totalVolume: 0, totalMinutes: 0, prs: 0 };
    }

    if (!workoutHistory.length) {
      return { workouts: 0, totalVolume: 0, totalMinutes: 0, prs: 0 };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let workouts = 0;
    let totalVolumeKg = 0;
    let totalMinutes = 0;
    let prs = 0;

    const allTimeExerciseMaxWeight = new Map<string, number>();

    const sessionsAsc = [...workoutHistory]
      .map((session) => ({ session, date: getSessionDate(session) }))
      .filter((item) => item.date !== null)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    sessionsAsc.forEach(({ session, date }) => {
      const inCurrentMonth = date!.getMonth() === currentMonth && date!.getFullYear() === currentYear;

      let sessionVolumeKg = 0;
      const sessionNewPrExercises = new Set<string>();

      if (Array.isArray(session.exercises)) {
        session.exercises.forEach((exercise: any) => {
          const exerciseKey = exercise?.exerciseId || exercise?.exercise?.id || exercise?.id;
          const workingSets = getCompletedWorkingSets(exercise);

          workingSets.forEach((set: any) => {
            const weight = Number(set?.weight) || 0;
            const reps = Number(set?.reps) || 0;

            if (weight > 0 && reps > 0) {
              sessionVolumeKg += weight * reps;
            }

            if (exerciseKey && weight > 0) {
              const prevMax = allTimeExerciseMaxWeight.get(exerciseKey) || 0;
              if (weight > prevMax) {
                allTimeExerciseMaxWeight.set(exerciseKey, weight);
                if (inCurrentMonth && !sessionNewPrExercises.has(exerciseKey)) {
                  sessionNewPrExercises.add(exerciseKey);
                }
              }
            }
          });
        });
      }

      if (inCurrentMonth) {
        workouts += 1;
        totalVolumeKg += sessionVolumeKg;
        totalMinutes += Math.round(getSessionDurationSeconds(session) / 60);
        prs += sessionNewPrExercises.size;
      }
    });

    const totalVolume = weightUnit === 'lbs'
      ? Math.round(totalVolumeKg * KG_TO_LBS)
      : Math.round(totalVolumeKg);

    return {
      workouts,
      totalVolume,
      totalMinutes,
      prs,
    };
  }, [activeTab, workoutHistory, weightUnit]);

  // Calculate volume trend
  const volumeTrend = useMemo(() => {
    if (strengthProgressData.length < 2) return 0;
    const recent = strengthProgressData.slice(-3).reduce((sum, d) => sum + d.value, 0) / Math.min(3, strengthProgressData.length);
    const earlier = strengthProgressData.slice(0, 3).reduce((sum, d) => sum + d.value, 0) / Math.min(3, strengthProgressData.length);
    return recent - earlier;
  }, [strengthProgressData]);

  const shouldComputeBodyMetrics = activeTab === 'body' || showMeasurementHistory;

  const sortedMeasurementLogs = useMemo(
    () =>
      shouldComputeBodyMetrics
        ? [...measurementLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [],
    [measurementLogs, shouldComputeBodyMetrics]
  );

  const latestMeasurementLog = useMemo(() => sortedMeasurementLogs[0] ?? null, [sortedMeasurementLogs]);

  const measurementRows = useMemo(
    () => {
      if (!shouldComputeBodyMetrics) {
        return [];
      }

      return MEASUREMENT_ITEMS.map((item) => {
        const latestLogForMetric = sortedMeasurementLogs.find((log) => {
          const value = log[item.key];
          return typeof value === 'number' && Number.isFinite(value) && value > 0;
        });

        const rawValue = latestLogForMetric?.[item.key];
        const latestValue =
          typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0
            ? item.key === 'weightKg'
              ? weightUnit === 'lbs'
                ? rawValue * KG_TO_LBS
                : rawValue
              : measurementUnit === 'in'
                ? rawValue * CM_TO_IN
                : rawValue
            : null;

        return {
          ...item,
          latestValue: latestValue === null ? null : parseFloat(latestValue.toFixed(1)),
          displayUnit: item.key === 'weightKg' ? weightUnit : measurementUnit,
          lastLoggedAt: latestLogForMetric ? formatDate(latestLogForMetric.date) : null,
        };
      });
    },
    [measurementUnit, shouldComputeBodyMetrics, sortedMeasurementLogs, weightUnit]
  );

  const groupedMeasurementRows = useMemo(
    () =>
      MEASUREMENT_GROUPS.map((group) => ({
        ...group,
        rows: measurementRows.filter((row) => row.group === group.key),
      })).filter((group) => group.rows.length > 0),
    [measurementRows]
  );

  const cardioLogsList = useMemo(() => {
    if (activeTab !== 'cardio') return [];
    return transformCardioLogs(cardioLogs);
  }, [activeTab, cardioLogs]);

  // Calculate weight change
  const weightChange = useMemo(() => {
     if (weightChartData.length < 2) return 0;
     return weightChartData[weightChartData.length -1].value - weightChartData[0].value;
  }, [weightChartData]);

  const onSaveMeasurementMetric = async (metricKey: MeasurementMetricKey, valueInBaseUnits: number) => {
    if (!user) {
      showAppAlert('Unavailable', 'Please complete your profile before logging measurements.');
      return;
    }

    if (!Number.isFinite(valueInBaseUnits) || valueInBaseUnits <= 0) {
      showAppAlert('Invalid', 'Enter a valid measurement value.');
      return;
    }

    const previous = latestMeasurementLog;
    const newLog: MeasurementLog = {
      id: `log-measurement-${Date.now()}`,
      userId: user.id,
      date: new Date(),
      createdAt: new Date(),
      weightKg: previous?.weightKg,
      bodyFatPct: previous?.bodyFatPct,
      chestCm: previous?.chestCm,
      shouldersCm: previous?.shouldersCm,
      neckCm: previous?.neckCm,
      waistCm: previous?.waistCm,
      hipsCm: previous?.hipsCm,
      leftArmCm: previous?.leftArmCm,
      rightArmCm: previous?.rightArmCm,
      leftThighCm: previous?.leftThighCm,
      rightThighCm: previous?.rightThighCm,
      leftCalfCm: previous?.leftCalfCm,
      rightCalfCm: previous?.rightCalfCm,
      notes: previous?.notes,
      [metricKey]: parseFloat(valueInBaseUnits.toFixed(2)),
    };

    try {
      await syncAddMeasurementLog(newLog);
      await refreshProgressData();
    } catch (error) {
      if (!isAbortError(error)) {
        console.error(error);
        showAppAlert('Save Failed', 'Could not save that measurement. Please try again.');
      }
      throw error;
    }
  };

  // Exercise stats type for the Exercises tab
  interface ExerciseStat {
    id: string;
    name: string;
    muscle: string;
    pr: number;
    lastWeight: number;
    sessions: number;
    trend: 'up' | 'down' | 'stable';
  }

  const exerciseStats = useMemo((): ExerciseStat[] => {
    if (activeTab !== 'exercises') return [];

    const catalogMap = new Map<string, { name: string; muscle: string }>();
    catalogExercises.forEach((exercise) => {
      catalogMap.set(exercise.id, {
        name: normalizeHydratedExerciseName(exercise.name) || formatExerciseDisplayName(String(exercise.id)),
        muscle: exercise.muscleGroups?.[0] || 'General',
      });
    });

    type ExerciseAccumulator = {
      id: string;
      name: string;
      muscle: string;
      prKg: number;
      lastWeightKg: number;
      sessions: number;
      maxWeightBySession: number[];
    };

    const statsMap = new Map<string, ExerciseAccumulator>();

    catalogMap.forEach((meta, exerciseId) => {
      statsMap.set(exerciseId, {
        id: exerciseId,
        name: meta.name,
        muscle: meta.muscle,
        prKg: 0,
        lastWeightKg: 0,
        sessions: 0,
        maxWeightBySession: [],
      });
    });

    const sessionsAsc = [...workoutHistory]
      .map((session) => ({ session, date: getSessionDate(session) }))
      .filter((item) => item.date !== null)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    sessionsAsc.forEach(({ session }) => {
      if (!Array.isArray(session.exercises)) return;

      session.exercises.forEach((exercise: any) => {
        const exerciseId = exercise?.exerciseId || exercise?.exercise?.id || exercise?.id;
        if (!exerciseId) return;

        const hydratedName = normalizeHydratedExerciseName(exercise?.exercise?.name);
        const hydratedMuscle = exercise?.exercise?.muscleGroups?.[0];
        const fallbackMeta = catalogMap.get(exerciseId);

        const existing: ExerciseAccumulator = statsMap.get(exerciseId) || {
          id: exerciseId,
          name: hydratedName || normalizeHydratedExerciseName(fallbackMeta?.name) || formatExerciseDisplayName(String(exerciseId)),
          muscle: hydratedMuscle || fallbackMeta?.muscle || 'General',
          prKg: 0,
          lastWeightKg: 0,
          sessions: 0,
          maxWeightBySession: [],
        };

        existing.name = hydratedName || existing.name;
        existing.muscle = hydratedMuscle || existing.muscle;
        existing.sessions += 1;

        const workingSets = getCompletedWorkingSets(exercise);
        const sessionMaxWeight = workingSets.reduce((max: number, set: any) => {
          const weight = Number(set?.weight) || 0;
          return weight > max ? weight : max;
        }, 0);

        if (sessionMaxWeight > 0) {
          existing.prKg = Math.max(existing.prKg, sessionMaxWeight);
          existing.lastWeightKg = sessionMaxWeight;
          existing.maxWeightBySession.push(sessionMaxWeight);
        }

        statsMap.set(exerciseId, existing);
      });
    });

    return Array.from(statsMap.values()).map((exercise) => {
      const recent = exercise.maxWeightBySession.slice(-3);
      const previous = exercise.maxWeightBySession.slice(-6, -3);

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (recent.length > 0 && previous.length > 0) {
        const recentAvg = recent.reduce((sum, w) => sum + w, 0) / recent.length;
        const previousAvg = previous.reduce((sum, w) => sum + w, 0) / previous.length;
        const delta = recentAvg - previousAvg;

        if (delta > 0.25) trend = 'up';
        else if (delta < -0.25) trend = 'down';
      }

      const pr = weightUnit === 'lbs'
        ? Math.round(exercise.prKg * KG_TO_LBS)
        : Math.round(exercise.prKg);

      const lastWeight = weightUnit === 'lbs'
        ? Math.round(exercise.lastWeightKg * KG_TO_LBS)
        : Math.round(exercise.lastWeightKg);

      return {
        id: exercise.id,
        name: exercise.name,
        muscle: exercise.muscle,
        pr,
        lastWeight,
        sessions: exercise.sessions,
        trend,
      };
    });
  }, [activeTab, catalogExercises, workoutHistory, weightUnit]);

  // Filter and sort exercises
  const filteredExercises = useMemo(() => {
    if (activeTab !== 'exercises') return [];

    return exerciseStats
      .filter((ex) => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
                    ex.muscle.toLowerCase().includes(exerciseSearch.toLowerCase()))
      .sort((a, b) => {
        switch (exerciseFilter) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'muscle':
            return a.muscle.localeCompare(b.muscle);
          case 'pr':
            return b.pr - a.pr;
          default: // recent
            return b.sessions - a.sessions;
        }
      });
  }, [activeTab, exerciseFilter, exerciseSearch, exerciseStats]);

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  const renderWeightPointerLabel = useCallback(
    (items: any) => (
      <View className="bg-card border border-border rounded-lg px-3 py-2">
        <Text className="text-xs text-primary font-bold">{items[0].value} {weightUnit}</Text>
        <Text className="text-xs text-muted-foreground">{items[0].date || items[0].label}</Text>
      </View>
    ),
    [weightUnit]
  );

  const weightPointerConfig = useMemo(
    () => ({
      pointerStripHeight: 160,
      pointerStripColor: '#31D5E3',
      pointerStripWidth: 2,
      pointerColor: '#31D5E3',
      radius: 6,
      pointerLabelWidth: 100,
      pointerLabelHeight: 90,
      activatePointersOnLongPress: true,
      autoAdjustPointerLabelPosition: false,
      pointerLabelComponent: renderWeightPointerLabel,
    }),
    [renderWeightPointerLabel]
  );

  const renderStrengthPointerLabel = useCallback(
    (items: any) => (
      <View className="bg-card border border-border rounded-lg px-3 py-2">
        <Text className="text-xs text-[#8B5CF6] font-bold">
          {items[0].value.toLocaleString()} {weightUnit}
        </Text>
        <Text className="text-xs text-muted-foreground">{items[0].date}</Text>
        <Text className="text-xs text-muted-foreground">{items[0].sessionName}</Text>
      </View>
    ),
    [weightUnit]
  );

  const strengthPointerConfig = useMemo(
    () => ({
      pointerStripHeight: 160,
      pointerStripColor: '#8B5CF6',
      pointerStripWidth: 2,
      pointerColor: '#8B5CF6',
      radius: 6,
      pointerLabelWidth: 120,
      pointerLabelHeight: 90,
      activatePointersOnLongPress: true,
      autoAdjustPointerLabelPosition: false,
      pointerLabelComponent: renderStrengthPointerLabel,
    }),
    [renderStrengthPointerLabel]
  );

  const renderSymmetryPointerLabel = useCallback(
    (items: any) => (
      <View className="bg-card border border-border rounded-lg px-3 py-2">
        <Text className="text-xs text-success font-bold">Score: {items[0].value}</Text>
        <Text className="text-xs text-muted-foreground">{items[0].label}</Text>
      </View>
    ),
    []
  );

  const symmetryPointerConfig = useMemo(
    () => ({
      pointerStripHeight: 160,
      pointerStripColor: '#4ADE80',
      pointerStripWidth: 2,
      pointerColor: '#4ADE80',
      radius: 6,
      pointerLabelWidth: 100,
      pointerLabelHeight: 90,
      activatePointersOnLongPress: true,
      autoAdjustPointerLabelPosition: false,
      pointerLabelComponent: renderSymmetryPointerLabel,
    }),
    [renderSymmetryPointerLabel]
  );

  // Show loading state only on initial load (not on subsequent background refreshes)
  if (!isInitialLoadComplete && isProgressLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="px-4 pt-6 gap-4">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <GlassCard className="gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </GlassCard>
          <GlassCard className="gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </GlassCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: Math.max(8, insets.bottom) }}>
        <View className="px-4">
          <Animated.View style={createAnimStyle(headerAnim)} className="mb-6">
            <Text className="text-2xl font-bold text-foreground">Progress</Text>
            <Text className="text-muted-foreground text-sm mt-1">
              Track your transformation
            </Text>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-xs text-muted-foreground">
                {isProgressRefreshing
                  ? 'Refreshing in background...'
                  : lastRefreshedAt
                    ? `Updated ${lastRefreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'Using cached data'}
              </Text>
              {progressError && (
                <Button variant="ghost" size="sm" onPress={() => refreshProgressData({ force: true })}>
                  <Text className="text-primary text-xs">Retry</Text>
                </Button>
              )}
            </View>
          </Animated.View>

          <Animated.View style={createAnimStyle(contentAnim)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full mb-6 ">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="exercises">Exercises</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="cardio">Cardio</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="gap-6">
              {/* Weight Chart */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <Scale size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Body Weight</Text>
                  </View>
                  {weightChange !== 0 && (
                    <Text className={cn('text-sm', weightChange > 0 ? 'text-success' : 'text-destructive')}>
                      {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} {weightUnit}
                    </Text>
                  )}
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  {weightChartData.length > 0 ? (
                    <View className="items-center justify-center pt-4">
                      <MemoizedLineChart
                        data={weightChartData}
                        curved
                        areaChart
                        height={180}
                        width={chartWidth}
                        spacing={30}
                        initialSpacing={10}
                        color="#31D5E3"
                        thickness={3}
                        startFillColor="#31D5E3"
                        endFillColor="#31D5E3"
                        startOpacity={0.3}
                        endOpacity={0.05}
                        dataPointsColor="#31D5E3"
                        dataPointsRadius={4}
                        hideDataPoints={false}
                        yAxisColor="#27272A"
                        xAxisColor="#27272A"
                        yAxisTextStyle={chartAxisTextStyle}
                        xAxisLabelTextStyle={chartAxisLabelStyle}
                        rulesType="solid"
                        rulesColor="#27272A"
                        noOfSections={4}
                        backgroundColor="transparent"
                        pointerConfig={weightPointerConfig}
                    />
                    </View>
                  ) : (
                    <View className="items-center justify-center py-12">
                      <Scale size={40} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-3">No weight data yet</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Log your weight to see trends</Text>
                    </View>
                  )}
                </GlassCard>
              </View>

              {/* Strength Progress Chart */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <Dumbbell size={20} color="#8B5CF6" />
                    <Text className="text-lg font-semibold text-foreground">Strength Progress</Text>
                  </View>
                  {volumeTrend !== 0 && (
                    <Text className={cn('text-sm', volumeTrend > 0 ? 'text-success' : 'text-destructive')}>
                      {volumeTrend > 0 ? '+' : ''}{Math.round(volumeTrend).toLocaleString()} {weightUnit}
                    </Text>
                  )}
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  {strengthProgressData.length > 0 ? (
                    <View className="items-center justify-center pt-4">
                      <MemoizedLineChart
                        data={strengthProgressData}
                        curved
                        areaChart
                        height={180}
                        width={chartWidth}
                        spacing={30}
                        initialSpacing={10}
                        color="#8B5CF6"
                        thickness={3}
                        startFillColor="#8B5CF6"
                        endFillColor="#8B5CF6"
                        startOpacity={0.3}
                        endOpacity={0.05}
                        dataPointsColor="#8B5CF6"
                        dataPointsRadius={4}
                        hideDataPoints={false}
                        yAxisColor="#27272A"
                        xAxisColor="#27272A"
                        yAxisTextStyle={chartAxisTextStyle}
                        xAxisLabelTextStyle={chartAxisLabelStyle}
                        rulesType="solid"
                        rulesColor="#27272A"
                        noOfSections={4}
                        backgroundColor="transparent"
                        formatYLabel={formatVolumeTick}
                        pointerConfig={strengthPointerConfig}
                      />
                      <Text className="text-xs text-muted-foreground mt-2">Total Volume per Session</Text>
                    </View>
                  ) : (
                    <View className="items-center justify-center py-12">
                      <Dumbbell size={40} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-3">No workout data yet</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Complete workouts to track strength progress</Text>
                    </View>
                  )}
                </GlassCard>
              </View>

              {/* Symmetry Score Chart */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <TrendingUp size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Symmetry Score</Text>
                  </View>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-row items-center"
                    onPress={() => router.push('/symmetry-history')}
                  >
                    <Text className="text-primary text-sm">View All</Text>
                    <ChevronRight size={16} color="#31D5E3" />
                  </Button>
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  {symmetryChartData.length > 0 ? (
                    <View className="items-center justify-center pt-4">
                      <MemoizedLineChart
                        data={symmetryChartData}
                        curved
                        areaChart
                        height={180}
                        width={chartWidth}
                        spacing={80}
                        initialSpacing={20}
                        color="#4ADE80"
                        thickness={3}
                        startFillColor="#4ADE80"
                        endFillColor="#4ADE80"
                        startOpacity={0.3}
                        endOpacity={0.05}
                        dataPointsColor="#4ADE80"
                        dataPointsRadius={5}
                        hideDataPoints={false}
                        yAxisColor="#27272A"
                        xAxisColor="#27272A"
                      yAxisTextStyle={chartAxisTextStyle}
                      xAxisLabelTextStyle={chartAxisLabelStyleWide}
                      rulesType="solid"
                      rulesColor="#27272A"
                      noOfSections={4}
                      backgroundColor="transparent"
                      pointerConfig={symmetryPointerConfig}
                    />
                    </View>
                  ) : (
                    <View className="items-center justify-center py-12">
                      <TrendingUp size={40} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-3">No symmetry scans yet</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Complete a physique scan to track symmetry</Text>
                    </View>
                  )}
                </GlassCard>
              </View>

              {/* Quick Stats */}
              <View>
                <Text className="text-lg font-semibold mb-3 text-foreground">This Month</Text>
                <View className="flex-row flex-wrap gap-3">
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-primary">{monthlyStats.workouts}</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Workouts</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-success">{formatCompactNumber(monthlyStats.totalVolume)} {weightUnit}</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Total Volume</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-warning">{formatMinutesTrained(monthlyStats.totalMinutes)}</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Time Trained</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-foreground">{monthlyStats.prs}</Text>
                      <Text className="text-xs text-muted-foreground mt-1">PRs Hit</Text>
                    </GlassCard>
                  </View>
                </View>
              </View>
            </TabsContent>

            {/* Exercises Tab */}
            <TabsContent value="exercises" className="gap-4">
              <View>
                {/* Search and Filter */}
                <View className="w-full mb-4 flex-row items-center gap-2">
                  <View className="relative flex-1">
                    <View className="absolute left-3 top-1/2 z-10" style={{ transform: [{ translateY: -10 }] }}>
                      <Search size={16} color="#71717A" />
                    </View>
                    <Input
                      placeholder="Search exercises..."
                      value={exerciseSearch}
                      onChangeText={setExerciseSearch}
                      className="pl-9 w-full"
                    />
                  </View>
                  <GestureHandlerRootView>
                  <Pressable
                    onPress={() => {
                      const filters = ['recent', 'name', 'muscle', 'pr'];
                      const currentIndex = filters.indexOf(exerciseFilter);
                      setExerciseFilter(filters[(currentIndex + 1) % filters.length]);
                    }}
                    className="px-3 py-2 border border-border rounded-lg flex-row items-center gap-2 bg-card min-w-[96px] justify-center"
                  >
                    <Filter size={16} color="#71717A" />
                    <Text className="text-sm text-foreground capitalize">{exerciseFilter}</Text>
                  </Pressable>
                  </GestureHandlerRootView>
                </View>

                {/* Exercise List */}
                <View className="gap-2">
                  {isLoadingExercises ? (
                    <View className="gap-2 py-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <GlassCard key={`exercise-skeleton-${idx}`} className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-3 flex-1">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <View className="flex-1 gap-2">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-24" />
                            </View>
                          </View>
                          <View className="items-end gap-2">
                            <Skeleton className="h-4 w-14" />
                            <Skeleton className="h-3 w-20" />
                          </View>
                        </GlassCard>
                      ))}
                    </View>
                  ) : (
                    <FlatList
                      data={filteredExercises}
                      keyExtractor={(item) => item.id}
                      scrollEnabled={false}
                      removeClippedSubviews
                      initialNumToRender={10}
                      maxToRenderPerBatch={10}
                      windowSize={5}
                      contentContainerStyle={{ gap: 8 }}
                      renderItem={({ item: exercise }) => (
                        <GestureHandlerRootView>
                          <Pressable
                            onPress={() => {
                              if (exercise.sessions === 0) {
                                showAppAlert('No Stats Yet', 'Complete this exercise in a workout to view detailed history.');
                                return;
                              }
                              setSelectedExerciseId(exercise.id);
                              setShowExerciseHistory(true);
                            }}
                          >
                            <GlassCard className="flex-row items-center justify-between">
                              <View className="flex-row items-center gap-3 flex-1">
                                <View className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                  <Dumbbell size={20} color="#31D5E3" />
                                </View>
                                <View className="flex-1">
                                  <Text className="font-medium text-foreground">{exercise.name}</Text>
                                  <Text className="text-xs text-muted-foreground">{exercise.muscle}</Text>
                                </View>
                              </View>
                              {exercise.sessions > 0 && (
                                <View className="items-end">
                                  <Text className="font-bold text-foreground">{exercise.lastWeight} {weightUnit}</Text>
                                  <View className="flex-row items-center gap-1">
                                    <Text className="text-xs text-muted-foreground">PR: {exercise.pr} {weightUnit}</Text>
                                    {exercise.trend === 'up' && <TrendingUp size={12} color="#4ADE80" />}
                                  </View>
                                </View>
                              )}
                            </GlassCard>
                          </Pressable>
                        </GestureHandlerRootView>
                      )}
                    />
                  )}
                  
                  {!isLoadingExercises && filteredExercises.length === 0 && (
                    <View className="items-center py-8">
                      <Dumbbell size={32} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-2">
                        {exerciseLoadError || 'No exercises found'}
                      </Text>
                      {exerciseLoadError && (
                        <Button variant="ghost" size="sm" onPress={loadExercises}>
                          <Text className="text-primary text-xs">Try again</Text>
                        </Button>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Exercise History Sheet */}
              <ExerciseHistorySheet
                exerciseId={selectedExerciseId}
                isOpen={showExerciseHistory}
                onClose={() => setShowExerciseHistory(false)}
                unit={weightUnit}
              />
            </TabsContent>

            {/* Body Measurements Tab */}
            <TabsContent value="body" className="gap-6">
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Ruler size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Body Measurements</Text>
                  </View>
                </View>

                <Text className="text-sm text-muted-foreground mb-4">
                  Tap any metric to open its trend, recent check-ins, and quick log.
                </Text>

                <View className="gap-5">
                  {groupedMeasurementRows.map((group) => (
                    <View key={group.key}>
                      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        {group.title}
                      </Text>
                      <Text className="text-xs text-muted-foreground mb-2">{group.subtitle}</Text>

                      <View className="gap-3">
                        {group.rows.map((row) => (
                          <GestureHandlerRootView key={row.key}>
                            <Pressable
                              onPress={() => {
                                setSelectedMeasurementKey(row.key);
                                setShowMeasurementHistory(true);
                              }}
                            >
                              <GlassCard className="flex-row items-center justify-between">
                                <View className="flex-1 pr-3">
                                  <Text className="font-medium text-foreground">{row.label}</Text>
                                  <Text className="text-xs text-muted-foreground mt-0.5">{row.description}</Text>
                                  <Text className="text-[11px] text-muted-foreground mt-1">
                                    {row.lastLoggedAt ? `Updated ${row.lastLoggedAt}` : 'No check-ins yet'}
                                  </Text>
                                </View>

                                <View className="items-end">
                                  <Text className="text-xl font-bold text-foreground">
                                    {row.latestValue === null ? '--' : row.latestValue.toFixed(1)}
                                  </Text>
                                  <View className="flex-row items-center gap-1">
                                    <Text className="text-xs text-muted-foreground">{row.displayUnit}</Text>
                                    <ChevronRight size={12} color="#71717A" />
                                  </View>
                                </View>
                              </GlassCard>
                            </Pressable>
                          </GestureHandlerRootView>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>

                <MeasurementHistorySheet
                  metricKey={selectedMeasurementKey}
                  isOpen={showMeasurementHistory}
                  onClose={() => {
                    setShowMeasurementHistory(false);
                    setSelectedMeasurementKey(null);
                  }}
                  logs={measurementLogs}
                  measurementUnit={measurementUnit}
                  weightUnit={weightUnit}
                  onSaveMeasurement={onSaveMeasurementMetric}
                />
              </View>
            </TabsContent>

            {/* Cardio Tab */}
            <TabsContent value="cardio" className="gap-6">
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Activity size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Cardio Log</Text>
                  </View>
                  <Button size="sm" variant="outline" onPress={() => setShowCardioLogModal(true)}>
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-1">Add</Text>
                  </Button>
                </View>

                {cardioLogsList.length > 0 ? (
                  <FlatList
                    data={cardioLogsList}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    removeClippedSubviews
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={4}
                    contentContainerStyle={{ gap: 12 }}
                    renderItem={({ item: session }) => (
                      <GlassCard className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                          <View className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            session.intensity === 'High' ? 'bg-destructive/20' :
                            session.intensity === 'Moderate' ? 'bg-warning/20' : 'bg-success/20'
                          )}>
                            <Activity 
                              size={20} 
                              color={
                                session.intensity === 'High' ? '#EF4444' :
                                session.intensity === 'Moderate' ? '#F59E0B' : '#4ADE80'
                              } 
                            />
                          </View>
                          <View>
                            <Text className="font-medium text-foreground">{session.type}</Text>
                            <Text className="text-xs text-muted-foreground">{session.date}</Text>
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="font-bold text-foreground">{session.duration} min</Text>
                          <Text className="text-xs text-muted-foreground">{session.calories} cal</Text>
                        </View>
                      </GlassCard>
                    )}
                  />
                ) : (
                  <GlassCard className="items-center py-8">
                    <Activity size={40} color="#71717A" style={{ opacity: 0.5 }} />
                    <Text className="text-muted-foreground mt-3">No cardio sessions logged</Text>
                    <Text className="text-xs text-muted-foreground mt-1">Tap "Add" to log your cardio</Text>
                  </GlassCard>
                )}

                {/* Weekly Summary */}
                {cardioLogsList.length > 0 && (
                  <GlassCard className="mt-6">
                    <Text className="font-semibold mb-3 text-foreground">Recent Activity</Text>
                    <View className="flex-row justify-between">
                      <View className="items-center flex-1">
                        <Text className="text-2xl font-bold text-primary">{cardioLogsList.length}</Text>
                        <Text className="text-xs text-muted-foreground">Sessions</Text>
                      </View>
                      <View className="items-center flex-1">
                        <Text className="text-2xl font-bold text-foreground">
                          {cardioLogsList.reduce((sum, s) => sum + s.duration, 0)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Minutes</Text>
                      </View>
                      <View className="items-center flex-1">
                        <Text className="text-2xl font-bold text-warning">
                          {cardioLogsList.reduce((sum, s) => sum + s.calories, 0)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Calories</Text>
                      </View>
                    </View>
                  </GlassCard>
                )}
              </View>
            </TabsContent>
          </Tabs>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Modals */}
      <CardioLogModal 
        open={showCardioLogModal} 
        onOpenChange={setShowCardioLogModal} 
      />
    </SafeAreaView>
  );
}


