import { useState, useEffect, useRef, useCallback } from 'react';
import * as React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
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
  Info
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { cn } from '@/lib/utils';

// Mock workout data
const weeklyPlan = [
  { 
    day: 'Mon', 
    date: 23, 
    name: 'Push Day', 
    muscles: ['Chest', 'Shoulders', 'Triceps'],
    status: 'completed',
    exercises: 6
  },
  { 
    day: 'Tue', 
    date: 24, 
    name: 'Pull Day', 
    muscles: ['Back', 'Biceps', 'Rear Delts'],
    status: 'completed',
    exercises: 6
  },
  { 
    day: 'Wed', 
    date: 25, 
    name: 'Rest', 
    muscles: [],
    status: 'rest',
    exercises: 0
  },
  { 
    day: 'Thu', 
    date: 26, 
    name: 'Legs', 
    muscles: ['Quads', 'Hamstrings', 'Glutes'],
    status: 'today',
    exercises: 7
  },
  { 
    day: 'Fri', 
    date: 27, 
    name: 'Push Day', 
    muscles: ['Chest', 'Shoulders', 'Triceps'],
    status: 'upcoming',
    exercises: 6
  },
  { 
    day: 'Sat', 
    date: 28, 
    name: 'Pull Day', 
    muscles: ['Back', 'Biceps', 'Rear Delts'],
    status: 'upcoming',
    exercises: 6
  },
  { 
    day: 'Sun', 
    date: 29, 
    name: 'Rest', 
    muscles: [],
    status: 'rest',
    exercises: 0
  },
];

// Exercise details with alternatives and muscle targeting info
const exerciseInfo: Record<string, {
  muscles: string[];
  reason: string;
  alternatives: { name: string; equipment: string }[];
}> = {
  'Bench Press': {
    muscles: ['Chest', 'Front Delts', 'Triceps'],
    reason: 'Primary compound movement for chest development. Selected based on your goal to build upper body mass.',
    alternatives: [
      { name: 'Dumbbell Bench Press', equipment: 'Dumbbells + Bench' },
      { name: 'Push-Ups', equipment: 'Bodyweight' },
      { name: 'Floor Press', equipment: 'Dumbbells/Barbell' },
    ]
  },
  'Incline DB Press': {
    muscles: ['Upper Chest', 'Front Delts', 'Triceps'],
    reason: 'Targets upper chest to create balanced chest development and improve symmetry score.',
    alternatives: [
      { name: 'Incline Barbell Press', equipment: 'Barbell + Incline Bench' },
      { name: 'Low-to-High Cable Fly', equipment: 'Cable Machine' },
      { name: 'Incline Push-Ups', equipment: 'Bodyweight + Elevated Surface' },
    ]
  },
  'Cable Flyes': {
    muscles: ['Chest', 'Front Delts'],
    reason: 'Isolation movement for chest stretch and contraction. Great for muscle definition.',
    alternatives: [
      { name: 'Dumbbell Flyes', equipment: 'Dumbbells + Bench' },
      { name: 'Pec Deck Machine', equipment: 'Pec Deck' },
      { name: 'Resistance Band Flyes', equipment: 'Resistance Bands' },
    ]
  },
  'Shoulder Press': {
    muscles: ['Front Delts', 'Side Delts', 'Triceps'],
    reason: 'Compound shoulder builder for overall deltoid development.',
    alternatives: [
      { name: 'Dumbbell Shoulder Press', equipment: 'Dumbbells' },
      { name: 'Arnold Press', equipment: 'Dumbbells' },
      { name: 'Pike Push-Ups', equipment: 'Bodyweight' },
    ]
  },
  'Lateral Raises': {
    muscles: ['Side Delts'],
    reason: 'Isolation for side delts to create wider shoulder appearance.',
    alternatives: [
      { name: 'Cable Lateral Raises', equipment: 'Cable Machine' },
      { name: 'Resistance Band Lateral Raises', equipment: 'Resistance Bands' },
      { name: 'Leaning Lateral Raises', equipment: 'Dumbbells' },
    ]
  },
  'Tricep Pushdowns': {
    muscles: ['Triceps'],
    reason: 'Isolation movement for tricep definition and arm size.',
    alternatives: [
      { name: 'Overhead Tricep Extension', equipment: 'Dumbbell/Cable' },
      { name: 'Skull Crushers', equipment: 'Barbell/EZ Bar' },
      { name: 'Diamond Push-Ups', equipment: 'Bodyweight' },
    ]
  },
  'Squats': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    reason: 'King of leg exercises. Essential for lower body strength and mass.',
    alternatives: [
      { name: 'Leg Press', equipment: 'Leg Press Machine' },
      { name: 'Goblet Squats', equipment: 'Dumbbell/Kettlebell' },
      { name: 'Bulgarian Split Squats', equipment: 'Dumbbells + Bench' },
    ]
  },
};

export default function WorkoutPlan() {
  const [selectedDay, setSelectedDay] = useState(3); // Thursday
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      headerAnim.setValue(0);
      calendarAnim.setValue(0);
      contentAnim.setValue(0);
      Animated.stagger(80, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(calendarAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, [headerAnim, calendarAnim, contentAnim])
  );

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [exerciseToSwap, setExerciseToSwap] = useState<string | null>(null);
  const [swappedExercises, setSwappedExercises] = useState<Record<string, string>>({});
  const router = useRouter();

  const selectedWorkout = weeklyPlan[selectedDay];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/20 text-success border-success/30';
      case 'today': return 'bg-primary/20 text-primary border-primary/30';
      case 'skipped': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'rest': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-card text-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check size={12} color="#4ADE80" />;
      case 'skipped': return <X size={12} color="#EF4444" />;
      case 'today': return <Zap size={12} color="#31D5E3" />;
      default: return null;
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          {/* Header */}
          <Animated.View style={createAnimStyle(headerAnim)} className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-2xl font-bold text-foreground">Workout Plan</Text>
              <Text className="text-sm text-muted-foreground">December 2024</Text>
            </View>
            <View className="flex-row gap-2">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft size={20} color="#A1A1AA" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full">
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
            {weeklyPlan.map((day, index) => (
              <Pressable
                key={day.day}
                onPress={() => setSelectedDay(index)}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center p-3 rounded-xl border min-w-[52px]',
                  selectedDay === index
                    ? 'bg-primary border-primary'
                    : getStatusColor(day.status)
                )}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: selectedDay === index ? 1.05 : 1 }]
                })}
              >
                <Text className={cn(
                  'text-xs font-medium',
                  selectedDay === index ? 'text-primary-foreground opacity-70' : 'opacity-70'
                )}>
                  {day.day}
                </Text>
                <Text className={cn(
                  'text-lg font-bold mt-0.5',
                  selectedDay === index ? 'text-primary-foreground' : ''
                )}>
                  {day.date}
                </Text>
                <View className="mt-1 h-4 flex items-center justify-center">
                  {getStatusIcon(day.status)}
                </View>
              </Pressable>
            ))}
          </Animated.ScrollView>

          {/* Selected Workout Details */}
          <Animated.View style={createAnimStyle(contentAnim)}>
            {selectedWorkout.status === 'rest' ? (
              <GlassCard className="items-center py-8">
                <View className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Calendar size={32} color="#71717A" />
                </View>
                <Text className="text-xl font-bold text-foreground">Rest Day</Text>
                <Text className="text-muted-foreground mt-2 text-center">
                  Recovery is part of the process. Rest up!
                </Text>
              </GlassCard>
            ) : (
              <>
                <GlassCard 
                  variant="glow" 
                  glowColor={selectedWorkout.status === 'today' ? 'primary' : undefined}
                  className="mb-4"
                >
                  <View className="flex-row items-center gap-4">
                    <View className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center',
                      selectedWorkout.status === 'completed' 
                        ? 'bg-success' 
                        : 'bg-primary'
                    )}>
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
                            <Text className="text-xs font-medium text-primary">
                              Today
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        {selectedWorkout.muscles.join(' • ')}
                      </Text>
                      <Text className="text-xs text-primary mt-1">
                        {selectedWorkout.exercises} exercises
                      </Text>
                    </View>
                  </View>

                  {selectedWorkout.status === 'today' && (
                    <Button 
                      className="w-full mt-4 bg-primary"
                      onPress={() => router.push('/active-workout')}
                    >
                      <Zap size={16} color="#FFFFFF" />
                      <Text className="text-primary-foreground font-semibold ml-2">
                        Start Workout
                      </Text>
                    </Button>
                  )}

                  {selectedWorkout.status === 'completed' && (
                    <View className="mt-4 pt-4 border-t border-border">
                      <View className="flex-row justify-between">
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-success">48:32</Text>
                          <Text className="text-xs text-muted-foreground">Duration</Text>
                        </View>
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-foreground">24</Text>
                          <Text className="text-xs text-muted-foreground">Sets</Text>
                        </View>
                        <View className="items-center flex-1">
                          <Text className="text-lg font-bold text-foreground">8,450</Text>
                          <Text className="text-xs text-muted-foreground">Volume (lbs)</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </GlassCard>

                {/* Exercise Preview */}
                <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Exercises
                </Text>
                <View className="gap-2">
                  {['Bench Press', 'Incline DB Press', 'Cable Flyes', 'Shoulder Press', 'Lateral Raises', 'Tricep Pushdowns'].slice(0, selectedWorkout.exercises).map((exercise, i) => {
                    const displayName = swappedExercises[exercise] || exercise;
                    const info = exerciseInfo[exercise] || exerciseInfo['Bench Press'];
                    const isExpanded = expandedExercise === exercise;
                    
                    return (
                      <View key={exercise}>
                        <GlassCard className="py-3">
                          <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                              <Text className="text-sm font-bold text-foreground">{i + 1}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className="font-medium text-sm text-foreground">{displayName}</Text>
                              <Text className="text-xs text-muted-foreground">4 sets • 8-12 reps</Text>
                            </View>
                            
                            {selectedWorkout.status !== 'completed' && (
                              <Pressable 
                                onPress={() => {
                                  setExerciseToSwap(exercise);
                                  setSwapDialogOpen(true);
                                }}
                                className="h-8 w-8 items-center justify-center"
                              >
                                <Wrench size={16} color="#71717A" />
                              </Pressable>
                            )}
                            
                            <Pressable 
                              onPress={() => setExpandedExercise(isExpanded ? null : exercise)}
                              className="h-8 w-8 items-center justify-center"
                            >
                              {isExpanded ? (
                                <ChevronUp size={16} color="#71717A" />
                              ) : (
                                <ChevronDown size={16} color="#71717A" />
                              )}
                            </Pressable>
                            
                            {selectedWorkout.status === 'completed' && (
                              <Check size={20} color="#4ADE80" />
                            )}
                          </View>
                          
                          {isExpanded && (
                            <View className="mt-3 pt-3 border-t border-border gap-3">
                              {/* Muscle Groups */}
                              <View>
                                <Text className="text-xs font-semibold text-muted-foreground mb-1">MUSCLES TARGETED</Text>
                                <View className="flex-row flex-wrap gap-2">
                                  {info.muscles.map(muscle => (
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
      {swapDialogOpen && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setSwapDialogOpen(false)}
          />
          <View className="bg-card rounded-2xl p-6 mx-4 max-w-sm w-full">
            <Text className="text-lg font-bold text-foreground mb-2">Swap Exercise</Text>
            <Text className="text-sm text-muted-foreground mb-4">
              Choose an alternative for <Text className="font-medium text-foreground">{exerciseToSwap}</Text>
            </Text>
            <View className="gap-2">
              {exerciseToSwap && exerciseInfo[exerciseToSwap]?.alternatives.map((alt) => (
                <Pressable
                  key={alt.name}
                  onPress={() => {
                    if (exerciseToSwap) {
                      setSwappedExercises(prev => ({
                        ...prev,
                        [exerciseToSwap]: alt.name
                      }));
                    }
                    setSwapDialogOpen(false);
                  }}
                  className="border border-border rounded-lg p-3 flex-row items-center justify-between"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1
                  })}
                >
                  <Text className="font-medium text-foreground">{alt.name}</Text>
                  <Text className="text-xs text-muted-foreground">{alt.equipment}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
