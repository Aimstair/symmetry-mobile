import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppState, View, Text, ScrollView, Pressable, TextInput,  Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { healthService } from '@/services/HealthService';
import { notificationService } from '@/services/NotificationService';
import { getCurrentWeekCalendar, normalizeDayName } from '@/utils/workoutCalendar';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/modal';
import { showAppAlert } from '@/store/useAlertStore';
import { ExerciseDetailSheet } from '@/components/ui/workout/ExerciseDetailSheet';
import { ExerciseHistorySheet } from '@/components/ui/workout/ExerciseHistorySheet';
import { AddExerciseModal } from '@/components/ui/workout/AddExerciseModal';
import { ShareModal } from '@/components/ui/workout/ShareModal';
import type { WorkoutSummaryData } from '@/components/ui/workout/WorkoutSummaryCard';
import { 
  ChevronLeft, 
  Timer, 
  Check, 
  Plus, 
  MoreVertical,
  Calculator,
  SkipForward,
  Flame,
  Dumbbell,
  ChevronRight,
  Trophy,
  Trash2,
  Share2,
} from 'lucide-react-native';
import { cn, formatMuscleGroups, formatWorkoutDuration, isAbortError } from '@/lib/utils';
import { calculateWorkoutStreak, getSymmetryScoreForDate } from '@/utils/workoutMetrics';
import type { PlanExercise } from '@/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Custom spring animation config for smooth transitions
const springConfig = {
  duration: 300,
  create: { type: LayoutAnimation.Types.spring, property: LayoutAnimation.Properties.opacity, springDamping: 0.7 },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 },
  delete: { type: LayoutAnimation.Types.spring, property: LayoutAnimation.Properties.opacity, springDamping: 0.7 },
};

const WORKOUT_EXPIRY_HOURS = 12;
const INPUT_PERSIST_DEBOUNCE_MS = 400;
const EXPIRE_CHECK_THROTTLE_MS = 5000;
const MIN_CUSTOM_REST_SECONDS = 1;
const MAX_CUSTOM_REST_SECONDS = 1800;

function sanitizeRestSecondsValue(value: number | string, fallback = 90): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value || '').trim(), 10);
  const normalized = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  return Math.max(MIN_CUSTOM_REST_SECONDS, Math.min(MAX_CUSTOM_REST_SECONDS, normalized));
}

function formatExerciseDisplayName(value: string): string {
  const normalized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Exercise';

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

const getBackendRank = (source: unknown): number | undefined => {
  if (!source || typeof source !== 'object') return undefined;

  const record = source as Record<string, unknown>;
  const candidates = [record.rank, record.countryRank, record.dailyCountryRank];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return Math.floor(candidate);
    }
  }

  return undefined;
};

// Isolated timer component to prevent full-screen re-renders
const ElapsedTimer = ({ startTime }: { startTime: Date | string | null }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      // JSON storage converts Date to String, so we must parse it new Date()
      const start = new Date(startTime).getTime(); 
      if (Number.isNaN(start)) return;
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <View className="flex-row items-center gap-2">
      <Timer size={16} color="#31D5E3" />
      <Text className="font-mono font-bold text-lg text-foreground">{formatWorkoutDuration(elapsed)}</Text>
    </View>
  );
};

// Isolated rest timer component with entrance/exit animations
// Uses "Delta" method for drift-proof timing - guarantees accurate completion even if app lags/backgrounds
const RestTimerDisplay = ({ 
  restTimer, 
  onStop,
}: { 
  restTimer: { isRunning: boolean; elapsedSeconds: number; targetSeconds: number };
  onStop: () => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [isVisible, setIsVisible] = useState(false);
  const [displayElapsedSeconds, setDisplayElapsedSeconds] = useState(restTimer.elapsedSeconds || 0);
  
  // âœ… DRIFT-PROOF: Store the exact timestamp when timer should complete
  const endTimeRef = useRef<number | null>(null);
  const onStopRef = useRef(onStop);
  const elapsedRef = useRef(restTimer.elapsedSeconds);
  const lastElapsedTickRef = useRef(restTimer.elapsedSeconds);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  useEffect(() => {
    elapsedRef.current = restTimer.elapsedSeconds;
  }, [restTimer.elapsedSeconds]);

  useEffect(() => {
    if (restTimer.isRunning) return;
    setDisplayElapsedSeconds(restTimer.elapsedSeconds || 0);
  }, [restTimer.elapsedSeconds, restTimer.isRunning]);

  // Handle entrance/exit animations
  useEffect(() => {
    if (restTimer.isRunning) {
      setIsVisible(true);
      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIsVisible(false));
    }
  }, [restTimer.isRunning, fadeAnim, scaleAnim]);

  // âœ… DRIFT-PROOF TIMER: Uses delta-time method instead of counting intervals
  useEffect(() => {
    if (!restTimer.isRunning) {
      endTimeRef.current = null;
      hasCompletedRef.current = false;
      lastElapsedTickRef.current = elapsedRef.current;
      return;
    }

    // Calculate the exact moment when timer should complete
    // This only happens once when timer starts running
    if (endTimeRef.current === null) {
      const remainingSeconds = restTimer.targetSeconds - elapsedRef.current;
      endTimeRef.current = Date.now() + remainingSeconds * 1000;
      hasCompletedRef.current = false;
      setDisplayElapsedSeconds(elapsedRef.current);
      lastElapsedTickRef.current = elapsedRef.current;
    }

    // Check 5x per second for smooth visual updates while only dispatching on second changes.
    const interval = setInterval(() => {
      const now = Date.now();
      const msRemaining = endTimeRef.current! - now;

      if (msRemaining <= 0) {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onStopRef.current();
        }
        endTimeRef.current = null;
      } else {
        const secondsRemaining = Math.ceil(msRemaining / 1000);
        const newElapsed = Math.max(
          0,
          Math.min(restTimer.targetSeconds - secondsRemaining, restTimer.targetSeconds)
        );

        // Update elapsed - this "catches up" instantly if frames were dropped
        if (newElapsed !== lastElapsedTickRef.current) {
          lastElapsedTickRef.current = newElapsed;
          setDisplayElapsedSeconds(newElapsed);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [restTimer.isRunning, restTimer.targetSeconds]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const circumference = 2 * Math.PI * 88;
  const progress = restTimer.targetSeconds > 0 
    ? displayElapsedSeconds / restTimer.targetSeconds 
    : 0;
  const strokeDashoffset = circumference * (1 - progress);

  if (!isVisible) return null;

  return (
    <Animated.View 
      className="absolute inset-0 z-50 bg-background/95 items-center justify-center"
      style={{ opacity: fadeAnim }}
    >
      <Animated.View 
        className="items-center"
        style={{ transform: [{ scale: scaleAnim }] }}
      >
        <Text className="text-sm text-muted-foreground mb-4 uppercase tracking-wide">Rest Timer</Text>
        
        <View className="relative w-48 h-48 mb-8 items-center justify-center">
          <Svg width={192} height={192} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="#27272A"
              strokeWidth="8"
            />
            <Circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="#31D5E3"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-5xl font-bold font-mono text-foreground">
              {formatTime(displayElapsedSeconds)}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              / {formatTime(restTimer.targetSeconds)}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-4">
          <Button
            variant="outline"
            size="lg"
            onPress={() => onStopRef.current()}
            className="min-w-[128px]"
          >
            <SkipForward size={16} color="#A1A1AA" />
            <Text className="text-foreground ml-2">Skip</Text>
          </Button>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

// Extended set data for tracking during workout
interface SetData {
  id: number;
  weight: string;
  reps: string;
  rpe: string; // Rate of Perceived Exertion (1-10)
  completed: boolean;
  isWarmup: boolean;
  tags: string[];
  prevWeight?: number;
  prevReps?: number;
}

// Extended exercise data for workout session
interface ExerciseData {
  id: string; // Unique Plan/Session ID
  catalogExerciseId: string; // Actual DB Exercise ID (e.g. 'bench_press')
  name: string;
  muscleGroup: string;
  equipment: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  sets: SetData[];
  supersetId?: string;
  notes?: string;
}

type RestSettingsFeedback = {
  type: 'success' | 'warning' | 'error';
  message: string;
};

type ActionToastKind = 'success' | 'error' | 'info';

// Convert plan exercises to workout session format
function convertToSessionExercises(exercises: PlanExercise[]): ExerciseData[] {
  return exercises.map((ex) => {
    return {
      id: ex.id, 
      catalogExerciseId: ex.exerciseId, // Store the reference for the DB
      name: ex.exercise?.name || formatExerciseDisplayName(ex.exerciseId),
      muscleGroup: ex.exercise?.muscleGroups[0] || 'General',
      equipment: ex.exercise?.equipment[0] || 'Unknown',
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      sets: Array.from({ length: ex.targetSets }, (_, i) => ({
        id: i + 1,
        weight: '',
        reps: '',
        rpe: '',
        completed: false,
        isWarmup: false,
        tags: [],
        prevWeight: undefined,
        prevReps: undefined,
      })),
    };
  });
}

export default function ActiveWorkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPro = useAppStore((s) => s.isPro);
  
  // Keep screen awake during workout
  useKeepAwake();
  
  // Store connections
  const {
    activeWorkout,
    workoutPlans,
    workoutHistory,
    physiqueScans,
    settings,
    endWorkout,
    toggleWarmupMode,
    toggleDeloadMode,
    startRestTimer,
    stopRestTimer,
    syncSwapExerciseToCloud,
    syncAddExerciseToDayCloud,
    syncUpdateExerciseRestSecondsGlobally,
    syncUpdateExercisesRestSecondsGlobally,
    syncSaveWorkoutSession,
    syncMarkTodayWorkoutCompleted,
    syncFetchWorkoutHistory,
    updateActiveWorkout,
    setDefaultRestSeconds,
    incrementWorkoutsCompleted,
  } = useAppStore(
    useShallow((s) => ({
      activeWorkout: s.activeWorkout,
      workoutPlans: s.workoutPlans,
      workoutHistory: s.workoutHistory,
      physiqueScans: s.physiqueScans,
      settings: s.settings,
      endWorkout: s.endWorkout,
      toggleWarmupMode: s.toggleWarmupMode,
      toggleDeloadMode: s.toggleDeloadMode,
      startRestTimer: s.startRestTimer,
      stopRestTimer: s.stopRestTimer,
      syncSwapExerciseToCloud: s.syncSwapExerciseToCloud,
      syncAddExerciseToDayCloud: s.syncAddExerciseToDayCloud,
      syncUpdateExerciseRestSecondsGlobally: s.syncUpdateExerciseRestSecondsGlobally,
      syncUpdateExercisesRestSecondsGlobally: s.syncUpdateExercisesRestSecondsGlobally,
      syncSaveWorkoutSession: s.syncSaveWorkoutSession,
      syncMarkTodayWorkoutCompleted: s.syncMarkTodayWorkoutCompleted,
      syncFetchWorkoutHistory: s.syncFetchWorkoutHistory,
      updateActiveWorkout: s.updateActiveWorkout,
      setDefaultRestSeconds: s.setDefaultRestSeconds,
      incrementWorkoutsCompleted: s.incrementWorkoutsCompleted,
    }))
  );

  // Local state
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [calcWeight, setCalcWeight] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>(settings.unit === 'kg' ? 'kg' : 'lbs');
  const [showMenu, setShowMenu] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseData | null>(null);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [defaultRestSecondsInput, setDefaultRestSecondsInput] = useState(String(settings.defaultRestSeconds ?? 90));
  const [isSavingRestSettings, setIsSavingRestSettings] = useState(false);
  const [restSettingsFeedback, setRestSettingsFeedback] = useState<RestSettingsFeedback | null>(null);
  const [actionToast, setActionToast] = useState<{ message: string; kind: ActionToastKind } | null>(null);
  const [shareWorkoutData, setShareWorkoutData] = useState<WorkoutSummaryData | null>(null);
  const [isPostWorkoutFlow, setIsPostWorkoutFlow] = useState(false);
  
  // Animation refs for smooth entrance
  const exerciseAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const hasInitializedExercisesRef = useRef(false);
  const hasAppliedPersistedSetsRef = useRef(false);
  const hasAutoExpiredRef = useRef(false);
  const pendingPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistExercisesRef = useRef<ExerciseData[] | null>(null);
  const isSavingWorkoutRef = useRef(false);
  const lastExpireCheckAtRef = useRef(0);
  const restSettingsFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRestSettingsStatus = useCallback((status: RestSettingsFeedback) => {
    if (restSettingsFeedbackTimeoutRef.current) {
      clearTimeout(restSettingsFeedbackTimeoutRef.current);
    }

    setRestSettingsFeedback(status);

    restSettingsFeedbackTimeoutRef.current = setTimeout(() => {
      restSettingsFeedbackTimeoutRef.current = null;
      setRestSettingsFeedback(null);
    }, 2600);
  }, []);

  const showActionToast = useCallback((message: string, kind: ActionToastKind = 'info') => {
    if (actionToastTimeoutRef.current) {
      clearTimeout(actionToastTimeoutRef.current);
    }

    setActionToast({ message, kind });

    actionToastTimeoutRef.current = setTimeout(() => {
      actionToastTimeoutRef.current = null;
      setActionToast(null);
    }, 2200);
  }, []);

  // âœ… PERSISTENCE HELPER: Syncs current UI state to Global Store
  const persistProgress = useCallback((currentExercises: ExerciseData[]) => {
    const exerciseSets: Record<string, any[]> = {};
    currentExercises.forEach((ex) => {
      exerciseSets[ex.id] = ex.sets.map((s) => ({
        id: `temp-${s.id}`,
        sessionExerciseId: ex.id,
        setNumber: s.id,
        weight: parseFloat(s.weight) || 0,
        reps: parseInt(s.reps) || 0,
        rpe: Number.isFinite(parseFloat(s.rpe)) && parseFloat(s.rpe) > 0 ? parseFloat(s.rpe) : undefined,
        isWarmup: s.isWarmup,
        isCompleted: s.completed,
        createdAt: new Date(),
      }));
    });
    // âœ… Saves immediately to MMKV via Zustand
    updateActiveWorkout({ exerciseSets });
  }, [updateActiveWorkout]);

  const flushPendingPersist = useCallback(() => {
    if (pendingPersistTimeoutRef.current) {
      clearTimeout(pendingPersistTimeoutRef.current);
      pendingPersistTimeoutRef.current = null;
    }

    if (pendingPersistExercisesRef.current) {
      persistProgress(pendingPersistExercisesRef.current);
      pendingPersistExercisesRef.current = null;
    }
  }, [persistProgress]);

  const cancelPendingPersist = useCallback(() => {
    if (pendingPersistTimeoutRef.current) {
      clearTimeout(pendingPersistTimeoutRef.current);
      pendingPersistTimeoutRef.current = null;
    }
    pendingPersistExercisesRef.current = null;
  }, []);

  const schedulePersistProgress = useCallback((currentExercises: ExerciseData[]) => {
    pendingPersistExercisesRef.current = currentExercises;

    if (pendingPersistTimeoutRef.current) {
      clearTimeout(pendingPersistTimeoutRef.current);
    }

    pendingPersistTimeoutRef.current = setTimeout(() => {
      pendingPersistTimeoutRef.current = null;
      if (pendingPersistExercisesRef.current) {
        persistProgress(pendingPersistExercisesRef.current);
        pendingPersistExercisesRef.current = null;
      }
    }, INPUT_PERSIST_DEBOUNCE_MS);
  }, [persistProgress]);

  useEffect(() => {
    return () => {
      flushPendingPersist();
    };
  }, [flushPendingPersist]);

  const restoreExercisesFromPersistedState = useCallback(
    (sessionExercises: ExerciseData[], persistedSets: Record<string, any[]>) => {
      const persistedEntries = Object.entries(persistedSets || {});
      let restoredCount = 0;

      const nextExercises = sessionExercises.map((ex, exIndex) => {
        let savedSets = persistedSets?.[ex.id];
        if ((!savedSets || savedSets.length === 0) && persistedEntries[exIndex]) {
          savedSets = persistedEntries[exIndex][1];
        }

        if (!savedSets || savedSets.length === 0) {
          return ex;
        }

        restoredCount += 1;

        return {
          ...ex,
          sets: savedSets.map((saved: any, idx: number) => ({
            id: idx + 1,
            weight: saved.weight ? String(saved.weight) : '',
            reps: saved.reps ? String(saved.reps) : '',
            rpe: saved.rpe ? String(saved.rpe) : '',
            completed: saved.isCompleted || false,
            isWarmup: saved.isWarmup || false,
            tags: [],
            prevWeight: ex.sets[idx]?.prevWeight,
            prevReps: ex.sets[idx]?.prevReps,
          })),
        };
      });

      return { nextExercises, restoredCount };
    },
    []
  );

  const previousSetsByExerciseId = useMemo(() => {
    const byExerciseId = new Map<string, Array<{ weight: number; reps: number }>>();
    const sessions = [...(workoutHistory || [])].sort((a: any, b: any) => {
      const aTime = new Date(a?.startedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.startedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    });

    sessions.forEach((session: any) => {
      if (!Array.isArray(session?.exercises)) return;

      session.exercises.forEach((exercise: any) => {
        const exerciseId = String(exercise?.exerciseId || exercise?.exercise?.id || exercise?.id || '');
        if (!exerciseId || byExerciseId.has(exerciseId)) return;

        const completedSets = (exercise?.sets || [])
          .filter((set: any) => !set?.isWarmup && set?.isCompleted !== false)
          .map((set: any) => ({
            weight: Number(set?.weight) || 0,
            reps: Number(set?.reps) || 0,
          }))
          .filter((set: { weight: number; reps: number }) => set.weight > 0 && set.reps > 0);

        if (completedSets.length > 0) {
          byExerciseId.set(exerciseId, completedSets);
        }
      });
    });

    return byExerciseId;
  }, [workoutHistory]);

  const applyPreviousSetHistory = useCallback(
    (sessionExercises: ExerciseData[]) => {
      return sessionExercises.map((exercise) => {
        const previousSets = previousSetsByExerciseId.get(exercise.catalogExerciseId);
        if (!previousSets || previousSets.length === 0) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((set, idx) => {
            const previous = previousSets[Math.min(idx, previousSets.length - 1)];
            return {
              ...set,
              prevWeight: previous?.weight,
              prevReps: previous?.reps,
            };
          }),
        };
      });
    },
    [previousSetsByExerciseId]
  );

  // Resolve current workout plan and day
  const { currentPlan, currentDay, loadError } = useMemo(() => {
    if (!activeWorkout.isActive || !activeWorkout.workoutId) {
      return { currentPlan: null, currentDay: null, loadError: 'No active workout' };
    }

    // Find the active workout plan
    const plan = workoutPlans.find((p) => p.id === activeWorkout.workoutId);
    if (!plan) {
      return { currentPlan: null, currentDay: null, loadError: 'Workout plan not found' };
    }

    // Get user's training days and normalize them for consistent matching
    const user = useAppStore.getState().user;
    const trainingDays = (user?.trainingDays || []).map(d => normalizeDayName(d));
    
    // Determine today's workout day using the calendar utility
    const calendarDays = getCurrentWeekCalendar(plan, trainingDays);
    const today = new Date();
    const todayCalendarDay = calendarDays.find(
      (day) =>
        day.fullDate.getDate() === today.getDate() &&
        day.fullDate.getMonth() === today.getMonth() &&
        day.fullDate.getFullYear() === today.getFullYear()
    );

    // Try to get today's workout day
    let workoutDay = todayCalendarDay?.workoutDay || null;
    
    // Fallback 1: Try to find workout day by matching today's day name directly
    if (!workoutDay && plan.workoutDays.length > 0) {
      const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
      workoutDay = plan.workoutDays.find(wd => 
        wd.dayName && normalizeDayName(wd.dayName).toLowerCase() === todayDayName.toLowerCase()
      ) || null;
    }
    
    // Fallback 2: Use first workout day with exercises
    if (!workoutDay && plan.workoutDays.length > 0) {
      workoutDay = plan.workoutDays.find(wd => wd.exercises && wd.exercises.length > 0) || plan.workoutDays[0];
      if (__DEV__) {
        console.log('âš ï¸ Using fallback workout day:', workoutDay?.name);
      }
    }

    if (!workoutDay) {
      return { currentPlan: plan, currentDay: null, loadError: 'No workout scheduled for today' };
    }

    return { currentPlan: plan, currentDay: workoutDay, loadError: null };
  }, [activeWorkout.isActive, activeWorkout.workoutId, workoutPlans]);

  // Redirect if no active workout
  useFocusEffect(
    useCallback(() => {
      if ((!activeWorkout.isActive || !activeWorkout.workoutId) && !isPostWorkoutFlow) {
        // No active workout, redirect to dashboard
        router.replace('/(tabs)/workout-plan');
      }
    }, [activeWorkout.isActive, activeWorkout.workoutId, isPostWorkoutFlow, router])
  );

  useEffect(() => {
    if (!activeWorkout.isActive) return;
    if (workoutHistory.length > 0) return;

    void syncFetchWorkoutHistory({ force: false });
  }, [activeWorkout.isActive, workoutHistory.length, syncFetchWorkoutHistory]);

  const handleRestTimerStop = useCallback(() => {
    stopRestTimer();
  }, [stopRestTimer]);

  const maybeExpireStaleWorkout = useCallback(() => {
    if (!activeWorkout.isActive || !activeWorkout.startTime || hasAutoExpiredRef.current || isSavingWorkoutRef.current) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastExpireCheckAtRef.current < EXPIRE_CHECK_THROTTLE_MS) {
      return;
    }
    lastExpireCheckAtRef.current = nowMs;

    const startedAt = new Date(activeWorkout.startTime);
    if (Number.isNaN(startedAt.getTime())) {
      return;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - startedAt.getTime();
    const exceededLifetime = elapsedMs >= WORKOUT_EXPIRY_HOURS * 60 * 60 * 1000;

    if (!exceededLifetime) {
      return;
    }

    hasAutoExpiredRef.current = true;
    stopRestTimer();
    endWorkout();
    showAppAlert(
      'Workout Session Ended',
      'This workout session expired because it was inactive too long. Please start a new workout session.',
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/workout-plan') }]
    );
  }, [activeWorkout.isActive, activeWorkout.startTime, endWorkout, router, stopRestTimer]);

  useEffect(() => {
    if (!activeWorkout.isActive) {
      hasAutoExpiredRef.current = false;
      lastExpireCheckAtRef.current = 0;
      cancelPendingPersist();
    }
  }, [activeWorkout.isActive, cancelPendingPersist]);

  useEffect(() => {
    if (!isPro && showAdvancedMetrics) {
      setShowAdvancedMetrics(false);
    }
  }, [isPro, showAdvancedMetrics]);

  useEffect(() => {
    if (!showMenu) return;
    setDefaultRestSecondsInput(String(settings.defaultRestSeconds ?? 90));
  }, [showMenu, settings.defaultRestSeconds]);

  useEffect(() => {
    return () => {
      if (restSettingsFeedbackTimeoutRef.current) {
        clearTimeout(restSettingsFeedbackTimeoutRef.current);
        restSettingsFeedbackTimeoutRef.current = null;
      }

      if (actionToastTimeoutRef.current) {
        clearTimeout(actionToastTimeoutRef.current);
        actionToastTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    maybeExpireStaleWorkout();

    const intervalId = setInterval(maybeExpireStaleWorkout, 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        maybeExpireStaleWorkout();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [maybeExpireStaleWorkout]);

  // Initialize workout exercises once current day is available
  useEffect(() => {
    if (hasInitializedExercisesRef.current) return;
    if (!currentDay?.exercises || currentDay.exercises.length === 0) return;

    const baseExercises = applyPreviousSetHistory(convertToSessionExercises(currentDay.exercises));
    const { nextExercises, restoredCount } = restoreExercisesFromPersistedState(
      baseExercises,
      activeWorkout.exerciseSets || {}
    );

    if (restoredCount > 0) {
      hasAppliedPersistedSetsRef.current = true;
      if (__DEV__) console.log(`ðŸ“¥ Workout progress restored for ${restoredCount} exercises`);
    }

    setExercises(nextExercises);
    hasInitializedExercisesRef.current = true;

    nextExercises.forEach((ex, index) => {
      if (!exerciseAnimations.current.has(ex.id)) {
        exerciseAnimations.current.set(ex.id, new Animated.Value(0));
      }
      Animated.spring(exerciseAnimations.current.get(ex.id)!, {
        toValue: 1,
        delay: index * 80,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    });
  }, [
    currentDay,
    activeWorkout.exerciseSets,
    restoreExercisesFromPersistedState,
    applyPreviousSetHistory,
  ]);

  // Apply persisted sets once hydration catches up after initial render.
  useEffect(() => {
    if (!hasInitializedExercisesRef.current || hasAppliedPersistedSetsRef.current) return;

    const persistedSetCount = Object.keys(activeWorkout.exerciseSets || {}).length;
    if (persistedSetCount === 0 || exercises.length === 0) return;

    setExercises((prev) => {
      const { nextExercises, restoredCount } = restoreExercisesFromPersistedState(
        prev,
        activeWorkout.exerciseSets || {}
      );

      if (restoredCount > 0) {
        hasAppliedPersistedSetsRef.current = true;
        if (__DEV__) console.log(`ðŸ“¥ Late hydration restored ${restoredCount} exercises`);
      }

      return nextExercises;
    });
  }, [activeWorkout.exerciseSets, exercises.length, restoreExercisesFromPersistedState]);

  // Calculate workout stats
  const workoutStats = useMemo(() => {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const completedSets = exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );
    const totalVolume = exercises.reduce((acc, ex) => {
      return acc + ex.sets.reduce((setAcc, set) => {
        const weight = parseFloat(set.weight) || 0;
        const reps = parseInt(set.reps) || 0;
        return setAcc + weight * reps;
      }, 0);
    }, 0);
    return { totalSets, completedSets, totalVolume };
  }, [exercises]);

  // Handle workout completion
  const handleFinishWorkout = async () => {
    // Check if any sets are completed
    if (workoutStats.completedSets === 0) {
      showAppAlert(
        'No Sets Logged',
        'You haven\'t completed any sets yet. Are you sure you want to finish?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Finish Anyway',
            style: 'destructive',
            onPress: () => finishAndSaveWorkout(),
          },
        ]
      );
      return;
    }

    showAppAlert(
      'Finish Workout',
      `Complete ${workoutStats.completedSets}/${workoutStats.totalSets} sets logged. Finish this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => finishAndSaveWorkout(),
        },
      ]
    );
  };

  // Save workout session to database and clean up
  const finishAndSaveWorkout = async () => {
    isSavingWorkoutRef.current = true;

    try {
      flushPendingPersist();
      stopRestTimer();

      if (__DEV__) {
        console.log('ðŸ Starting workout save process...');
      }
      
      // Prepare session data from exercises
      const sessionExercises = exercises
        .filter(ex => ex.sets.some(s => s.completed)) // Only include exercises with completed sets
        .map(ex => ({
          exerciseId: ex.catalogExerciseId,
          sets: ex.sets
            .filter(s => s.completed) // Only include completed sets
            .map(s => ({
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps) || 0,
              rpe: Number.isFinite(parseFloat(s.rpe)) && parseFloat(s.rpe) > 0 ? parseFloat(s.rpe) : undefined,
              isWarmup: s.isWarmup,
              isCompleted: s.completed,
            })),
        }));

      if (__DEV__) {
        console.log('ðŸ’¾ Saving workout session with', sessionExercises.length, 'exercises...');
      }

      const normalizedStartTime = activeWorkout.startTime
        ? new Date(activeWorkout.startTime)
        : null;
      const safeStartTime =
        normalizedStartTime && !Number.isNaN(normalizedStartTime.getTime())
          ? normalizedStartTime
          : new Date();
      const endedAt = new Date();
      const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - safeStartTime.getTime()) / 1000));
      const historicalWorkoutDates = workoutHistory.map((session) => session?.startedAt);
      const streakDays = calculateWorkoutStreak([...historicalWorkoutDates, endedAt], endedAt);
      const symmetryScore = getSymmetryScoreForDate(physiqueScans, endedAt);

      const reportItems = exercises
        .map((exercise) => {
          const completedExerciseSets = exercise.sets.filter((set) => set.completed);
          if (completedExerciseSets.length === 0) {
            return null;
          }

          const exerciseVolume = completedExerciseSets.reduce((sum, set) => {
            const weight = parseFloat(set.weight) || 0;
            const reps = parseInt(set.reps, 10) || 0;
            return sum + weight * reps;
          }, 0);

          return {
            label: exercise.name,
            value: `${completedExerciseSets.length} sets • ${Math.round(exerciseVolume).toLocaleString()} ${unit}`,
          };
        })
        .filter(Boolean) as Array<{ label: string; value: string }>;

      const exerciseSummary =
        reportItems.length > 0
          ? `${reportItems.length} exercise${reportItems.length === 1 ? '' : 's'} done`
          : `${workoutStats.completedSets} sets done`;
      
      // Save to cloud and get session ID
      const sessionId = await syncSaveWorkoutSession({
        name: currentDay?.name || 'Workout Session',
        exercises: sessionExercises,
      });

      if (__DEV__) {
        console.log('âœ… Workout saved with session ID:', sessionId);
      }

      // Mark today's scheduled workout as completed (if exists)
      if (sessionId) {
        if (__DEV__) {
          console.log('ðŸ“… Marking today as completed...');
        }
        await syncMarkTodayWorkoutCompleted(sessionId);
        if (__DEV__) {
          console.log('âœ… Today marked as completed');
        }
      }

      // Refresh workout history to update UI with completed workout
      if (__DEV__) {
        console.log('ðŸ”„ Fetching updated workout history...');
      }
      await syncFetchWorkoutHistory();
      if (__DEV__) {
        console.log('âœ… Workout history refreshed');
      }

      const refreshedHistory = useAppStore.getState().workoutHistory as Array<Record<string, unknown>>;
      const sessionRank = sessionId
        ? getBackendRank(refreshedHistory.find((session) => session?.id === sessionId))
        : undefined;

      const completedShareData: WorkoutSummaryData = {
        workoutName: currentDay?.name || 'Workout Session',
        duration: durationSeconds,
        totalVolume: workoutStats.totalVolume,
        completedSets: workoutStats.completedSets,
        prs: 0,
        rank: sessionRank,
        date: endedAt,
        streakDays,
        symmetryScore: symmetryScore ?? undefined,
        reportItems,
        exerciseSummary,
      };

      // Export workout to Health (Apple Health / Health Connect)
      if (healthService.isAvailable()) {
        try {
          const currentUser = useAppStore.getState().user;
          const durationSeconds = activeWorkout.startTime 
            ? Math.floor((Date.now() - new Date(activeWorkout.startTime).getTime()) / 1000)
            : 0;
          
          const healthResult = await healthService.saveWorkout({
            id: sessionId || `session_${Date.now()}`,
            userId: currentUser?.id || '',
            name: currentDay?.name || 'Workout Session',
            startedAt: activeWorkout.startTime ? new Date(activeWorkout.startTime) : new Date(),
            endedAt: new Date(),
            durationSeconds,
            warmupMode: activeWorkout.warmupMode,
            deloadMode: activeWorkout.deloadMode,
            exercises: [],
            createdAt: new Date(),
          });
          
          if (__DEV__) {
            console.log('ðŸŽ Health sync result:', healthResult.message);
          }
        } catch (healthError) {
          // Non-critical - don't block workout completion
          console.warn('Health sync failed (non-critical):', healthError);
        }
      }

      // End workout in store
      setShareWorkoutData(completedShareData);
      setIsPostWorkoutFlow(true);
      cancelPendingPersist();
      endWorkout();

      if (settings.notifications.progressUpdates) {
        void notificationService.scheduleLocalNotification(
          'Workout Complete ✅',
          `Nice work. You logged ${workoutStats.completedSets} sets today.`,
          {
            type: 'progress_update',
            deepLink: '/(tabs)/progress',
            completedSets: workoutStats.completedSets,
          },
          {
            type:  Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 12,
          }
        );
      }
      
      // Increment workouts completed counter and check for review trigger
      const workoutsCompleted = incrementWorkoutsCompleted();

      if (!isPro && settings.notifications.progressUpdates && workoutsCompleted >= 2) {
        void notificationService.maybeScheduleProUpsellNotification('settings', { delaySeconds: 45 });
      }
      
      // Smart Review Trigger: Ask for review on 3rd workout or every 50th workout
      // This targets active, happy users who have formed a habit
      if (workoutsCompleted === 3 || (workoutsCompleted > 0 && workoutsCompleted % 50 === 0)) {
        try {
          const isAvailable = await StoreReview.isAvailableAsync();
          if (isAvailable) {
            // Small delay to let the completion modal show first
            setTimeout(async () => {
              await StoreReview.requestReview();
              if (__DEV__) {
                console.log('â­ Store review requested at workout #', workoutsCompleted);
              }
            }, 1500);
          }
        } catch (reviewError) {
          // Non-critical - don't block on review errors
          if (__DEV__) {
            console.warn('Store review request failed:', reviewError);
          }
        }
      }
      
      // Trigger success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showActionToast('Workout saved successfully.', 'success');
      
      // Immediately show share summary after a successful save.
      setShowCompletionModal(false);
      setIsPostWorkoutFlow(false);
      router.replace('/(tabs)/workout-plan?postWorkoutShare=1');
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Failed to save workout session:', error);
      }
      showAppAlert(
        'Error Saving Workout',
        'Your workout data could not be saved. Would you like to try again?',
        [
          { text: 'Try Again', onPress: () => finishAndSaveWorkout() },
          { 
            text: 'Finish Without Saving', 
            style: 'destructive',
            onPress: () => {
              endWorkout();
              setIsPostWorkoutFlow(true);
              setShareWorkoutData(null);
              setShowCompletionModal(true);
            }
          },
        ]
      );
      showActionToast('Workout save failed.', 'error');
    } finally {
      isSavingWorkoutRef.current = false;
    }
  };

  // Handle adding a new set to an exercise
  const handleAddSet = (exerciseId: string) => {
    LayoutAnimation.configureNext(springConfig);
    const updatedExercises = exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const newSetId = ex.sets.length + 1;
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [...ex.sets, {
          id: newSetId,
          weight: lastSet?.weight || '',
          reps: lastSet?.reps || '',
          rpe: '',
          completed: false,
          isWarmup: false,
          tags: [],
        }],
      };
    });
    setExercises(updatedExercises);
    flushPendingPersist();
    persistProgress(updatedExercises); // ðŸ’¾ Save
    showActionToast('Set added.', 'success');
  };

  // Handle removing a set from an exercise (minimum 1 set)
  const handleRemoveSet = (exerciseId: string, setId: number) => {
    LayoutAnimation.configureNext(springConfig);
    const updatedExercises = exercises.map((ex) => {
      if (ex.id !== exerciseId || ex.sets.length <= 1) return ex;
      return {
        ...ex,
        sets: ex.sets.filter((s) => s.id !== setId).map((s, idx) => ({ ...s, id: idx + 1 })),
      };
    });
    setExercises(updatedExercises);
    flushPendingPersist();
    persistProgress(updatedExercises); // ðŸ’¾ Save
    showActionToast('Set removed.', 'success');
  };

  // Handle set completion - validates inputs and uses store rest timer
  const handleSetComplete = (exerciseId: string, setId: number) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const set = exercise?.sets.find((s) => s.id === setId);
    const isCompleting = Boolean(set && !set.completed);
    
    if (isCompleting && set) {
      const weight = parseFloat(set.weight);
      const reps = parseInt(set.reps);
      if (isNaN(weight) || weight <= 0 || isNaN(reps) || reps <= 0) {
        showAppAlert('Input Required', 'Enter weight and reps first.');
        showActionToast('Enter weight and reps first.', 'error');
        return;
      }
    }
    
    // Trigger haptic feedback on set completion
    if (isCompleting) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    LayoutAnimation.configureNext(springConfig);
    const updatedExercises = exercises.map((ex) =>
      ex.id === exerciseId
        ? { ...ex, sets: ex.sets.map((s) => s.id === setId ? { ...s, completed: !s.completed } : s) }
        : ex
    );
    
    setExercises(updatedExercises);
    schedulePersistProgress(updatedExercises);
    showActionToast(isCompleting ? 'Set completed.' : 'Set unchecked.');
    
    if (isCompleting && exercise && !activeWorkout.restTimer.isRunning) {
      const effectiveRestSeconds = sanitizeRestSecondsValue(exercise.restSeconds, settings.defaultRestSeconds ?? 90);
      startRestTimer(effectiveRestSeconds);
    }
  };

  const handleInputChange = (exerciseId: string, setId: number, field: 'weight' | 'reps' | 'rpe', value: string) => {
    const updatedExercises = exercises.map((ex) =>
      ex.id === exerciseId
        ? { ...ex, sets: ex.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s) }
        : ex
    );
    setExercises(updatedExercises);
    schedulePersistProgress(updatedExercises);
  };

  const applyRestSecondsToSessionExercises = useCallback((catalogExerciseIds: string[], nextRestSeconds: number) => {
    const targetIds = new Set(catalogExerciseIds.map((id) => String(id || '').trim()).filter(Boolean));
    if (targetIds.size === 0) return;

    setExercises((prev) => prev.map((exercise) => {
      const catalogId = String(exercise.catalogExerciseId || '').trim();
      if (!targetIds.has(catalogId)) {
        return exercise;
      }

      if (exercise.restSeconds === nextRestSeconds) {
        return exercise;
      }

      return {
        ...exercise,
        restSeconds: nextRestSeconds,
      };
    }));

    setSelectedExercise((prev) => {
      if (!prev) return prev;
      const selectedCatalogId = String(prev.catalogExerciseId || '').trim();
      if (!targetIds.has(selectedCatalogId) || prev.restSeconds === nextRestSeconds) {
        return prev;
      }

      return {
        ...prev,
        restSeconds: nextRestSeconds,
      };
    });
  }, []);

  const handleExerciseRestSecondsChange = useCallback(async (_exerciseId: string, catalogExerciseId: string, restSeconds: number) => {
    if (isSavingRestSettings) {
      return;
    }

    const normalizedRestSeconds = sanitizeRestSecondsValue(restSeconds, settings.defaultRestSeconds ?? 90);
    const normalizedCatalogExerciseId = String(catalogExerciseId || '').trim();
    if (!normalizedCatalogExerciseId) {
      showAppAlert('Invalid Exercise', 'Unable to update rest timer for this exercise.');
      setRestSettingsStatus({
        type: 'error',
        message: 'Could not determine which exercise to update.',
      });
      showActionToast('Unable to update this exercise rest timer.', 'error');
      return;
    }

    const currentExerciseRest = exercises.find(
      (exercise) => String(exercise.catalogExerciseId || '').trim() === normalizedCatalogExerciseId
    )?.restSeconds;

    if (currentExerciseRest === normalizedRestSeconds) {
      setRestSettingsStatus({
        type: 'warning',
        message: 'Rest timer already set to that value.',
      });
      showActionToast('Rest timer already set to that value.');
      return;
    }

    applyRestSecondsToSessionExercises([normalizedCatalogExerciseId], normalizedRestSeconds);
    showActionToast(`Rest timer updated locally (${normalizedRestSeconds}s).`);
    setIsSavingRestSettings(true);

    try {
      await syncUpdateExerciseRestSecondsGlobally(normalizedCatalogExerciseId, normalizedRestSeconds);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestSettingsStatus({
        type: 'success',
        message: `Rest timer saved (${normalizedRestSeconds}s).`,
      });
      showActionToast(`Rest timer saved (${normalizedRestSeconds}s).`, 'success');
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Failed to sync exercise rest timer:', error);
      }
      showAppAlert('Unable to Save Rest Timer', 'Your rest timer change could not be synced right now.');
      setRestSettingsStatus({
        type: 'error',
        message: 'Saved locally, but cloud sync failed.',
      });
      showActionToast('Rest timer saved locally, but cloud sync failed.', 'error');
      throw error;
    } finally {
      setIsSavingRestSettings(false);
    }
  }, [
    applyRestSecondsToSessionExercises,
    exercises,
    isSavingRestSettings,
    settings.defaultRestSeconds,
    setRestSettingsStatus,
    showActionToast,
    syncUpdateExerciseRestSecondsGlobally,
  ]);

  const handleSaveDefaultRestSeconds = useCallback(() => {
    const normalizedDefault = sanitizeRestSecondsValue(defaultRestSecondsInput, settings.defaultRestSeconds ?? 90);
    const currentDefault = settings.defaultRestSeconds ?? 90;

    if (normalizedDefault === currentDefault) {
      setRestSettingsStatus({
        type: 'warning',
        message: `Default rest is already ${normalizedDefault}s.`,
      });
      showActionToast(`Default rest already ${normalizedDefault}s.`);
      return;
    }

    setDefaultRestSeconds(normalizedDefault);
    setDefaultRestSecondsInput(String(normalizedDefault));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRestSettingsStatus({
      type: 'success',
      message: `Default rest saved (${normalizedDefault}s).`,
    });
    showActionToast(`Default rest saved (${normalizedDefault}s).`, 'success');
  }, [defaultRestSecondsInput, setDefaultRestSeconds, setRestSettingsStatus, settings.defaultRestSeconds, showActionToast]);

  const handleApplyDefaultRestToAllExercises = useCallback(async () => {
    if (isSavingRestSettings) {
      return;
    }

    const normalizedDefault = sanitizeRestSecondsValue(defaultRestSecondsInput, settings.defaultRestSeconds ?? 90);
    const catalogExerciseIds = Array.from(
      new Set(
        exercises
          .map((exercise) => String(exercise.catalogExerciseId || '').trim())
          .filter(Boolean)
      )
    );
    const changedExercisesCount = exercises.filter((exercise) => exercise.restSeconds !== normalizedDefault).length;

    setDefaultRestSeconds(normalizedDefault);
    setDefaultRestSecondsInput(String(normalizedDefault));

    if (catalogExerciseIds.length === 0) {
      setRestSettingsStatus({
        type: 'warning',
        message: 'No exercises to update in this session.',
      });
      showActionToast('No exercises to update.');
      return;
    }

    if (changedExercisesCount === 0) {
      setRestSettingsStatus({
        type: 'warning',
        message: 'All exercises already match the default rest value.',
      });
      showActionToast('All exercises already match the default rest value.');
      return;
    }

    applyRestSecondsToSessionExercises(catalogExerciseIds, normalizedDefault);
    showActionToast(`Applied ${normalizedDefault}s locally. Syncing...`);
    setIsSavingRestSettings(true);

    try {
      await syncUpdateExercisesRestSecondsGlobally(catalogExerciseIds, normalizedDefault);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestSettingsStatus({
        type: 'success',
        message: `Applied ${normalizedDefault}s rest to ${changedExercisesCount} exercise${changedExercisesCount === 1 ? '' : 's'}.`,
      });
      showActionToast('Default rest applied to all exercises.', 'success');
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Failed to apply default rest timer:', error);
      }
      showAppAlert('Unable to Apply Default Rest', 'Some rest timer changes could not be synced right now.');
      setRestSettingsStatus({
        type: 'error',
        message: 'Applied locally, but cloud sync failed.',
      });
      showActionToast('Applied locally, but cloud sync failed.', 'error');
    } finally {
      setIsSavingRestSettings(false);
    }
  }, [
    applyRestSecondsToSessionExercises,
    defaultRestSecondsInput,
    exercises,
    isSavingRestSettings,
    setDefaultRestSeconds,
    setRestSettingsStatus,
    settings.defaultRestSeconds,
    showActionToast,
    syncUpdateExercisesRestSecondsGlobally,
  ]);

  const handleResetSession = useCallback(() => {
    showAppAlert(
      'Reset Session',
      'This will reset the workout timer and clear all logged sets for this session. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const resetExercises = exercises.map((exercise) => ({
              ...exercise,
              sets: exercise.sets.map((set) => ({
                ...set,
                weight: '',
                reps: '',
                rpe: '',
                completed: false,
                tags: [],
              })),
            }));

            LayoutAnimation.configureNext(springConfig);
            cancelPendingPersist();
            stopRestTimer();
            setExercises(resetExercises);

            updateActiveWorkout({
              startTime: new Date(),
              currentExerciseIndex: 0,
              exerciseSets: {},
              restTimer: {
                isRunning: false,
                elapsedSeconds: 0,
                targetSeconds: settings.defaultRestSeconds ?? 90,
              },
            });

            setShowMenu(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showActionToast('Session reset complete.', 'success');
          },
        },
      ]
    );
  }, [cancelPendingPersist, exercises, settings.defaultRestSeconds, showActionToast, stopRestTimer, updateActiveWorkout]);

  const handleSwapExercise = async (exerciseId: string, newExerciseId: string, newName: string) => {
    if (activeWorkout.restTimer.isRunning) {
      stopRestTimer();
    }

    const resolvedName = newName?.trim() || formatExerciseDisplayName(newExerciseId);
    const previousSets = previousSetsByExerciseId.get(newExerciseId) || [];

    setExercises((prev) => {
      const nextExercises = prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;

        return {
          ...ex,
          name: resolvedName,
          catalogExerciseId: newExerciseId,
          sets: ex.sets.map((set, idx) => {
            const previous = previousSets[Math.min(idx, Math.max(0, previousSets.length - 1))];
            return {
              ...set,
              prevWeight: previous?.weight,
              prevReps: previous?.reps,
            };
          }),
        };
      });

      schedulePersistProgress(nextExercises);
      return nextExercises;
    });

    setSelectedExercise((prev) => {
      if (!prev || prev.id !== exerciseId) return prev;
      return {
        ...prev,
        name: resolvedName,
        catalogExerciseId: newExerciseId,
      };
    });
    
    // Sync to cloud if we have plan context
    if (currentPlan && currentDay) {
      try {
        const originalExercise = currentDay.exercises.find(e => e.id === exerciseId);
        if (originalExercise) {
          await syncSwapExerciseToCloud(
            currentPlan.id,
            currentDay.id,
            originalExercise.id,
            newExerciseId
          );
        }
        showActionToast('Exercise swapped.', 'success');
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Failed to sync exercise swap:', error);
        }
        showActionToast('Exercise swap sync failed.', 'error');
      }
    }
  };

  const handleViewHistory = (exerciseId: string) => {
    setHistoryExerciseId(exerciseId);
    setShowHistory(true);
  };

  const openExerciseDetail = (exercise: ExerciseData) => {
    setSelectedExercise(exercise);
    setShowExerciseDetail(true);
  };

  const calculatePlates = (targetWeight: number, barWeight: number = unit === 'kg' ? 20 : 45) => {
    const platesKg = [25, 20, 15, 10, 5, 2.5, 1.25];
    const platesLbs = [45, 35, 25, 10, 5, 2.5];
    const plates = unit === 'kg' ? platesKg : platesLbs;
    const perSide = (targetWeight - barWeight) / 2;
    const result: { weight: number; count: number }[] = [];
    
    let remaining = perSide;
    for (const plate of plates) {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        result.push({ weight: plate, count });
        remaining -= count * plate;
      }
    }
    
    return result;
  };

  const getPlateColor = (weight: number) => {
    if (unit === 'kg') {
      switch (weight) {
        case 25: return 'bg-red-500';
        case 20: return 'bg-blue-500';
        case 15: return 'bg-yellow-500';
        case 10: return 'bg-green-500';
        case 5: return 'bg-white';
        case 2.5: return 'bg-red-400';
        case 1.25: return 'bg-gray-400';
        default: return 'bg-gray-500';
      }
    }
    switch (weight) {
      case 45: return 'bg-blue-500';
      case 35: return 'bg-yellow-500';
      case 25: return 'bg-green-500';
      case 10: return 'bg-white';
      case 5: return 'bg-blue-300';
      case 2.5: return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  // Show error state if workout cannot be loaded
  if (!currentDay && activeWorkout.isActive) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background items-center justify-center px-6">
        <Dumbbell size={48} color="#71717A" />
        <Text className="text-foreground text-lg font-semibold mt-4 text-center">
          {loadError || 'Unable to load workout'}
        </Text>
        <Text className="text-muted-foreground text-center mt-2">
          {currentPlan ? 
            'No workout is scheduled for today. You can still add exercises or go back.' :
            'The workout plan could not be found.'
          }
        </Text>
        <View className="flex-row gap-4 mt-6">
          <Button 
            variant="outline"
            onPress={() => {
              endWorkout();
              router.replace('/(tabs)/workout-plan');
            }}
          >
            <Text className="text-muted-foreground">Go Back</Text>
          </Button>
          {currentPlan && currentPlan.workoutDays.length > 0 && (
            <Button 
              className="bg-primary"
              onPress={() => {
                // Use the first available workout day as fallback
                const fallbackDay = currentPlan.workoutDays[0];
                if (fallbackDay?.exercises && fallbackDay.exercises.length > 0) {
                  setExercises(applyPreviousSetHistory(convertToSessionExercises(fallbackDay.exercises)));
                }
              }}
            >
              <Text className="text-primary-foreground">Start Anyway</Text>
            </Button>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Header */}
      <View className="border-b border-border bg-card">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable 
            onPress={() => {
              showAppAlert(
                'Leave Workout',
                'Are you sure you want to leave? Your progress will be saved.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Leave', 
                    style: 'destructive',
                    onPress: () => router.push('/(tabs)/workout-plan')
                  },
                ]
              );
            }}
            className="p-2 -ml-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <ChevronLeft size={20} color="#A1A1AA" />
          </Pressable>
          
          <ElapsedTimer startTime={activeWorkout.startTime} />

          <Pressable
            onPress={() => setShowMenu(!showMenu)}
            className="p-2 -mr-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <MoreVertical size={20} color="#A1A1AA" />
          </Pressable>
        </View>

        <View className="px-4 pb-3">
          <Text className="text-xl font-bold text-foreground">
            {currentDay?.name || 'Workout'}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {formatMuscleGroups(currentDay?.muscleGroups || [], ' | ') || 'No muscles targeted'}
          </Text>
          {/* Progress indicator */}
          <View className="flex-row items-center gap-2 mt-2">
            <View className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <View 
                className="h-full bg-primary rounded-full" 
                style={{ 
                  width: `${workoutStats.totalSets > 0 
                    ? (workoutStats.completedSets / workoutStats.totalSets) * 100 
                    : 0}%` 
                }} 
              />
            </View>
            <Text className="text-xs text-muted-foreground">
              {workoutStats.completedSets}/{workoutStats.totalSets}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: Math.max(16, insets.bottom + 64), paddingTop: 16 }}>
        <View className="px-4 gap-4">
          {exercises.length === 0 ? (
            <GlassCard className="items-center py-8">
              <Dumbbell size={32} color="#71717A" />
              <Text className="text-muted-foreground mt-2">No exercises in this workout</Text>
              <Button 
                variant="outline" 
                className="mt-4"
                onPress={() => router.push('/(tabs)/workout-plan')}
              >
                <Text className="text-foreground">Edit Workout Plan</Text>
              </Button>
            </GlassCard>
          ) : (
            exercises.map((exercise, exIndex) => {
              const isSuperset = exercise.supersetId;
              const supersetNext = exercises[exIndex + 1]?.supersetId === exercise.supersetId;
            
              const animValue = exerciseAnimations.current.get(exercise.id) || new Animated.Value(1);
              
              return (
                <Animated.View 
                  key={exercise.id} 
                  className="relative"
                  style={{
                    opacity: animValue,
                    transform: [
                      {
                        translateY: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                      {
                        scale: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.95, 1],
                        }),
                      },
                    ],
                  }}
                >
                  {isSuperset && supersetNext && (
                    <View className="absolute left-4 top-full w-0.5 h-4 bg-primary z-10" />
                )}
                
                <GlassCard className="overflow-hidden p-0">
                  {/* Exercise Header - Pressable */}
                  <Pressable 
                    className="flex-row items-center justify-between p-4 border-b border-border/50"
                    onPress={() => openExerciseDetail(exercise)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: pressed ? 'rgba(255,255,255,0.02)' : 'transparent' })}
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      {isSuperset && (
                        <View className="w-1 h-8 rounded-full bg-primary" />
                      )}
                      <View>
                        <Text className="font-semibold text-foreground">{exercise.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {exercise.targetSets} sets x {exercise.targetReps} reps
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-primary">Details</Text>
                      <ChevronRight size={16} color="#31D5E3" />
                    </View>
                  </Pressable>

                  {/* Sets Table Header */}
                  <View className="flex-row px-4 py-2 bg-muted/30 border-b border-border/30">
                    <Text className="w-[10%] text-xs text-muted-foreground font-medium">SET</Text>
                    <Text className={cn('text-xs text-muted-foreground font-medium', showAdvancedMetrics ? 'w-[20%]' : 'w-[24%]')}>PREV</Text>
                    <Text className={cn('text-xs text-muted-foreground font-medium', showAdvancedMetrics ? 'w-[16%]' : 'w-[18%]')}>{unit.toUpperCase()}</Text>
                    <Text className={cn('text-xs text-muted-foreground font-medium', showAdvancedMetrics ? 'w-[16%]' : 'w-[18%]')}>REPS</Text>
                    {showAdvancedMetrics && (
                      <Text className="w-[12%] text-xs text-muted-foreground font-medium">RPE</Text>
                    )}
                    <Text className={cn('text-xs text-muted-foreground font-medium text-center', showAdvancedMetrics ? 'w-[14%]' : 'w-[16%]')}>Done</Text>
                    <Text className={cn('text-xs text-muted-foreground font-medium text-center', showAdvancedMetrics ? 'w-[12%]' : 'w-[14%]')}></Text>
                  </View>

                  {/* Warmup sets */}
                  {activeWorkout.warmupMode && exIndex === 0 && (
                    <>
                      {[0.5, 0.7, 0.9].map((pct, i) => (
                        <View key={`warmup-${i}`} className="flex-row px-4 py-3 items-center bg-muted/10 border-b border-border/30" style={{ opacity: 0.6 }}>
                          <Text className="w-[12%] text-sm font-medium text-warning">W{i + 1}</Text>
                          <Text className="w-[28%] text-xs text-muted-foreground">
                            {Math.round((exercise.sets[0]?.prevWeight || 0) * pct)} x 8
                          </Text>
                          <View className="w-[20%]">
                            <TextInput
                              keyboardType="numeric"
                              className="h-8 text-center text-sm bg-muted/50 text-foreground rounded border border-border px-2"
                              placeholder="-"
                              placeholderTextColor="#71717A"
                            />
                          </View>
                          <View className="w-[20%]">
                            <TextInput
                              keyboardType="numeric"
                              className="h-8 text-center text-sm bg-muted/50 text-foreground rounded border border-border px-2"
                              placeholder="-"
                              placeholderTextColor="#71717A"
                            />
                          </View>
                          <View className="w-[20%] items-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Check size={16} color="#A1A1AA" />
                            </Button>
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  {/* Working sets */}
                  {exercise.sets.map((set) => (
                    <Animated.View
                      key={set.id}
                      className={cn(
                        'flex-row px-4 py-3 items-center border-b border-border/30',
                        set.completed && 'bg-success/10'
                      )}
                    >
                      <Text className={cn(
                        'w-[10%] text-sm font-medium',
                        set.completed ? 'text-success' : 'text-foreground'
                      )}>{set.id}</Text>
                      <Text className={cn('text-xs text-muted-foreground', showAdvancedMetrics ? 'w-[20%]' : 'w-[24%]')}>
                        {set.prevWeight ? `${set.prevWeight} x ${set.prevReps}` : '-'}
                      </Text>
                      <View className={showAdvancedMetrics ? 'w-[16%]' : 'w-[18%]'}>
                        <TextInput
                          keyboardType="numeric"
                          value={set.weight}
                          onChangeText={(text) => handleInputChange(exercise.id, set.id, 'weight', text)}
                          className={cn(
                            'h-8 text-center text-sm rounded border px-1',
                            set.completed 
                              ? 'bg-success/20 text-success border-success/30' 
                              : 'bg-background text-foreground border-border'
                          )}
                          placeholder={set.prevWeight ? String(activeWorkout.deloadMode ? Math.round(set.prevWeight * 0.6) : set.prevWeight) : '-'}
                          placeholderTextColor="#71717A"
                          textAlignVertical="center"
                          style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                          editable={!set.completed}
                        />
                      </View>
                      <View className={showAdvancedMetrics ? 'w-[16%]' : 'w-[18%]'}>
                        <TextInput
                          keyboardType="numeric"
                          value={set.reps}
                          onChangeText={(text) => handleInputChange(exercise.id, set.id, 'reps', text)}
                          className={cn(
                            'h-8 text-center text-sm rounded border px-1',
                            set.completed 
                              ? 'bg-success/20 text-success border-success/30' 
                              : 'bg-background text-foreground border-border'
                          )}
                          placeholder={set.prevReps ? String(set.prevReps) : '-'}
                          placeholderTextColor="#71717A"
                          textAlignVertical="center"
                          style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                          editable={!set.completed}
                        />
                      </View>
                      {showAdvancedMetrics && (
                        <View className="w-[12%]">
                          <TextInput
                            keyboardType="numeric"
                            value={set.rpe}
                            onChangeText={(text) => handleInputChange(exercise.id, set.id, 'rpe', text)}
                            className={cn(
                              'h-8 text-center text-sm rounded border px-1',
                              set.completed 
                                ? 'bg-success/20 text-success border-success/30' 
                                : 'bg-background text-foreground border-border'
                            )}
                            placeholder="-"
                            placeholderTextColor="#71717A"
                            textAlignVertical="center"
                            style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                            editable={!set.completed}
                            maxLength={2}
                          />
                        </View>
                      )}
                      <View className={cn('items-center', showAdvancedMetrics ? 'w-[14%]' : 'w-[16%]')}>
                        <Pressable
                          onPress={() => handleSetComplete(exercise.id, set.id)}
                          className={cn(
                            'h-8 w-8 rounded items-center justify-center',
                            set.completed ? 'bg-success' : 'bg-transparent'
                          )}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Check size={16} color={set.completed ? '#FFFFFF' : '#A1A1AA'} />
                        </Pressable>
                      </View>
                      <View className={cn('items-center', showAdvancedMetrics ? 'w-[12%]' : 'w-[14%]')}>
                        {exercise.sets.length > 1 && !set.completed && (
                          <Pressable
                            onPress={() => handleRemoveSet(exercise.id, set.id)}
                            className="h-8 w-8 rounded items-center justify-center"
                            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                          >
                            <Trash2 size={14} color="#EF4444" />
                          </Pressable>
                        )}
                      </View>
                    </Animated.View>
                  ))}

                  {/* Add Set */}
                  <Pressable 
                    onPress={() => handleAddSet(exercise.id)}
                    className="py-3 items-center justify-center flex-row gap-2"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-sm text-primary">Add Set</Text>
                  </Pressable>
                </GlassCard>
              </Animated.View>
            );
          })
        )}
        
        {/* Add Exercise Button during active workout */}
        {exercises.length > 0 && (
          <Pressable
            onPress={() => setShowAddExerciseModal(true)}
            className="p-4 rounded-lg border border-dashed border-primary/50 bg-primary/5 items-center justify-center"
          >
            <View className="flex-row items-center gap-2">
              <Plus size={18} color="#31D5E3" />
              <Text className="text-primary font-medium">Add Exercise</Text>
            </View>
          </Pressable>
        )}
        </View>
      </ScrollView>

      {/* Finish Button */}
      <View className="absolute left-4 right-4" style={{ bottom: Math.max(16, insets.bottom + 12) }}>
        <Button 
          onPress={handleFinishWorkout}
          className="w-full bg-primary h-12"
        >
          <Flame size={20} color="#FFFFFF" />
          <Text className="text-primary-foreground font-semibold ml-2">Finish Workout</Text>
        </Button>
      </View>

      {/* Rest Timer Modal */}
      <RestTimerDisplay 
        restTimer={activeWorkout.restTimer}
        onStop={handleRestTimerStop}
      />

      {actionToast ? (
        <View pointerEvents="none" className="absolute left-4 right-4 z-[60]" style={{ bottom: Math.max(16, insets.bottom + 72) }}>
          <View
            className={cn(
              'rounded-xl border px-4 py-3',
              actionToast.kind === 'success' && 'bg-success/20 border-success/40',
              actionToast.kind === 'error' && 'bg-destructive/20 border-destructive/40',
              actionToast.kind === 'info' && 'bg-card border-border'
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                actionToast.kind === 'success' && 'text-success',
                actionToast.kind === 'error' && 'text-destructive',
                actionToast.kind === 'info' && 'text-foreground'
              )}
            >
              {actionToast.message}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Settings Menu Modal */}
      <Dialog open={showMenu} onOpenChange={setShowMenu}>
        <DialogContent>
          <DialogHeader onClose={() => setShowMenu(false)}>
            <DialogTitle>Workout Options</DialogTitle>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Warm-up Sets</Text>
              <Switch
                value={activeWorkout.warmupMode}
                onValueChange={(value) => {
                  toggleWarmupMode();
                  showActionToast(value ? 'Warm-up sets enabled.' : 'Warm-up sets disabled.');
                }}
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Deload Mode (-40%)</Text>
              <Switch
                value={activeWorkout.deloadMode}
                onValueChange={(value) => {
                  toggleDeloadMode();
                  showActionToast(value ? 'Deload mode enabled.' : 'Deload mode disabled.');
                }}
              />
            </View>
            <View className="pt-4 border-t border-border gap-3">
              <Text className="text-foreground">Default Rest Timer (sec)</Text>
              <View className="flex-row items-center gap-2">
                <Input
                  value={defaultRestSecondsInput}
                  onChangeText={setDefaultRestSecondsInput}
                  keyboardType="number-pad"
                  placeholder="90"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleSaveDefaultRestSeconds}
                  disabled={isSavingRestSettings}
                >
                  <Text className="text-foreground font-semibold">Save</Text>
                </Button>
              </View>
              <Button
                variant="outline"
                className="w-full"
                onPress={() => {
                  void handleApplyDefaultRestToAllExercises();
                }}
                disabled={isSavingRestSettings || exercises.length === 0}
              >
                <Text className="text-foreground font-semibold">Apply Default To All Exercises</Text>
              </Button>
              {restSettingsFeedback && (
                <Text
                  className={cn(
                    'text-xs',
                    restSettingsFeedback.type === 'success' && 'text-success',
                    restSettingsFeedback.type === 'warning' && 'text-warning',
                    restSettingsFeedback.type === 'error' && 'text-destructive'
                  )}
                >
                  {restSettingsFeedback.message}
                </Text>
              )}
            </View>
            <View className="flex-row items-center justify-between pt-4 border-t border-border">
              <Text className="text-foreground">Unit System</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  const nextUnit = unit === 'kg' ? 'lbs' : 'kg';
                  setUnit(nextUnit);
                  showActionToast(`Unit changed to ${nextUnit.toUpperCase()}.`);
                }}
              >
                <Text className="text-foreground font-bold">{unit.toUpperCase()}</Text>
              </Button>
            </View>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-foreground">Advanced Metrics (RPE)</Text>
                {!isPro && <Text className="text-xs text-muted-foreground">Pro feature</Text>}
              </View>
              {isPro ? (
                <Switch value={showAdvancedMetrics} onValueChange={setShowAdvancedMetrics} />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    if (settings.notifications.progressUpdates) {
                      void notificationService.maybeScheduleProUpsellNotification('advanced_metrics');
                    }
                    setShowMenu(false);
                    router.push('/paywall');
                  }}
                >
                  <Text className="text-primary font-semibold">Upgrade</Text>
                </Button>
              )}
            </View>
            <Button 
              onPress={() => {
                setShowMenu(false);
                setShowPlateCalc(true);
              }}
              variant="outline"
              className="w-full"
            >
              <Calculator size={16} color="#31D5E3" />
              <Text className="text-foreground ml-2">Plate Calculator</Text>
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onPress={handleResetSession}
            >
              <Text className="text-primary-foreground font-semibold">Reset Session</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      {/* Plate Calculator Modal */}
      <Dialog open={showPlateCalc} onOpenChange={setShowPlateCalc}>
        <DialogContent>
          <DialogHeader onClose={() => setShowPlateCalc(false)}>
            <View className="flex-row items-center gap-2">
              <Calculator size={20} color="#31D5E3" />
              <DialogTitle>Plate Calculator</DialogTitle>
            </View>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">Target Weight</Text>
              <Button 
                variant="outline" 
                size="sm"
                onPress={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')}
              >
                <Text className="text-foreground text-xs">{unit.toUpperCase()}</Text>
              </Button>
            </View>
            <Input
              value={calcWeight}
              onChangeText={setCalcWeight}
              placeholder={`Enter weight in ${unit}`}
              keyboardType="numeric"
            />
            
            {calcWeight && Number(calcWeight) >= (unit === 'kg' ? 20 : 45) && (
              <View className="pt-4 border-t border-border">
                <Text className="text-sm text-muted-foreground mb-3">Load per side:</Text>
                <View className="flex-row flex-wrap gap-2">
                  {calculatePlates(Number(calcWeight)).map(({ weight, count }, i) => (
                    <View key={i} className="flex-row gap-1">
                      {Array.from({ length: count }).map((_, j) => (
                        <View
                          key={j}
                          className={cn(
                            'px-3 py-2 rounded-lg',
                            getPlateColor(weight)
                          )}
                        >
                          <Text className={cn(
                            'font-bold text-sm',
                            weight === 5 || weight === 10 ? 'text-black' : 'text-white'
                          )}>
                            {weight}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
                <Text className="text-xs text-muted-foreground mt-3">
                  Bar: {unit === 'kg' ? '20 kg' : '45 lbs'} | Each side: {(Number(calcWeight) - (unit === 'kg' ? 20 : 45)) / 2} {unit}
                </Text>
              </View>
            )}
          </View>
        </DialogContent>
      </Dialog>

      {/* Exercise Detail Sheet */}
      <ExerciseDetailSheet
        exercise={selectedExercise}
        isOpen={showExerciseDetail}
        onClose={() => setShowExerciseDetail(false)}
        onSetComplete={handleSetComplete}
        onInputChange={handleInputChange}
        onSwapExercise={handleSwapExercise}
        onRestSecondsChange={handleExerciseRestSecondsChange}
        onViewHistory={handleViewHistory}
        onRemoveSet={handleRemoveSet}
        unit={unit}
        deloadMode={activeWorkout.deloadMode}
        isRestSecondsSaving={isSavingRestSettings}
      />

      <ExerciseHistorySheet
        exerciseId={historyExerciseId}
        isOpen={showHistory}
        onClose={() => {
          setShowHistory(false);
          setHistoryExerciseId(null);
        }}
        unit={unit}
      />

      {/* Workout Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent>
          <DialogHeader onClose={() => {
            setIsPostWorkoutFlow(false);
            setShowCompletionModal(false);
            router.replace('/(tabs)/workout-plan');
          }}>
            <View className="items-center mb-2">
              <View className="w-16 h-16 rounded-full bg-success/20 items-center justify-center mb-3">
                <Trophy size={32} color="#22C55E" />
              </View>
              <DialogTitle className="text-center">Workout Complete!</DialogTitle>
            </View>
          </DialogHeader>
          
          <View className="gap-4 py-4 items-center">
            <View className="flex-row gap-6">
              <View className="items-center">
                <Text className="text-3xl font-bold text-success">{workoutStats.completedSets}</Text>
                <Text className="text-xs text-muted-foreground">Sets</Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold text-warning">
                  {workoutStats.totalVolume > 1000 
                    ? `${(workoutStats.totalVolume / 1000).toFixed(1)}k` 
                    : workoutStats.totalVolume}
                </Text>
                <Text className="text-xs text-muted-foreground">Volume</Text>
              </View>
            </View>

            {/* Share Button */}
            <Button 
              variant="outline"
              className="w-full mt-2"
              onPress={() => {
                setShowCompletionModal(false);
                setShowShareModal(true);
              }}
            >
              <Share2 size={18} color="#31D5E3" />
              <Text className="text-primary font-semibold ml-2">Share Workout</Text>
            </Button>

            <Button 
              className="w-full bg-primary"
              onPress={() => {
                setIsPostWorkoutFlow(false);
                setShowCompletionModal(false);
                router.replace('/(tabs)/workout-plan');
              }}
            >
              <Text className="text-primary-foreground font-semibold">Back to Workout Plan</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <ShareModal
        open={showShareModal}
        onOpenChange={(open) => {
          setShowShareModal(open);
          if (!open) {
            setIsPostWorkoutFlow(false);
            setShareWorkoutData(null);
            // Navigate to workout plan when share modal is closed
            router.replace('/(tabs)/workout-plan');
          }
        }}
        workoutData={
          shareWorkoutData || {
            workoutName: currentDay?.name || 'Workout Session',
            duration: 0,
            totalVolume: workoutStats.totalVolume,
            completedSets: workoutStats.completedSets,
            prs: 0,
            rank: undefined,
            date: new Date(),
          }
        }
      />

      {/* Add Exercise Modal */}
      <AddExerciseModal
        open={showAddExerciseModal}
        onOpenChange={setShowAddExerciseModal}
        defaultRestSeconds={settings.defaultRestSeconds ?? 90}
        excludeExerciseIds={exercises.map(e => e.id)}
        onAddExercise={async (exerciseData) => {
          if (!currentPlan || !currentDay) return;
          
          // Generate a unique ID for the new exercise
          const newExercise: PlanExercise = {
            ...exerciseData,
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            workoutDayId: currentDay.id,
            orderIndex: currentDay.exercises.length,
          };
          
          try {
            // Add to cloud/store
            await syncAddExerciseToDayCloud(
              currentPlan.id,
              currentDay.id,
              newExercise
            );
            
            // Also add to local exercises state for immediate UI update
            const newExerciseData: ExerciseData = {
              id: newExercise.id,
              catalogExerciseId: exerciseData.exerciseId,
              name: exerciseData.exercise?.name || formatExerciseDisplayName(exerciseData.exerciseId),
              muscleGroup: exerciseData.exercise?.muscleGroups[0] || '',
              equipment: exerciseData.exercise?.equipment?.[0] || '',
              targetSets: exerciseData.targetSets,
              targetReps: exerciseData.targetReps,
              restSeconds: exerciseData.restSeconds,
              sets: Array.from({ length: exerciseData.targetSets }, (_, i) => ({
                id: i + 1,
                weight: '',
                reps: '',
                rpe: '',
                completed: false,
                isWarmup: false,
                tags: [],
                prevWeight: undefined,
                prevReps: undefined,
              })),
            };

            const [exerciseWithHistory] = applyPreviousSetHistory([newExerciseData]);
            setExercises((prev) => {
              const next = [...prev, exerciseWithHistory];
              schedulePersistProgress(next);
              return next;
            });
            showActionToast('Exercise added.', 'success');
          } catch (error) {
            if (!isAbortError(error)) {
              console.error('Failed to add exercise:', error);
            }
            showAppAlert('Error', 'Failed to add exercise. Please try again.');
            showActionToast('Failed to add exercise.', 'error');
          }
        }}
      />
    </SafeAreaView>
  );
}


