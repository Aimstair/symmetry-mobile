import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
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
import { 
  ChevronLeft, 
  Timer, 
  Check, 
  Plus, 
  MoreVertical,
  Calculator,
  SkipForward,
  Flame,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';

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

interface ExerciseData {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  sets: SetData[];
  supersetId?: string;
  notes?: string;
}

const initialExercises: ExerciseData[] = [
  {
    id: '1',
    name: 'Barbell Bench Press',
    targetSets: 4,
    targetReps: '6-8',
    restSeconds: 180,
    sets: [
      { id: 1, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 8 },
      { id: 2, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 7 },
      { id: 3, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 6 },
      { id: 4, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 85, prevReps: 6 },
    ],
  },
  {
    id: '2',
    name: 'Incline Dumbbell Press',
    targetSets: 4,
    targetReps: '8-12',
    restSeconds: 120,
    supersetId: 'ss1',
    sets: [
      { id: 1, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 30, prevReps: 10 },
      { id: 2, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 30, prevReps: 10 },
      { id: 3, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 30, prevReps: 9 },
      { id: 4, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 27.5, prevReps: 8 },
    ],
  },
  {
    id: '3',
    name: 'Cable Flyes',
    targetSets: 3,
    targetReps: '12-15',
    restSeconds: 90,
    supersetId: 'ss1',
    sets: [
      { id: 1, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 12.5, prevReps: 15 },
      { id: 2, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 12.5, prevReps: 14 },
      { id: 3, weight: '', reps: '', completed: false, isWarmup: false, tags: [], prevWeight: 12.5, prevReps: 12 },
    ],
  },
];

export default function ActiveWorkout() {
  const router = useRouter();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [exercises, setExercises] = useState<ExerciseData[]>(initialExercises);
  const [warmupMode, setWarmupMode] = useState(false);
  const [deloadMode, setDeloadMode] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [targetRestTime, setTargetRestTime] = useState(90);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [calcWeight, setCalcWeight] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [showMenu, setShowMenu] = useState(false);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rest timer
  useEffect(() => {
    if (showRestTimer && restTime < targetRestTime) {
      const interval = setInterval(() => {
        setRestTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showRestTimer, restTime, targetRestTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      setTargetRestTime(exercise.restSeconds);
      setRestTime(0);
      setShowRestTimer(true);
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
  const strokeDashoffset = circumference * (1 - restTime / targetRestTime);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Header */}
      <View className="border-b border-border bg-card">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable 
            onPress={() => router.back()}
            className="p-2 -ml-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <ChevronLeft size={20} color="#A1A1AA" />
          </Pressable>
          
          <View className="flex-row items-center gap-2">
            <Timer size={16} color="#31D5E3" />
            <Text className="font-mono font-bold text-lg text-foreground">{formatTime(elapsedTime)}</Text>
          </View>

          <Pressable
            onPress={() => setShowMenu(!showMenu)}
            className="p-2 -mr-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <MoreVertical size={20} color="#A1A1AA" />
          </Pressable>
        </View>

        <View className="px-4 pb-3">
          <Text className="text-xl font-bold text-foreground">Push Day</Text>
          <Text className="text-sm text-muted-foreground">Chest • Shoulders • Triceps</Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 py-4 gap-4 pb-32">
          {exercises.map((exercise, exIndex) => {
            const isSuperset = exercise.supersetId;
            const supersetNext = exercises[exIndex + 1]?.supersetId === exercise.supersetId;
            
            return (
              <View key={exercise.id} className="relative">
                {isSuperset && supersetNext && (
                  <View className="absolute left-4 top-full w-0.5 h-4 bg-primary z-10" />
                )}
                
                <GlassCard className="overflow-hidden p-0">
                  {/* Exercise Header */}
                  <View className="flex-row items-center justify-between p-4 border-b border-border/50">
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
                  </View>

                  {/* Sets Table Header */}
                  <View className="flex-row px-4 py-2 bg-muted/30 border-b border-border/30">
                    <Text className="w-[12%] text-xs text-muted-foreground font-medium">SET</Text>
                    <Text className="w-[28%] text-xs text-muted-foreground font-medium">PREV</Text>
                    <Text className="w-[20%] text-xs text-muted-foreground font-medium">{unit.toUpperCase()}</Text>
                    <Text className="w-[20%] text-xs text-muted-foreground font-medium">REPS</Text>
                    <Text className="w-[20%] text-xs text-muted-foreground font-medium text-center">✓</Text>
                  </View>

                  {/* Warmup sets */}
                  {warmupMode && exIndex === 0 && (
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
                      <Text className="w-[28%] text-xs text-muted-foreground">
                        {set.prevWeight} × {set.prevReps}
                      </Text>
                      <View className="w-[20%]">
                        <TextInput
                          keyboardType="numeric"
                          value={set.weight}
                          onChangeText={(text) => handleInputChange(exercise.id, set.id, 'weight', text)}
                          className="h-8 text-center text-sm bg-background text-foreground rounded border border-border px-2"
                          placeholder={String(deloadMode ? Math.round((set.prevWeight || 0) * 0.6) : set.prevWeight)}
                          placeholderTextColor="#71717A"
                        />
                      </View>
                      <View className="w-[20%]">
                        <TextInput
                          keyboardType="numeric"
                          value={set.reps}
                          onChangeText={(text) => handleInputChange(exercise.id, set.id, 'reps', text)}
                          className="h-8 text-center text-sm bg-background text-foreground rounded border border-border px-2"
                          placeholder={String(set.prevReps)}
                          placeholderTextColor="#71717A"
                        />
                      </View>
                      <View className="w-[20%] items-center">
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
                    </View>
                  ))}

                  {/* Add Set */}
                  <Pressable 
                    className="py-3 items-center justify-center flex-row gap-2"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Plus size={16} color="#31D5E3" />
                    <Text className="text-sm text-primary">Add Set</Text>
                  </Pressable>
                </GlassCard>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Finish Button */}
      <View className="absolute bottom-4 left-4 right-4">
        <Button 
          onPress={() => router.back()}
          className="w-full bg-primary h-12"
        >
          <Flame size={20} color="#FFFFFF" />
          <Text className="text-primary-foreground font-semibold ml-2">Finish Workout</Text>
        </Button>
      </View>

      {/* Rest Timer Modal */}
      {showRestTimer && (
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
                <Text className="text-5xl font-bold font-mono text-foreground">{formatTime(restTime)}</Text>
                <Text className="text-sm text-muted-foreground mt-1">/ {formatTime(targetRestTime)}</Text>
              </View>
            </View>

            <View className="flex-row gap-4">
              <Button
                variant="outline"
                size="lg"
                onPress={() => setShowRestTimer(false)}
                className="min-w-[128px]"
              >
                <SkipForward size={16} color="#A1A1AA" />
                <Text className="text-foreground ml-2">Skip</Text>
              </Button>
              <Button
                size="lg"
                onPress={() => setShowRestTimer(false)}
                className="min-w-[128px] bg-primary"
              >
                <Text className="text-primary-foreground font-semibold">I'm Ready</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* Settings Menu Modal */}
      <Dialog open={showMenu} onOpenChange={setShowMenu}>
        <DialogContent>
          <DialogHeader onClose={() => setShowMenu(false)}>
            <DialogTitle>Workout Options</DialogTitle>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Warm-up Sets</Text>
              <Switch value={warmupMode} onValueChange={setWarmupMode} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Deload Mode (-40%)</Text>
              <Switch value={deloadMode} onValueChange={setDeloadMode} />
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
    </SafeAreaView>
  );
}
