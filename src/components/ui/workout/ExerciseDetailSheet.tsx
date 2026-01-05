import { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
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
import { dataService } from '@/services/dataServiceProvider';
import type { CatalogExercise } from '@/types';

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
  const [catalogExercise, setCatalogExercise] = useState<CatalogExercise | null>(null);
  const [alternatives, setAlternatives] = useState<CatalogExercise[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Fetch exercise details and alternatives when exercise changes
  useEffect(() => {
    if (!exercise || !isOpen) return;
    
    let mounted = true;
    
    const loadExerciseData = async () => {
      setIsLoadingDetails(true);
      try {
        // Fetch catalog exercise details
        const catalogData = await dataService.exercise.getExercise(exercise.id);
        if (mounted && catalogData) {
          setCatalogExercise(catalogData);
        }
        
        // Fetch alternatives
        const alts = await dataService.exercise.getAlternatives(exercise.id);
        if (mounted) {
          setAlternatives(alts);
        }
      } catch (error) {
        console.error('Failed to load exercise details:', error);
      } finally {
        if (mounted) {
          setIsLoadingDetails(false);
        }
      }
    };
    
    loadExerciseData();
    
    return () => {
      mounted = false;
    };
  }, [exercise?.id, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowSwapOptions(false);
      setCatalogExercise(null);
      setAlternatives([]);
    }
  }, [isOpen]);
  
  if (!exercise) return null;

  // Use catalog data if available, otherwise fallback to defaults
  const details = {
    description: catalogExercise?.description || 'A strength training exercise targeting multiple muscle groups.',
    muscleGroups: catalogExercise?.muscleGroups || ['Primary', 'Secondary'],
    tips: catalogExercise?.tips || ['Focus on controlled movements', 'Maintain proper form throughout'],
    formCues: catalogExercise?.formCues || ['Setup properly', 'Breathe consistently'],
    videoUrl: catalogExercise?.videoUrl,
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
              </View>
              <Pressable onPress={onClose} className="p-2">
                <X size={20} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>
  
          <ScrollView className="flex-1">
            <View className="p-4 gap-4 pb-8">
              {/* Video/Animation Placeholder */}
              <GlassCard className="overflow-hidden p-0">
                <View className="bg-muted/50 items-center justify-center relative" style={{ aspectRatio: 16/9 }}>
                  <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center">
                    <Play size={40} color="#31D5E3" style={{ marginLeft: 4 }} />
                  </View>
                  <Text className="text-sm text-muted-foreground mt-3">Tap to play form video</Text>
                </View>
              </GlassCard>

              {/* Muscle Groups */}
              <GlassCard>
                <View className="flex-row items-center gap-2 mb-3">
                  <Target size={16} color="#31D5E3" />
                  <Text className="font-semibold text-sm text-foreground">Muscles Targeted</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {details.muscleGroups.map((muscle, i) => (
                    <View key={i} className="px-3 py-1 bg-primary/10 rounded-full">
                      <Text className="text-xs text-primary">{muscle}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>

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
              </GlassCard>

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
                  ))}
                </View>
              </GlassCard>
              
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
                        textAlignVertical="center"
                        style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
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
                        textAlignVertical="center"
                        style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
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
                    onPress={() => {
                      onViewHistory(exercise.id);
                      onClose();
                    }}
                  >
                    <History size={16} color="#31D5E3" />
                    <Text className="text-foreground ml-2">History</Text>
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
              </View>

              {/* Swap Options */}
              {showSwapOptions && (
                <GlassCard>
                  <View className="flex-row items-center gap-2 mb-3">
                    <AlertCircle size={16} color="#F59E0B" />
                    <Text className="font-semibold text-sm text-foreground">Alternative Exercises</Text>
                  </View>
                  {isLoadingDetails ? (
                    <View className="py-4 items-center">
                      <ActivityIndicator size="small" color="#31D5E3" />
                      <Text className="text-sm text-muted-foreground mt-2">Loading alternatives...</Text>
                    </View>
                  ) : alternatives.length > 0 ? (
                    <View className="gap-2">
                      {alternatives.map((alt) => (
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
                          <Text className="text-xs text-muted-foreground">
                            {alt.muscleGroups.slice(0, 2).join(', ')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-sm text-muted-foreground text-center py-2">
                      No alternatives available for this exercise
                    </Text>
                  )}
                </GlassCard>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
