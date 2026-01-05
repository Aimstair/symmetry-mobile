import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataServiceProvider';
import { cn } from '@/lib/utils';
import { Dumbbell, Search, Plus, X } from 'lucide-react-native';
import type { CatalogExercise, PlanExercise } from '@/types';

interface AddExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExercise: (exercise: Omit<PlanExercise, 'id' | 'orderIndex'>) => void;
  /** Filter exercises to exclude already added ones */
  excludeExerciseIds?: string[];
}

export function AddExerciseModal({ 
  open, 
  onOpenChange,
  onAddExercise,
  excludeExerciseIds = [],
}: AddExerciseModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<CatalogExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<CatalogExercise | null>(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');

  // Load all exercises when modal opens
  useEffect(() => {
    if (open) {
      loadExercises();
    } else {
      // Reset state when modal closes
      setSearchQuery('');
      setSelectedExercise(null);
      setSets('3');
      setReps('10');
    }
  }, [open]);

  // Filter exercises when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredExercises(exercises.filter(e => !excludeExerciseIds.includes(e.id)));
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = exercises.filter(exercise => {
      if (excludeExerciseIds.includes(exercise.id)) return false;
      
      const nameMatch = exercise.name.toLowerCase().includes(query);
      const muscleMatch = exercise.muscleGroups.some(m => m.toLowerCase().includes(query));
      const equipmentMatch = exercise.equipment?.some(e => e.toLowerCase().includes(query));
      
      return nameMatch || muscleMatch || equipmentMatch;
    });
    
    setFilteredExercises(filtered);
  }, [searchQuery, exercises, excludeExerciseIds]);

  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const allExercises = await dataService.exercise.getExercises();
      setExercises(allExercises);
      setFilteredExercises(allExercises.filter(e => !excludeExerciseIds.includes(e.id)));
    } catch (error) {
      console.error('Failed to load exercises:', error);
      setExercises([]);
      setFilteredExercises([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) return;
    
    try {
      const results = await dataService.exercise.searchExercises(query);
      setFilteredExercises(results.filter(e => !excludeExerciseIds.includes(e.id)));
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [excludeExerciseIds]);

  const handleAddExercise = () => {
    if (!selectedExercise) return;

    const targetSets = parseInt(sets, 10) || 3;
    const targetReps = reps || '10'; // Keep as string for ranges like "8-12"

    onAddExercise({
      exerciseId: selectedExercise.id,
      exercise: selectedExercise,
      targetSets,
      targetReps,
      restSeconds: 90,
      workoutDayId: '', // Will be set by the parent
    });

    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader onClose={() => onOpenChange(false)}>
          <ModalTitle>Add Exercise</ModalTitle>
          <ModalDescription>
            Search and select an exercise to add to your workout
          </ModalDescription>
        </ModalHeader>

        {/* Search Input */}
        <View className="mb-4">
          <View className="flex-row items-center bg-muted/50 rounded-lg px-3 py-2 border border-border">
            <Search size={18} color="#71717A" />
            <TextInput
              className="flex-1 ml-2 text-foreground"
              placeholder="Search exercises..."
              placeholderTextColor="#71717A"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={18} color="#71717A" />
              </Pressable>
            )}
          </View>
        </View>

        <View className="min-h-[250px] max-h-[350px]">
          {isLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color="#31D5E3" />
              <Text className="text-muted-foreground mt-2">Loading exercises...</Text>
            </View>
          ) : selectedExercise ? (
            // Show selected exercise with sets/reps config
            <View className="flex-1">
              <View className="bg-primary/10 rounded-lg p-4 border border-primary mb-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-lg bg-primary items-center justify-center">
                    <Dumbbell size={24} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground text-lg">{selectedExercise.name}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {selectedExercise.muscleGroups.slice(0, 3).join(' • ')}
                    </Text>
                  </View>
                  <Pressable 
                    onPress={() => setSelectedExercise(null)}
                    className="p-2"
                  >
                    <X size={20} color="#71717A" />
                  </Pressable>
                </View>
              </View>

              {/* Sets and Reps Configuration */}
              <View className="gap-4">
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-muted-foreground mb-2">Sets</Text>
                    <TextInput
                      className="bg-muted/50 rounded-lg px-4 py-3 text-foreground text-center text-lg font-semibold border border-border"
                      value={sets}
                      onChangeText={setSets}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-muted-foreground mb-2">Reps</Text>
                    <TextInput
                      className="bg-muted/50 rounded-lg px-4 py-3 text-foreground text-center text-lg font-semibold border border-border"
                      value={reps}
                      onChangeText={setReps}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                </View>
              </View>
            </View>
          ) : filteredExercises.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {filteredExercises.slice(0, 20).map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => setSelectedExercise(exercise)}
                    className="p-3 rounded-lg border border-border bg-muted/30 active:bg-muted/50"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                        <Dumbbell size={18} color="#71717A" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-foreground">{exercise.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {exercise.muscleGroups.slice(0, 2).join(' • ')}
                          {exercise.equipment?.length ? ` • ${exercise.equipment[0]}` : ''}
                        </Text>
                      </View>
                      <Plus size={18} color="#31D5E3" />
                    </View>
                  </Pressable>
                ))}
                {filteredExercises.length > 20 && (
                  <Text className="text-center text-muted-foreground text-sm py-2">
                    Showing first 20 results. Refine your search for more.
                  </Text>
                )}
              </View>
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center py-8">
              <Dumbbell size={32} color="#71717A" style={{ opacity: 0.5 }} />
              <Text className="text-muted-foreground mt-3">No exercises found</Text>
              <Text className="text-xs text-muted-foreground mt-1 text-center px-4">
                Try a different search term
              </Text>
            </View>
          )}
        </View>

        <ModalFooter>
          <View className="flex-1">
            <Button variant="outline" onPress={() => onOpenChange(false)}>
              <Text className="text-foreground">Cancel</Text>
            </Button>
          </View>
          <View className="flex-1">
            <Button 
              className="bg-primary" 
              onPress={handleAddExercise}
              disabled={!selectedExercise}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text className="text-primary-foreground font-semibold ml-1">Add Exercise</Text>
            </Button>
          </View>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
