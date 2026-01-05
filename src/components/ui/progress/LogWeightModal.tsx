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
}

export function LogWeightModal({ open, onOpenChange }: LogWeightModalProps) {
  const [weight, setWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const syncAddBodyMeasurement = useAppStore((s) => s.syncAddBodyMeasurement);

  const handleSave = async () => {
    if (!user || !weight) return;

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) return;

    setIsSubmitting(true);
    try {
      const newMeasurement: BodyMeasurement = {
        id: `bm-weight-${Date.now()}`,
        userId: user.id,
        date: new Date(),
        weight: weightNum,
        measurements: {},
      };

      await syncAddBodyMeasurement(newMeasurement);
      
      // Reset form and close
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
            <Label className="mb-1">Weight ({settings.unit})</Label>
            <Input
              placeholder={user?.weight?.toString() || "180.0"}
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
