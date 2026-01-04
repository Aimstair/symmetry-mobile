import { useState, useRef, useCallback, useMemo } from 'react';
import * as React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
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
  AlertCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getExerciseInfo } from '@/hooks/useExercises';
import {
  getCurrentWeekCalendar,
  getWeekStart,
  navigateWeek,
  formatMonthYear,
  findTodayIndex,
  mapWorkoutPlanToWeek,
} from '@/utils/workoutCalendar';

export default function WorkoutPlanScreen() {
  const router = useRouter();

  // Store selectors
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const user = useAppStore((s) => s.user);
  const isLoading = useAppStore((s) => s.isLoading);

  // Get the active workout plan (first one for now, could add selection logic)
  const activePlan = useMemo(() => {
    return workoutPlans.length > 0 ? workoutPlans[0] : null;
  }, [workoutPlans]);

  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  // Generate calendar days from the active plan
  const calendarDays = useMemo(() => {
    return mapWorkoutPlanToWeek(activePlan, currentWeekStart);
  }, [activePlan, currentWeekStart]);

  // Find today's index for default selection
  const todayIndex = useMemo(() => {
    const idx = findTodayIndex(calendarDays);
    return idx >= 0 ? idx : 0;
  }, [calendarDays]);

  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [exerciseToSwap, setExerciseToSwap] = useState<string | null>(null);
  const [swappedExercises, setSwappedExercises] = useState<Record<string, string>>({});

  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Reset selected day when week changes
  useFocusEffect(
    useCallback(() => {
      const idx = findTodayIndex(calendarDays);
      if (idx >= 0) {
        setSelectedDay(idx);
      }

      // Reset and run animations
      headerAnim.setValue(0);
      calendarAnim.setValue(0);
      contentAnim.setValue(0);
      Animated.stagger(80, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(calendarAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, [headerAnim, calendarAnim, contentAnim, calendarDays])
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

  // Get the selected workout for the day
  const selectedWorkout = calendarDays[selectedDay];

  // Get exercises for the selected day
  const dayExercises = useMemo(() => {
    if (!selectedWorkout?.workoutDay?.exercises) {
      return [];
    }
    return selectedWorkout.workoutDay.exercises;
  }, [selectedWorkout]);

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

  // No workout plan state
  if (!activePlan) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ScrollView className="flex-1">
          <View className="px-4 py-6">
            <Animated.View style={createAnimStyle(headerAnim)} className="mb-6">
              <Text className="text-2xl font-bold text-foreground">Workout Plan</Text>
              <Text className="text-sm text-muted-foreground">{formatMonthYear(currentWeekStart)}</Text>
            </Animated.View>

            <GlassCard className="items-center py-12">
              <View className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <AlertCircle size={40} color="#71717A" />
              </View>
              <Text className="text-xl font-bold text-foreground text-center">No Workout Plan</Text>
              <Text className="text-muted-foreground mt-2 text-center px-4">
                You haven't created a workout plan yet. Complete onboarding to get a personalized plan.
              </Text>
              <Button
                className="mt-6 bg-primary"
                onPress={() => router.push('/onboarding')}
              >
                <Zap size={16} color="#FFFFFF" />
                <Text className="text-primary-foreground font-semibold ml-2">Create Plan</Text>
              </Button>
            </GlassCard>
          </View>
        </ScrollView>
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
              <GlassCard className="items-center py-8">
                <View className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Calendar size={32} color="#71717A" />
                </View>
                <Text className="text-xl font-bold text-foreground">Rest Day</Text>
                <Text className="text-muted-foreground mt-2 text-center">Recovery is part of the process. Rest up!</Text>
              </GlassCard>
            ) : (
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
                    <Button className="w-full mt-4 bg-primary" onPress={() => router.push('/active-workout')}>
                      <Zap size={16} color="#FFFFFF" />
                      <Text className="text-primary-foreground font-semibold ml-2">Start Workout</Text>
                    </Button>
                  )}

                  {selectedWorkout.status === 'completed' && (
                    <View className="mt-4 pt-4 border-t border-border">
                      <View className="flex-row justify-between">
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-success">--:--</Text>
                          <Text className="text-xs text-muted-foreground">Duration</Text>
                        </View>
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-foreground">{dayExercises.reduce((sum, e) => sum + e.sets, 0)}</Text>
                          <Text className="text-xs text-muted-foreground">Sets</Text>
                        </View>
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-foreground">--</Text>
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
                    const displayName = swappedExercises[exercise.name] || exercise.name;
                    const info = getExerciseInfo(exercise.name);
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
                                {exercise.sets} sets • {exercise.reps} reps
                              </Text>
                            </View>

                            {selectedWorkout.status !== 'completed' && (
                              <Pressable
                                onPress={() => {
                                  setExerciseToSwap(exercise.name);
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
                                  {info.muscles.map((muscle) => (
                                    <View key={muscle} className="px-2 py-1 bg-primary/10 rounded-full">
                                      <Text className="text-xs text-primary">{muscle}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>

                              {/* Reason */}
                              <View className="flex-row gap-2">
                                <Info size={14} color="#71717A" style={{ marginTop: 2 }} />
                                <Text className="text-xs text-muted-foreground flex-1">{info.reason}</Text>
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
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Swap Exercise Dialog */}
      {swapDialogOpen && exerciseToSwap && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
          <Pressable className="absolute inset-0" onPress={() => setSwapDialogOpen(false)} />
          <View className="bg-card rounded-2xl p-6 mx-4 max-w-sm w-full">
            <Text className="text-lg font-bold text-foreground mb-2">Swap Exercise</Text>
            <Text className="text-sm text-muted-foreground mb-4">
              Choose an alternative for <Text className="font-medium text-foreground">{exerciseToSwap}</Text>
            </Text>
            <View className="gap-2">
              {getExerciseInfo(exerciseToSwap).alternatives.map((alt) => (
                <Pressable
                  key={alt.name}
                  onPress={() => {
                    setSwappedExercises((prev) => ({
                      ...prev,
                      [exerciseToSwap]: alt.name,
                    }));
                    setSwapDialogOpen(false);
                  }}
                  className="border border-border rounded-lg p-3 flex-row items-center justify-between"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text className="font-medium text-foreground">{alt.name}</Text>
                  <Text className="text-xs text-muted-foreground">{alt.equipment}</Text>
                </Pressable>
              ))}
              {getExerciseInfo(exerciseToSwap).alternatives.length === 0 && (
                <Text className="text-muted-foreground text-center py-4">No alternatives available</Text>
              )}
            </View>
            <Button variant="ghost" className="mt-4" onPress={() => setSwapDialogOpen(false)}>
              <Text className="text-muted-foreground">Cancel</Text>
            </Button>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
