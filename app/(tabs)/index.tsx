import * as React from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { Button } from '@/components/ui/button';
import { mapWorkoutPlanToWeek, getWeekStart } from '@/utils/workoutCalendar';
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

/**
 * Dashboard Page - React Native Implementation
 * 
 * Migration Notes:
 * - Removed framer-motion animations (use react-native-reanimated if needed later)
 * - Replaced div with View
 * - Replaced p/h1/h2/h3/span with Text
 * - Replaced Link with router.push()
 * - lucide-react → lucide-react-native
 * - SafeAreaView handles notch/dynamic island
 * - ScrollView for scrollable content
 * - GlassCard component for frosted glass aesthetic
 */

export default function Dashboard() {
  const { 
    user, 
    nutritionTargets, 
    workoutPlans,
    physiqueScans,
    bodyMeasurements,
    cardioLogs,
  } = useAppStore();
  const headerAnim = React.useRef(new Animated.Value(0)).current;
  const card1Anim = React.useRef(new Animated.Value(0)).current;
  const card2Anim = React.useRef(new Animated.Value(0)).current;
  const card3Anim = React.useRef(new Animated.Value(0)).current;
  const card4Anim = React.useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      headerAnim.setValue(0);
      card1Anim.setValue(0);
      card2Anim.setValue(0);
      card3Anim.setValue(0);
      card4Anim.setValue(0);
      
      Animated.stagger(100, [
        Animated.parallel([
          Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(card1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card3Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card4Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, [headerAnim, card1Anim, card2Anim, card3Anim, card4Anim])
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

  const todayMacros = {
    protein: { current: nutritionTargets?.protein, target: nutritionTargets?.protein || 180 },
    carbs: { current: nutritionTargets?.carbs, target: nutritionTargets?.carbs || 300 },
    fats: { current: nutritionTargets?.fats, target: nutritionTargets?.fats || 70 },
  };

  // Get active workout plan (first active one or first plan)
  const activePlan = workoutPlans.find(p => p.name) || workoutPlans[0] || null;
  
  // Get user's training days
  const trainingDays = user?.trainingDays || [];
  
  // Get today's workout from the plan using calendar mapping
  const weekStart = getWeekStart(new Date());
  const weekCalendar = mapWorkoutPlanToWeek(activePlan, weekStart, trainingDays);
  const today = new Date();
  const todayCalendar = weekCalendar.find(
    day => day.fullDate.getDate() === today.getDate() &&
           day.fullDate.getMonth() === today.getMonth()
  );

  // Check if today is a rest day or has a workout
  const isRestDay = todayCalendar?.isRestDay ?? true;
  const isTrainingDay = todayCalendar?.isTrainingDay ?? false;
  const todayWorkout = todayCalendar?.workoutDay;

  // Get latest physique data
  const latestPhysiqueScan = physiqueScans.length > 0 ? physiqueScans[0] : null;
  const symmetryScore = latestPhysiqueScan?.symmetryScore ?? null;

  // Get latest body measurement
  const latestMeasurement = bodyMeasurements.length > 0 ? bodyMeasurements[0] : null;
  const currentWeight = latestMeasurement?.weight ?? user?.weight ?? null;

  // Calculate workouts per week from plan
  const workoutsPerWeek = activePlan?.daysPerWeek ?? 0;

  // Get recent activity feed (combine last items from each type)
  const recentActivity = React.useMemo(() => {
    const activities: Array<{
      id: string;
      type: 'scan' | 'measurement' | 'cardio';
      title: string;
      subtitle: string;
      date: Date;
    }> = [];

    // Add recent physique scans
    physiqueScans.slice(0, 2).forEach(scan => {
      activities.push({
        id: `scan-${scan.id}`,
        type: 'scan',
        title: 'Physique Scan',
        subtitle: `Score: ${scan.symmetryScore}%`,
        date: new Date(scan.date),
      });
    });

    // Add recent body measurements
    bodyMeasurements.slice(0, 2).forEach(m => {
      activities.push({
        id: `measurement-${m.id}`,
        type: 'measurement',
        title: 'Weight Update',
        subtitle: `${m.weight} lbs`,
        date: new Date(m.date),
      });
    });

    // Add recent cardio logs
    cardioLogs.slice(0, 2).forEach(log => {
      activities.push({
        id: `cardio-${log.id}`,
        type: 'cardio',
        title: log.type.charAt(0).toUpperCase() + log.type.slice(1),
        subtitle: `${log.duration} min${log.calories ? ` • ${log.calories} cal` : ''}`,
        date: new Date(log.date),
      });
    });

    // Sort by date descending and take top 3
    return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 3);
  }, [physiqueScans, bodyMeasurements, cardioLogs]);

  const hasMissedWorkout = false;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <Animated.View style={createAnimStyle(headerAnim)} className="mb-8">
          <Text className="text-sm text-muted-foreground font-medium">
            {getGreeting()}
          </Text>
          <Text className="text-3xl font-bold mt-1 text-primary">
            {user?.name || 'Athlete'}
          </Text>
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
          ) : todayWorkout ? (
            // Workout Day Card
            <GlassCard variant="glow" glowColor="primary" className="overflow-hidden">
              <View className="flex-row items-center gap-4">
                <View className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                  <Dumbbell size={28} color="#0A0A0F" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-lg text-foreground">
                    {todayWorkout.name}
                  </Text>
                  <Text className="text-sm text-muted-foreground capitalize">
                    {todayWorkout.muscleGroups.join(' • ')}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-xs text-primary font-medium">
                      {todayWorkout.exercises?.length || 0} exercises
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
                    {currentWeight !== null ? currentWeight : '--'}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-1">Weight (lbs)</Text>
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

        {/* Recent Activity */}
        <Animated.View style={createAnimStyle(card4Anim)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Activity size={16} color="#31D5E3" />
              <Text className="text-base font-semibold text-foreground">
                Recent Activity
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/progress')}
              className="flex-row items-center active:opacity-70"
            >
              <Text className="text-xs text-primary font-medium">View All</Text>
              <ChevronRight size={16} color="#31D5E3" />
            </Pressable>
          </View>
          
          {recentActivity.length > 0 ? (
            <GlassCard className="gap-3">
              {recentActivity.map((activity, index) => (
                <View 
                  key={activity.id}
                  className={`flex-row items-center gap-3 ${
                    index < recentActivity.length - 1 ? 'pb-3 border-b border-border' : ''
                  }`}
                >
                  <View className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.type === 'scan' 
                      ? 'bg-primary/20' 
                      : activity.type === 'measurement' 
                        ? 'bg-success/20' 
                        : 'bg-warning/20'
                  }`}>
                    {activity.type === 'scan' && <Sparkles size={16} color="#31D5E3" />}
                    {activity.type === 'measurement' && <Scale size={16} color="#22C55E" />}
                    {activity.type === 'cardio' && <Activity size={16} color="#F59E0B" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">
                      {activity.title}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {activity.subtitle}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {formatRelativeDate(activity.date)}
                  </Text>
                </View>
              ))}
            </GlassCard>
          ) : (
            <GlassCard onPress={() => router.push('/physique-scan')} className="relative overflow-hidden">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Sparkles size={12} color="#31D5E3" />
                    <Text className="text-xs text-primary font-semibold uppercase tracking-wider">
                      Get Started
                    </Text>
                  </View>
                  <Text className="text-sm text-muted-foreground mt-1">
                    Complete a physique scan or log your progress
                  </Text>
                </View>
                <View className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ChevronRight size={24} color="#31D5E3" />
                </View>
              </View>
            </GlassCard>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function for relative dates
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
