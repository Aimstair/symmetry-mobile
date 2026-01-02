import * as React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  AlertTriangle,
  Flame,
  Dumbbell,
  Calendar,
  Zap,
  Sparkles,
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
  const { user, nutritionTargets, workoutPlans } = useAppStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayMacros = {
    protein: { current: 145, target: nutritionTargets?.protein || 180 },
    carbs: { current: 220, target: nutritionTargets?.carbs || 300 },
    fats: { current: 55, target: nutritionTargets?.fats || 70 },
  };

  const todayWorkout = workoutPlans[0] || {
    id: '1',
    name: 'Push Day',
    dayName: 'Monday',
    targetMuscles: ['chest', 'shoulders', 'triceps'],
    exercises: [],
    status: 'scheduled',
  };

  const hasMissedWorkout = false;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-sm text-muted-foreground font-medium">
            {getGreeting()}
          </Text>
          <Text className="text-3xl font-bold mt-1 text-primary">
            {user?.name || 'Athlete'}
          </Text>
        </View>

        {/* Missed Workout Banner */}
        {hasMissedWorkout && (
          <View className="mb-4">
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
          </View>
        )}

        {/* Daily Macros */}
        <View className="mb-6">
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
        </View>

        {/* Today's Mission */}
        <View className="mb-6">
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
                  {(todayWorkout.targetMuscles as string[]).join(' • ')}
                </Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <Text className="text-xs text-primary font-medium">
                    {todayWorkout.exercises?.length || 6} exercises
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
        </View>

        {/* Quick Stats */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Calendar size={16} color="#31D5E3" />
              <Text className="text-base font-semibold text-foreground">
                This Week
              </Text>
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <GlassCard className="items-center py-5">
                <Text className="text-2xl font-bold text-primary">4</Text>
                <Text className="text-xs text-muted-foreground mt-1">Workouts</Text>
              </GlassCard>
            </View>
            <View className="flex-1">
              <GlassCard className="items-center py-5">
                <Text className="text-2xl font-bold text-success">12.5k</Text>
                <Text className="text-xs text-muted-foreground mt-1">Volume</Text>
              </GlassCard>
            </View>
            <View className="flex-1">
              <GlassCard className="items-center py-5">
                <Text className="text-2xl font-bold text-warning">3h 20m</Text>
                <Text className="text-xs text-muted-foreground mt-1">Time</Text>
              </GlassCard>
            </View>
          </View>
        </View>

        {/* Symmetry Score Teaser */}
        <View className="mb-6">
          <GlassCard onPress={() => router.push('/physique-scan')} className="relative overflow-hidden">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-1">
                  <Sparkles size={12} color="#31D5E3" />
                  <Text className="text-xs text-primary font-semibold uppercase tracking-wider">
                    AI Physique Analysis
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground mt-1">
                  Scan to see your symmetry score
                </Text>
              </View>
              <View className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ChevronRight size={24} color="#31D5E3" />
              </View>
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
