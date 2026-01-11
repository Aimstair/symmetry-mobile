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
  onSave: (data: { chest: number; waist: number; arms: number; thighs: number }) => Promise<void>;
  unit: string;
}

export function TapeMeasurementModal({ open, onOpenChange, onSave, unit }: TapeMeasurementModalProps) {
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [arms, setArms] = useState('');
  const [thighs, setThighs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = useAppStore((s) => s.user);
  const syncAddBodyMeasurement = useAppStore((s) => s.syncAddMeasurementLog);

  const unitLabel = unit === 'in' ? '(in)' : '(cm)';
  // ✅ STRICT VALIDATION HELPER
  // 1. Must not be empty
  // 2. Must be a valid JavaScript number (excludes ".." and "abc")
  // 3. Must not contain commas (common mistake) or spaces
  const isValidInput = (val: string) => {
    if (!val || val.trim() === '') return false;
    if (val.includes(',') || val.includes(' ')) return false;
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num > 0;
  };

  // ✅ CHECK ALL FIELDS
  const isFormValid = 
    isValidInput(chest) && 
    isValidInput(waist) && 
    isValidInput(arms) && 
    isValidInput(thighs);

  const handleSave = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      const payload = {
        chest: parseFloat(chest),
        waist: parseFloat(waist),
        arms: parseFloat(arms),
        thighs: parseFloat(thighs),
      };

      await onSave(payload);
      
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
            Enter your body measurements in {unit === 'in' ? 'inches' : 'cm'}
          </ModalDescription>
        </ModalHeader>

        <View className="gap-4">
          <View>
            <Label className="mb-1">Chest <Text className="text-muted-foreground text-xs">{unitLabel}</Text></Label>
            <Input
              placeholder="e.g., 42.5"
              value={chest}
              onChangeText={setChest}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Waist <Text className="text-muted-foreground text-xs">{unitLabel}</Text></Label>
            <Input
              placeholder="e.g., 32.0"
              value={waist}
              onChangeText={setWaist}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Arms avg <Text className="text-muted-foreground text-xs">{unitLabel}</Text></Label>
            <Input
              placeholder="e.g., 15.5"
              value={arms}
              onChangeText={setArms}
              keyboardType="decimal-pad"
            />
          </View>

          <View>
            <Label className="mb-1">Thighs avg <Text className="text-muted-foreground text-xs">{unitLabel}</Text></Label>
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
            {/* ✅ VISUAL FEEDBACK: Opacity change */}
            <Button 
              className="bg-primary"
              onPress={handleSave}
              disabled={isSubmitting || !isFormValid}
              style={{ opacity: isFormValid ? 1 : 0.5 }}
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