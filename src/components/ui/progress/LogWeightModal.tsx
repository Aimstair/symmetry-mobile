import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/useAppStore';
import type { BodyMeasurement } from '@/types';

interface LogWeightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (weight: number) => Promise<void>; // Added this
  currentUnit: string;
}

export function LogWeightModal({ open, onOpenChange, onSave, currentUnit }: LogWeightModalProps) {
  const [weight, setWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const unit = currentUnit || settings.unit;

  const placeholderWeight = (() => {
    if (typeof user?.weight === 'number' && user.weight > 0) {
      const displayWeight = unit === 'lbs' ? user.weight * 2.20462 : user.weight;
      return displayWeight.toFixed(1);
    }

    return unit === 'kg' ? '80.0' : '180.0';
  })();

  const isValidInput = (val: string) => {
    if (!val || val.trim() === '') return false;
    // Regex for valid number (integer or decimal)
    const strictPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
    return strictPattern.test(val) && parseFloat(val) > 0;
  };

  const isFormValid = isValidInput(weight);

  const handleSave = async () => {
    if (!isFormValid) return;
    if (!user || !weight) return;

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) return;

    setIsSubmitting(true);
    try {
      // ✅ Pass raw number to parent
      await onSave(parseFloat(weight));
      
      // Reset form on success
      setWeight('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save weight:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader onClose={() => onOpenChange(false)}>
          <ModalTitle>Log Weight</ModalTitle>
          <ModalDescription>
            Record your current weight
          </ModalDescription>
        </ModalHeader>

        <View className="gap-4">
          <View>
            <Label className="mb-1">Weight ({unit})</Label>
            <Input
              placeholder={placeholderWeight}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              className="text-center text-xl font-bold"
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
              disabled={isSubmitting || !weight}
            >
              <Text className="text-primary-foreground font-semibold">
                {isSubmitting ? 'Saving...' : 'Log Weight'}
              </Text>
            </Button>
          </View>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

