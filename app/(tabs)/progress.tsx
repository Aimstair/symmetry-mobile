import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GestureDetector, GestureHandlerRootView, Pressable } from 'react-native-gesture-handler';
import { ExerciseHistorySheet } from '@/components/ui/workout/ExerciseHistorySheet';
import { 
  TrendingUp, 
  Scale, 
  Ruler, 
  Activity,
  Plus,
  ChevronUp,
  ChevronDown,
  Minus,
  ChevronRight,
  Search,
  Filter,
  Dumbbell
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');
const chartWidth = width - 64; // Account for padding

// Mock data
const weightData = [
  { date: 'Nov 1', weight: 185, x: 1 },
  { date: 'Nov 8', weight: 186.2, x: 2 },
  { date: 'Nov 15', weight: 185.5, x: 3 },
  { date: 'Nov 22', weight: 186.8, x: 4 },
  { date: 'Nov 29', weight: 187.2, x: 5 },
  { date: 'Dec 6', weight: 186.5, x: 6 },
  { date: 'Dec 13', weight: 187.8, x: 7 },
  { date: 'Dec 20', weight: 188.1, x: 8 },
  { date: 'Dec 27', weight: 188.5, x: 9 },
];

const symmetryData = [
  { date: 'Oct', score: 72, x: 1 },
  { date: 'Nov', score: 76, x: 2 },
  { date: 'Dec', score: 82, x: 3 },
];

const measurements = [
  { name: 'Chest', current: 42.5, previous: 42.0, unit: 'in' },
  { name: 'Waist', current: 32.0, previous: 32.5, unit: 'in', inverse: true },
  { name: 'Left Arm', current: 15.2, previous: 15.0, unit: 'in' },
  { name: 'Right Arm', current: 15.5, previous: 15.3, unit: 'in' },
  { name: 'Left Thigh', current: 24.5, previous: 24.0, unit: 'in' },
  { name: 'Right Thigh', current: 24.8, previous: 24.2, unit: 'in' },
];

// Exercise history data
const exerciseStats = [
  { 
    name: 'Bench Press', 
    muscle: 'Chest',
    pr: 225,
    lastWeight: 205,
    sessions: 24,
    trend: 'up',
    history: [
      { date: 'Dec 20', weight: 205 },
      { date: 'Dec 13', weight: 200 },
      { date: 'Dec 6', weight: 195 },
      { date: 'Nov 29', weight: 190 },
      { date: 'Nov 22', weight: 185 },
    ]
  },
  { 
    name: 'Squat', 
    muscle: 'Legs',
    pr: 315,
    lastWeight: 285,
    sessions: 20,
    trend: 'up',
    history: [
      { date: 'Dec 20', weight: 285 },
      { date: 'Dec 13', weight: 275 },
      { date: 'Dec 6', weight: 270 },
      { date: 'Nov 29', weight: 265 },
      { date: 'Nov 22', weight: 260 },
    ]
  },
  { 
    name: 'Deadlift', 
    muscle: 'Back',
    pr: 365,
    lastWeight: 335,
    sessions: 18,
    trend: 'stable',
    history: [
      { date: 'Dec 20', weight: 335 },
      { date: 'Dec 13', weight: 335 },
      { date: 'Dec 6', weight: 330 },
      { date: 'Nov 29', weight: 325 },
      { date: 'Nov 22', weight: 320 },
    ]
  },
  { 
    name: 'Shoulder Press', 
    muscle: 'Shoulders',
    pr: 155,
    lastWeight: 135,
    sessions: 22,
    trend: 'up',
    history: [
      { date: 'Dec 20', weight: 135 },
      { date: 'Dec 13', weight: 130 },
      { date: 'Dec 6', weight: 125 },
      { date: 'Nov 29', weight: 125 },
      { date: 'Nov 22', weight: 120 },
    ]
  },
  { 
    name: 'Barbell Row', 
    muscle: 'Back',
    pr: 205,
    lastWeight: 185,
    sessions: 16,
    trend: 'up',
    history: [
      { date: 'Dec 20', weight: 185 },
      { date: 'Dec 13', weight: 180 },
      { date: 'Dec 6', weight: 175 },
      { date: 'Nov 29', weight: 170 },
      { date: 'Nov 22', weight: 165 },
    ]
  },
];

export default function Progress() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState('recent');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);
  
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      headerAnim.setValue(0);
      contentAnim.setValue(0);
      Animated.stagger(100, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, [headerAnim, contentAnim])
  );

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  const getDelta = (current: number, previous: number, inverse?: boolean) => {
    const delta = current - previous;
    const isPositive = inverse ? delta < 0 : delta > 0;
    return { value: Math.abs(delta).toFixed(1), isPositive };
  };

  // Filter and sort exercises
  const filteredExercises = exerciseStats
    .filter(ex => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
                  ex.muscle.toLowerCase().includes(exerciseSearch.toLowerCase()))
    .sort((a, b) => {
      switch (exerciseFilter) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'muscle':
          return a.muscle.localeCompare(b.muscle);
        case 'pr':
          return b.pr - a.pr;
        default: // recent
          return b.sessions - a.sessions;
      }
    });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6 pb-24">
          <Animated.View style={createAnimStyle(headerAnim)} className="mb-6">
            <Text className="text-2xl font-bold text-foreground">Progress</Text>
            <Text className="text-muted-foreground text-sm mt-1">
              Track your transformation
            </Text>
          </Animated.View>

          <Animated.View style={createAnimStyle(contentAnim)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full mb-6 ">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="exercises">Exercises</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="cardio">Cardio</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="gap-6">
              {/* Weight Chart */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <Scale size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Body Weight</Text>
                  </View>
                  <Text className="text-sm text-success">+3.5 lbs</Text>
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  <View className="items-center justify-center pt-4">
                    <LineChart
                      data={weightData.map(d => ({ value: d.weight, label: d.date.split(' ')[1] }))}
                      curved
                      areaChart
                      height={180}
                      width={chartWidth}
                      spacing={30}
                      initialSpacing={10}
                      color="#31D5E3"
                      thickness={3}
                      startFillColor="#31D5E3"
                      endFillColor="#31D5E3"
                      startOpacity={0.3}
                      endOpacity={0.05}
                      dataPointsColor="#31D5E3"
                      dataPointsRadius={4}
                      hideDataPoints={false}
                      yAxisColor="#27272A"
                      xAxisColor="#27272A"
                      yAxisTextStyle={{ color: '#A1A1AA', fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: '#A1A1AA', fontSize: 9 }}
                      rulesType="solid"
                      rulesColor="#27272A"
                      noOfSections={4}
                      backgroundColor="transparent"
                      pointerConfig={{
                        pointerStripHeight: 160,
                        pointerStripColor: '#31D5E3',
                        pointerStripWidth: 2,
                        pointerColor: '#31D5E3',
                        radius: 6,
                        pointerLabelWidth: 100,
                        pointerLabelHeight: 90,
                        activatePointersOnLongPress: true,
                        autoAdjustPointerLabelPosition: false,
                        pointerLabelComponent: (items: any) => {
                          return (
                            <View className="bg-card border border-border rounded-lg px-3 py-2">
                              <Text className="text-xs text-primary font-bold">{items[0].value} lbs</Text>
                              <Text className="text-xs text-muted-foreground">{items[0].label}</Text>
                            </View>
                          );
                        },
                      }}
                    />
                  </View>
                </GlassCard>
              </View>

              {/* Symmetry Score Chart */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <TrendingUp size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Symmetry Score</Text>
                  </View>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-row items-center"
                    onPress={() => router.push('/symmetry-history')}
                  >
                    <Text className="text-primary text-sm">View All</Text>
                    <ChevronRight size={16} color="#31D5E3" />
                  </Button>
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  <View className="items-center justify-center pt-4">
                    <LineChart
                      data={symmetryData.map(d => ({ value: d.score, label: d.date }))}
                      curved
                      areaChart
                      height={180}
                      width={chartWidth}
                      spacing={80}
                      initialSpacing={20}
                      color="#4ADE80"
                      thickness={3}
                      startFillColor="#4ADE80"
                      endFillColor="#4ADE80"
                      startOpacity={0.3}
                      endOpacity={0.05}
                      dataPointsColor="#4ADE80"
                      dataPointsRadius={5}
                      hideDataPoints={false}
                      yAxisColor="#27272A"
                      xAxisColor="#27272A"
                      yAxisTextStyle={{ color: '#A1A1AA', fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: '#A1A1AA', fontSize: 10 }}
                      rulesType="solid"
                      rulesColor="#27272A"
                      noOfSections={4}
                      backgroundColor="transparent"
                      pointerConfig={{
                        pointerStripHeight: 160,
                        pointerStripColor: '#4ADE80',
                        pointerStripWidth: 2,
                        pointerColor: '#4ADE80',
                        radius: 6,
                        pointerLabelWidth: 100,
                        pointerLabelHeight: 90,
                        activatePointersOnLongPress: true,
                        autoAdjustPointerLabelPosition: false,
                        pointerLabelComponent: (items: any) => {
                          return (
                            <View className="bg-card border border-border rounded-lg px-3 py-2">
                              <Text className="text-xs text-success font-bold">Score: {items[0].value}</Text>
                              <Text className="text-xs text-muted-foreground">{items[0].label}</Text>
                            </View>
                          );
                        },
                      }}
                    />
                  </View>
                </GlassCard>
              </View>

              {/* Quick Stats */}
              <View>
                <Text className="text-lg font-semibold mb-3 text-foreground">This Month</Text>
                <View className="flex-row flex-wrap gap-3">
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-primary">16</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Workouts</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-success">48.2k</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Total Volume</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-warning">12h</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Time Trained</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-foreground">4</Text>
                      <Text className="text-xs text-muted-foreground mt-1">PRs Hit</Text>
                    </GlassCard>
                  </View>
                </View>
              </View>
            </TabsContent>

            {/* Exercises Tab */}
            <TabsContent value="exercises" className="gap-4">
              <View>
                {/* Search and Filter */}
                <View className="flex-row gap-2 mb-4">
                  <View className="relative flex-1">
                    <View className="absolute left-3 top-1/2 z-10" style={{ transform: [{ translateY: -10 }] }}>
                      <Search size={16} color="#71717A" />
                    </View>
                    <Input
                      placeholder="Search exercises..."
                      value={exerciseSearch}
                      onChangeText={setExerciseSearch}
                      className="pl-9"
                    />
                  </View>
                  <GestureHandlerRootView>
                  <Pressable
                    onPress={() => {
                      const filters = ['recent', 'name', 'muscle', 'pr'];
                      const currentIndex = filters.indexOf(exerciseFilter);
                      setExerciseFilter(filters[(currentIndex + 1) % filters.length]);
                    }}
                    className="px-3 py-2 border border-border rounded-lg flex-row items-center gap-2 bg-card"
                  >
                    <Filter size={16} color="#71717A" />
                    <Text className="text-sm text-foreground capitalize">{exerciseFilter}</Text>
                  </Pressable>
                  </GestureHandlerRootView>
                </View>

                {/* Exercise List */}
                <View className="gap-2">
                  {filteredExercises.map((exercise, i) => (
                    <GestureHandlerRootView>
                    <Pressable
                      key={exercise.name}
                      onPress={() => {
                        setSelectedExerciseId(exercise.name.toLowerCase().replace(/\s+/g, '-'));
                        setShowExerciseHistory(true);
                      }}
                    >
                      <GlassCard className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Dumbbell size={20} color="#31D5E3" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-medium text-foreground">{exercise.name}</Text>
                          <Text className="text-xs text-muted-foreground">{exercise.muscle}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="font-bold text-foreground">{exercise.lastWeight} lbs</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs text-muted-foreground">PR: {exercise.pr} lbs</Text>
                          {exercise.trend === 'up' && <TrendingUp size={12} color="#4ADE80" />}
                        </View>
                      </View>
                    </GlassCard>
                    </Pressable>
                    </GestureHandlerRootView>
                  ))}
                  
                  {filteredExercises.length === 0 && (
                    <View className="items-center py-8">
                      <Dumbbell size={32} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-2">No exercises found</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Exercise History Sheet */}
              <ExerciseHistorySheet
                exerciseId={selectedExerciseId}
                isOpen={showExerciseHistory}
                onClose={() => setShowExerciseHistory(false)}
                unit="lbs"
              />
            </TabsContent>

            {/* Body Measurements Tab */}
            <TabsContent value="body" className="gap-6">
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Ruler size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Tape Measurements</Text>
                  </View>
                  <Button size="sm" variant="outline">
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-1">Log</Text>
                  </Button>
                </View>

                <View className="gap-3">
                  {measurements.map((m) => {
                    const delta = getDelta(m.current, m.previous, m.inverse);
                    return (
                      <GlassCard key={m.name} className="flex-row items-center justify-between">
                        <View>
                          <Text className="font-medium text-foreground">{m.name}</Text>
                          <Text className="text-xs text-muted-foreground">Last: {m.previous} {m.unit}</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <View className={cn(
                            'flex-row items-center gap-0.5',
                            delta.isPositive ? 'text-success' : delta.value !== '0.0' ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {delta.value === '0.0' ? (
                              <Minus size={12} color="#71717A" />
                            ) : delta.isPositive ? (
                              <ChevronUp size={12} color="#4ADE80" />
                            ) : (
                              <ChevronDown size={12} color="#EF4444" />
                            )}
                            <Text className={cn(
                              'text-xs font-medium',
                              delta.isPositive ? 'text-success' : delta.value !== '0.0' ? 'text-destructive' : 'text-muted-foreground'
                            )}>
                              {delta.value}"
                            </Text>
                          </View>
                          <Text className="text-xl font-bold text-foreground">{m.current}</Text>
                          <Text className="text-sm text-muted-foreground">{m.unit}</Text>
                        </View>
                      </GlassCard>
                    );
                  })}
                </View>
              </View>

              {/* Weight Log */}
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Scale size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Log Weight</Text>
                  </View>
                </View>
                <GlassCard>
                  <View className="flex-row gap-3">
                    <Input 
                      placeholder="188.5" 
                      className="flex-1 text-center text-lg font-bold"
                      keyboardType="decimal-pad"
                    />
                    <Button className="bg-primary px-6">
                      <Text className="text-primary-foreground font-semibold">Log</Text>
                    </Button>
                  </View>
                  <Text className="text-xs text-muted-foreground mt-2 text-center">
                    Last entry: 188.5 lbs on Dec 27
                  </Text>
                </GlassCard>
              </View>
            </TabsContent>

            {/* Cardio Tab */}
            <TabsContent value="cardio" className="gap-6">
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Activity size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Cardio Log</Text>
                  </View>
                  <Button size="sm" variant="outline">
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-1">Add</Text>
                  </Button>
                </View>

                <View className="gap-3">
                  {[
                    { type: 'Running', duration: 30, intensity: 'Moderate', date: 'Today', calories: 320 },
                    { type: 'Walking', duration: 45, intensity: 'Low', date: 'Dec 27', calories: 180 },
                    { type: 'Cycling', duration: 25, intensity: 'High', date: 'Dec 25', calories: 280 },
                  ].map((session, i) => (
                    <GlassCard key={i} className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <View className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          session.intensity === 'High' ? 'bg-destructive/20' :
                          session.intensity === 'Moderate' ? 'bg-warning/20' : 'bg-success/20'
                        )}>
                          <Activity 
                            size={20} 
                            color={
                              session.intensity === 'High' ? '#EF4444' :
                              session.intensity === 'Moderate' ? '#F59E0B' : '#4ADE80'
                            } 
                          />
                        </View>
                        <View>
                          <Text className="font-medium text-foreground">{session.type}</Text>
                          <Text className="text-xs text-muted-foreground">{session.date}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="font-bold text-foreground">{session.duration} min</Text>
                        <Text className="text-xs text-muted-foreground">{session.calories} cal</Text>
                      </View>
                    </GlassCard>
                  ))}
                </View>

                {/* Weekly Summary */}
                <GlassCard className="mt-6">
                  <Text className="font-semibold mb-3 text-foreground">This Week</Text>
                  <View className="flex-row justify-between">
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-primary">3</Text>
                      <Text className="text-xs text-muted-foreground">Sessions</Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-foreground">100</Text>
                      <Text className="text-xs text-muted-foreground">Minutes</Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-warning">780</Text>
                      <Text className="text-xs text-muted-foreground">Calories</Text>
                    </View>
                  </View>
                </GlassCard>
              </View>
            </TabsContent>
          </Tabs>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
