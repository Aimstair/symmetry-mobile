import { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Video, ResizeMode } from 'expo-av';
import { getVideoForExercise } from '@/lib/videoRegistry';
import { useCachedVideo } from '@/lib/videoCaching';
import {
  Check,
  RefreshCw,
  History,
  ChevronRight,
  Lightbulb,
  Target,
  AlertCircle,
  X,
  Trash2,
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
  catalogExerciseId?: string;
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
  onRestSecondsChange?: (exerciseId: string, catalogExerciseId: string, restSeconds: number) => void | Promise<void>;
  onViewHistory: (exerciseId: string) => void;
  onRemoveSet?: (exerciseId: string, setId: number) => void;
  unit: 'kg' | 'lbs';
  deloadMode: boolean;
  isRestSecondsSaving?: boolean;
}

export function ExerciseDetailSheet({
  exercise,
  isOpen,
  onClose,
  onSetComplete,
  onInputChange,
  onSwapExercise,
  onRestSecondsChange,
  onViewHistory,
  onRemoveSet,
  unit,
  deloadMode,
  isRestSecondsSaving = false,
}: ExerciseDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const [showSwapOptions, setShowSwapOptions] = useState(false);
  const [restSecondsInput, setRestSecondsInput] = useState('');
  const [restSecondsError, setRestSecondsError] = useState<string | null>(null);
  const [restSecondsNotice, setRestSecondsNotice] = useState<string | null>(null);
  const [catalogExercise, setCatalogExercise] = useState<CatalogExercise | null>(null);
  const [alternatives, setAlternatives] = useState<CatalogExercise[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const videoRef = useRef<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const lookupExerciseId = exercise?.catalogExerciseId || exercise?.id || '';
  
  // CRITICAL: Call useCachedVideo hook BEFORE any conditional returns to follow React's Rules of Hooks
  const exerciseId = catalogExercise ? catalogExercise.id : lookupExerciseId;
  const resolvedRegistrySource = (exerciseId ? getVideoForExercise(exerciseId) : null)
    || (exercise?.name ? getVideoForExercise(exercise.name) : null);

  const remoteVideoUrl = typeof resolvedRegistrySource === 'string' ? resolvedRegistrySource : null;
  const { uri: videoUri, isLocal: isVideoCached, isLoading: isVideoLoading } = useCachedVideo(remoteVideoUrl);

  const playbackSource =
    typeof resolvedRegistrySource === 'number'
      ? resolvedRegistrySource
      : videoUri
        ? { uri: videoUri }
        : null;
  
  // Fetch exercise details and alternatives when exercise changes
  useEffect(() => {
    if (!exercise || !isOpen || !lookupExerciseId) return;
    
    let mounted = true;
    
    const loadExerciseData = async () => {
      setIsLoadingDetails(true);
      try {
        // Fetch catalog exercise details
        const catalogData = await dataService.exercise.getExercise(lookupExerciseId);
        if (mounted && catalogData) {
          setCatalogExercise(catalogData);
        }
        
        // Fetch alternatives
        const alts = await dataService.exercise.getAlternatives(lookupExerciseId);
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
  }, [exercise?.id, exercise?.catalogExerciseId, isOpen, lookupExerciseId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowSwapOptions(false);
      setCatalogExercise(null);
      setAlternatives([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!exercise) return;
    setRestSecondsInput(String(exercise.restSeconds || 90));
    setRestSecondsError(null);
    setRestSecondsNotice(null);
  }, [exercise?.id, exercise?.restSeconds]);

  useEffect(() => {
    if (isOpen) {
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, {
        toValue: 1,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, sheetAnim]);
  
  if (!exercise) return null;

  // Use catalog data if available, otherwise fallback to defaults
  const details = {
    description: catalogExercise?.description || 'A strength training exercise targeting multiple muscle groups.',
    muscleGroups: catalogExercise?.muscleGroups || ['Primary', 'Secondary'],
    tips: catalogExercise?.tips || ['Focus on controlled movements', 'Maintain proper form throughout'],
    formCues: catalogExercise?.formCues || ['Setup properly', 'Breathe consistently'],
    videoUrl: catalogExercise?.videoUrl,
  };
  
  // Debug: Log exercise ID to help match with video registry
  if (__DEV__ && !resolvedRegistrySource) {
    console.log('🎥 No video found for exercise ID:', exerciseId, '| Exercise name:', exercise.name);
  }

  const handleSaveRestSeconds = async () => {
    if (!onRestSecondsChange || !exercise) return;

    const parsed = parseInt(restSecondsInput.trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 1800) {
      setRestSecondsError('Enter a value between 1 and 1800 seconds.');
      setRestSecondsNotice(null);
      return;
    }

    if (parsed === exercise.restSeconds) {
      setRestSecondsError(null);
      setRestSecondsNotice('Already set to this value.');
      return;
    }

    setRestSecondsError(null);
    setRestSecondsNotice(null);

    try {
      await onRestSecondsChange(exercise.id, exercise.catalogExerciseId || exercise.id, parsed);
      setRestSecondsInput(String(parsed));
      setRestSecondsNotice('Rest timer saved.');
    } catch {
      setRestSecondsError('Unable to sync right now. Changes are stored locally.');
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="none"
      transparent={true}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <Animated.View
          className="absolute inset-0 bg-black/80"
          style={{ opacity: sheetAnim }}
        />
        {/* Background overlay - tap to close */}
        <Pressable 
          className="flex-1" 
          onPress={onClose}
        />
        
        {/* Bottom sheet content */}
        <Animated.View
          className="h-[90%] bg-background rounded-t-3xl border-t border-border overflow-hidden"
          style={{
            opacity: sheetAnim,
            transform: [
              {
                translateY: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [140, 0],
                }),
              },
            ],
          }}
        >
          {/* Sticky Header */}
          <View className="border-b border-border bg-card">
            <View className="flex-row items-center justify-between p-4 pb-2">
              <View className="flex-1">
                <Text className="text-lg font-bold text-foreground">{exercise.name}</Text>
              </View>
              <Pressable onPress={onClose} className="p-2">
                <X size={20} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>
  
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 20) }}
          >
            <View className="p-4 gap-4">
              {/* Video/Animation Placeholder */}
              <GlassCard className="overflow-hidden p-0">
                {isVideoLoading ? (
                  <View className="bg-muted/50 items-center justify-center" style={{ aspectRatio: 16 / 9 }}>
                    <ActivityIndicator size="large" color="#31D5E3" />
                    <Text className="text-sm text-muted-foreground mt-3">Loading video...</Text>
                  </View>
                ) : playbackSource ? (
                  <View>
                    <Video
                      ref={videoRef}
                      source={playbackSource as any}
                      style={{ width: '100%', aspectRatio: 16 / 9 }}
                      resizeMode={ResizeMode.COVER}
                      useNativeControls={true}
                      isLooping={true}
                      shouldPlay={true}
                      isMuted={true}
                    />
                    {typeof resolvedRegistrySource === 'string' && isVideoCached && (
                      <View className="absolute top-2 right-2 bg-success/80 px-2 py-1 rounded-full">
                        <Text className="text-xs text-white">Cached</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  /* Fallback Placeholder */
                  <View className="bg-muted/50 items-center justify-center relative" style={{ aspectRatio: 16 / 9 }}>
                    <View className="w-24 h-24 rounded-full bg-muted/20 items-center justify-center">
                      <AlertCircle size={40} color="#71717A" style={{ opacity: 0.5 }} />
                    </View>
                    <Text className="text-sm text-muted-foreground mt-3">
                      No demonstration video available
                    </Text>
                  </View>
                )}
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

                <View className="px-4 py-3 border-b border-border/30 bg-muted/20">
                  <Text className="text-xs text-muted-foreground mb-2">Rest Between Sets (sec)</Text>
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      keyboardType="number-pad"
                      value={restSecondsInput}
                      onChangeText={(text) => {
                        setRestSecondsInput(text);
                        if (restSecondsError) {
                          setRestSecondsError(null);
                        }
                      }}
                      className="flex-1 h-10 text-center text-sm rounded border px-2 bg-background text-foreground border-border"
                      placeholder="90"
                      placeholderTextColor="#71717A"
                    />
                    <Button
                      size="sm"
                      onPress={() => {
                        void handleSaveRestSeconds();
                      }}
                      disabled={isRestSecondsSaving || !onRestSecondsChange}
                    >
                      {isRestSecondsSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-primary-foreground font-medium">Save</Text>
                      )}
                    </Button>
                  </View>
                  {restSecondsError && (
                    <Text className="text-xs text-destructive mt-2">{restSecondsError}</Text>
                  )}
                  {!restSecondsError && restSecondsNotice && (
                    <Text className="text-xs text-success mt-2">{restSecondsNotice}</Text>
                  )}
                </View>
                
                {/* Table Header */}
                <View className="flex-row px-4 py-2 bg-muted/30 border-b border-border/30">
                  <Text className="w-[12%] text-xs text-muted-foreground font-medium">SET</Text>
                  <Text className="w-[25%] text-xs text-muted-foreground font-medium">PREV</Text>
                  <Text className="w-[18%] text-xs text-muted-foreground font-medium">{unit.toUpperCase()}</Text>
                  <Text className="w-[18%] text-xs text-muted-foreground font-medium">REPS</Text>
                  <Text className="w-[15%] text-xs text-muted-foreground font-medium text-center">✓</Text>
                  <Text className="w-[12%] text-xs text-muted-foreground font-medium text-center"></Text>
                </View>

                {exercise.sets.map((set) => (
                  <View
                    key={set.id}
                    className={cn(
                      'flex-row px-4 py-3 items-center border-b border-border/30',
                      set.completed && 'bg-success/10'
                    )}
                  >
                    <Text className={cn(
                      'w-[12%] text-sm font-medium',
                      set.completed ? 'text-success' : 'text-foreground'
                    )}>{set.id}</Text>
                    <Text className="w-[25%] text-xs text-muted-foreground">
                      {set.prevWeight} × {set.prevReps}
                    </Text>
                    <View className="w-[18%]">
                      <TextInput
                        keyboardType="numeric"
                        value={set.weight}
                        onChangeText={(text) => onInputChange(exercise.id, set.id, 'weight', text)}
                        className={cn(
                          'h-8 text-center text-sm rounded border px-2',
                          set.completed 
                            ? 'bg-success/20 text-success border-success/30' 
                            : 'bg-background text-foreground border-border'
                        )}
                        placeholder={set.prevWeight ? String(deloadMode ? Math.round(set.prevWeight * 0.6) : set.prevWeight) : '—'}
                        placeholderTextColor="#71717A"
                        textAlignVertical="center"
                        style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                        editable={!set.completed}
                      />
                    </View>
                    <View className="w-[18%]">
                      <TextInput
                        keyboardType="numeric"
                        value={set.reps}
                        onChangeText={(text) => onInputChange(exercise.id, set.id, 'reps', text)}
                        className={cn(
                          'h-8 text-center text-sm rounded border px-2',
                          set.completed 
                            ? 'bg-success/20 text-success border-success/30' 
                            : 'bg-background text-foreground border-border'
                        )}
                        placeholder={set.prevReps ? String(set.prevReps) : '—'}
                        placeholderTextColor="#71717A"
                        textAlignVertical="center"
                        style={{ paddingTop: 0, paddingBottom: 0, lineHeight: 18 }}
                        editable={!set.completed}
                      />
                    </View>
                    <View className="w-[15%] items-center">
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
                    <View className="w-[12%] items-center">
                      {exercise.sets.length > 1 && onRemoveSet && !set.completed && (
                        <Pressable
                          onPress={() => onRemoveSet(exercise.id, set.id)}
                          className="h-8 w-8 rounded items-center justify-center"
                          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </Pressable>
                      )}
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
                      onViewHistory(exercise.catalogExerciseId || exercise.id);
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
        </Animated.View>
      </View>
    </Modal>
  );
}

