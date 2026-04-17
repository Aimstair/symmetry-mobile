import * as React from 'react';
import { View, Text, ScrollView, Pressable, Animated, RefreshControl, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { Button } from '@/components/ui/button';
import { mapWorkoutPlanToWeek, getWeekStart } from '@/utils/workoutCalendar';
import { toLocalDateKey } from '@/utils/workoutMetrics';
import { useConsumeSessionAnimation } from '@/hooks/useSessionAnimationGate';
import {
  DEFAULT_FRESHNESS_WINDOW_MS,
  formatMuscleGroups,
  isAbortError,
  isStaleTimestamp,
} from '@/lib/utils';
import { supabase } from '@/lib/supabase'; // ✅ Added for direct auth check
import {
  ChevronRight,
  AlertTriangle,
  Flame,
  Dumbbell,
  Calendar,
  Zap,
  Sparkles,
  Scale,
  Activity,
  TrendingUp,
  Timer,
} from 'lucide-react-native';

const KG_TO_LBS = 2.20462;
const CONTRIBUTION_MEDIUM_THRESHOLD_KG = 2500;
const CONTRIBUTION_HIGH_THRESHOLD_KG = 6000;
const CONTRIBUTION_MAX_THRESHOLD_KG = 10000;
const WEEKDAY_LABELS = ['S', 'Mon', 'T', 'Wed', 'T', 'Fri', 'S'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CONTRIBUTION_COLORS = [
  'rgba(113, 113, 122, 0.2)',
  'rgba(49, 213, 227, 0.35)',
  'rgba(49, 213, 227, 0.5)',
  'rgba(49, 213, 227, 0.72)',
  'rgba(49, 213, 227, 0.95)',
];

type ContributionDay = {
  date: Date;
  isInYear: boolean;
  isFuture: boolean;
  level: number;
  sessions: number;
  volumeKg: number;
};

function getContributionLevel(volumeKg: number, sessionCount: number): number {
  if (sessionCount <= 0) return 0;
  if (volumeKg >= CONTRIBUTION_MAX_THRESHOLD_KG) return 4;
  if (volumeKg >= CONTRIBUTION_HIGH_THRESHOLD_KG) return 3;
  if (volumeKg >= CONTRIBUTION_MEDIUM_THRESHOLD_KG) return 2;
  return 1;
}

function toDisplayVolume(volumeKg: number, unit: 'kg' | 'lbs'): number {
  if (unit === 'lbs') {
    return Math.round(volumeKg * KG_TO_LBS);
  }
  return Math.round(volumeKg);
}

export default function Dashboard() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const unit = useAppStore((s) => s.settings.unit);
  const nutritionTargets = useAppStore((s) => s.nutritionTargets);
  const setNutritionTargets = useAppStore((s) => s.setNutritionTargets);
  const syncFetchWorkoutHistory = useAppStore((s) => s.syncFetchWorkoutHistory);
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const measurementLogs = useAppStore((s) => s.measurementLogs);
  const workoutHistory = useAppStore((s) => s.workoutHistory);

  const headerAnim = React.useRef(new Animated.Value(0)).current;
  const card1Anim = React.useRef(new Animated.Value(0)).current;
  const card2Anim = React.useRef(new Animated.Value(0)).current;
  const card3Anim = React.useRef(new Animated.Value(0)).current;
  const card4Anim = React.useRef(new Animated.Value(0)).current;
  const refreshInFlightRef = React.useRef(false);
  const lastRefreshAtRef = React.useRef(0);
  const userRef = React.useRef(user);
  const nutritionTargetsRef = React.useRef(nutritionTargets);
  const animationInFlightRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const consumeEntryAnimation = useConsumeSessionAnimation('tabs-home');

  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  React.useEffect(() => {
    nutritionTargetsRef.current = nutritionTargets;
  }, [nutritionTargets]);

  // ✅ New State for Pull-to-Refresh
  const [refreshing, setRefreshing] = React.useState(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null);

  const hasSameTrainingDays = React.useCallback((a?: string[], b?: string[]) => {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    if (left.length !== right.length) return false;

    return left.every((day, index) => day === right[index]);
  }, []);

  const isSameUserPayload = React.useCallback(
    (nextUser: NonNullable<typeof user>) => {
      const current = userRef.current;
      if (!current) return false;

      return (
        current.id === nextUser.id &&
        current.name === nextUser.name &&
        current.email === nextUser.email &&
        current.age === nextUser.age &&
        current.gender === nextUser.gender &&
        current.height === nextUser.height &&
        current.weight === nextUser.weight &&
        current.goal === nextUser.goal &&
        current.experienceLevel === nextUser.experienceLevel &&
        current.workoutsCompleted === nextUser.workoutsCompleted &&
        hasSameTrainingDays(current.trainingDays, nextUser.trainingDays)
      );
    },
    [hasSameTrainingDays]
  );

  const isSameNutritionPayload = React.useCallback(
    (nextNutrition: NonNullable<typeof nutritionTargets>) => {
      const current = nutritionTargetsRef.current;
      if (!current) return false;

      return (
        current.calories === nextNutrition.calories &&
        current.protein === nextNutrition.protein &&
        current.carbs === nextNutrition.carbs &&
        current.fats === nextNutrition.fats &&
        current.tdee === nextNutrition.tdee
      );
    },
    []
  );

  // ✅ ROBUST DATA FETCHING FUNCTION
  const refreshData = React.useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const force = options?.force ?? false;
    if (!force && !isStaleTimestamp(lastRefreshAtRef.current, DEFAULT_FRESHNESS_WINDOW_MS)) {
      return;
    }

    if (refreshInFlightRef.current) return;

    const silent = options?.silent ?? false;
    refreshInFlightRef.current = true;
    setRefreshError(null);

    if (silent) {
      setIsBackgroundRefreshing(true);
    } else {
      setRefreshing(true);
    }

    try {
      // 1. Check if we have a session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (session?.user) {
        if (__DEV__) console.log('🔄 Dashboard: Fetching data for', session.user.email);

        const [{ data: profile, error: userError }, { data: nutrition, error: nutritionError }] = await Promise.all([
          supabase.from('users').select('*').eq('id', session.user.id).single(),
          supabase.from('nutrition_targets').select('*').eq('user_id', session.user.id).single(),
        ]);

        if (userError) throw userError;
        if (nutritionError && nutritionError.code !== 'PGRST116') throw nutritionError;

        if (profile) {
          // Map DB snake_case fields to app User shape
          const nextUser = {
            id: profile.id,
            name: profile.name || '',
            email: profile.email || '',
            age: profile.age || 0,
            gender: profile.gender || 'male',
            height: profile.height || 0,
            weight: profile.weight || 0,
            goal: profile.goal || 'maintenance',
            experienceLevel: profile.experience_level || 'beginner',
            trainingDays: profile.training_days || [],
            workoutsCompleted: profile.workouts_completed ?? 0,
            createdAt: profile.created_at ? new Date(profile.created_at) : new Date(),
            updatedAt: profile.updated_at ? new Date(profile.updated_at) : new Date(),
          };

          if (!isSameUserPayload(nextUser)) {
            setUser(nextUser);
          }
        }

        if (nutrition) {
          const nextNutrition = {
            calories: nutrition.calories ?? 0,
            protein: nutrition.protein ?? 0,
            carbs: nutrition.carbs ?? 0,
            fats: nutrition.fats ?? 0,
            tdee: nutrition.tdee ?? 0,
          };

          if (!isSameNutritionPayload(nextNutrition)) {
            setNutritionTargets(nextNutrition);
          }
        }

        await syncFetchWorkoutHistory({ force });

        setLastRefreshedAt(new Date());
        lastRefreshAtRef.current = Date.now();
        
        // (Optional) You could trigger other fetches here like workout plans
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('❌ Dashboard Refresh Error:', error);
        setRefreshError('Failed to refresh dashboard data.');
      }
    } finally {
      refreshInFlightRef.current = false;
      if (silent) {
        setIsBackgroundRefreshing(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [isSameNutritionPayload, isSameUserPayload, setNutritionTargets, setUser, syncFetchWorkoutHistory]);

  // ✅ ZOMBIE STATE CHECKER
  // If we are logged in (session exists) but have NO user data (store is empty),
  // automatically trigger a refresh.
  React.useEffect(() => {
    const checkZombieState = async () => {
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (__DEV__) console.log('🧟 Zombie State Detected (Auth but no Data). Reviving...');
          refreshData({ silent: true });
        }
      }
    };
    checkZombieState();
  }, [user, refreshData]);

  useFocusEffect(
    React.useCallback(() => {
      const refreshTask = InteractionManager.runAfterInteractions(() => {
        if (user?.id) {
          refreshData({ silent: true });
        }
      });

      const shouldAnimateEntry = consumeEntryAnimation();

      if (!shouldAnimateEntry) {
        if (animationInFlightRef.current) {
          animationInFlightRef.current.stop();
          animationInFlightRef.current = null;
        }

        headerAnim.setValue(1);
        card1Anim.setValue(1);
        card2Anim.setValue(1);
        card3Anim.setValue(1);
        card4Anim.setValue(1);

        return () => {
          refreshTask.cancel();
          if (animationInFlightRef.current) {
            animationInFlightRef.current.stop();
            animationInFlightRef.current = null;
          }
        };
      }

      headerAnim.setValue(0);
      card1Anim.setValue(0);
      card2Anim.setValue(0);
      card3Anim.setValue(0);
      card4Anim.setValue(0);

      if (animationInFlightRef.current) {
        animationInFlightRef.current.stop();
      }

      const animation = Animated.stagger(100, [
        Animated.parallel([
          Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(card1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card3Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card4Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
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
    }, [user?.id, refreshData, consumeEntryAnimation])
  );

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatWeightForDisplay = React.useCallback(
    (kg?: number | null) => {
      if (kg == null) return '--';
      const value = unit === 'lbs' ? kg * 2.20462 : kg;
      return value.toFixed(1);
    },
    [unit]
  );

  const todayMacros = React.useMemo(() => ({
    protein: { 
      current: nutritionTargets?.protein ?? 0, 
      target: nutritionTargets?.protein ?? 180 
    },
    carbs: { 
      current: nutritionTargets?.carbs ?? 0, 
      target: nutritionTargets?.carbs ?? 300 
    },
    fats: { 
      current: nutritionTargets?.fats ?? 0, 
      target: nutritionTargets?.fats ?? 70 
    },
  }), [nutritionTargets]);

  // Get active workout plan (first active one or first plan)
  const activePlan = React.useMemo(
    () => workoutPlans.find((p) => p.name) || workoutPlans[0] || null,
    [workoutPlans]
  );

  // Get user's training days
  const trainingDays = React.useMemo(() => user?.trainingDays || [], [user?.trainingDays]);

  // Get today's workout from the plan using calendar mapping
  const weekCalendar = React.useMemo(() => {
    const weekStart = getWeekStart(new Date());
    return mapWorkoutPlanToWeek(activePlan, weekStart, trainingDays);
  }, [activePlan, trainingDays]);

  const todayCalendar = React.useMemo(() => {
    const today = new Date();
    return weekCalendar.find(
      (day) => day.fullDate.getDate() === today.getDate() && day.fullDate.getMonth() === today.getMonth()
    );
  }, [weekCalendar]);

  // Check if today is a rest day or has a workout
  const isRestDay = todayCalendar?.isRestDay ?? true;
  const isTrainingDay = todayCalendar?.isTrainingDay ?? false;
  const todayWorkout = todayCalendar?.workoutDay;

  // Check if today's workout is already completed
  const isTodayCompleted = React.useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return workoutHistory.some((session: any) => {
      if (session.startedAt) {
        const date = new Date(session.startedAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const sessionDateStr = `${year}-${month}-${day}`;
        return sessionDateStr === todayStr;
      }
      return false;
    });
  }, [workoutHistory]);

  // Get latest physique data
  const latestPhysiqueScan = physiqueScans.length > 0 ? physiqueScans[0] : null;
  const symmetryScore = latestPhysiqueScan?.symmetryScore ?? null;

  // Get latest body measurement
  const latestMeasurement = measurementLogs.length > 0 ? measurementLogs[0] : null;
  const currentWeight = latestMeasurement?.weightKg ?? user?.weight ?? null;

  // Calculate workouts per week from plan
  const workoutsPerWeek = activePlan?.daysPerWeek ?? 0;

  const contributionSummary = React.useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const dailyByKey = new Map<string, { volumeKg: number; sessions: number }>();

    workoutHistory.forEach((session: any) => {
      const sessionDate = new Date(session?.startedAt);
      if (Number.isNaN(sessionDate.getTime()) || sessionDate.getFullYear() !== year) {
        return;
      }

      const dayKey = toLocalDateKey(sessionDate);
      if (!dayKey) return;

      let sessionVolumeKg = 0;
      if (Array.isArray(session?.exercises)) {
        session.exercises.forEach((exercise: any) => {
          const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
          sets.forEach((set: any) => {
            if (!set?.isCompleted || set?.isWarmup) return;

            const weight = Number(set?.weight) || 0;
            const reps = Number(set?.reps) || 0;
            if (weight > 0 && reps > 0) {
              sessionVolumeKg += weight * reps;
            }
          });
        });
      }

      const existing = dailyByKey.get(dayKey) || { volumeKg: 0, sessions: 0 };
      dailyByKey.set(dayKey, {
        volumeKg: existing.volumeKg + sessionVolumeKg,
        sessions: existing.sessions + 1,
      });
    });

    const gridStart = new Date(yearStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const gridEnd = new Date(yearEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    const weeks: ContributionDay[][] = [];
    const cursor = new Date(gridStart);

    while (cursor.getTime() <= gridEnd.getTime()) {
      const week: ContributionDay[] = [];
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(cursor);
        const isInYear = day.getFullYear() === year;
        const dayKey = toLocalDateKey(day);
        const dailyEntry = dayKey ? dailyByKey.get(dayKey) : undefined;
        const volumeKg = dailyEntry?.volumeKg ?? 0;
        const sessions = dailyEntry?.sessions ?? 0;
        const isFuture = day.getTime() > today.getTime();

        week.push({
          date: day,
          isInYear,
          isFuture,
          sessions,
          volumeKg,
          level: isInYear && !isFuture ? getContributionLevel(volumeKg, sessions) : 0,
        });

        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    const monthMarkers: Array<{ month: string; weekIndex: number }> = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const monthStartCell = week.find((day) => day.isInYear && day.date.getDate() === 1);
      if (!monthStartCell) return;

      const month = monthStartCell.date.getMonth();
      if (month === lastMonth) return;

      monthMarkers.push({ month: MONTH_LABELS[month], weekIndex });
      lastMonth = month;
    });

    const activeDays = Array.from(dailyByKey.values()).filter((entry) => entry.sessions > 0).length;
    const totalSessions = Array.from(dailyByKey.values()).reduce((sum, entry) => sum + entry.sessions, 0);

    return {
      year,
      weeks,
      monthMarkers,
      activeDays,
      totalSessions,
    };
  }, [workoutHistory]);

  const legendItems = React.useMemo(() => {
    const medium = toDisplayVolume(CONTRIBUTION_MEDIUM_THRESHOLD_KG, unit);
    const high = toDisplayVolume(CONTRIBUTION_HIGH_THRESHOLD_KG, unit);
    const max = toDisplayVolume(CONTRIBUTION_MAX_THRESHOLD_KG, unit);

    return [
      { label: 'None', detail: '' },
      { label: 'Light', detail: `<${medium} ${unit}` },
      { label: 'Medium', detail: `${medium}+` },
      { label: 'High', detail: `${high}+` },
      { label: 'Max', detail: `${max}+` },
    ];
  }, [unit]);

  const hasMissedWorkout = false;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshData({ force: true })}
            tintColor="#31D5E3" // Primary color
            colors={["#31D5E3"]} // Android color
          />
        }
      >
        {/* Header */}
        <Animated.View style={createAnimStyle(headerAnim)} className="mb-8">
          <Text className="text-sm text-muted-foreground font-medium">
            {getGreeting()}
          </Text>
          <Text className="text-3xl font-bold mt-1 text-primary">
            {user?.name || 'Athlete'}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-xs text-muted-foreground">
              {isBackgroundRefreshing
                ? 'Refreshing in background...'
                : lastRefreshedAt
                  ? `Updated ${lastRefreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Using cached data'}
            </Text>
            {refreshError && (
              <Button variant="ghost" size="sm" onPress={() => refreshData({ force: true })}>
                <Text className="text-primary text-xs">Retry</Text>
              </Button>
            )}
          </View>
        </Animated.View>

        {/* Missed Workout Banner */}
        {hasMissedWorkout && (
          <Animated.View style={createAnimStyle(card1Anim)} className="mb-4">
            <GlassCard variant="glow" glowColor="warning" className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <AlertTriangle size={20} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">
                  Missed yesterday's workout
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Shift schedule forward?
                </Text>
              </View>
              <Button
                variant="outline"
                size="sm"
                className="border-warning/50"
              >
                <Text className="text-warning">Shift</Text>
              </Button>
            </GlassCard>
          </Animated.View>
        )}

        {/* Daily Macros */}
        <Animated.View style={createAnimStyle(card1Anim)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Flame size={16} color="#31D5E3" />
              <Text className="text-base font-semibold text-foreground">
                Daily Macros
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground font-medium">
              {nutritionTargets?.calories || 2500} cal target
            </Text>
          </View>
          <GlassCard className="py-5">
            <View className="flex-row justify-around items-center">
              <CircularProgress
                value={todayMacros.protein.current}
                max={todayMacros.protein.target}
                color="primary"
                label="Protein"
                sublabel="g"
                size={80}
              />
              <CircularProgress
                value={todayMacros.carbs.current}
                max={todayMacros.carbs.target}
                color="warning"
                label="Carbs"
                sublabel="g"
                size={80}
              />
              <CircularProgress
                value={todayMacros.fats.current}
                max={todayMacros.fats.target}
                color="success"
                label="Fats"
                sublabel="g"
                size={80}
              />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Today's Mission */}
        <Animated.View style={createAnimStyle(card2Anim)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Dumbbell size={16} color="#31D5E3" />
              <Text className="text-base font-semibold text-foreground">
                Today's Mission
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/workout-plan')}
              className="flex-row items-center active:opacity-70"
            >
              <Text className="text-xs text-primary font-medium">View Plan</Text>
              <ChevronRight size={16} color="#31D5E3" />
            </Pressable>
          </View>
          
          {isRestDay ? (
            // Rest Day Card
            <GlassCard className="overflow-hidden">
              <View className="flex-row items-center gap-4">
                <View className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                  <Timer size={28} color="#71717A" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg text-foreground">
                    Rest Day
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Recovery is part of the process
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-1">
                    {activePlan ? `${workoutsPerWeek} days/week` : 'No plan set up'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          ) : isTrainingDay ? (
            // Workout Day Card (show completion status if already done)
            isTodayCompleted ? (
              // Completed Workout Card
              <GlassCard variant="glow" glowColor="success" className="overflow-hidden">
                <View className="flex-row items-center gap-4">
                  <View className="w-14 h-14 rounded-xl bg-green-500 flex items-center justify-center">
                    <Sparkles size={28} color="#0A0A0F" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-lg text-foreground">
                      Workout Complete!
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {todayWorkout?.name || 'Great job today'}
                    </Text>
                    <Text className="text-xs text-green-500 font-medium mt-1">
                      ✓ Mission accomplished
                    </Text>
                  </View>
                </View>
                <Button
                  onPress={() => router.push('/(tabs)/workout-plan')}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <Text className="text-foreground font-medium">
                    View Progress
                  </Text>
                </Button>
              </GlassCard>
            ) : (
              // Start Workout Card
              <GlassCard variant="glow" glowColor="primary" className="overflow-hidden">
                <View className="flex-row items-center gap-4">
                  <View className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                    <Dumbbell size={28} color="#0A0A0F" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-lg text-foreground">
                      {todayWorkout?.name || 'Workout Day'}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {formatMuscleGroups(todayWorkout?.muscleGroups || []) || 'Ready to train'}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Text className="text-xs text-primary font-medium">
                        {todayWorkout?.exercises?.length || 0} exercises
                      </Text>
                      <Text className="text-xs text-muted-foreground">•</Text>
                      <Text className="text-xs text-muted-foreground">~60 min</Text>
                    </View>
                  </View>
                </View>
                <Button
                  onPress={() => router.push('/active-workout')}
                  className="w-full mt-4 bg-primary h-11"
                >
                  <View className="flex-row items-center gap-2">
                    <Zap size={16} color="#0A0A0F" />
                    <Text className="text-primary-foreground font-semibold">
                      Start Workout
                    </Text>
                  </View>
                </Button>
              </GlassCard>
            )
          ) : (
            // No Plan Card
            <GlassCard className="overflow-hidden">
              <View className="flex-row items-center gap-4">
                <View className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                  <Dumbbell size={28} color="#71717A" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg text-foreground">
                    No Workout Plan
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Create a plan to get started
                  </Text>
                </View>
              </View>
              <Button
                onPress={() => router.push('/(tabs)/workout-plan')}
                variant="outline"
                className="w-full mt-4"
              >
                <Text className="text-foreground font-medium">
                  Create Plan
                </Text>
              </Button>
            </GlassCard>
          )}
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View style={createAnimStyle(card3Anim)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <TrendingUp size={16} color="#31D5E3" />
              <Text className="text-base font-semibold text-foreground">
                Quick Stats
              </Text>
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <GlassCard className="items-center py-5" onPress={() => router.push('/physique-scan')}>
                <View className="flex-row items-center gap-1">
                  <Sparkles size={14} color="#31D5E3" />
                  <Text className="text-2xl font-bold text-primary">
                    {symmetryScore !== null ? `${symmetryScore}%` : '--'}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-1">Symmetry</Text>
              </GlassCard>
            </View>
            <View className="flex-1">
              <GlassCard className="items-center py-5" onPress={() => router.push('/(tabs)/progress')}>
                <View className="flex-row items-center gap-1">
                  <Scale size={14} color="#22C55E" />
                  <Text className="text-2xl font-bold text-success">
                    {formatWeightForDisplay(currentWeight)}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-1">Weight ({unit})</Text>
              </GlassCard>
            </View>
            <View className="flex-1">
              <GlassCard className="items-center py-5" onPress={() => router.push('/(tabs)/workout-plan')}>
                <View className="flex-row items-center gap-1">
                  <Calendar size={14} color="#F59E0B" />
                  <Text className="text-2xl font-bold text-warning">
                    {workoutsPerWeek > 0 ? workoutsPerWeek : '--'}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-1">Days/Week</Text>
              </GlassCard>
            </View>
          </View>
        </Animated.View>

        {/* Exercise Contributions */}
        <Animated.View style={createAnimStyle(card4Anim)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Activity size={16} color="#31D5E3" />
              <Text className="text-base font-semibold text-foreground">
                Exercise Contributions
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {contributionSummary.activeDays} days • {contributionSummary.totalSessions} sessions
            </Text>
          </View>

          <GlassCard className="py-4 px-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View className="relative mb-2" style={{ height: 12, marginLeft: 20 }}>
                  {contributionSummary.monthMarkers.map((marker) => (
                    <Text
                      key={`${marker.month}-${marker.weekIndex}`}
                      className="absolute text-[10px] text-muted-foreground"
                      style={{ left: marker.weekIndex * 14 }}
                    >
                      {marker.month}
                    </Text>
                  ))}
                </View>

                <View className="flex-row">
                  <View className="mr-2" style={{ width: 12 }}>
                    {WEEKDAY_LABELS.map((label, rowIndex) => (
                      <View key={`${label}-${rowIndex}`} style={{ height: 12, marginBottom: 2, justifyContent: 'center' }}>
                        <Text className="text-[9px] text-muted-foreground">{rowIndex % 2 != 0 ? label : ''}</Text>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row" style={{ gap: 2 }}>
                    {contributionSummary.weeks.map((week, weekIndex) => (
                      <View key={`week-${weekIndex}`} style={{ gap: 2 }}>
                        {week.map((day) => {
                          const dateText = day.date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });

                          const volume = toDisplayVolume(day.volumeKg, unit);
                          const accessibilityLabel = !day.isInYear
                            ? `${dateText}, outside current year`
                            : day.sessions <= 0
                              ? `${dateText}, no completed sessions`
                              : `${dateText}, ${day.sessions} completed session${day.sessions === 1 ? '' : 's'}, ${volume} ${unit} total volume`;

                          return (
                            <View
                              key={day.date.toISOString()}
                              accessible
                              accessibilityRole="image"
                              accessibilityLabel={accessibilityLabel}
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                backgroundColor: day.isInYear ? CONTRIBUTION_COLORS[day.level] : 'transparent',
                                borderWidth: day.isInYear ? 0.5 : 0,
                                borderColor: day.isInYear ? 'rgba(24, 24, 27, 0.2)' : 'transparent',
                              }}
                            />
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>

                <View className="flex-row items-center mt-4" style={{ gap: 8 }}>
                  {legendItems.map((item, index) => (
                    <View key={`${item.label}-${index}`} className="flex-row items-center" style={{ gap: 4 }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          backgroundColor: CONTRIBUTION_COLORS[index],
                        }}
                      />
                      <Text className="text-[10px] text-muted-foreground">
                        {item.detail ? `${item.label} ${item.detail}` : item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <Text className="text-xs text-muted-foreground mt-3">
              {contributionSummary.year} daily load based on completed workout sessions.
            </Text>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}