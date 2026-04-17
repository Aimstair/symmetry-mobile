import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import * as React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, Animated, InteractionManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActiveDayModal } from '@/components/ui/workout/ActiveDayModal';
import { SwapExerciseModal } from '@/components/ui/workout/SwapExerciseModal';
import { AddExerciseModal } from '@/components/ui/workout/AddExerciseModal';
import { ShareModal } from '@/components/ui/workout/ShareModal';
import type { WorkoutSummaryData } from '@/components/ui/workout/WorkoutSummaryCard';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Check,
  X,
  Zap,
  Calendar,
  ChevronDown,
  ChevronUp,
  Wrench,
  Info,
  Plus,
  Pause,
  Play,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { showAppAlert } from '@/store/useAlertStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  cn,
  DEFAULT_FRESHNESS_WINDOW_MS,
  formatExerciseDisplayName,
  formatMuscleGroups,
  formatWorkoutDuration,
  isStaleTimestamp,
} from '@/lib/utils';
import { calculateWorkoutStreak, getSymmetryScoreForDate } from '@/utils/workoutMetrics';
import { useAppStore } from '@/store/useAppStore';
import { getExerciseInfo } from '@/hooks/useExercises';
import {
  getWeekStart,
  navigateWeek,
  formatMonthYear,
  findTodayIndex,
  mapWorkoutPlanToWeek,
  normalizeDayName,
} from '@/utils/workoutCalendar';
import { generateSingleDayWorkout } from '@/utils/aiPlanner';
import { useConsumeSessionAnimation } from '@/hooks/useSessionAnimationGate';
import type { WorkoutDay, PlanExercise } from '@/types';

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

export default function WorkoutPlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postWorkoutShare?: string }>();
  const insets = useSafeAreaInsets();

  // Store selectors
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const user = useAppStore((s) => s.user);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const isLoading = useAppStore((s) => s.isLoading);
  const workoutHistory = useAppStore((s) => s.workoutHistory);
  const unit = useAppStore((s) => s.settings.unit);
  const activeWorkout = useAppStore((s) => s.activeWorkout);

  // Store actions for day toggling
  const syncUpdateUserToCloud = useAppStore((s) => s.syncUpdateUserToCloud);
  const syncAddWorkoutDayToCloud = useAppStore((s) => s.syncAddWorkoutDayToCloud);
  const syncRemoveWorkoutDayFromCloud = useAppStore((s) => s.syncRemoveWorkoutDayFromCloud);
  const syncAddExerciseToDayCloud = useAppStore((s) => s.syncAddExerciseToDayCloud);
  const syncRemoveExerciseFromDayCloud = useAppStore((s) => s.syncRemoveExerciseFromDayCloud);
  const syncSwapExerciseToCloud = useAppStore((s) => s.syncSwapExerciseToCloud);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const syncFetchWorkoutHistory = useAppStore((s) => s.syncFetchWorkoutHistory);

  // Get user's training days (from onboarding)
  const trainingDays = useMemo(() => {
    return Array.isArray(user?.trainingDays) ? user.trainingDays : [];
  }, [user]);

  // Get the active workout plan (first one for now, could add selection logic)
  const activePlan = useMemo(() => {
    return workoutPlans.length > 0 ? workoutPlans[0] : null;
  }, [workoutPlans]);
  
  // Get latest physique scan for generating workouts
  const latestScan = useMemo(() => {
    if (physiqueScans.length === 0) return null;
    return physiqueScans.reduce((latest, scan) => 
      new Date(scan.date) > new Date(latest.date) ? scan : latest
    );
  }, [physiqueScans]);

  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  // Fetch workout history when screen loads
  useFocusEffect(
    useCallback(() => {
      if (historyFetchInFlightRef.current) {
        return;
      }

      if (!isStaleTimestamp(lastHistoryFetchAtRef.current, DEFAULT_FRESHNESS_WINDOW_MS)) {
        return;
      }

      historyFetchInFlightRef.current = true;
      const task = InteractionManager.runAfterInteractions(() => {
        Promise.resolve(syncFetchWorkoutHistory({ force: false })).finally(() => {
          historyFetchInFlightRef.current = false;
          lastHistoryFetchAtRef.current = Date.now();
        });
      });

      return () => {
        task.cancel();
        historyFetchInFlightRef.current = false;
      };
    }, [syncFetchWorkoutHistory])
  );

  // Parse workout history into completed dates Set
  const completedDates = useMemo(() => {
    const dates = new Set<string>();
    workoutHistory.forEach((session: any) => {
      if (!session?.startedAt) return;

      // Convert to local date string (YYYY-MM-DD) to avoid UTC timezone shift
      const date = new Date(session.startedAt);
      if (Number.isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      dates.add(dateStr);
    });

    return dates;
  }, [workoutHistory]);

  // Generate calendar days from the active plan and training days
  const calendarDays = useMemo(() => {
    return mapWorkoutPlanToWeek(activePlan, currentWeekStart, trainingDays, completedDates);
  }, [activePlan, currentWeekStart, trainingDays, completedDates]);

  // Find today's index for default selection
  const todayIndex = useMemo(() => {
    const idx = findTodayIndex(calendarDays);
    return idx >= 0 ? idx : 0;
  }, [calendarDays]);

  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [exerciseToSwap, setExerciseToSwap] = useState<string | null>(null);
  const [exerciseToSwapId, setExerciseToSwapId] = useState<string | null>(null);
  const [exerciseToSwapPlanExerciseId, setExerciseToSwapPlanExerciseId] = useState<string | null>(null);
  const [swappedExercises, setSwappedExercises] = useState<Record<string, string>>({});
  
  // Active Day Modal state
  const [showActiveDayModal, setShowActiveDayModal] = useState(false);
  const [pendingActiveDayName, setPendingActiveDayName] = useState<string>('');
  
  // Add Exercise Modal state
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareWorkoutData, setShareWorkoutData] = useState<WorkoutSummaryData | null>(null);
  const hasConsumedPostWorkoutShareRef = useRef(false);

  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const historyFetchInFlightRef = useRef(false);
  const lastHistoryFetchAtRef = useRef(0);
  const animationInFlightRef = useRef<Animated.CompositeAnimation | null>(null);
  const consumeEntryAnimation = useConsumeSessionAnimation('tabs-workout-plan');

  // Reset selected day when week changes
  useFocusEffect(
    useCallback(() => {
      const shouldAnimateEntry = consumeEntryAnimation();

      if (!shouldAnimateEntry) {
        if (animationInFlightRef.current) {
          animationInFlightRef.current.stop();
          animationInFlightRef.current = null;
        }

        headerAnim.setValue(1);
        calendarAnim.setValue(1);
        contentAnim.setValue(1);

        return () => {
          if (animationInFlightRef.current) {
            animationInFlightRef.current.stop();
            animationInFlightRef.current = null;
          }
        };
      }

      // Reset values
      headerAnim.setValue(0);
      calendarAnim.setValue(0);
      contentAnim.setValue(0);

      if (animationInFlightRef.current) {
        animationInFlightRef.current.stop();
      }
      
      // Create animation composition
      const animation = Animated.stagger(80, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(calendarAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]);

      // Start
      animationInFlightRef.current = animation;
      animation.start(() => {
        if (animationInFlightRef.current === animation) {
          animationInFlightRef.current = null;
        }
      });

      // CLEANUP: Stop animation if user navigates away before it finishes
      return () => {
        animation.stop();
        if (animationInFlightRef.current === animation) {
          animationInFlightRef.current = null;
        }
      };
    }, [consumeEntryAnimation])
  );

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  // Week navigation handlers
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart((prev) => navigateWeek(prev, 'prev'));
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart((prev) => navigateWeek(prev, 'next'));
  }, []);

  // Handler: Turn rest day into active day - opens modal
  const handleMakeActiveDay = useCallback((dayName: string) => {
    setPendingActiveDayName(dayName);
    setShowActiveDayModal(true);
  }, []);

  // Handler: Confirm active day creation from modal
  const handleConfirmActiveDay = useCallback(async (workoutName: string, muscleGroups: string[]) => {
    if (!user || !activePlan) {
      showAppAlert('Error', 'User or workout plan not found');
      return;
    }
    
    // Normalize the day name to ensure consistent format (e.g., 'Thu' -> 'Thursday')
    const dayName = normalizeDayName(pendingActiveDayName);

    try {
      // Add this day to user's training days (normalized for consistency)
      // Also normalize existing training days to prevent duplicates
      const normalizedExisting = trainingDays.map(d => normalizeDayName(d));
      const newTrainingDays = normalizedExisting.includes(dayName) 
        ? normalizedExisting 
        : [...normalizedExisting, dayName];
      
      if (__DEV__) {
        console.log('ðŸ“… Activating day:', dayName);
        console.log('ðŸ“… New training days:', newTrainingDays);
      }
      
      // Update user's training days and WAIT for store to update
      const updatedUser = await syncUpdateUserToCloud(user.id, { trainingDays: newTrainingDays });
      
      if (__DEV__) {
        console.log('ðŸ“… User updated with training days:', updatedUser?.trainingDays);
      }

      // Create a new workout day with the selected muscle groups (no exercises yet)
      const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
      // Get the next order index based on existing workout days
      const existingDays = activePlan.workoutDays || [];
      const nextOrderIndex = existingDays.length > 0 
        ? Math.max(...existingDays.map(d => d.orderIndex)) + 1 
        : dayIndex;
      
      const newWorkoutDay: WorkoutDay = {
        id: `wd-${Date.now()}`,
        planId: activePlan.id,
        name: workoutName,
        dayName: dayName, // Store normalized day name (e.g., 'Thursday' not 'Thu')
        orderIndex: nextOrderIndex,
        muscleGroups: muscleGroups,
        exercises: [], // Empty - user will add exercises later
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await syncAddWorkoutDayToCloud(activePlan.id, newWorkoutDay);
      
      if (__DEV__) {
        console.log('ðŸ“… Workout day created:', newWorkoutDay.name, 'for', dayName);
      }
      
      // Close modal and reset state after successful operation
      setShowActiveDayModal(false);
      setPendingActiveDayName('');
      
      // Show success alert
      setTimeout(() => {
        showAppAlert('Day Activated', `${dayName} is now an active training day! Add exercises from the workout screen.`);
      }, 100);
    } catch (error) {
      console.error('Failed to make active day:', error);
      showAppAlert('Error', 'Failed to activate day. Please try again.');
      // Don't close modal on error so user can retry
      throw error; // Re-throw to let modal know there was an error
    }
  }, [user, activePlan, trainingDays, pendingActiveDayName, syncUpdateUserToCloud, syncAddWorkoutDayToCloud]);

  // Handler: Turn active day into rest day
  const handleMakeRestDay = useCallback(async (dayName: string, workoutDayId?: string) => {
    if (!user || !activePlan) return;
    
    // Normalize the day name for consistent comparison
    const normalizedDayName = normalizeDayName(dayName);

    showAppAlert(
      'Rest Day',
      `Make ${normalizedDayName} a rest day? The scheduled workout will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove this day from user's training days
              // Compare normalized names to ensure we find the right day
              const newTrainingDays = trainingDays.filter(
                (d) => normalizeDayName(d) !== normalizedDayName
              );
              
              if (__DEV__) {
                console.log('ðŸ“… Removing day:', normalizedDayName);
                console.log('ðŸ“… New training days:', newTrainingDays);
              }
              
              await syncUpdateUserToCloud(user.id, { trainingDays: newTrainingDays });

              // Remove the workout day from the plan
              if (workoutDayId) {
                await syncRemoveWorkoutDayFromCloud(activePlan.id, workoutDayId);
              }

              showAppAlert('Rest Day Set', `${normalizedDayName} is now a rest day.`);
            } catch (error) {
              console.error('Failed to make rest day:', error);
              showAppAlert('Error', 'Failed to set rest day. Please try again.');
            }
          },
        },
      ]
    );
  }, [user, activePlan, trainingDays, syncUpdateUserToCloud, syncRemoveWorkoutDayFromCloud]);

  // Get the selected workout for the day
  const selectedWorkout = calendarDays[selectedDay] ?? calendarDays[0] ?? null;

  if (!selectedWorkout) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">No calendar data available.</Text>
      </SafeAreaView>
    );
  }

  // Get exercises for the selected day
  const dayExercises = useMemo(() => {
    if (!selectedWorkout?.workoutDay?.exercises) {
      return [];
    }
    return selectedWorkout.workoutDay.exercises;
  }, [selectedWorkout]);

  const handleRemoveExerciseFromPlan = useCallback((exercise: PlanExercise) => {
    if (!activePlan || !selectedWorkout?.workoutDay) return;

    const exerciseName = exercise.exercise?.name || formatExerciseDisplayName(exercise.exerciseId);

    showAppAlert(
      'Remove Exercise',
      `Remove ${exerciseName} from this workout day?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await syncRemoveExerciseFromDayCloud(activePlan.id, selectedWorkout.workoutDay!.id, exercise.id);
              showAppAlert('Exercise Removed', `${exerciseName} has been removed.`);
            } catch (error) {
              console.error('Failed to remove exercise:', error);
              showAppAlert('Error', 'Failed to remove exercise. Please try again.');
            }
          },
        },
      ]
    );
  }, [activePlan, selectedWorkout, syncRemoveExerciseFromDayCloud]);

  const completedSession = useMemo(() => {
    if (selectedWorkout?.status !== 'completed') return null;

    const year = selectedWorkout.fullDate.getFullYear();
    const month = String(selectedWorkout.fullDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedWorkout.fullDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const sessionsForDay = workoutHistory.filter((s: any) => {
      if (!s.startedAt) return false;

      const sessionDate = new Date(s.startedAt);
      if (Number.isNaN(sessionDate.getTime())) return false;

      const sessionYear = sessionDate.getFullYear();
      const sessionMonth = String(sessionDate.getMonth() + 1).padStart(2, '0');
      const sessionDay = String(sessionDate.getDate()).padStart(2, '0');
      const sessionDateStr = `${sessionYear}-${sessionMonth}-${sessionDay}`;
      return sessionDateStr === dateStr;
    });

    if (sessionsForDay.length === 0) return null;

    return sessionsForDay.sort((a: any, b: any) => {
      const aTime = new Date(a.endedAt || a.startedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.endedAt || b.startedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    })[0];
  }, [selectedWorkout, workoutHistory]);

  const completedSessionData = useMemo(() => {
    if (!completedSession) return null;

    const totalSets = completedSession.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets?.length || 0), 0) || 0;
    const totalVolume = completedSession.exercises?.reduce((sum: number, ex: any) => {
      return sum + (ex.sets?.reduce((setSum: number, set: any) => {
        return setSum + ((set.weight || 0) * (set.reps || 0));
      }, 0) || 0);
    }, 0) || 0;

    const durationSeconds = completedSession.durationSeconds ||
      (completedSession.endedAt && completedSession.startedAt
        ? Math.floor((new Date(completedSession.endedAt).getTime() - new Date(completedSession.startedAt).getTime()) / 1000)
        : 0);

    return {
      durationSeconds,
      duration: formatWorkoutDuration(durationSeconds),
      sets: totalSets,
      totalVolume,
      volume: totalVolume > 0 ? Math.round(totalVolume).toLocaleString() : '--',
    };
  }, [completedSession]);

  const selectedWorkoutStreak = useMemo(() => {
    return calculateWorkoutStreak(
      workoutHistory.map((session) => session?.startedAt),
      selectedWorkout?.fullDate
    );
  }, [workoutHistory, selectedWorkout?.fullDate]);

  const selectedWorkoutSymmetryScore = useMemo(() => {
    return getSymmetryScoreForDate(physiqueScans, selectedWorkout?.fullDate);
  }, [physiqueScans, selectedWorkout?.fullDate]);

  const openCompletedSummary = useCallback(() => {
    if (!completedSessionData || !selectedWorkout) return;

    const sessionRank = getBackendRank(completedSession);

    const reportItems = (completedSession?.exercises || [])
      .map((exercise: any) => {
        const sets = exercise?.sets || [];
        if (sets.length === 0) {
          return null;
        }

        const volume = sets.reduce((sum: number, set: any) => {
          const weight = Number(set?.weight) || 0;
          const reps = Number(set?.reps) || 0;
          return sum + weight * reps;
        }, 0);

        const exerciseName =
          exercise?.exercise?.name ||
          exercise?.name ||
          formatExerciseDisplayName(String(exercise?.exerciseId || exercise?.id || 'Exercise'));

        return {
          label: exerciseName,
          value: `${sets.length} sets • ${Math.round(volume).toLocaleString()} ${unit}`,
        };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;

    const exerciseSummary =
      reportItems.length > 0
        ? `${reportItems.length} exercise${reportItems.length === 1 ? '' : 's'} done`
        : `${completedSessionData.sets} sets done`;

    setShareWorkoutData({
      workoutName: selectedWorkout.name || 'Workout Session',
      duration: completedSessionData.durationSeconds,
      totalVolume: Math.round(completedSessionData.totalVolume),
      completedSets: completedSessionData.sets,
      prs: 0,
      rank: sessionRank,
      date: selectedWorkout.fullDate || new Date(),
      streakDays: selectedWorkoutStreak,
      symmetryScore: selectedWorkoutSymmetryScore ?? undefined,
      reportItems,
      exerciseSummary,
    });
    setShowShareModal(true);
  }, [
    completedSession,
    completedSessionData,
    selectedWorkout,
    selectedWorkoutStreak,
    selectedWorkoutSymmetryScore,
    unit,
  ]);

  useEffect(() => {
    if (params.postWorkoutShare === '1') {
      hasConsumedPostWorkoutShareRef.current = false;
      const today = findTodayIndex(calendarDays);
      if (today >= 0) {
        setSelectedDay(today);
      }
      return;
    }

    hasConsumedPostWorkoutShareRef.current = false;
  }, [params.postWorkoutShare, calendarDays]);

  useEffect(() => {
    if (params.postWorkoutShare !== '1') return;
    if (hasConsumedPostWorkoutShareRef.current) return;
    if (!selectedWorkout || selectedWorkout.status !== 'completed') return;
    if (!completedSessionData) return;

    hasConsumedPostWorkoutShareRef.current = true;
    openCompletedSummary();
    router.replace('/(tabs)/workout-plan');
  }, [
    params.postWorkoutShare,
    selectedWorkout,
    completedSessionData,
    openCompletedSummary,
    router,
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/20 text-success border-success/30';
      case 'today':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'skipped':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'rest':
        return 'bg-muted text-muted-foreground border-border';
      case 'no-workout':
        return 'bg-warning/20 text-warning border-warning/30';
      default:
        return 'bg-card text-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check size={12} color="#4ADE80" />;
      case 'skipped':
        return <X size={12} color="#EF4444" />;
      case 'today':
        return <Zap size={12} color="#31D5E3" />;
      case 'no-workout':
        return <Plus size={12} color="#FBBF24" />;
      default:
        return null;
    }
  };

  const isSelectedWorkoutToday = useMemo(() => {
    const today = new Date();
    return (
      selectedWorkout.fullDate.getFullYear() === today.getFullYear() &&
      selectedWorkout.fullDate.getMonth() === today.getMonth() &&
      selectedWorkout.fullDate.getDate() === today.getDate()
    );
  }, [selectedWorkout.fullDate]);

  const isCompletedToday = selectedWorkout.status === 'completed' && isSelectedWorkoutToday;
  const canStartWorkout = selectedWorkout.status === 'today' || isCompletedToday;
  const isContinuingWorkout =
    canStartWorkout &&
    activeWorkout.isActive &&
    Boolean(activePlan?.id) &&
    activeWorkout.workoutId === activePlan?.id;
  const handleStartOrContinueWorkout = useCallback(() => {
    if (!activePlan?.id) return;

    if (!isContinuingWorkout) {
      startWorkout(activePlan.id);
    }

    InteractionManager.runAfterInteractions(() => {
      router.replace('/active-workout');
    });
  }, [activePlan?.id, isContinuingWorkout, startWorkout, router]);
  const canMakeRestDay = selectedWorkout.status === 'today' || selectedWorkout.status === 'upcoming';
  const canEditExercises = selectedWorkout.status === 'today' || selectedWorkout.status === 'upcoming';
  const restActionLabel = selectedWorkout.status === 'today' ? 'Rest Today' : 'Make Rest Day';
  const startActionLabel = isContinuingWorkout ? 'Continue Workout' : 'Start Workout';

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="px-4 pt-6 gap-4">
          <View className="flex-row items-center justify-between">
            <View className="gap-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-4 w-24" />
            </View>
            <View className="flex-row gap-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </View>
          </View>

          <View className="flex-row gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={`day-skeleton-${idx}`} className="h-20 w-14 rounded-xl" />
            ))}
          </View>

          <GlassCard className="gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </GlassCard>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state - no workout plans
  if (workoutPlans.length === 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="px-4 py-6 mb-6">
          <Text className="text-2xl font-bold text-foreground">Workout Plan</Text>
          <Text className="text-sm text-muted-foreground">Plan your training week</Text>
        </View>
        <EmptyState
          icon={Dumbbell}
          title="No plans found"
          description="Create a custom routine or use the AI planner to generate a personalized workout plan."
          action={{
            label: 'Create Plan',
            onPress: () => router.push('/workout-builder'),
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: Math.max(12, insets.bottom) }}>
        <View className="px-4">
          {/* Header */}
          <Animated.View style={createAnimStyle(headerAnim)} className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-2xl font-bold text-foreground">Workout Plan</Text>
              <Text className="text-sm text-muted-foreground">{formatMonthYear(currentWeekStart)}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button variant="ghost" size="icon" className="rounded-full" onPress={goToPreviousWeek}>
                <ChevronLeft size={20} color="#A1A1AA" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" onPress={goToNextWeek}>
                <ChevronRight size={20} color="#A1A1AA" />
              </Button>
            </View>
          </Animated.View>

          {/* Week Calendar */}
          <Animated.ScrollView
            style={createAnimStyle(calendarAnim)}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6 -mx-4 px-4"
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            {calendarDays.map((day, index) => (
              <Pressable
                key={`${day.day}-${day.date}`}
                onPress={() => setSelectedDay(index)}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center p-3 rounded-xl border min-w-[52px]',
                  selectedDay === index ? 'bg-primary border-primary' : getStatusColor(day.status)
                )}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: selectedDay === index ? 1.05 : 1 }],
                })}
              >
                <Text
                  className={cn(
                    'text-xs font-medium',
                    selectedDay === index ? 'text-primary-foreground opacity-70' : 'opacity-70'
                  )}
                >
                  {day.day}
                </Text>
                <Text className={cn('text-lg font-bold mt-0.5', selectedDay === index ? 'text-primary-foreground' : '')}>
                  {day.date}
                </Text>
                <View className="mt-1 h-4 flex items-center justify-center">{getStatusIcon(day.status)}</View>
              </Pressable>
            ))}
          </Animated.ScrollView>

          {/* Selected Workout Details */}
          <Animated.View style={createAnimStyle(contentAnim)}>
            {selectedWorkout.isRestDay ? (
              // REST DAY - User didn't select this day for training
              <GlassCard className="items-center py-8">
                <View className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Calendar size={32} color="#71717A" />
                </View>
                <Text className="text-xl font-bold text-foreground">Rest Day</Text>
                <Text className="text-muted-foreground mt-2 text-center">Recovery is part of the process. Rest up!</Text>
                
                {/* Turn into Active Day button */}
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onPress={() => handleMakeActiveDay(selectedWorkout.day)}
                  disabled={isLoading}
                >
                  <Play size={16} color="#31D5E3" />
                  <Text className="text-foreground font-semibold ml-2">Turn into Active Day</Text>
                </Button>
              </GlassCard>
            ) : selectedWorkout.isTrainingDay && !selectedWorkout.workoutDay ? (
              // TRAINING DAY BUT NO WORKOUT PLANNED
              <GlassCard className="items-center py-8">
                <View className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mb-4">
                  <Plus size={32} color="#FBBF24" />
                </View>
                <Text className="text-xl font-bold text-foreground">No Workout Planned</Text>
                <Text className="text-muted-foreground mt-2 text-center px-4">
                  This is a training day but no workout routine is scheduled.
                </Text>
                <Button 
                  className="mt-6 bg-primary" 
                  onPress={() => {
                    router.push({
                      pathname: '/workout-builder',
                      params: {
                        date: selectedWorkout.fullDate.toISOString(),
                        dayName: selectedWorkout.day,
                      },
                    });
                  }}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text className="text-primary-foreground font-semibold ml-2">Add Workout Routine</Text>
                </Button>
              </GlassCard>
            ) : (
              // TRAINING DAY WITH WORKOUT
              <>
                <GlassCard
                  variant="glow"
                  glowColor={selectedWorkout.status === 'today' ? 'primary' : undefined}
                  className="mb-4"
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center',
                        selectedWorkout.status === 'completed' ? 'bg-success' : 'bg-primary'
                      )}
                    >
                      {selectedWorkout.status === 'completed' ? (
                        <Check size={28} color="#FFFFFF" />
                      ) : (
                        <Dumbbell size={28} color="#FFFFFF" />
                      )}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="font-bold text-lg text-foreground">{selectedWorkout.name}</Text>
                        {selectedWorkout.status === 'today' && (
                          <View className="px-2 py-0.5 bg-primary/20 rounded-full">
                            <Text className="text-xs font-medium text-primary">Today</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        {formatMuscleGroups(selectedWorkout.muscles, ' | ') || 'Full Body'}
                      </Text>
                      <Text className="text-xs text-primary mt-1">{selectedWorkout.exercises} exercises</Text>
                    </View>
                  </View>

                  {canStartWorkout && !isCompletedToday && (
                    <View className="gap-3 mt-4">
                      <Button className="w-full bg-primary" onPress={handleStartOrContinueWorkout}>
                        <Zap size={16} color="#FFFFFF" />
                        <Text className="text-primary-foreground font-semibold ml-2">{startActionLabel}</Text>
                      </Button>
                    </View>
                  )}

                  {canMakeRestDay && (
                    <View className="gap-3 mt-4">
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onPress={() => handleMakeRestDay(selectedWorkout.day, selectedWorkout.workoutDay?.id)}
                        disabled={isLoading}
                      >
                        <Pause size={16} color="#71717A" />
                        <Text className="text-muted-foreground font-semibold ml-2">{restActionLabel}</Text>
                      </Button>
                    </View>
                  )}

                  {selectedWorkout.status === 'completed' && completedSessionData && (
                    <View className="mt-4 pt-4 border-t border-border">
                      <View className="flex-row justify-between">
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-success">{completedSessionData.duration}</Text>
                          <Text className="text-xs text-muted-foreground">Duration</Text>
                        </View>
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-foreground">{completedSessionData.sets}</Text>
                          <Text className="text-xs text-muted-foreground">Sets</Text>
                        </View>
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-foreground">{completedSessionData.volume}</Text>
                          <Text className="text-xs text-muted-foreground">Volume ({unit})</Text>
                        </View>
                      </View>
                      <Button variant="outline" className="mt-4" onPress={openCompletedSummary}>
                        <Share2 size={16} color="#31D5E3" />
                        <Text className="text-foreground font-semibold ml-2">View Summary</Text>
                      </Button>
                      {isCompletedToday && (
                        <Button className="mt-3 w-full bg-primary" onPress={handleStartOrContinueWorkout}>
                          <Play size={16} color="#FFFFFF" />
                          <Text className="text-primary-foreground font-semibold ml-2">Continue Training Today</Text>
                        </Button>
                      )}
                    </View>
                  )}
                </GlassCard>

                {/* Exercise List */}
                <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Exercises</Text>
                <View className="gap-2">
                  {dayExercises.map((exercise, i) => {
                    const exerciseName = exercise.exercise?.name || formatExerciseDisplayName(exercise.exerciseId);
                    const displayName = swappedExercises[exercise.id] || exerciseName;
                    const info = getExerciseInfo(exercise.exerciseId);
                    const isExpanded = expandedExercise === exercise.id;

                    return (
                      <View key={exercise.id}>
                        <GlassCard className="py-3">
                          <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              <Text className="text-sm font-bold text-foreground">{i + 1}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className="font-medium text-sm text-foreground">{displayName}</Text>
                              <Text className="text-xs text-muted-foreground">
                                {exercise.targetSets} sets | {exercise.targetReps} reps
                              </Text>
                            </View>

                            {canEditExercises && (
                              <Pressable
                                onPress={() => {
                                  setExerciseToSwap(displayName);
                                  setExerciseToSwapId(exercise.exerciseId);
                                  setExerciseToSwapPlanExerciseId(exercise.id);
                                  setSwapDialogOpen(true);
                                }}
                                className="h-8 w-8 items-center justify-center"
                              >
                                <Wrench size={16} color="#71717A" />
                              </Pressable>
                            )}

                            {canEditExercises && (
                              <Pressable
                                onPress={() => handleRemoveExerciseFromPlan(exercise)}
                                className="h-8 w-8 items-center justify-center"
                              >
                                <Trash2 size={16} color="#EF4444" />
                              </Pressable>
                            )}

                            <Pressable
                              onPress={() => setExpandedExercise(isExpanded ? null : exercise.id)}
                              className="h-8 w-8 items-center justify-center"
                            >
                              {isExpanded ? <ChevronUp size={16} color="#71717A" /> : <ChevronDown size={16} color="#71717A" />}
                            </Pressable>

                            {selectedWorkout.status === 'completed' && <Check size={20} color="#4ADE80" />}
                          </View>

                          {isExpanded && (
                            <View className="mt-3 pt-3 border-t border-border gap-3">
                              {/* Muscle Groups */}
                              <View>
                                <Text className="text-xs font-semibold text-muted-foreground mb-1">MUSCLES TARGETED</Text>
                                <View className="flex-row flex-wrap gap-2">
                                  {info.muscleGroups.map((muscle) => (
                                    <View key={muscle} className="px-2 py-1 bg-primary/10 rounded-full">
                                      <Text className="text-xs text-primary">{muscle}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>

                              {/* Description */}
                              <View className="flex-row gap-2">
                                <Info size={14} color="#71717A" style={{ marginTop: 2 }} />
                                <Text className="text-xs text-muted-foreground flex-1">{info.description}</Text>
                              </View>

                              {/* Notes if present */}
                              {exercise.notes && (
                                <View className="bg-muted/30 rounded-lg p-2">
                                  <Text className="text-xs text-muted-foreground">{exercise.notes}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </GlassCard>
                      </View>
                    );
                  })}
                  
                  {/* Add Exercise Button */}
                  {canEditExercises && selectedWorkout.workoutDay && (
                    <Pressable
                      onPress={() => setShowAddExerciseModal(true)}
                      className="p-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 items-center justify-center"
                    >
                      <View className="flex-row items-center gap-2">
                        <Plus size={18} color="#31D5E3" />
                        <Text className="text-primary font-medium">Add Exercise</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Swap Exercise Modal */}
      <SwapExerciseModal
        open={swapDialogOpen}
        onOpenChange={(open) => {
          setSwapDialogOpen(open);
          if (!open) {
            setExerciseToSwapPlanExerciseId(null);
            setExerciseToSwap(null);
            setExerciseToSwapId(null);
          }
        }}
        exerciseId={exerciseToSwapId}
        exerciseName={exerciseToSwap || ''}
        onSwap={async (newId, newName) => {
          if (!activePlan || !selectedWorkout?.workoutDay || !exerciseToSwapPlanExerciseId) {
            showAppAlert('Error', 'Could not determine workout context for swap.');
            return;
          }

          try {
            await syncSwapExerciseToCloud(
              activePlan.id,
              selectedWorkout.workoutDay.id,
              exerciseToSwapPlanExerciseId,
              newId
            );

            setSwappedExercises((prev) => ({
              ...prev,
              [exerciseToSwapPlanExerciseId]: newName,
            }));
          } catch (error) {
            if (__DEV__) {
              console.error('Failed to swap exercise from workout plan:', error);
            }
            showAppAlert('Error', 'Failed to swap exercise. Please try again.');
          }

          setExerciseToSwapPlanExerciseId(null);
          setExerciseToSwap(null);
          setExerciseToSwapId(null);
          setSwapDialogOpen(false);
        }}
      />

      {/* Active Day Modal */}
      <ActiveDayModal
        open={showActiveDayModal}
        onOpenChange={setShowActiveDayModal}
        dayName={pendingActiveDayName}
        onConfirm={handleConfirmActiveDay}
      />

      {/* Add Exercise Modal */}
      <AddExerciseModal
        open={showAddExerciseModal}
        onOpenChange={setShowAddExerciseModal}
        excludeExerciseIds={selectedWorkout?.workoutDay?.exercises.map(e => e.exerciseId) || []}
        onAddExercise={async (exerciseData) => {
          if (!activePlan || !selectedWorkout?.workoutDay) return;
          
          // Generate a unique ID for the new exercise
          const newExercise: PlanExercise = {
            ...exerciseData,
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            workoutDayId: selectedWorkout.workoutDay.id,
            orderIndex: selectedWorkout.workoutDay.exercises.length,
          };
          
          try {
            await syncAddExerciseToDayCloud(
              activePlan.id,
              selectedWorkout.workoutDay.id,
              newExercise
            );
          } catch (error) {
            console.error('Failed to add exercise:', error);
            showAppAlert('Error', 'Failed to add exercise. Please try again.');
          }
        }}
      />

      <ShareModal
        open={showShareModal}
        onOpenChange={(open) => {
          setShowShareModal(open);
          if (!open) {
            setShareWorkoutData(null);
          }
        }}
        workoutData={
          shareWorkoutData || {
            workoutName: selectedWorkout?.name || 'Workout Session',
            duration: 0,
            totalVolume: 0,
            completedSets: 0,
            prs: 0,
            rank: undefined,
            date: new Date(),
            streakDays: selectedWorkoutStreak,
            symmetryScore: selectedWorkoutSymmetryScore ?? undefined,
          }
        }
      />
    </SafeAreaView>
  );
}


