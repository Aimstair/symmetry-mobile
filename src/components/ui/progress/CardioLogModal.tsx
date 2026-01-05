import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { CardioLog } from '@/types';

interface CardioLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CARDIO_TYPES = [
  { id: 'running', label: 'Running' },
  { id: 'walking', label: 'Walking' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'rowing', label: 'Rowing' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'elliptical', label: 'Elliptical' },
  { id: 'stairclimber', label: 'Stair Climber' },
];

export function CardioLogModal({ open, onOpenChange }: CardioLogModalProps) {
  const [cardioType, setCardioType] = useState('running');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = useAppStore((s) => s.user);
  const syncAddCardioLog = useAppStore((s) => s.syncAddCardioLog);

  const handleSave = async () => {
    if (!user || !duration) return;

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum <= 0) return;

    setIsSubmitting(true);
    try {
      const newCardioLog: CardioLog = {
        id: `cardio-${Date.now()}`,
        userId: user.id,
        date: new Date(),
        type: cardioType as CardioLog['type'],
        duration: durationNum,
        distance: distance ? parseFloat(distance) : undefined,
        calories: calories ? parseInt(calories, 10) : Math.round(durationNum * 8), // Estimate if not provided
      };

      await syncAddCardioLog(newCardioLog);
      
      // Reset form and close
      setCardioType('running');
      setDuration('');
      setDistance('');
      setCalories('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save cardio log:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader onClose={() => onOpenChange(false)}>
          <ModalTitle>Log Cardio Session</ModalTitle>
          <ModalDescription>
            Record your cardio workout
          </ModalDescription>
        </ModalHeader>

        <View className="gap-4">
          {/* Cardio Type Selection */}
          <View>
            <Label className="mb-2">Type</Label>
            <View className="flex-row flex-wrap gap-2">
              {CARDIO_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => setCardioType(type.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border',
                    cardioType === type.id
                      ? 'bg-primary border-primary'
                      : 'bg-muted/30 border-border'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      cardioType === type.id ? 'text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Label className="mb-1">Duration (minutes) *</Label>
            <Input
              placeholder="e.g., 30"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Distance (miles)</Label>
            <Input
              placeholder="e.g., 3.5"
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Calories Burned</Label>
            <Input
              placeholder="Auto-estimated if blank"
              value={calories}
              onChangeText={setCalories}
              keyboardType="number-pad"
            />
          </View>
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
              onPress={handleSave}
              disabled={isSubmitting || !duration}
            >
              <Text className="text-primary-foreground font-semibold">
                {isSubmitting ? 'Saving...' : 'Save'}
              </Text>
            </Button>
          </View>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
