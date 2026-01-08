import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Dimensions, Animated, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GestureDetector, GestureHandlerRootView, Pressable } from 'react-native-gesture-handler';
import { ExerciseHistorySheet } from '@/components/ui/workout/ExerciseHistorySheet';
import { TapeMeasurementModal, CardioLogModal, LogWeightModal } from '@/components/ui/progress';
import { useAppStore } from '@/store/useAppStore';
import { useProgressDataInitialization } from '@/hooks/useDataInitialization';
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
import { dataService } from '@/services/dataServiceProvider';
import type { BodyMeasurement, PhysiqueScan, CardioLog, CatalogExercise, MeasurementLog } from '@/types';

const { width } = Dimensions.get('window');
const chartWidth = width - 64; // Account for padding
const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;
const IN_TO_CM = 2.54;
const LBS_TO_KG = 0.453592;

// Helper functions to transform store data for display
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthYear(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Transform body measurements to weight chart data
function transformToWeightData(measurements: BodyMeasurement[]) {
  if (!measurements.length) return [];
  
  return measurements
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-9) // Last 9 entries for chart
    .map((m, i) => ({
      value: m.weight,
      label: formatDate(m.date).split(' ')[1], // Just the day
      date: formatDate(m.date),
    }));
}

// Transform physique scans to symmetry chart data
function transformToSymmetryData(scans: PhysiqueScan[]) {
  if (!scans.length) return [];
  
  return scans
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-6) // Last 6 entries
    .map((s) => ({
      value: s.symmetryScore,
      label: formatMonthYear(s.date).split(' ')[0], // Just the month
    }));
}

// Get body measurements comparison (current vs previous)
function getMeasurementsComparison(measurements: BodyMeasurement[]) {
  if (measurements.length < 1) return [];
  
  const sorted = measurements
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const current = sorted[0];
  const previous = sorted[1] || current;
  
  const measurementTypes: Array<{
    key: keyof BodyMeasurement['measurements'];
    name: string;
    unit: string;
    inverse?: boolean;
  }> = [
    { key: 'chest', name: 'Chest', unit: 'in' },
    { key: 'waist', name: 'Waist', unit: 'in', inverse: true },
    { key: 'arms', name: 'Arms', unit: 'in' },
    { key: 'thighs', name: 'Thighs', unit: 'in' },
  ];
  
  return measurementTypes
    .filter(m => current.measurements[m.key] !== undefined)
    .map(m => ({
      name: m.name,
      current: current.measurements[m.key] ?? 0,
      previous: previous.measurements[m.key] ?? current.measurements[m.key] ?? 0,
      unit: m.unit,
      inverse: m.inverse,
    }));
}

// Transform cardio logs for display
function transformCardioLogs(logs: CardioLog[]) {
  return logs
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10) // Last 10 entries
    .map(log => ({
      id: log.id,
      type: log.type.charAt(0).toUpperCase() + log.type.slice(1),
      duration: log.duration,
      intensity: log.duration > 40 ? 'High' : log.duration > 20 ? 'Moderate' : 'Low',
      date: formatDate(log.date),
      calories: log.calories ?? Math.round(log.duration * 8),
    }));
}

export default function Progress() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState('recent');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  
  // Modal states
  const [showLogWeightModal, setShowLogWeightModal] = useState(false);
  const [showTapeMeasurementModal, setShowTapeMeasurementModal] = useState(false);
  const [showCardioLogModal, setShowCardioLogModal] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<CatalogExercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Get user and data from store
  const user = useAppStore((s) => s.user);
  const measurementLogs = useAppStore((s) => s.measurementLogs);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const cardioLogs = useAppStore((s) => s.cardioLogs);
  const settings = useAppStore((s) => s.settings);
  const syncAddMeasurementLog = useAppStore((s) => s.syncAddMeasurementLog);
  const syncAddCardioLog = useAppStore((s) => s.syncAddCardioLog);
  const isLoading = useAppStore((s) => s.isLoading);

  // Load progress data on tab focus
  const { isLoading: isProgressLoading, loadProgressData } = useProgressDataInitialization(user?.id ?? null);

  // Initial data load on mount (fixes black screen on first load)
  useEffect(() => {
    if (user?.id && !initialLoadDone) {
      loadProgressData().then(() => {
        setInitialLoadDone(true);
      });
    }
  }, [user?.id, initialLoadDone, loadProgressData]);

  // Load exercises when switching to the Exercises tab
  useEffect(() => {
    if (activeTab === 'exercises' && catalogExercises.length === 0 && !isLoadingExercises) {
      setIsLoadingExercises(true);
      dataService.exercise.getExercises()
        .then((exercises) => {
          setCatalogExercises(exercises);
        })
        .catch((error) => {
          console.error('Failed to load exercises:', error);
        })
        .finally(() => {
          setIsLoadingExercises(false);
        });
    }
  }, [activeTab, catalogExercises.length, isLoadingExercises]);

  // Load progress data when this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProgressData();
      
      headerAnim.setValue(0);
      contentAnim.setValue(0);
      const animation = Animated.stagger(100, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]);

      animation.start();

      return () => {
        animation.stop();
      };
    }, [headerAnim, contentAnim, loadProgressData])
  );

  // Compute derived data using useMemo
  const weightChartData = useMemo(() => {
    if (!measurementLogs.length) return [];
    
    return measurementLogs
      .filter(m => m.weightKg !== undefined && m.weightKg !== null)
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-9)
      .map((m) => {
        // Convert Metric (DB) -> User Unit (UI)
        const val = settings.unit === 'lbs' ? (m.weightKg! * KG_TO_LBS) : m.weightKg!;
        return {
          value: parseFloat(val.toFixed(1)),
          label: formatDate(m.date).split(' ')[1],
          date: formatDate(m.date),
        };
      });
  }, [measurementLogs, settings.unit]);

  const symmetryChartData = useMemo(() => transformToSymmetryData(physiqueScans), [physiqueScans]);

  const measurementsComparison = useMemo(() => {
    const logsWithTape = measurementLogs
      .filter(m => m.chestCm || m.waistCm || m.leftArmCm || m.rightArmCm || m.leftThighCm || m.rightThighCm)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (logsWithTape.length < 1) return [];

    const current = logsWithTape[0];
    const previous = logsWithTape[1] || current;

    // Helper: Convert CM to User Unit
    const toUserUnit = (cm?: number) => {
      if (!cm) return 0;
      const val = settings.measurementUnit === 'in' ? cm * CM_TO_IN : cm;
      return parseFloat(val.toFixed(1));
    };

    const types = [
      { name: 'Chest', current: toUserUnit(current.chestCm), prev: toUserUnit(previous.chestCm), inverse: false },
      { name: 'Waist', current: toUserUnit(current.waistCm), prev: toUserUnit(previous.waistCm), inverse: true },
      { name: 'Arms', current: toUserUnit(current.leftArmCm || current.rightArmCm), prev: toUserUnit(previous.leftArmCm || previous.rightArmCm), inverse: false },
      { name: 'Thighs', current: toUserUnit(current.leftThighCm || current.rightThighCm), prev: toUserUnit(previous.leftThighCm || previous.rightThighCm), inverse: false },
    ];

    return types
      .filter(t => t.current > 0)
      .map(t => ({
        name: t.name,
        current: t.current,
        previous: t.prev || t.current,
        unit: settings.measurementUnit,
        inverse: t.inverse
      }));
  }, [measurementLogs, settings.measurementUnit]);

  const cardioLogsList = useMemo(() => transformCardioLogs(cardioLogs), [cardioLogs]);

  // Calculate weight change
  const weightChange = useMemo(() => {
     if (weightChartData.length < 2) return 0;
     return weightChartData[weightChartData.length -1].value - weightChartData[0].value;
  }, [weightChartData]);

  // Get last weight entry
  const lastWeight = weightChartData.length > 0 ? weightChartData[weightChartData.length - 1] : null;

  // Handle logging weight
  const onSaveWeight = async (weightValue: number) => {
    if (!user) return;
    if (isNaN(weightValue) || weightValue <= 0) { Alert.alert('Invalid', 'Enter a valid number.'); return; }

    // Convert Input to KG
    const weightKg = settings.unit === 'lbs' ? weightValue * LBS_TO_KG : weightValue;

    const newLog: MeasurementLog = {
      id: `log-${Date.now()}`,
      userId: user.id,
      date: new Date(),
      createdAt: new Date(),
      weightKg: parseFloat(weightKg.toFixed(2)),
    };

    try {
      await syncAddMeasurementLog(newLog);
      setWeightInput('');
      Keyboard.dismiss();
    } catch (error) {
      console.error(error);
    }
  };

  const onSaveMeasurements = async (data: { chest: number; waist: number; arms: number; thighs: number }) => {
    if (!user) return;

    // Helper: Convert Input to CM
    const toCm = (val: number) => settings.measurementUnit === 'in' ? val * IN_TO_CM : val;
    
    // Get last weight to avoid gaps (optional)
    const lastWeightKg = measurementLogs
       .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
       .find(m => m.weightKg)?.weightKg;

    const newLog: MeasurementLog = {
      id: `log-tape-${Date.now()}`,
      userId: user.id,
      date: new Date(),
      createdAt: new Date(),
      weightKg: lastWeightKg, // Carry over weight
      chestCm: toCm(data.chest),
      waistCm: toCm(data.waist),
      leftArmCm: toCm(data.arms),
      rightArmCm: toCm(data.arms), // Assume symmetry for simple input
      leftThighCm: toCm(data.thighs),
      rightThighCm: toCm(data.thighs),
    };

    try {
      await syncAddMeasurementLog(newLog);
    } catch (error) {
      console.error(error);
    }
  };

  const handleInlineLog = () => {
    const w = parseFloat(weightInput);
    onSaveWeight(w);
  };

  // Exercise stats type for the Exercises tab
  interface ExerciseStat {
    id: string;
    name: string;
    muscle: string;
    pr: number;
    lastWeight: number;
    sessions: number;
    trend: 'up' | 'down' | 'stable';
  }

  // Transform catalog exercises to exercise stats
  // In the future, this should merge with workout history data
  const exerciseStats = useMemo((): ExerciseStat[] => {
    return catalogExercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscle: exercise.muscleGroups[0] || 'General',
      pr: 0, // TODO: Get from workout history
      lastWeight: 0, // TODO: Get from workout history
      sessions: 0, // TODO: Count from workout history
      trend: 'stable' as const,
    }));
  }, [catalogExercises]);

  // Filter and sort exercises
  const filteredExercises = exerciseStats
    .filter((ex) => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
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

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  const getDelta = (current: number, previous: number, inverse?: boolean) => {
    const delta = current - previous;
    const isPositive = inverse ? delta < 0 : delta > 0;
    return { value: Math.abs(delta).toFixed(1), isPositive };
  };

  // Show loading state only on initial load (not on subsequent refreshes)
  if (!initialLoadDone && isProgressLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#31D5E3" />
          <Text className="text-muted-foreground mt-4">Loading progress data...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
                  {weightChange !== 0 && (
                    <Text className={cn('text-sm', weightChange > 0 ? 'text-success' : 'text-destructive')}>
                      {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} {settings.unit}
                    </Text>
                  )}
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  {weightChartData.length > 0 ? (
                    <View className="items-center justify-center pt-4">
                      <LineChart
                        data={weightChartData}
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
                              <Text className="text-xs text-primary font-bold">{items[0].value} {settings.unit}</Text>
                              <Text className="text-xs text-muted-foreground">{items[0].date || items[0].label}</Text>
                            </View>
                          );
                        },
                      }}
                    />
                    </View>
                  ) : (
                    <View className="items-center justify-center py-12">
                      <Scale size={40} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-3">No weight data yet</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Log your weight to see trends</Text>
                    </View>
                  )}
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
                  {symmetryChartData.length > 0 ? (
                    <View className="items-center justify-center pt-4">
                      <LineChart
                        data={symmetryChartData}
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
                  ) : (
                    <View className="items-center justify-center py-12">
                      <TrendingUp size={40} color="#71717A" style={{ opacity: 0.5 }} />
                      <Text className="text-muted-foreground mt-3">No symmetry scans yet</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Complete a physique scan to track symmetry</Text>
                    </View>
                  )}
                </GlassCard>
              </View>

              {/* Quick Stats */}
              <View>
                <Text className="text-lg font-semibold mb-3 text-foreground">This Month</Text>
                <View className="flex-row flex-wrap gap-3">
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-primary">--</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Workouts</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-success">--</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Total Volume</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-warning">--</Text>
                      <Text className="text-xs text-muted-foreground mt-1">Time Trained</Text>
                    </GlassCard>
                  </View>
                  <View className="w-[48%]">
                    <GlassCard className="items-center">
                      <Text className="text-3xl font-bold text-foreground">--</Text>
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
                  {isLoadingExercises ? (
                    <View className="items-center py-8">
                      <ActivityIndicator size="large" color="#31D5E3" />
                      <Text className="text-muted-foreground mt-2">Loading exercises...</Text>
                    </View>
                  ) : (
                    <>
                      {filteredExercises.map((exercise) => (
                        <GestureHandlerRootView key={exercise.id}>
                          <Pressable
                            onPress={() => {
                              setSelectedExerciseId(exercise.id);
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
                              {exercise.sessions > 0 && (
                                <View className="items-end">
                                  <Text className="font-bold text-foreground">{exercise.lastWeight} lbs</Text>
                                  <View className="flex-row items-center gap-1">
                                    <Text className="text-xs text-muted-foreground">PR: {exercise.pr} lbs</Text>
                                    {exercise.trend === 'up' && <TrendingUp size={12} color="#4ADE80" />}
                                  </View>
                                </View>
                              )}
                            </GlassCard>
                          </Pressable>
                        </GestureHandlerRootView>
                      ))}
                    </>
                  )}
                  
                  {!isLoadingExercises && filteredExercises.length === 0 && (
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
                  <Button size="sm" variant="outline" onPress={() => setShowTapeMeasurementModal(true)}>
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-1">Log</Text>
                  </Button>
                </View>

                {measurementsComparison.length > 0 ? (
                  <View className="gap-3">
                    {measurementsComparison.map((m) => {
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
                ) : (
                  <GlassCard className="items-center py-8">
                    <Ruler size={40} color="#71717A" style={{ opacity: 0.5 }} />
                    <Text className="text-muted-foreground mt-3">No measurements logged</Text>
                    <Text className="text-xs text-muted-foreground mt-1">Tap "Log" to add your first measurement</Text>
                  </GlassCard>
                )}
              </View>

              {/* Weight Log */}
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Scale size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Log Weight</Text>
                  </View>
                  <Button size="sm" variant="outline" onPress={() => setShowLogWeightModal(true)}>
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-1">Log</Text>
                  </Button>
                </View>
                <GlassCard className="mt-4">
                    
                    <Text className="text-xs text-muted-foreground mt-2 text-center">
                      {lastWeight 
                        ? `Last entry: ${lastWeight.value} ${settings.unit} on ${lastWeight.date}`
                        : 'No entries yet'
                      }
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
                  <Button size="sm" variant="outline" onPress={() => setShowCardioLogModal(true)}>
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-1">Add</Text>
                  </Button>
                </View>

                {cardioLogsList.length > 0 ? (
                  <View className="gap-3">
                    {cardioLogsList.map((session) => (
                      <GlassCard key={session.id} className="flex-row items-center justify-between">
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
                ) : (
                  <GlassCard className="items-center py-8">
                    <Activity size={40} color="#71717A" style={{ opacity: 0.5 }} />
                    <Text className="text-muted-foreground mt-3">No cardio sessions logged</Text>
                    <Text className="text-xs text-muted-foreground mt-1">Tap "Add" to log your cardio</Text>
                  </GlassCard>
                )}

                {/* Weekly Summary */}
                {cardioLogsList.length > 0 && (
                  <GlassCard className="mt-6">
                    <Text className="font-semibold mb-3 text-foreground">Recent Activity</Text>
                    <View className="flex-row justify-between">
                      <View className="items-center flex-1">
                        <Text className="text-2xl font-bold text-primary">{cardioLogsList.length}</Text>
                        <Text className="text-xs text-muted-foreground">Sessions</Text>
                      </View>
                      <View className="items-center flex-1">
                        <Text className="text-2xl font-bold text-foreground">
                          {cardioLogsList.reduce((sum, s) => sum + s.duration, 0)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Minutes</Text>
                      </View>
                      <View className="items-center flex-1">
                        <Text className="text-2xl font-bold text-warning">
                          {cardioLogsList.reduce((sum, s) => sum + s.calories, 0)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Calories</Text>
                      </View>
                    </View>
                  </GlassCard>
                )}
              </View>
            </TabsContent>
          </Tabs>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Modals */}
      <LogWeightModal 
        open={showLogWeightModal} 
        onOpenChange={setShowLogWeightModal} 
        onSave={onSaveWeight} // Pass the save handler!
        currentUnit={settings.unit}
      />
      <TapeMeasurementModal 
        open={showTapeMeasurementModal} 
        onOpenChange={setShowTapeMeasurementModal} 
        onSave={onSaveMeasurements}
        unit={settings.measurementUnit} // 'in' or 'cm'
      />
      <CardioLogModal 
        open={showCardioLogModal} 
        onOpenChange={setShowCardioLogModal} 
      />
    </SafeAreaView>
  );
}
