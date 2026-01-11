import { useState, useRef, useCallback, useMemo } from 'react';
import * as React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, Animated, ActivityIndicator, Alert, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { ActiveDayModal } from '@/components/ui/workout/ActiveDayModal';
import { SwapExerciseModal } from '@/components/ui/workout/SwapExerciseModal';
import { AddExerciseModal } from '@/components/ui/workout/AddExerciseModal';
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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { cn } from '@/lib/utils';
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
import type { WorkoutDay, PlanExercise } from '@/types';

export default function WorkoutPlanScreen() {
  const router = useRouter();

  // Store selectors
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const user = useAppStore((s) => s.user);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const isLoading = useAppStore((s) => s.isLoading);
  const workoutHistory = useAppStore((s) => s.workoutHistory);

  // Store actions for day toggling
  const syncUpdateUserToCloud = useAppStore((s) => s.syncUpdateUserToCloud);
  const syncAddWorkoutDayToCloud = useAppStore((s) => s.syncAddWorkoutDayToCloud);
  const syncRemoveWorkoutDayFromCloud = useAppStore((s) => s.syncRemoveWorkoutDayFromCloud);
  const syncAddExerciseToDayCloud = useAppStore((s) => s.syncAddExerciseToDayCloud);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const syncFetchWorkoutHistory = useAppStore((s) => s.syncFetchWorkoutHistory);

  // Get user's training days (from onboarding)
  const trainingDays = useMemo(() => {
    return user?.trainingDays || [];
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
      const task = InteractionManager.runAfterInteractions(() => {
        syncFetchWorkoutHistory();
      });

      return () => task.cancel(); // Cleanup if we leave before it runs
    }, [syncFetchWorkoutHistory])
  );

  // Parse workout history into completed dates Set
  const completedDates = useMemo(() => {
    const dates = new Set<string>();
    workoutHistory.forEach((session: any) => {
      if (session.startedAt) {
        // Convert to local date string (YYYY-MM-DD) to avoid UTC timezone shift
        const date = new Date(session.startedAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        dates.add(dateStr);
      }
    });
    
    if (__DEV__) {
      console.log('📅 Completed dates calculated:', Array.from(dates));
      console.log('📅 Total workout history sessions:', workoutHistory.length);
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      console.log('📅 Is today completed?', dates.has(todayStr));
    }
    
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
  const [swappedExercises, setSwappedExercises] = useState<Record<string, string>>({});
  
  // Active Day Modal state
  const [showActiveDayModal, setShowActiveDayModal] = useState(false);
  const [pendingActiveDayName, setPendingActiveDayName] = useState<string>('');
  
  // Add Exercise Modal state
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);

  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Reset selected day when week changes
  useFocusEffect(
    useCallback(() => {
      // Reset values
      headerAnim.setValue(0);
      calendarAnim.setValue(0);
      contentAnim.setValue(0);
      
      // Create animation composition
      const animation = Animated.stagger(80, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(calendarAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]);

      // Start
      animation.start();

      // CLEANUP: Stop animation if user navigates away before it finishes
      return () => {
        animation.stop();
      };
    }, []) 
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
      Alert.alert('Error', 'User or workout plan not found');
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
        console.log('📅 Activating day:', dayName);
        console.log('📅 New training days:', newTrainingDays);
      }
      
      // Update user's training days and WAIT for store to update
      const updatedUser = await syncUpdateUserToCloud(user.id, { trainingDays: newTrainingDays });
      
      if (__DEV__) {
        console.log('📅 User updated with training days:', updatedUser?.trainingDays);
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
        console.log('📅 Workout day created:', newWorkoutDay.name, 'for', dayName);
      }
      
      // Close modal and reset state after successful operation
      setShowActiveDayModal(false);
      setPendingActiveDayName('');
      
      // Show success alert
      setTimeout(() => {
        Alert.alert('Day Activated', `${dayName} is now an active training day! Add exercises from the workout screen.`);
      }, 100);
    } catch (error) {
      console.error('Failed to make active day:', error);
      Alert.alert('Error', 'Failed to activate day. Please try again.');
      // Don't close modal on error so user can retry
      throw error; // Re-throw to let modal know there was an error
    }
  }, [user, activePlan, trainingDays, pendingActiveDayName, syncUpdateUserToCloud, syncAddWorkoutDayToCloud]);

  // Handler: Turn active day into rest day
  const handleMakeRestDay = useCallback(async (dayName: string, workoutDayId?: string) => {
    if (!user || !activePlan) return;
    
    // Normalize the day name for consistent comparison
    const normalizedDayName = normalizeDayName(dayName);

    Alert.alert(
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
                console.log('📅 Removing day:', normalizedDayName);
                console.log('📅 New training days:', newTrainingDays);
              }
              
              await syncUpdateUserToCloud(user.id, { trainingDays: newTrainingDays });

              // Remove the workout day from the plan
              if (workoutDayId) {
                await syncRemoveWorkoutDayFromCloud(activePlan.id, workoutDayId);
              }

              Alert.alert('Rest Day Set', `${normalizedDayName} is now a rest day.`);
            } catch (error) {
              console.error('Failed to make rest day:', error);
              Alert.alert('Error', 'Failed to set rest day. Please try again.');
            }
          },
        },
      ]
    );
  }, [user, activePlan, trainingDays, syncUpdateUserToCloud, syncRemoveWorkoutDayFromCloud]);

  // Get the selected workout for the day
  const selectedWorkout = calendarDays[selectedDay];

  // Get exercises for the selected day
  const dayExercises = useMemo(() => {
    if (!selectedWorkout?.workoutDay?.exercises) {
      return [];
    }
    return selectedWorkout.workoutDay.exercises;
  }, [selectedWorkout]);

  // Get actual completed session data for the selected day
  const completedSessionData = useMemo(() => {
    if (selectedWorkout?.status !== 'completed') return null;
    
    // Find session for this specific date
    const year = selectedWorkout.fullDate.getFullYear();
    const month = String(selectedWorkout.fullDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedWorkout.fullDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const session = workoutHistory.find((s: any) => {
      if (s.startedAt) {
        const sessionDate = new Date(s.startedAt);
        const sessionYear = sessionDate.getFullYear();
        const sessionMonth = String(sessionDate.getMonth() + 1).padStart(2, '0');
        const sessionDay = String(sessionDate.getDate()).padStart(2, '0');
        const sessionDateStr = `${sessionYear}-${sessionMonth}-${sessionDay}`;
        return sessionDateStr === dateStr;
      }
      return false;
    });
    
    if (!session) return null;
    
    // Calculate stats from actual session
    const totalSets = session.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets?.length || 0), 0) || 0;
    const totalVolume = session.exercises?.reduce((sum: number, ex: any) => {
      return sum + (ex.sets?.reduce((setSum: number, set: any) => {
        return setSum + ((set.weight || 0) * (set.reps || 0));
      }, 0) || 0);
    }, 0) || 0;
    
    const durationSeconds = session.durationSeconds || 
      (session.endedAt && session.startedAt ? 
        Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000) : 0);
    
    const durationMinutes = Math.floor(durationSeconds / 60);
    const durationDisplay = durationMinutes > 0 ? `${durationMinutes} min` : '--';
    
    return {
      duration: durationDisplay,
      sets: totalSets,
      volume: totalVolume > 0 ? Math.round(totalVolume).toLocaleString() : '--',
    };
  }, [selectedWorkout, workoutHistory]);

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

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#31D5E3" />
        <Text className="text-muted-foreground mt-4">Loading workout plan...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
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
                        {selectedWorkout.muscles.join(' • ') || 'Full Body'}
                      </Text>
                      <Text className="text-xs text-primary mt-1">{selectedWorkout.exercises} exercises</Text>
                    </View>
                  </View>

                  {selectedWorkout.status === 'today' && (
                    <View className="gap-3 mt-4">
                      <Button 
                        className="w-full bg-primary" 
                        onPress={() => {
                          // Set active workout state before navigating
                          // Pass the PLAN ID, not the day ID
                          if (activePlan?.id) {
                            startWorkout(activePlan.id);
                          }
                          router.push('/active-workout');
                        }}
                      >
                        <Zap size={16} color="#FFFFFF" />
                        <Text className="text-primary-foreground font-semibold ml-2">Start Workout</Text>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onPress={() => handleMakeRestDay(selectedWorkout.day, selectedWorkout.workoutDay?.id)}
                        disabled={isLoading}
                      >
                        <Pause size={16} color="#71717A" />
                        <Text className="text-muted-foreground font-semibold ml-2">Rest Today</Text>
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
                          <Text className="text-xs text-muted-foreground">Volume (lbs)</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </GlassCard>

                {/* Exercise List */}
                <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Exercises</Text>
                <View className="gap-2">
                  {dayExercises.map((exercise, i) => {
                    const exerciseName = exercise.exercise?.name  || exercise.exerciseId;
                    const displayName = swappedExercises[exerciseName] || exerciseName;
                    const info = getExerciseInfo(exerciseName);
                    const isExpanded = expandedExercise === exercise.id;

                    return (
                      <View key={exercise.id}>
                        <GlassCard className="py-3">
                          <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              <Text className="text-sm font-bold text-foreground">{i + 1}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className="font-medium text-sm text-foreground">{exerciseName}</Text>
                              <Text className="text-xs text-muted-foreground">
                                {exercise.targetSets} sets • {exercise.targetReps} reps
                              </Text>
                            </View>

                            {selectedWorkout.status !== 'completed' && (
                              <Pressable
                                onPress={() => {
                                  setExerciseToSwap(exerciseName);
                                  setExerciseToSwapId(exercise.exerciseId);
                                  setSwapDialogOpen(true);
                                }}
                                className="h-8 w-8 items-center justify-center"
                              >
                                <Wrench size={16} color="#71717A" />
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
                  {selectedWorkout.status !== 'completed' && selectedWorkout.workoutDay && (
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
        onOpenChange={setSwapDialogOpen}
        exerciseId={exerciseToSwapId}
        exerciseName={exerciseToSwap || ''}
        onSwap={(newId, newName) => {
          if (exerciseToSwap) {
            setSwappedExercises((prev) => ({
              ...prev,
              [exerciseToSwap]: newName,
            }));
          }
          setExerciseToSwap(null);
          setExerciseToSwapId(null);
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
            Alert.alert('Error', 'Failed to add exercise. Please try again.');
          }
        }}
      />
    </SafeAreaView>
  );
}
