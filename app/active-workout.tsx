import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
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
import { ExerciseDetailSheet } from '@/components/ui/workout/ExerciseDetailSheet';
import { AddExerciseModal } from '@/components/ui/workout/AddExerciseModal';
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
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import type { PlanExercise, WorkoutDay, CatalogExercise } from '@/types';

// Isolated timer component to prevent full-screen re-renders
const ElapsedTimer = ({ startTime }: { startTime: Date | null }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const start = startTime.getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View className="flex-row items-center gap-2">
      <Timer size={16} color="#31D5E3" />
      <Text className="font-mono font-bold text-lg text-foreground">{formatTime(elapsed)}</Text>
    </View>
  );
};

// Isolated rest timer component
const RestTimerDisplay = ({ 
  restTimer, 
  onStop, 
  onUpdate 
}: { 
  restTimer: { isRunning: boolean; elapsedSeconds: number; targetSeconds: number };
  onStop: () => void;
  onUpdate: (elapsed: number) => void;
}) => {
  useEffect(() => {
    if (!restTimer.isRunning) return;

    const interval = setInterval(() => {
      const newElapsed = restTimer.elapsedSeconds + 1;
      if (newElapsed >= restTimer.targetSeconds) {
        onStop();
      } else {
        onUpdate(newElapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimer.isRunning, restTimer.elapsedSeconds, restTimer.targetSeconds, onStop, onUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const circumference = 2 * Math.PI * 88;
  const progress = restTimer.targetSeconds > 0 
    ? restTimer.elapsedSeconds / restTimer.targetSeconds 
    : 0;
  const strokeDashoffset = circumference * (1 - progress);

  if (!restTimer.isRunning) return null;

  return (
    <View className="absolute inset-0 z-50 bg-background/95 items-center justify-center">
      <View className="items-center">
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
              {formatTime(restTimer.elapsedSeconds)}
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
            onPress={onStop}
            className="min-w-[128px]"
          >
            <SkipForward size={16} color="#A1A1AA" />
            <Text className="text-foreground ml-2">Skip</Text>
          </Button>
          <Button
            size="lg"
            onPress={onStop}
            className="min-w-[128px] bg-primary"
          >
            <Text className="text-primary-foreground font-semibold">I'm Ready</Text>
          </Button>
        </View>
      </View>
    </View>
  );
};

// Extended set data for tracking during workout
interface SetData {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
  isWarmup: boolean;
  tags: string[];
  prevWeight?: number;
  prevReps?: number;
}

// Extended exercise data for workout session
interface ExerciseData {
  id: string;
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

// Convert plan exercises to workout session format
function convertToSessionExercises(exercises: PlanExercise[]): ExerciseData[] {
  return exercises.map((ex) => {
    // Get exercise name from hydrated exercise or use exerciseId as fallback
    const exerciseName = ex.exercise?.name || ex.exerciseId;
    const muscleGroup = ex.exercise?.muscleGroups[0] || 'General';
    const equipment = ex.exercise?.equipment[0] || 'Unknown';

    return {
      id: ex.id,
      name: exerciseName,
      muscleGroup: muscleGroup,
      equipment: equipment,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      sets: Array.from({ length: ex.targetSets }, (_, i) => ({
        id: i + 1,
        weight: '',
        reps: '',
        completed: false,
        isWarmup: false,
        tags: [],
        // In a real app, these would come from workout history
        prevWeight: undefined,
        prevReps: undefined,
      })),
    };
  });
}

export default function ActiveWorkout() {
  const router = useRouter();
  
  // Store connections
  const {
    activeWorkout,
    workoutPlans,
    settings,
    endWorkout,
    toggleWarmupMode,
    toggleDeloadMode,
    startRestTimer,
    updateRestTimer,
    stopRestTimer,
    setCurrentExercise,
    syncSwapExerciseToCloud,
    syncAddExerciseToDayCloud,
  } = useAppStore();

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
  
  // Animation refs for smooth entrance
  const exerciseAnimations = useRef<Map<string, Animated.Value>>(new Map());

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
        console.log('⚠️ Using fallback workout day:', workoutDay?.name);
      }
    }

    if (!workoutDay) {
      return { currentPlan: plan, currentDay: null, loadError: 'No workout scheduled for today' };
    }

    return { currentPlan: plan, currentDay: workoutDay, loadError: null };
  }, [activeWorkout, workoutPlans]);

  // Redirect if no active workout
  useFocusEffect(
    useCallback(() => {
      if (!activeWorkout.isActive || !activeWorkout.workoutId) {
        // No active workout, redirect to dashboard
        router.replace('/(tabs)');
      }
    }, [activeWorkout.isActive, activeWorkout.workoutId, router])
  );

  // Initialize exercises from current day
  useEffect(() => {
    if (currentDay?.exercises && currentDay.exercises.length > 0) {
      const sessionExercises = convertToSessionExercises(currentDay.exercises);
      setExercises(sessionExercises);
      
      // Animate exercises entrance
      sessionExercises.forEach((ex, index) => {
        if (!exerciseAnimations.current.has(ex.id)) {
          exerciseAnimations.current.set(ex.id, new Animated.Value(0));
        }
        const anim = exerciseAnimations.current.get(ex.id)!;
        
        Animated.spring(anim, {
          toValue: 1,
          delay: index * 80,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [currentDay]);

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
  const handleFinishWorkout = () => {
    Alert.alert(
      'Finish Workout',
      `Complete ${workoutStats.completedSets}/${workoutStats.totalSets} sets logged. Finish this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => {
            endWorkout();
            setShowCompletionModal(true);
          },
        },
      ]
    );
  };

  // Handle adding a new set to an exercise
  const handleAddSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        
        const newSetId = ex.sets.length + 1;
        const lastSet = ex.sets[ex.sets.length - 1];
        
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: newSetId,
              weight: lastSet?.weight || '',
              reps: lastSet?.reps || '',
              completed: false,
              isWarmup: false,
              tags: [],
              prevWeight: lastSet?.prevWeight,
              prevReps: lastSet?.prevReps,
            },
          ],
        };
      })
    );
  };

  // Handle removing a set from an exercise (minimum 1 set)
  const handleRemoveSet = (exerciseId: string, setId: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId || ex.sets.length <= 1) return ex;
        
        // Remove the set and reindex remaining sets
        const newSets = ex.sets
          .filter((set) => set.id !== setId)
          .map((set, index) => ({ ...set, id: index + 1 }));
        
        return {
          ...ex,
          sets: newSets,
        };
      })
    );
  };

  // Handle set completion - now uses store rest timer
  const handleSetComplete = (exerciseId: string, setId: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === setId ? { ...set, completed: !set.completed } : set
              ),
            }
          : ex
      )
    );
    
    // Start rest timer via store
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      startRestTimer(exercise.restSeconds);
    }
  };

  const handleInputChange = (
    exerciseId: string,
    setId: number,
    field: 'weight' | 'reps',
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === setId ? { ...set, [field]: value } : set
              ),
            }
          : ex
      )
    );
  };

  const handleSwapExercise = async (exerciseId: string, newExerciseId: string, newName: string) => {
    // Update local state immediately for UI
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, name: newName, id: newExerciseId }
          : ex
      )
    );
    
    // Sync to cloud if we have plan context
    if (currentPlan && currentDay) {
      try {
        // Find the original exercise in the plan to get its actual ID
        const originalExercise = currentDay.exercises.find(e => e.id === exerciseId);
        if (originalExercise) {
          await syncSwapExerciseToCloud(
            currentPlan.id,
            currentDay.id,
            originalExercise.id,
            newExerciseId
          );
        }
      } catch (error) {
        console.error('Failed to sync exercise swap:', error);
        // The local state is already updated, so user can continue
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

  const circumference = 2 * Math.PI * 88;
  const restProgress = activeWorkout.restTimer.targetSeconds > 0 
    ? activeWorkout.restTimer.elapsedSeconds / activeWorkout.restTimer.targetSeconds 
    : 0;
  const strokeDashoffset = circumference * (1 - restProgress);

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
                  setExercises(convertToSessionExercises(fallbackDay.exercises));
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
              Alert.alert(
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
            {currentDay?.muscleGroups?.join(' • ') || 'No muscles targeted'}
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

      <ScrollView className="flex-1">
        <View className="px-4 py-4 gap-4 pb-32">
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
                          {exercise.targetSets} sets × {exercise.targetReps} reps
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
                    <Text className="w-[12%] text-xs text-muted-foreground font-medium">SET</Text>
                    <Text className="w-[25%] text-xs text-muted-foreground font-medium">PREV</Text>
                    <Text className="w-[18%] text-xs text-muted-foreground font-medium">{unit.toUpperCase()}</Text>
                    <Text className="w-[18%] text-xs text-muted-foreground font-medium">REPS</Text>
                    <Text className="w-[15%] text-xs text-muted-foreground font-medium text-center">✓</Text>
                    <Text className="w-[12%] text-xs text-muted-foreground font-medium text-center"></Text>
                  </View>

                  {/* Warmup sets */}
                  {activeWorkout.warmupMode && exIndex === 0 && (
                    <>
                      {[0.5, 0.7, 0.9].map((pct, i) => (
                        <View key={`warmup-${i}`} className="flex-row px-4 py-3 items-center bg-muted/10 border-b border-border/30" style={{ opacity: 0.6 }}>
                          <Text className="w-[12%] text-sm font-medium text-warning">W{i + 1}</Text>
                          <Text className="w-[28%] text-xs text-muted-foreground">
                            {Math.round((exercise.sets[0]?.prevWeight || 0) * pct)} × 8
                          </Text>
                          <View className="w-[20%]">
                            <TextInput
                              keyboardType="numeric"
                              className="h-8 text-center text-sm bg-muted/50 text-foreground rounded border border-border px-2"
                              placeholder="—"
                              placeholderTextColor="#71717A"
                            />
                          </View>
                          <View className="w-[20%]">
                            <TextInput
                              keyboardType="numeric"
                              className="h-8 text-center text-sm bg-muted/50 text-foreground rounded border border-border px-2"
                              placeholder="—"
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
                    <View
                      key={set.id}
                      className={cn(
                        'flex-row px-4 py-3 items-center border-b border-border/30',
                        set.completed && 'bg-success/10'
                      )}
                    >
                      <Text className="w-[12%] text-sm font-medium text-foreground">{set.id}</Text>
                      <Text className="w-[25%] text-xs text-muted-foreground">
                        {set.prevWeight ? `${set.prevWeight} × ${set.prevReps}` : '—'}
                      </Text>
                      <View className="w-[18%]">
                        <TextInput
                          keyboardType="numeric"
                          value={set.weight}
                          onChangeText={(text) => handleInputChange(exercise.id, set.id, 'weight', text)}
                          className="h-8 text-center text-sm bg-background text-foreground rounded border border-border px-2"
                          placeholder={set.prevWeight ? String(activeWorkout.deloadMode ? Math.round(set.prevWeight * 0.6) : set.prevWeight) : '—'}
                          placeholderTextColor="#71717A"
                          textAlignVertical="center"
                          style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                        />
                      </View>
                      <View className="w-[18%]">
                        <TextInput
                          keyboardType="numeric"
                          value={set.reps}
                          onChangeText={(text) => handleInputChange(exercise.id, set.id, 'reps', text)}
                          className="h-8 text-center text-sm bg-background text-foreground rounded border border-border px-2"
                          placeholder={set.prevReps ? String(set.prevReps) : '—'}
                          placeholderTextColor="#71717A"
                          textAlignVertical="center"
                          style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                        />
                      </View>
                      <View className="w-[15%] items-center">
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
                      <View className="w-[12%] items-center">
                        {exercise.sets.length > 1 && (
                          <Pressable
                            onPress={() => handleRemoveSet(exercise.id, set.id)}
                            className="h-8 w-8 rounded items-center justify-center"
                            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                          >
                            <Trash2 size={14} color="#EF4444" />
                          </Pressable>
                        )}
                      </View>
                    </View>
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
      <View className="absolute bottom-4 left-4 right-4">
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
        onStop={stopRestTimer}
        onUpdate={updateRestTimer}
      />

      {/* Settings Menu Modal */}
      <Dialog open={showMenu} onOpenChange={setShowMenu}>
        <DialogContent>
          <DialogHeader onClose={() => setShowMenu(false)}>
            <DialogTitle>Workout Options</DialogTitle>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Warm-up Sets</Text>
              <Switch value={activeWorkout.warmupMode} onValueChange={toggleWarmupMode} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Deload Mode (-40%)</Text>
              <Switch value={activeWorkout.deloadMode} onValueChange={toggleDeloadMode} />
            </View>
            <View className="flex-row items-center justify-between pt-4 border-t border-border">
              <Text className="text-foreground">Unit System</Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')}
              >
                <Text className="text-foreground font-bold">{unit.toUpperCase()}</Text>
              </Button>
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
                  Bar: {unit === 'kg' ? '20 kg' : '45 lbs'} • Each side: {(Number(calcWeight) - (unit === 'kg' ? 20 : 45)) / 2} {unit}
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
        onViewHistory={handleViewHistory}
        onRemoveSet={handleRemoveSet}
        unit={unit}
        deloadMode={activeWorkout.deloadMode}
      />

      {/* Workout Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent>
          <DialogHeader onClose={() => {
            setShowCompletionModal(false);
            router.replace('/(tabs)');
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

            <Button 
              className="w-full mt-4 bg-primary"
              onPress={() => {
                setShowCompletionModal(false);
                router.replace('/(tabs)');
              }}
            >
              <Text className="text-primary-foreground font-semibold">Back to Dashboard</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      {/* Add Exercise Modal */}
      <AddExerciseModal
        open={showAddExerciseModal}
        onOpenChange={setShowAddExerciseModal}
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
              name: exerciseData.exercise?.name || exerciseData.exerciseId,
              muscleGroup: exerciseData.exercise?.muscleGroups[0] || '',
              equipment: exerciseData.exercise?.equipment?.[0] || '',
              targetSets: exerciseData.targetSets,
              targetReps: exerciseData.targetReps,
              restSeconds: exerciseData.restSeconds,
              sets: Array.from({ length: exerciseData.targetSets }, (_, i) => ({
                id: i + 1,
                weight: '',
                reps: '',
                completed: false,
                isWarmup: false,
                tags: [],
              })),
            };
            
            setExercises(prev => [...prev, newExerciseData]);
          } catch (error) {
            console.error('Failed to add exercise:', error);
            Alert.alert('Error', 'Failed to add exercise. Please try again.');
          }
        }}
      />
    </SafeAreaView>
  );
}
