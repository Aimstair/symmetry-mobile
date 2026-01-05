import { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { useExercises } from '@/hooks/useExercises';
import { ChevronLeft, Plus, X, Check, Search } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import type { WorkoutPlan, WorkoutDay, PlanExercise, CatalogExercise } from '@/types';

interface SelectedExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes?: string;
}

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
];

export default function WorkoutBuilder() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; dayName?: string }>();
  
  // Store
  const user = useAppStore((s) => s.user);
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const syncWorkoutPlanToCloud = useAppStore((s) => s.syncWorkoutPlanToCloud);
  const syncUpdateWorkoutPlanToCloud = useAppStore((s) => s.syncUpdateWorkoutPlanToCloud);
  const addWorkoutPlan = useAppStore((s) => s.addWorkoutPlan);

  // Get exercises from catalog
  const { exercises, isLoading: exercisesLoading } = useExercises();

  // State
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Filtered exercises based on search and selected muscle groups
  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    // Filter by selected muscle groups
    if (selectedMuscleGroups.length > 0) {
      filtered = filtered.filter((exercise) =>
        exercise.muscleGroups.some((mg) => selectedMuscleGroups.includes(mg))
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((exercise) =>
        exercise.name.toLowerCase().includes(query) ||
        exercise.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [exercises, selectedMuscleGroups, searchQuery]);

  // Already selected exercise IDs
  const selectedExerciseIds = useMemo(
    () => selectedExercises.map((e) => e.exerciseId),
    [selectedExercises]
  );

  const toggleMuscleGroup = (muscle: string) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const addExercise = (exercise: CatalogExercise) => {
    if (selectedExerciseIds.includes(exercise.id)) return;

    const newExercise: SelectedExercise = {
      exerciseId: exercise.id,
      targetSets: 3,
      targetReps: '10-12',
      restSeconds: 90,
    };

    setSelectedExercises((prev) => [...prev, newExercise]);
    setShowExercisePicker(false);
  };

  const removeExercise = (exerciseId: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
  };

  const updateExercise = (exerciseId: string, updates: Partial<SelectedExercise>) => {
    setSelectedExercises((prev) =>
      prev.map((e) => (e.exerciseId === exerciseId ? { ...e, ...updates } : e))
    );
  };

  const getExerciseDetails = (exerciseId: string): CatalogExercise | undefined => {
    return exercises.find((e) => e.id === exerciseId);
  };

  const handleSave = async () => {
    if (!user || selectedExercises.length === 0) {
      alert('Please add at least one exercise');
      return;
    }

    setIsSaving(true);

    try {
      const activePlan = workoutPlans.length > 0 ? workoutPlans[0] : null;
      const targetDate = params.date ? new Date(params.date) : new Date();
      const targetDayName = params.dayName || targetDate.toLocaleDateString('en-US', { weekday: 'long' });

      if (activePlan) {
        // Update existing plan
        const workoutDayId = Crypto.randomUUID();
        const newWorkoutDay: WorkoutDay = {
          id: workoutDayId,
          planId: activePlan.id,
          orderIndex: activePlan.workoutDays.length,
          name: `${targetDayName} - Custom`,
          muscleGroups: selectedMuscleGroups,
          exercises: selectedExercises.map((ex, idx) => ({
            id: Crypto.randomUUID(),
            workoutDayId,
            exerciseId: ex.exerciseId,
            orderIndex: idx,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            restSeconds: ex.restSeconds,
            notes: ex.notes,
            exercise: getExerciseDetails(ex.exerciseId),
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updatedPlan = await syncUpdateWorkoutPlanToCloud(activePlan.id, {
          workoutDays: [...activePlan.workoutDays, newWorkoutDay],
          updatedAt: new Date(),
        });

        console.log('✅ Updated existing plan with new workout day:', updatedPlan.id);
      } else {
        // Create new custom plan
        const planId = Crypto.randomUUID();
        const workoutDayId = Crypto.randomUUID();

        const newPlan: WorkoutPlan = {
          id: planId,
          userId: user.id,
          name: 'Custom Plan',
          description: 'User-generated workout plan',
          type: 'custom',
          daysPerWeek: 1,
          workoutDays: [
            {
              id: workoutDayId,
              planId,
              orderIndex: 0,
              name: `${targetDayName} - Custom`,
              muscleGroups: selectedMuscleGroups,
              exercises: selectedExercises.map((ex, idx) => ({
                id: Crypto.randomUUID(),
                workoutDayId,
                exerciseId: ex.exerciseId,
                orderIndex: idx,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps,
                restSeconds: ex.restSeconds,
                notes: ex.notes,
                exercise: getExerciseDetails(ex.exerciseId),
              })),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const savedPlan = await syncWorkoutPlanToCloud(newPlan);
        console.log('✅ Created new custom plan:', savedPlan.id);
      }

      // Navigate back to workout plan screen
      router.back();
    } catch (error) {
      console.error('❌ Failed to save workout:', error);
      alert('Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (exercisesLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#31D5E3" />
        <Text className="text-muted-foreground mt-4">Loading exercises...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-muted items-center justify-center"
              >
                <ChevronLeft size={20} color="#A1A1AA" />
              </Pressable>
              <View>
                <Text className="text-2xl font-bold text-foreground">Build Workout</Text>
                <Text className="text-sm text-muted-foreground">
                  {params.dayName || 'Custom Routine'}
                </Text>
              </View>
            </View>
          </View>

          {/* Muscle Group Selection */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Target Muscle Groups
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MUSCLE_GROUPS.map((muscle) => (
                <Pressable
                  key={muscle}
                  onPress={() => toggleMuscleGroup(muscle)}
                  className={cn(
                    'px-4 py-2 rounded-full border',
                    selectedMuscleGroups.includes(muscle)
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      selectedMuscleGroups.includes(muscle)
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {muscle}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Selected Exercises */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Exercises ({selectedExercises.length})
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowExercisePicker(true)}
                className="flex-row items-center"
              >
                <Plus size={16} color="#31D5E3" />
                <Text className="text-primary ml-1">Add</Text>
              </Button>
            </View>

            {selectedExercises.length === 0 ? (
              <GlassCard className="items-center py-8">
                <Text className="text-muted-foreground">No exercises added yet</Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  Tap "Add" to select exercises
                </Text>
              </GlassCard>
            ) : (
              <View className="gap-3">
                {selectedExercises.map((ex, idx) => {
                  const details = getExerciseDetails(ex.exerciseId);
                  return (
                    <GlassCard key={ex.exerciseId} className="py-3">
                      <View className="flex-row items-center gap-3 mb-3">
                        <View className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Text className="text-sm font-bold text-foreground">{idx + 1}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="font-medium text-sm text-foreground">
                            {details?.name || ex.exerciseId}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {details?.muscleGroups.join(' • ')}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => removeExercise(ex.exerciseId)}
                          className="w-8 h-8 items-center justify-center"
                        >
                          <X size={16} color="#71717A" />
                        </Pressable>
                      </View>

                      {/* Exercise Parameters */}
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <Text className="text-xs text-muted-foreground mb-1">Sets</Text>
                          <TextInput
                            value={String(ex.targetSets)}
                            onChangeText={(text) =>
                              updateExercise(ex.exerciseId, {
                                targetSets: parseInt(text) || 3,
                              })
                            }
                            keyboardType="number-pad"
                            className="bg-muted rounded-lg px-3 py-2 text-foreground"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs text-muted-foreground mb-1">Reps</Text>
                          <TextInput
                            value={ex.targetReps}
                            onChangeText={(text) =>
                              updateExercise(ex.exerciseId, { targetReps: text })
                            }
                            className="bg-muted rounded-lg px-3 py-2 text-foreground"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs text-muted-foreground mb-1">Rest (s)</Text>
                          <TextInput
                            value={String(ex.restSeconds)}
                            onChangeText={(text) =>
                              updateExercise(ex.exerciseId, {
                                restSeconds: parseInt(text) || 90,
                              })
                            }
                            keyboardType="number-pad"
                            className="bg-muted rounded-lg px-3 py-2 text-foreground"
                          />
                        </View>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            )}
          </View>

          {/* Save Button */}
          <Button
            onPress={handleSave}
            disabled={selectedExercises.length === 0 || isSaving}
            className="w-full bg-primary h-12"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Check size={20} color="#FFFFFF" />
                <Text className="text-primary-foreground font-semibold ml-2">Save Workout</Text>
              </>
            )}
          </Button>
        </View>
      </ScrollView>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <View className="absolute inset-0 bg-black/80">
          <SafeAreaView edges={['top', 'bottom']} className="flex-1">
            <View className="flex-1 px-4 py-6">
              {/* Modal Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-foreground">Select Exercise</Text>
                <Pressable
                  onPress={() => setShowExercisePicker(false)}
                  className="w-10 h-10 rounded-full bg-muted items-center justify-center"
                >
                  <X size={20} color="#A1A1AA" />
                </Pressable>
              </View>

              {/* Search Bar */}
              <View className="mb-4">
                <View className="flex-row items-center bg-muted rounded-lg px-3 py-2">
                  <Search size={18} color="#71717A" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search exercises..."
                    placeholderTextColor="#71717A"
                    className="flex-1 ml-2 text-foreground"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <X size={16} color="#71717A" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Exercise List */}
              <ScrollView className="flex-1">
                <View className="gap-2 pb-4">
                  {filteredExercises.map((exercise) => {
                    const isSelected = selectedExerciseIds.includes(exercise.id);
                    return (
                      <Pressable
                        key={exercise.id}
                        onPress={() => !isSelected && addExercise(exercise)}
                        disabled={isSelected}
                        className={cn(
                          'border border-border rounded-lg p-3',
                          isSelected ? 'bg-muted/50 opacity-50' : 'bg-card'
                        )}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 mr-3">
                            <Text className="font-medium text-foreground">{exercise.name}</Text>
                            <Text className="text-xs text-muted-foreground mt-1">
                              {exercise.muscleGroups.join(' • ')}
                            </Text>
                          </View>
                          {isSelected && <Check size={20} color="#4ADE80" />}
                        </View>
                      </Pressable>
                    );
                  })}
                  {filteredExercises.length === 0 && (
                    <View className="items-center py-8">
                      <Text className="text-muted-foreground">No exercises found</Text>
                      <Text className="text-xs text-muted-foreground mt-1">
                        Try adjusting your filters
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}
