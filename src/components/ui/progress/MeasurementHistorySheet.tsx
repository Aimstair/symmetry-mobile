import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LineChart } from 'react-native-gifted-charts';
import { cn } from '@/lib/utils';
import type { MeasurementLog } from '@/types';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Minus,
  Ruler,
  Scale,
  X,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const chartWidth = Math.max(width - 96, 220);
const CM_TO_IN = 0.393701;
const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;
const MemoizedLineChart = React.memo(LineChart);

export type MeasurementMetricKey =
  | 'waistCm'
  | 'hipsCm'
  | 'chestCm'
  | 'leftArmCm'
  | 'rightArmCm'
  | 'leftThighCm'
  | 'rightThighCm'
  | 'leftCalfCm'
  | 'rightCalfCm'
  | 'weightKg'
  | 'shouldersCm'
  | 'neckCm';

export type MeasurementItem = {
  key: MeasurementMetricKey;
  group: 'Core Check-In' | 'Upper Body' | 'Lower Body';
  label: string;
  description: string;
  inverseTrend?: boolean;
};

export const MEASUREMENT_ITEMS: MeasurementItem[] = [
  {
    key: 'weightKg',
    group: 'Core Check-In',
    label: 'Weight',
    description: 'Body weight trend.',
  },
  {
    key: 'waistCm',
    group: 'Core Check-In',
    label: 'Waist',
    description: 'Measures fat loss/abdominal gain (narrowest point).',
    inverseTrend: true,
  },
  {
    key: 'hipsCm',
    group: 'Core Check-In',
    label: 'Hips/Glutes',
    description: 'Indicates glute growth (widest part).',
  },
  {
    key: 'chestCm',
    group: 'Core Check-In',
    label: 'Chest',
    description: 'Tracks torso muscle growth (across nipple line).',
  },
  {
    key: 'shouldersCm',
    group: 'Upper Body',
    label: 'Shoulders',
    description: 'Tracks upper-torso width growth (around delts).',
  },
  {
    key: 'neckCm',
    group: 'Upper Body',
    label: 'Neck',
    description: 'Tracks neck circumference (just below the larynx).',
  },
  {
    key: 'leftArmCm',
    group: 'Upper Body',
    label: 'Biceps (Left)',
    description: 'Tracks arm growth (widest point, often while flexed).',
  },
  {
    key: 'rightArmCm',
    group: 'Upper Body',
    label: 'Biceps (Right)',
    description: 'Tracks arm growth (widest point, often while flexed).',
  },
  {
    key: 'leftThighCm',
    group: 'Lower Body',
    label: 'Thighs (Left)',
    description: 'Tracks leg muscle growth (midpoint or widest part).',
  },
  {
    key: 'rightThighCm',
    group: 'Lower Body',
    label: 'Thighs (Right)',
    description: 'Tracks leg muscle growth (midpoint or widest part).',
  },
  {
    key: 'leftCalfCm',
    group: 'Lower Body',
    label: 'Calves (Left)',
    description: 'Measures lower leg growth (largest part).',
  },
  {
    key: 'rightCalfCm',
    group: 'Lower Body',
    label: 'Calves (Right)',
    description: 'Measures lower leg growth (largest part).',
  },
];

interface MeasurementHistorySheetProps {
  metricKey: MeasurementMetricKey | null;
  isOpen: boolean;
  onClose: () => void;
  logs: MeasurementLog[];
  measurementUnit: 'cm' | 'in';
  weightUnit: 'kg' | 'lbs';
  onSaveMeasurement: (metricKey: MeasurementMetricKey, valueInBaseUnits: number) => Promise<void>;
}

function getMetricMeta(metricKey: MeasurementMetricKey | null): MeasurementItem | null {
  if (!metricKey) return null;
  return MEASUREMENT_ITEMS.find((item) => item.key === metricKey) ?? null;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MeasurementHistorySheet({
  metricKey,
  isOpen,
  onClose,
  logs,
  measurementUnit,
  weightUnit,
  onSaveMeasurement,
}: MeasurementHistorySheetProps) {
  const insets = useSafeAreaInsets();
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canDismissBackdrop, setCanDismissBackdrop] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const metricMeta = useMemo(() => getMetricMeta(metricKey), [metricKey]);
  const isWeightMetric = metricKey === 'weightKg';
  const displayUnit = isWeightMetric ? weightUnit : measurementUnit;

  const timeline = useMemo(() => {
    if (!metricKey) return [] as Array<{ date: Date; displayValue: number }>;

    return logs
      .map((log) => {
        const rawValue = log[metricKey];
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue <= 0) {
          return null;
        }

        const displayValue = isWeightMetric
          ? (weightUnit === 'lbs' ? rawValue * KG_TO_LBS : rawValue)
          : (measurementUnit === 'in' ? rawValue * CM_TO_IN : rawValue);

        return {
          date: new Date(log.date),
          displayValue: parseFloat(displayValue.toFixed(1)),
        };
      })
      .filter((entry): entry is { date: Date; displayValue: number } => !!entry)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [logs, metricKey, isWeightMetric, measurementUnit, weightUnit]);

  const latest = timeline[0] ?? null;
  const previous = timeline[1] ?? null;

  const delta = useMemo(() => {
    if (!latest || !previous || !metricMeta) return null;

    const signedDelta = latest.displayValue - previous.displayValue;
    const isPositive = metricMeta.inverseTrend ? signedDelta < 0 : signedDelta > 0;

    return {
      value: Math.abs(signedDelta).toFixed(1),
      isPositive,
      isZero: Math.abs(signedDelta) < 0.05,
    };
  }, [latest, previous, metricMeta]);

  const chartData = useMemo(() => {
    return timeline
      .slice(0, 8)
      .reverse()
      .map((entry) => ({
        value: entry.displayValue,
        label: entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));
  }, [timeline]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = setTimeout(() => {
      setSuccessMessage(null);
    }, 1800);

    return () => clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    setInputValue('');
    setSuccessMessage(null);
  }, [isOpen, metricKey]);

  useEffect(() => {
    if (isOpen) {
      setCanDismissBackdrop(false);
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, {
        toValue: 1,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setCanDismissBackdrop(true);
        }
      });
      return;
    }

    setCanDismissBackdrop(false);
    sheetAnim.stopAnimation();
  }, [isOpen, sheetAnim]);

  const handleBackdropPress = () => {
    // Prevent the opening tap from dismissing immediately on first open.
    if (!canDismissBackdrop) {
      return;
    }

    onClose();
  };

  const onPressSave = async () => {
    if (!metricKey || !metricMeta || isSaving) return;

    const parsed = parseFloat(inputValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    const baseValue = isWeightMetric
      ? (weightUnit === 'lbs' ? parsed * LBS_TO_KG : parsed)
      : (measurementUnit === 'in' ? parsed * 2.54 : parsed);

    try {
      setIsSaving(true);
      await onSaveMeasurement(metricKey, parseFloat(baseValue.toFixed(2)));
      setInputValue('');
      setSuccessMessage(`${metricMeta.label} check-in saved`);
    } catch {
      // Save errors are surfaced by the parent callback.
    } finally {
      setIsSaving(false);
    }
  };

  if (!metricKey || !metricMeta) {
    return null;
  }

  return (
    <Modal
      visible={isOpen}
      animationType="none"
      transparent
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ zIndex: 9999, elevation: 9999 }}>
        <Animated.View
          className="absolute inset-0 bg-black/80"
          style={{ opacity: sheetAnim, zIndex: 1 }}
        />
        <Pressable className="flex-1" onPress={handleBackdropPress} pointerEvents={canDismissBackdrop ? 'auto' : 'none'} />

        <Animated.View
          className="h-[85%] bg-background rounded-t-3xl border-t border-border overflow-hidden"
          style={{
            zIndex: 2,
            elevation: 24,
            opacity: sheetAnim,
            transform: [
              {
                translateY: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [140, 0],
                }),
              },
            ],
          }}
        >
          <View className="border-b border-border bg-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold text-foreground">{metricMeta.label}</Text>
                <Text className="text-xs text-muted-foreground mt-1">{metricMeta.description}</Text>
              </View>
              <Pressable onPress={onClose} className="p-2">
                <X size={20} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 20) }}
          >
            <View className="p-4 gap-4">
              {successMessage && (
                <View className="rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                  <Text className="text-xs font-medium text-success">{successMessage}</Text>
                </View>
              )}

              <View className="flex-row gap-3">
                <GlassCard className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-primary">{timeline.length}</Text>
                  <Text className="text-xs text-muted-foreground">Entries</Text>
                </GlassCard>

                <GlassCard className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-foreground">
                    {latest ? latest.displayValue.toFixed(1) : '--'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Latest ({displayUnit})</Text>
                </GlassCard>

                <GlassCard className="flex-1 items-center">
                  {delta ? (
                    <>
                      <View className="flex-row items-center">
                        {delta.isZero ? (
                          <Minus size={18} color="#71717A" />
                        ) : delta.isPositive ? (
                          <ChevronUp size={18} color="#4ADE80" />
                        ) : (
                          <ChevronDown size={18} color="#EF4444" />
                        )}
                        <Text
                          className={cn(
                            'text-xl font-bold',
                            delta.isZero
                              ? 'text-muted-foreground'
                              : delta.isPositive
                                ? 'text-success'
                                : 'text-destructive'
                          )}
                        >
                          {delta.value}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground">Last Delta</Text>
                    </>
                  ) : (
                    <>
                      <Minus size={18} color="#71717A" />
                      <Text className="text-xs text-muted-foreground">Last Delta</Text>
                    </>
                  )}
                </GlassCard>
              </View>

              {chartData.length > 0 ? (
                <GlassCard className="overflow-hidden">
                  <View className="flex-row items-center gap-2 mb-6">
                    {isWeightMetric ? <Scale size={16} color="#31D5E3" /> : <Ruler size={16} color="#31D5E3" />}
                    <Text className="font-semibold text-sm text-foreground">Trend ({displayUnit})</Text>
                  </View>
                  <View className="items-center pb-0">
                    <MemoizedLineChart
                      data={chartData}
                      width={chartWidth}
                      areaChart
                      curved
                      height={180}
                      spacing={chartData.length > 4 ? 50 : 70}
                      initialSpacing={10}
                      color="#31D5E3"
                      thickness={2}
                      startFillColor="#31D5E3"
                      endFillColor="#31D5E3"
                      startOpacity={0.28}
                      endOpacity={0.06}
                      dataPointsColor="#31D5E3"
                      dataPointsRadius={4}
                      hideDataPoints={false}
                      yAxisColor="#27272A"
                      xAxisColor="#27272A"
                      yAxisTextStyle={{ color: '#71717A', fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: '#71717A', fontSize: 9, width: 54 }}
                      rulesType="solid"
                      rulesColor="#27272A"
                      noOfSections={4}
                    />
                  </View>
                </GlassCard>
              ) : (
                <GlassCard className="items-center py-8">
                  <Calendar size={28} color="#71717A" style={{ opacity: 0.55 }} />
                  <Text className="text-muted-foreground mt-3">No history yet</Text>
                  <Text className="text-xs text-muted-foreground mt-1 text-center">
                    Log your first {metricMeta.label.toLowerCase()} entry below.
                  </Text>
                </GlassCard>
              )}

              <View>
                <View className="flex-row items-center gap-2 mb-3">
                  <Calendar size={16} color="#31D5E3" />
                  <Text className="font-semibold text-sm text-foreground">Recent History</Text>
                </View>
                <View className="gap-2">
                  {timeline.slice(0, 10).map((entry, idx) => (
                    <GlassCard key={`${entry.date.toISOString()}-${idx}`}>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-medium text-foreground">{entry.displayValue.toFixed(1)} {displayUnit}</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs text-muted-foreground">{formatDate(entry.date)}</Text>
                          <ChevronRight size={12} color="#71717A" />
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                  {timeline.length === 0 && (
                    <GlassCard>
                      <Text className="text-sm text-muted-foreground">No entries yet.</Text>
                    </GlassCard>
                  )}
                </View>
              </View>

              <GlassCard>
                <Text className="font-semibold text-sm text-foreground mb-1">Quick Check-In</Text>
                <Text className="text-xs text-muted-foreground mb-3">
                  Log today's number to update your trend instantly.
                </Text>
                <View className="flex-row items-center gap-2">
                  <Input
                    value={inputValue}
                    onChangeText={setInputValue}
                    placeholder={`Enter today's ${metricMeta.label.toLowerCase()} (${displayUnit})`}
                    keyboardType="decimal-pad"
                    className="flex-1"
                  />
                  <Button
                    onPress={onPressSave}
                    disabled={isSaving || !inputValue.trim()}
                    className={cn(isSaving ? 'opacity-70' : '')}
                  >
                    <Text className="text-primary-foreground font-medium">{isSaving ? 'Saving...' : 'Log'}</Text>
                  </Button>
                </View>
              </GlassCard>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
