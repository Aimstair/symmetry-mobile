import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Calendar,
  Dumbbell,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Minus,
  Sparkles,
  Lock,
  Crown,
  X,
} from 'lucide-react-native';
import { cn, formatExerciseDisplayName } from '@/lib/utils';
import { LineChart } from 'react-native-gifted-charts';
import { useAppStore } from '@/store/useAppStore';

const { width } = Dimensions.get('window');
const chartWidth = Math.max(width - 96, 220);
const MemoizedLineChart = React.memo(LineChart);

interface ExerciseHistorySheetProps {
  exerciseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  unit: 'kg' | 'lbs';
}

type SessionSetPoint = {
  weight: number;
  reps: number;
};

type ExerciseSessionPoint = {
  date: Date;
  label: string;
  sessionName: string;
  sets: SessionSetPoint[];
};

function formatSessionLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function normalizeExerciseName(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Exercise';

  // If the backend sends a slug/id-like value, present it as a readable label.
  if (trimmed.includes('_') || trimmed.includes('-')) {
    return formatExerciseDisplayName(trimmed);
  }

  return trimmed;
}

function getSessionDate(session: any): Date | null {
  const rawDate = session?.startedAt || session?.createdAt || session?.date;
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function ExerciseHistorySheet({
  exerciseId,
  isOpen,
  onClose,
  unit,
}: ExerciseHistorySheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const workoutHistory = useAppStore((s) => s.workoutHistory);
  const isPro = useAppStore((s) => s.isPro);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [canDismissBackdrop, setCanDismissBackdrop] = useState(false);

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

  const handleBackdropPress = useCallback(() => {
    // Prevent the opening tap from immediately dismissing the sheet.
    if (!canDismissBackdrop) {
      return;
    }

    onClose();
  }, [canDismissBackdrop, onClose]);

  const history = useMemo(() => {
    if (!exerciseId) {
      return {
        name: 'Exercise',
        sessions: [] as ExerciseSessionPoint[],
        personalRecord: { weight: 0, reps: 0, date: 'N/A' },
      };
    }

    const sessions: ExerciseSessionPoint[] = [];
    let resolvedName: string | null = null;
    let prWeight = 0;
    let prReps = 0;
    let prDate = 'N/A';

    workoutHistory.forEach((session: any) => {
      const sessionDate = getSessionDate(session);
      if (!sessionDate || !Array.isArray(session?.exercises)) return;

      session.exercises.forEach((exercise: any) => {
        const id = exercise?.exerciseId || exercise?.exercise?.id || exercise?.id;
        if (id !== exerciseId) return;

        const hydratedName = exercise?.exercise?.name ? normalizeExerciseName(exercise.exercise.name) : null;
        resolvedName = hydratedName || resolvedName || formatExerciseDisplayName(String(exerciseId));

        const workingSets: SessionSetPoint[] = (exercise?.sets || [])
          .filter((set: any) => !set?.isWarmup && set?.isCompleted !== false)
          .map((set: any) => ({
            weight: Number(set?.weight) || 0,
            reps: Number(set?.reps) || 0,
          }))
          .filter((set: SessionSetPoint) => set.weight > 0 && set.reps > 0);

        if (workingSets.length === 0) return;

        workingSets.forEach((set) => {
          if (set.weight > prWeight || (set.weight === prWeight && set.reps > prReps)) {
            prWeight = set.weight;
            prReps = set.reps;
            prDate = sessionDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        });

        sessions.push({
          date: sessionDate,
          label: formatSessionLabel(sessionDate),
          sessionName: session?.name || 'Workout',
          sets: workingSets,
        });
      });
    });

    sessions.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      name: resolvedName ? normalizeExerciseName(resolvedName) : formatExerciseDisplayName(String(exerciseId)),
      sessions,
      personalRecord: {
        weight: prWeight,
        reps: prReps,
        date: prDate,
      },
    };
  }, [exerciseId, workoutHistory]);

  const convertWeight = useCallback(
    (kg: number) => (unit === 'lbs' ? Math.round(kg * 2.205) : Math.round(kg)),
    [unit]
  );

  const chartSessions = useMemo(() => history.sessions.slice(0, 8).reverse(), [history.sessions]);

  const weightChartData = useMemo(
    () =>
      chartSessions.map((session) => ({
        value: convertWeight(Math.max(...session.sets.map((s) => s.weight))),
        label: session.label,
      })),
    [chartSessions, convertWeight]
  );

  const volumeChartData = useMemo(
    () =>
      chartSessions.map((session) => ({
        value: session.sets.reduce((acc, s) => acc + convertWeight(s.weight) * s.reps, 0),
        label: session.label,
      })),
    [chartSessions, convertWeight]
  );

  const progress = useMemo(() => {
    if (history.sessions.length < 2) return null;

    const latest = Math.max(...history.sessions[0].sets.map((s) => s.weight));
    const previous = Math.max(...history.sessions[1].sets.map((s) => s.weight));
    const delta = latest - previous;

    return { value: convertWeight(Math.abs(delta)), isPositive: delta >= 0 };
  }, [convertWeight, history.sessions]);

  const aiInsights = useMemo(() => {
    if (history.sessions.length === 0) {
      return [
        'Log at least two sessions to unlock trend-based AI coaching for this exercise.',
        'Keep exercise setup consistent each session so changes in load and reps are comparable.',
        'Track complete working sets so the insight engine can detect reliable progression patterns.',
      ];
    }

    const latest = history.sessions[0];
    const previous = history.sessions[1] || null;
    const latestTopSet = Math.max(...latest.sets.map((s) => s.weight));
    const latestTopSetReps = latest.sets.find((s) => s.weight === latestTopSet)?.reps || latest.sets[0]?.reps || 0;
    const latestVolume = latest.sets.reduce((acc, set) => acc + set.weight * set.reps, 0);

    const previousTopSet = previous ? Math.max(...previous.sets.map((s) => s.weight)) : null;
    const previousVolume = previous
      ? previous.sets.reduce((acc, set) => acc + set.weight * set.reps, 0)
      : null;

    const topSetDelta = previousTopSet === null ? null : latestTopSet - previousTopSet;
    const volumeDelta = previousVolume === null ? null : latestVolume - previousVolume;

    const recentSessions = history.sessions.slice(0, 3);
    const recentSets = recentSessions.flatMap((session) => session.sets);
    const averageReps = recentSets.length > 0
      ? Math.round(recentSets.reduce((acc, set) => acc + set.reps, 0) / recentSets.length)
      : 0;

    return [
      topSetDelta === null
        ? `Top set signal: Latest performance is ${convertWeight(latestTopSet)} ${unit} x ${latestTopSetReps}.`
        : topSetDelta >= 0
          ? `Top set trend: Up ${convertWeight(Math.abs(topSetDelta))} ${unit} vs previous session.`
          : `Top set trend: Down ${convertWeight(Math.abs(topSetDelta))} ${unit} vs previous session. Consider a deload or longer rest.`,
      volumeDelta === null
        ? 'Volume signal: Need one more logged session to compare workload trend.'
        : volumeDelta >= 0
          ? `Volume trend: Total workload increased by ${Math.abs(Math.round(volumeDelta))} ${unit}*reps.`
          : `Volume trend: Workload dipped by ${Math.abs(Math.round(volumeDelta))} ${unit}*reps.`,
      `Rep quality: Recent working-set average is about ${averageReps} reps across ${recentSessions.length} sessions.`,
      'Programming suggestion: Keep weekly progression small and consistent to sustain long-term strength gains.',
    ];
  }, [convertWeight, history.sessions, unit]);

  const handleUpgradeToPro = () => {
    onClose();
    router.push('/paywall');
  };

  if (!exerciseId) return null;

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
              <Text className="text-lg font-bold text-foreground">{history.name}</Text>
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
              <View className="flex-row gap-3">
                <GlassCard className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-primary">{history.sessions.length}</Text>
                  <Text className="text-xs text-muted-foreground">Sessions</Text>
                </GlassCard>
                <GlassCard className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-foreground">
                    {convertWeight(history.personalRecord.weight)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">PR ({unit})</Text>
                </GlassCard>
                <GlassCard className="flex-1 items-center">
                  {progress ? (
                    <>
                      <View className="flex-row items-center">
                        {progress.isPositive ? (
                          <ChevronUp size={20} color="#4ADE80" />
                        ) : (
                          <ChevronDown size={20} color="#EF4444" />
                        )}
                        <Text
                          className={cn(
                            'text-2xl font-bold',
                            progress.isPositive ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {progress.value}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground">Last Δ ({unit})</Text>
                    </>
                  ) : (
                    <>
                      <Minus size={20} color="#71717A" />
                      <Text className="text-xs text-muted-foreground">No change</Text>
                    </>
                  )}
                </GlassCard>
              </View>

              {history.sessions.length === 0 ? (
                <GlassCard className="items-center py-8">
                  <Dumbbell size={36} color="#71717A" style={{ opacity: 0.5 }} />
                  <Text className="text-muted-foreground mt-3">No logged sets yet</Text>
                  <Text className="text-xs text-muted-foreground mt-1 text-center">
                    Complete this exercise in a workout to populate stats.
                  </Text>
                </GlassCard>
              ) : (
                <>
                  <GlassCard className="overflow-hidden">
                    <View className="flex-row items-center gap-2 mb-7">
                      <Dumbbell size={16} color="#31D5E3" />
                      <Text className="font-semibold text-sm text-foreground">Weight Progress</Text>
                    </View>
                    <View className="items-center pb-0">
                      <MemoizedLineChart
                        data={weightChartData}
                        width={chartWidth}
                        areaChart
                        curved
                        height={180}
                        spacing={weightChartData.length > 4 ? 50 : 70}
                        initialSpacing={10}
                        color="#31D5E3"
                        thickness={2}
                        startFillColor="#31D5E3"
                        endFillColor="#31D5E3"
                        startOpacity={0.3}
                        endOpacity={0.05}
                        dataPointsColor="#31D5E3"
                        dataPointsRadius={4}
                        hideDataPoints={false}
                        yAxisColor="#27272A"
                        xAxisColor="#27272A"
                        yAxisTextStyle={{ color: '#71717A', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: '#71717A', fontSize: 9, width: 50 }}
                        rulesType="solid"
                        rulesColor="#27272A"
                        noOfSections={4}
                      />
                    </View>
                  </GlassCard>

                  <GlassCard className="overflow-hidden">
                    <View className="flex-row items-center gap-2 mb-7">
                      <TrendingUp size={16} color="#4ADE80" />
                      <Text className="font-semibold text-sm text-foreground">Volume Progress</Text>
                    </View>
                    <View className="items-center pb-0">
                      <MemoizedLineChart
                        data={volumeChartData}
                        width={chartWidth}
                        curved
                        height={180}
                        spacing={volumeChartData.length > 4 ? 50 : 70}
                        initialSpacing={10}
                        color="#4ADE80"
                        thickness={2}
                        dataPointsColor="#4ADE80"
                        dataPointsRadius={4}
                        hideDataPoints={false}
                        yAxisColor="#27272A"
                        xAxisColor="#27272A"
                        yAxisTextStyle={{ color: '#71717A', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: '#71717A', fontSize: 9, width: 50 }}
                        rulesType="solid"
                        rulesColor="#27272A"
                        noOfSections={4}
                      />
                    </View>
                  </GlassCard>

                  <GlassCard className="relative overflow-hidden">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Sparkles size={16} color="#31D5E3" />
                      <Text className="font-semibold text-sm text-foreground">AI Analysis & Insights</Text>
                    </View>

                    <View className={cn('gap-2', !isPro && 'opacity-30')}>
                      {aiInsights.map((insight, i) => (
                        <View key={`ai-insight-${i}`} className="flex-row items-start gap-2">
                          <ChevronRight size={16} color="#31D5E3" style={{ marginTop: 2, flexShrink: 0 }} />
                          <Text className="text-sm text-muted-foreground flex-1">{insight}</Text>
                        </View>
                      ))}
                    </View>

                    {!isPro && (
                      <View className="absolute inset-0 bg-background/75 backdrop-blur-xl items-center justify-center px-4">
                        <View className="w-12 h-12 rounded-full bg-primary/15 items-center justify-center mb-3">
                          <Lock size={20} color="#31D5E3" />
                        </View>
                        <Text className="text-foreground font-semibold text-center">Unlock Pro AI Insights</Text>
                        <Text className="text-xs text-muted-foreground text-center mt-1 mb-4">
                          Upgrade to Pro to view personalized analysis from your exercise history trends.
                        </Text>
                        <Button className="bg-primary" size="sm" onPress={handleUpgradeToPro}>
                          <Crown size={14} color="#FFFFFF" />
                          <Text className="text-primary-foreground font-semibold ml-2">Upgrade to Pro</Text>
                        </Button>
                      </View>
                    )}
                  </GlassCard>

                  <View>
                    <View className="flex-row items-center gap-2 mb-3">
                      <Calendar size={16} color="#31D5E3" />
                      <Text className="font-semibold text-sm text-foreground">Recent Sessions</Text>
                    </View>
                    <View className="gap-2">
                      {history.sessions.slice(0, 10).map((session, i) => (
                        <GlassCard key={`${session.label}-${i}`}>
                          <View className="flex-row items-center justify-between mb-2">
                            <Text className="font-medium text-sm text-foreground">{session.label}</Text>
                            <Text className="text-xs text-muted-foreground">{session.sets.length} sets</Text>
                          </View>
                          <Text className="text-xs text-muted-foreground mb-2">{session.sessionName}</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {session.sets.map((set, j) => (
                              <View key={j} className="px-2 py-1 bg-muted/50 rounded">
                                <Text className="text-xs text-foreground">
                                  {convertWeight(set.weight)} × {set.reps}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </GlassCard>
                      ))}
                    </View>
                  </View>

                  <GlassCard className="border-2 border-success/30">
                    <View className="items-center">
                      <Text className="text-xs text-success uppercase tracking-wide mb-1">Personal Record</Text>
                      <Text className="text-3xl font-bold text-foreground">
                        {convertWeight(history.personalRecord.weight)} {unit} × {history.personalRecord.reps}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-1">{history.personalRecord.date}</Text>
                    </View>
                  </GlassCard>
                </>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}