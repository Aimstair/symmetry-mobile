import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ActiveDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayName: string;
  onConfirm: (workoutName: string, muscleGroups: string[]) => void;
}

const MUSCLE_GROUP_OPTIONS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
  { id: 'glutes', label: 'Glutes' },
];

export function ActiveDayModal({ open, onOpenChange, dayName, onConfirm }: ActiveDayModalProps) {
  const [workoutName, setWorkoutName] = useState(`${dayName} Workout`);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens with new dayName
  React.useEffect(() => {
    if (open && dayName) {
      setWorkoutName(`${dayName} Workout`);
      setSelectedMuscles([]);
      setIsSubmitting(false);
    }
  }, [open, dayName]);

  const toggleMuscle = (muscleId: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscleId)
        ? prev.filter((m) => m !== muscleId)
        : [...prev, muscleId]
    );
  };

  const handleConfirm = async () => {
    if (!workoutName.trim() || selectedMuscles.length === 0 || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await onConfirm(workoutName.trim(), selectedMuscles);
      // Modal will be closed by the parent component after successful confirmation
    } catch (error) {
      console.error('Error creating workout day:', error);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing while submitting
    setWorkoutName('');
    setSelectedMuscles([]);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader onClose={handleClose}>
          <ModalTitle>Create Workout for {dayName}</ModalTitle>
          <ModalDescription>
            Name your workout and select muscle groups to train
          </ModalDescription>
        </ModalHeader>

        <View className="gap-4 min-h-[200px]">
          <View>
            <Label className="mb-1">Workout Name</Label>
            <Input
              placeholder="e.g., Push Day, Upper Body"
              value={workoutName}
              onChangeText={setWorkoutName}
            />
          </View>

          <View>
            <Label className="mb-2">Muscle Groups *</Label>
            <View className="flex-row flex-wrap gap-2">
              {MUSCLE_GROUP_OPTIONS.map((muscle) => (
                <Pressable
                  key={muscle.id}
                  onPress={() => toggleMuscle(muscle.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border',
                    selectedMuscles.includes(muscle.id)
                      ? 'bg-primary border-primary'
                      : 'bg-muted/30 border-border'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      selectedMuscles.includes(muscle.id)
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {muscle.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text className="text-xs text-muted-foreground">
            You can add exercises later from the workout screen.
          </Text>
        </View>

        <ModalFooter>
          <View className="flex-1">
            <Button variant="outline" onPress={handleClose}>
              <Text className="text-foreground">Cancel</Text>
            </Button>
          </View>
          <View className="flex-1">
            <Button 
              className="bg-primary" 
              onPress={handleConfirm}
              disabled={isSubmitting || !workoutName.trim() || selectedMuscles.length === 0}
            >
              <Text className="text-primary-foreground font-semibold">
                {isSubmitting ? 'Creating...' : 'Create'}
              </Text>
            </Button>
          </View>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
