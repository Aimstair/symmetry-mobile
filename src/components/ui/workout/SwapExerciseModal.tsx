import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';
import { dataService } from '@/services/dataServiceProvider';
import { cn } from '@/lib/utils';
import { Dumbbell, RefreshCw } from 'lucide-react-native';
import type { CatalogExercise } from '@/types';

interface SwapExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string | null;
  exerciseName: string;
  onSwap: (newExerciseId: string, newExerciseName: string) => void;
}

export function SwapExerciseModal({ 
  open, 
  onOpenChange, 
  exerciseId, 
  exerciseName,
  onSwap 
}: SwapExerciseModalProps) {
  const [alternatives, setAlternatives] = useState<CatalogExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState<CatalogExercise | null>(null);
  const canConfirmSwap = !!selectedAlt && !isLoading;

  // Fetch alternatives when modal opens
  useEffect(() => {
    if (open && exerciseId) {
      loadAlternatives();
    } else {
      setAlternatives([]);
      setSelectedAlt(null);
    }
  }, [open, exerciseId]);

  const loadAlternatives = async () => {
    if (!exerciseId) return;
    
    setIsLoading(true);
    try {
      const alts = await dataService.exercise.getAlternatives(exerciseId);
      setAlternatives(alts);
    } catch (error) {
      console.error('Failed to load alternatives:', error);
      setAlternatives([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSwap = () => {
    if (selectedAlt) {
      onSwap(selectedAlt.id, selectedAlt.name);
      onOpenChange(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader onClose={() => onOpenChange(false)}>
          <ModalTitle>Swap Exercise</ModalTitle>
          <ModalDescription>
            Choose an alternative for <Text className="font-semibold text-foreground">{exerciseName}</Text>
          </ModalDescription>
        </ModalHeader>

        <View className="min-h-[200px]">
          {isLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" color="#31D5E3" />
              <Text className="text-muted-foreground mt-2">Loading alternatives...</Text>
            </View>
          ) : alternatives.length > 0 ? (
            <ScrollView className="max-h-[300px]" showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {alternatives.map((alt) => (
                  <Pressable
                    key={alt.id}
                    onPress={() => setSelectedAlt(alt)}
                    className={cn(
                      'p-3 rounded-lg border',
                      selectedAlt?.id === alt.id
                        ? 'bg-primary/20 border-primary'
                        : 'bg-muted/30 border-border'
                    )}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className={cn(
                        'w-10 h-10 rounded-lg items-center justify-center',
                        selectedAlt?.id === alt.id ? 'bg-primary' : 'bg-muted'
                      )}>
                        <Dumbbell size={18} color={selectedAlt?.id === alt.id ? '#FFFFFF' : '#71717A'} />
                      </View>
                      <View className="flex-1">
                        <Text className={cn(
                          'font-medium',
                          selectedAlt?.id === alt.id ? 'text-primary' : 'text-foreground'
                        )}>
                          {alt.name}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {alt.muscleGroups.slice(0, 2).join(' • ')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center py-8">
              <RefreshCw size={32} color="#71717A" style={{ opacity: 0.5 }} />
              <Text className="text-muted-foreground mt-3">No alternatives found</Text>
              <Text className="text-xs text-muted-foreground mt-1 text-center px-4">
                Try editing the workout in the builder to choose a different exercise
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
              className={cn('bg-primary', canConfirmSwap ? 'opacity-100' : 'opacity-50')} 
              onPress={handleConfirmSwap}
              disabled={!canConfirmSwap}
            >
              <Text className="text-primary-foreground font-semibold">Swap</Text>
            </Button>
          </View>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
