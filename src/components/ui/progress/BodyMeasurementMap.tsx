import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { DimensionValue } from 'react-native';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MeasurementLog } from '@/types';
import { cn } from '@/lib/utils';

export type MeasurementField =
  | 'chestCm'
  | 'shouldersCm'
  | 'waistCm'
  | 'hipsCm'
  | 'leftArmCm'
  | 'rightArmCm'
  | 'leftThighCm'
  | 'rightThighCm'
  | 'leftCalfCm'
  | 'rightCalfCm';

type BodyView = 'front' | 'back';

type Region = {
  field: MeasurementField;
  label: string;
  top: DimensionValue;
  left: DimensionValue;
  width: DimensionValue;
  height: DimensionValue;
};

interface BodyMeasurementMapProps {
  latestLog: MeasurementLog | null;
  unit: 'cm' | 'in';
  onSaveMeasurement: (field: MeasurementField, valueCm: number) => Promise<void>;
}

const IN_TO_CM = 2.54;
const CM_TO_IN = 0.393701;

const FRONT_REGIONS: Region[] = [
  { field: 'shouldersCm', label: 'Shoulders', top: '8%', left: '34%', width: '32%', height: '9%' },
  { field: 'chestCm', label: 'Chest', top: '20%', left: '37%', width: '26%', height: '10%' },
  { field: 'waistCm', label: 'Waist', top: '33%', left: '40%', width: '20%', height: '9%' },
  { field: 'hipsCm', label: 'Hips', top: '44%', left: '38%', width: '24%', height: '9%' },
  { field: 'leftArmCm', label: 'L Bicep', top: '24%', left: '19%', width: '14%', height: '10%' },
  { field: 'rightArmCm', label: 'R Bicep', top: '24%', left: '67%', width: '14%', height: '10%' },
  { field: 'leftThighCm', label: 'L Thigh', top: '55%', left: '35%', width: '14%', height: '12%' },
  { field: 'rightThighCm', label: 'R Thigh', top: '55%', left: '51%', width: '14%', height: '12%' },
  { field: 'leftCalfCm', label: 'L Calf', top: '72%', left: '36%', width: '12%', height: '12%' },
  { field: 'rightCalfCm', label: 'R Calf', top: '72%', left: '52%', width: '12%', height: '12%' },
];

const BACK_REGIONS: Region[] = [
  { field: 'shouldersCm', label: 'Upper Back', top: '10%', left: '34%', width: '32%', height: '10%' },
  { field: 'waistCm', label: 'Lower Back', top: '28%', left: '40%', width: '20%', height: '10%' },
  { field: 'hipsCm', label: 'Glutes/Hips', top: '43%', left: '38%', width: '24%', height: '10%' },
  { field: 'leftArmCm', label: 'L Tricep', top: '23%', left: '19%', width: '14%', height: '10%' },
  { field: 'rightArmCm', label: 'R Tricep', top: '23%', left: '67%', width: '14%', height: '10%' },
  { field: 'leftThighCm', label: 'L Ham', top: '56%', left: '35%', width: '14%', height: '12%' },
  { field: 'rightThighCm', label: 'R Ham', top: '56%', left: '51%', width: '14%', height: '12%' },
  { field: 'leftCalfCm', label: 'L Calf', top: '72%', left: '36%', width: '12%', height: '12%' },
  { field: 'rightCalfCm', label: 'R Calf', top: '72%', left: '52%', width: '12%', height: '12%' },
];

function toDisplay(valueCm: number, unit: 'cm' | 'in'): number {
  if (unit === 'in') return valueCm * CM_TO_IN;
  return valueCm;
}

function toCm(value: number, unit: 'cm' | 'in'): number {
  if (unit === 'in') return value * IN_TO_CM;
  return value;
}

function getHeatColor(value: number | null, min: number, max: number): string {
  if (value === null || Number.isNaN(value)) return 'rgba(113,113,122,0.35)';
  if (max <= min) return 'rgba(49,213,227,0.45)';

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const low = { r: 37, g: 99, b: 235 };
  const high = { r: 249, g: 115, b: 22 };

  const r = Math.round(low.r + (high.r - low.r) * ratio);
  const g = Math.round(low.g + (high.g - low.g) * ratio);
  const b = Math.round(low.b + (high.b - low.b) * ratio);

  return `rgba(${r},${g},${b},0.62)`;
}

export function BodyMeasurementMap({ latestLog, unit, onSaveMeasurement }: BodyMeasurementMapProps) {
  const [view, setView] = useState<BodyView>('front');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;

  const measurementValues = useMemo(() => {
    const fields: MeasurementField[] = [
      'chestCm',
      'shouldersCm',
      'waistCm',
      'hipsCm',
      'leftArmCm',
      'rightArmCm',
      'leftThighCm',
      'rightThighCm',
      'leftCalfCm',
      'rightCalfCm',
    ];

    const values = fields
      .map((f) => latestLog?.[f])
      .filter((v): v is number => typeof v === 'number' && v > 0);

    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    return { min, max };
  }, [latestLog]);

  const handleOpenRegion = (region: Region) => {
    const existingCm = latestLog?.[region.field];
    const display = typeof existingCm === 'number' && existingCm > 0
      ? toDisplay(existingCm, unit).toFixed(1)
      : '';

    setSelectedRegion(region);
    setInputValue(display);
  };

  const handleSave = async () => {
    if (!selectedRegion || isSaving) return;

    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setIsSaving(true);
    try {
      await onSaveMeasurement(selectedRegion.field, toCm(parsed, unit));
      setSelectedRegion(null);
      setInputValue('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Heatmap: Blue (relatively smaller) to Orange (relatively larger)</Text>
        </View>

        <View className="flex-row gap-2">
          <Button
            variant={view === 'front' ? 'default' : 'outline'}
            className="flex-1"
            onPress={() => setView('front')}
          >
            <Text className={cn(view === 'front' ? 'text-primary-foreground' : 'text-foreground')}>Front View</Text>
          </Button>
          <Button
            variant={view === 'back' ? 'default' : 'outline'}
            className="flex-1"
            onPress={() => setView('back')}
          >
            <Text className={cn(view === 'back' ? 'text-primary-foreground' : 'text-foreground')}>Back View</Text>
          </Button>
        </View>

        <View className="h-[460px] rounded-xl border border-border bg-card/50 relative overflow-hidden">
          <View className="absolute left-1/2 top-[4%] -translate-x-1/2 w-16 h-16 rounded-full bg-muted/40 border border-border" />
          <View className="absolute left-1/2 top-[16%] -translate-x-1/2 w-24 h-44 rounded-[28px] bg-muted/25 border border-border" />
          <View className="absolute left-[26%] top-[21%] w-10 h-36 rounded-full bg-muted/15 border border-border" />
          <View className="absolute right-[26%] top-[21%] w-10 h-36 rounded-full bg-muted/15 border border-border" />
          <View className="absolute left-[39%] top-[60%] w-9 h-30 rounded-full bg-muted/15 border border-border" />
          <View className="absolute right-[39%] top-[60%] w-9 h-30 rounded-full bg-muted/15 border border-border" />

          {regions.map((region) => {
            const value = latestLog?.[region.field];
            const color = getHeatColor(
              typeof value === 'number' && value > 0 ? value : null,
              measurementValues.min,
              measurementValues.max
            );

            return (
              <Pressable
                key={`${view}-${region.field}`}
                onPress={() => handleOpenRegion(region)}
                className="absolute rounded-lg border border-white/20 items-center justify-center px-1"
                style={{
                  top: region.top,
                  left: region.left,
                  width: region.width,
                  height: region.height,
                  backgroundColor: color,
                }}
              >
                <Text className="text-[10px] font-semibold text-white text-center">{region.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Dialog open={!!selectedRegion} onOpenChange={(open) => !open && setSelectedRegion(null)}>
        <DialogContent>
          <DialogHeader onClose={() => setSelectedRegion(null)}>
            <DialogTitle>{selectedRegion?.label ?? 'Measurement'}</DialogTitle>
            <DialogDescription>
              Enter measurement in {unit}.
            </DialogDescription>
          </DialogHeader>

          <View className="py-2">
            <Input
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="decimal-pad"
              placeholder={`e.g. ${unit === 'in' ? '14.5' : '36.0'}`}
            />
          </View>

          <DialogFooter>
            <Button variant="outline" className="flex-1" onPress={() => setSelectedRegion(null)}>
              <Text className="text-foreground">Cancel</Text>
            </Button>
            <Button className="flex-1" onPress={handleSave} disabled={isSaving || Number(inputValue) <= 0}>
              <Text className="text-primary-foreground">{isSaving ? 'Saving...' : 'Save'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
