import { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import {
  Timer,
  Check,
  Play,
  RefreshCw,
  History,
  ChevronRight,
  Lightbulb,
  Target,
  AlertCircle,
  X,
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

// Mock exercise details database
const exerciseDetails: Record<string, {
  description: string;
  muscleGroups: string[];
  tips: string[];
  formCues: string[];
  videoPlaceholder: string;
  alternatives: { id: string; name: string; reason: string }[];
}> = {
  '1': {
    description: 'The barbell bench press is a compound movement that primarily targets the chest, with secondary involvement of the shoulders and triceps.',
    muscleGroups: ['Chest', 'Front Delts', 'Triceps'],
    tips: [
      'Keep your feet flat on the floor for stability',
      'Retract and depress your shoulder blades',
      'Lower the bar to your mid-chest with control',
      'Drive through your feet as you press up',
    ],
    formCues: [
      'Grip: Slightly wider than shoulder-width',
      'Arch: Maintain natural spine arch',
      'Elbows: 45-75° angle from torso',
      'Touch: Bar touches mid-chest',
    ],
    videoPlaceholder: 'bench-press',
    alternatives: [
      { id: 'alt1', name: 'Dumbbell Bench Press', reason: 'No barbell available' },
      { id: 'alt2', name: 'Push-ups', reason: 'Bodyweight alternative' },
      { id: 'alt3', name: 'Machine Chest Press', reason: 'Easier setup' },
    ],
  },
  '2': {
    description: 'The incline dumbbell press targets the upper portion of the chest while also engaging the shoulders and triceps.',
    muscleGroups: ['Upper Chest', 'Front Delts', 'Triceps'],
    tips: [
      'Set bench to 30-45 degree angle',
      'Keep dumbbells in line with upper chest',
      'Control the weight on the way down',
      'Press dumbbells together at the top',
    ],
    formCues: [
      'Angle: 30-45 degrees',
      'Path: Press up and slightly in',
      'Grip: Neutral or angled',
      'Range: Full stretch at bottom',
    ],
    videoPlaceholder: 'incline-db-press',
    alternatives: [
      { id: 'alt1', name: 'Incline Barbell Press', reason: 'Heavier loading' },
      { id: 'alt2', name: 'Low-to-High Cable Fly', reason: 'Constant tension' },
      { id: 'alt3', name: 'Landmine Press', reason: 'Shoulder-friendly' },
    ],
  },
  '3': {
    description: 'Cable flyes isolate the chest muscles through a horizontal adduction movement pattern, providing constant tension throughout the range.',
    muscleGroups: ['Chest', 'Front Delts'],
    tips: [
      'Keep a slight bend in your elbows',
      'Focus on squeezing your chest at the peak',
      'Control the negative portion',
      'Think about hugging a tree',
    ],
    formCues: [
      'Stance: Staggered for stability',
      'Arms: Slight elbow bend maintained',
      'Path: Arc motion, not pressing',
      'Peak: Squeeze chest hard at center',
    ],
    videoPlaceholder: 'cable-flyes',
    alternatives: [
      { id: 'alt1', name: 'Dumbbell Flyes', reason: 'No cables available' },
      { id: 'alt2', name: 'Pec Deck Machine', reason: 'Easier to control' },
      { id: 'alt3', name: 'Resistance Band Flyes', reason: 'Home gym option' },
    ],
  },
};

interface ExerciseDetailSheetProps {
  exercise: ExerciseData | null;
  isOpen: boolean;
  onClose: () => void;
  onSetComplete: (exerciseId: string, setId: number) => void;
  onInputChange: (exerciseId: string, setId: number, field: 'weight' | 'reps', value: string) => void;
  onSwapExercise: (exerciseId: string, newExerciseId: string, newName: string) => void;
  onViewHistory: (exerciseId: string) => void;
  elapsedTime: number;
  unit: 'kg' | 'lbs';
  deloadMode: boolean;
}

export function ExerciseDetailSheet({
  exercise,
  isOpen,
  onClose,
  onSetComplete,
  onInputChange,
  onSwapExercise,
  onViewHistory,
  elapsedTime,
  unit,
  deloadMode,
}: ExerciseDetailSheetProps) {
  const [showSwapOptions, setShowSwapOptions] = useState(false);
  
  if (!exercise) return null;

  const details = exerciseDetails[exercise.id] || {
    description: 'A strength training exercise targeting multiple muscle groups.',
    muscleGroups: ['Primary', 'Secondary'],
    tips: ['Focus on controlled movements', 'Maintain proper form throughout'],
    formCues: ['Setup properly', 'Breathe consistently'],
    videoPlaceholder: 'exercise',
    alternatives: [],
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80">
        {/* Background overlay - tap to close */}
        <Pressable 
          className="flex-1" 
          onPress={onClose}
        />
        
        {/* Bottom sheet content */}
        <View className="h-[90%] bg-background rounded-t-3xl border-t border-border overflow-hidden">
          {/* Sticky Header */}
          <View className="border-b border-border bg-card">
            <View className="flex-row items-center justify-between p-4 pb-2">
              <View className="flex-1">
                <Text className="text-lg font-bold text-foreground">{exercise.name}</Text>
              </View>
              <View className="flex-row items-center gap-2 mr-2">
                <Timer size={16} color="#31D5E3" />
                <Text className="font-mono font-bold text-foreground">{formatTime(elapsedTime)}</Text>
              {/* Video Placeholder */}
              <GlassCard className="overflow-hidden p-0">
                <View className="bg-muted/50 items-center justify-center relative" style={{ aspectRatio: 16/9 }}>
                  <View className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center">
                    <Play size={40} color="#31D5E3" style={{ marginLeft: 4 }} />
                  </View>
                  <Text className="text-sm text-muted-foreground mt-3">Tap to play form video</Text>
                </View>
  
          <ScrollView className="flex-1">
            <View className="p-4 gap-4 pb-8">
            {/* Video/Animation Placeholder */}
            <GlassCard noPadding className="overflow-hidden">
              <div className="aspect-video bg-muted/50 flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <motion.div
                  className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Play className="w-10 h-10 text-primary ml-1" />
                </motion.div>
                <p className="text-sm text-muted-foreground mt-3 relative z-10">Tap to play form video</p>
              </div>
            </GlassCard>

            {/* Form Cues */}
            <GlassCard>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
              {/* Form Cues */}
              <GlassCard>
                <View className="flex-row items-center gap-2 mb-3">
                  <Target size={16} color="#31D5E3" />
                  <Text className="font-semibold text-sm text-foreground">Form Cues</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {details.formCues.map((cue, i) => (
                    <View key={i} className="flex-1 min-w-[45%] p-2 bg-muted/30 rounded-lg">
                      <Text className="text-xs text-foreground">{cue}</Text>
                    </View>
                  ))}
                </View>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-warning" />
              {/* Tips */}
              <GlassCard>
                <View className="flex-row items-center gap-2 mb-3">
                  <Lightbulb size={16} color="#F59E0B" />
                  <Text className="font-semibold text-sm text-foreground">Pro Tips</Text>
                </View>
                <View className="gap-2">
                  {details.tips.map((tip, i) => (
                    <View key={i} className="flex-row items-start gap-2">
                      <ChevronRight size={16} color="#31D5E3" style={{ marginTop: 2, flexShrink: 0 }} />
                      <Text className="text-sm text-muted-foreground flex-1">{tip}</Text>
                    </View>
              {/* Set Logging */}
              <GlassCard className="p-0 overflow-hidden">
                <View className="p-4 border-b border-border/50">
                  <Text className="font-semibold text-sm text-foreground">Log Sets</Text>
                  <Text className="text-xs text-muted-foreground">{exercise.targetSets} sets × {exercise.targetReps} reps</Text>
                </View>
                
                {/* Table Header */}
                <View className="flex-row px-4 py-2 bg-muted/30 border-b border-border/30">
                  <Text className="w-[12%] text-xs text-muted-foreground font-medium">SET</Text>
                  <Text className="w-[28%] text-xs text-muted-foreground font-medium">PREV</Text>
                  <Text className="w-[20%] text-xs text-muted-foreground font-medium">{unit.toUpperCase()}</Text>
                  <Text className="w-[20%] text-xs text-muted-foreground font-medium">REPS</Text>
                  <Text className="w-[20%] text-xs text-muted-foreground font-medium text-center">✓</Text>
                </View>

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
                        onChangeText={(text) => onInputChange(exercise.id, set.id, 'weight', text)}
                        className="h-8 text-center text-sm bg-background text-foreground rounded border border-border px-2"
                        placeholder={String(deloadMode ? Math.round((set.prevWeight || 0) * 0.6) : set.prevWeight)}
                        placeholderTextColor="#71717A"
                      />
                    </View>
                    <View className="w-[20%]">
                      <TextInput
                        keyboardType="numeric"
                        value={set.reps}
                        onChangeText={(text) => onInputChange(exercise.id, set.id, 'reps', text)}
                        className="h-8 text-center text-sm bg-background text-foreground rounded border border-border px-2"
                        placeholder={String(set.prevReps)}
                        placeholderTextColor="#71717A"
                      />
                    </View>
                    <View className="w-[20%] items-center">
                      <Pressable
                        onPress={() => onSetComplete(exercise.id, set.id)}
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
              </GlassCard>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    variant="outline"
                    onPress={() => onViewHistory(exercise.id)}
                  >
                    <History size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-2">View History</Text>
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="outline"
                    onPress={() => setShowSwapOptions(!showSwapOptions)}
                  >
                    <RefreshCw size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-2">Swap</Text>
                  </Button>
                </View>
              {/* Swap Options */}
              {showSwapOptions && (
                <GlassCard>
                  <View className="flex-row items-center gap-2 mb-3">
                    <AlertCircle size={16} color="#F59E0B" />
                    <Text className="font-semibold text-sm text-foreground">Alternative Exercises</Text>
                  </View>
                  <View className="gap-2">
                    {details.alternatives.map((alt) => (
                      <Pressable
                        key={alt.id}
                        onPress={() => {
                          onSwapExercise(exercise.id, alt.id, alt.name);
                          setShowSwapOptions(false);
                          onClose();
                        }}
                        className="p-3 rounded-lg bg-muted/30"
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className="font-medium text-sm text-foreground">{alt.name}</Text>
                        <Text className="text-xs text-muted-foreground">{alt.reason}</Text>
                      </Pressable>
                    ))}
                  </View>
                </GlassCard>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modaliv>
      </SheetContent>
    </Sheet>
  );
}
