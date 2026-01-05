import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/useAppStore';
import type { BodyMeasurement } from '@/types';

interface TapeMeasurementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TapeMeasurementModal({ open, onOpenChange }: TapeMeasurementModalProps) {
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [arms, setArms] = useState('');
  const [thighs, setThighs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = useAppStore((s) => s.user);
  const syncAddBodyMeasurement = useAppStore((s) => s.syncAddBodyMeasurement);

  const handleSave = async () => {
    if (!user) return;

    const measurements: Record<string, number> = {};
    if (chest) measurements.chest = parseFloat(chest);
    if (waist) measurements.waist = parseFloat(waist);
    if (arms) measurements.arms = parseFloat(arms);
    if (thighs) measurements.thighs = parseFloat(thighs);

    // At least one measurement required
    if (Object.keys(measurements).length === 0) return;

    setIsSubmitting(true);
    try {
      const newMeasurement: BodyMeasurement = {
        id: `bm-tape-${Date.now()}`,
        userId: user.id,
        date: new Date(),
        weight: user.weight, // Use current weight
        measurements,
      };

      await syncAddBodyMeasurement(newMeasurement);
      
      // Reset form and close
      setChest('');
      setWaist('');
      setArms('');
      setThighs('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save measurements:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader onClose={() => onOpenChange(false)}>
          <ModalTitle>Log Tape Measurements</ModalTitle>
          <ModalDescription>
            Enter your body measurements in inches
          </ModalDescription>
        </ModalHeader>

        <View className="gap-4">
          <View>
            <Label className="mb-1">Chest</Label>
            <Input
              placeholder="e.g., 42.5"
              value={chest}
              onChangeText={setChest}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Waist</Label>
            <Input
              placeholder="e.g., 32.0"
              value={waist}
              onChangeText={setWaist}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Arms (avg)</Label>
            <Input
              placeholder="e.g., 15.5"
              value={arms}
              onChangeText={setArms}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Thighs (avg)</Label>
            <Input
              placeholder="e.g., 24.0"
              value={thighs}
              onChangeText={setThighs}
              keyboardType="decimal-pad"
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
              disabled={isSubmitting || (!chest && !waist && !arms && !thighs)}
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
