import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
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
  Calendar
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

export default function WorkoutPlan() {
  const [selectedDay, setSelectedDay] = useState(3); // Thursday
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
          <View className="flex-row items-center justify-between mb-6">
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
          </View>

          {/* Week Calendar */}
          <ScrollView 
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
          </ScrollView>

          {/* Selected Workout Details */}
          <View>
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
                  {['Bench Press', 'Incline DB Press', 'Cable Flyes', 'Shoulder Press', 'Lateral Raises', 'Tricep Pushdowns'].slice(0, selectedWorkout.exercises).map((exercise, i) => (
                    <GlassCard key={exercise} className="flex-row items-center gap-3 py-3">
                      <View className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Text className="text-sm font-bold text-foreground">{i + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-sm text-foreground">{exercise}</Text>
                        <Text className="text-xs text-muted-foreground">4 sets • 8-12 reps</Text>
                      </View>
                      {selectedWorkout.status === 'completed' && (
                        <Check size={20} color="#4ADE80" />
                      )}
                    </GlassCard>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
