import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  TrendingUp,
  Calendar,
  Dumbbell,
  ChevronUp,
  ChevronDown,
  Minus,
  X,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { LineChart } from 'react-native-gifted-charts';

// Mock history data
const exerciseHistoryData: Record<string, {
  name: string;
  sessions: { date: string; sets: { weight: number; reps: number }[] }[];
  personalRecord: { weight: number; reps: number; date: string };
}> = {
  '1': {
    name: 'Barbell Bench Press',
    sessions: [
      { date: 'Dec 23', sets: [{ weight: 85, reps: 8 }, { weight: 85, reps: 7 }, { weight: 85, reps: 6 }, { weight: 85, reps: 6 }] },
      { date: 'Dec 19', sets: [{ weight: 82.5, reps: 8 }, { weight: 82.5, reps: 8 }, { weight: 82.5, reps: 7 }, { weight: 80, reps: 7 }] },
      { date: 'Dec 16', sets: [{ weight: 82.5, reps: 7 }, { weight: 82.5, reps: 7 }, { weight: 80, reps: 7 }, { weight: 80, reps: 6 }] },
      { date: 'Dec 12', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }, { weight: 80, reps: 7 }, { weight: 77.5, reps: 6 }] },
      { date: 'Dec 9', sets: [{ weight: 80, reps: 7 }, { weight: 80, reps: 7 }, { weight: 77.5, reps: 6 }, { weight: 77.5, reps: 6 }] },
      { date: 'Dec 5', sets: [{ weight: 77.5, reps: 8 }, { weight: 77.5, reps: 8 }, { weight: 77.5, reps: 7 }, { weight: 75, reps: 7 }] },
    ],
    personalRecord: { weight: 100, reps: 3, date: 'Nov 15, 2024' },
  },
  '2': {
    name: 'Incline Dumbbell Press',
    sessions: [
      { date: 'Dec 23', sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 10 }, { weight: 30, reps: 9 }, { weight: 27.5, reps: 8 }] },
      { date: 'Dec 19', sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 9 }, { weight: 27.5, reps: 9 }, { weight: 27.5, reps: 8 }] },
      { date: 'Dec 16', sets: [{ weight: 27.5, reps: 10 }, { weight: 27.5, reps: 10 }, { weight: 27.5, reps: 9 }, { weight: 27.5, reps: 8 }] },
      { date: 'Dec 12', sets: [{ weight: 27.5, reps: 10 }, { weight: 27.5, reps: 9 }, { weight: 25, reps: 10 }, { weight: 25, reps: 9 }] },
    ],
    personalRecord: { weight: 35, reps: 6, date: 'Oct 20, 2024' },
  },
  '3': {
    name: 'Cable Flyes',
    sessions: [
      { date: 'Dec 23', sets: [{ weight: 12.5, reps: 15 }, { weight: 12.5, reps: 14 }, { weight: 12.5, reps: 12 }] },
      { date: 'Dec 19', sets: [{ weight: 12.5, reps: 14 }, { weight: 12.5, reps: 13 }, { weight: 10, reps: 14 }] },
      { date: 'Dec 16', sets: [{ weight: 10, reps: 15 }, { weight: 10, reps: 14 }, { weight: 10, reps: 13 }] },
    ],
    personalRecord: { weight: 15, reps: 12, date: 'Nov 1, 2024' },
  },
};

interface ExerciseHistorySheetProps {
  exerciseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  unit: 'kg' | 'lbs';
}

export function ExerciseHistorySheet({
  exerciseId,
  isOpen,
  onClose,
  unit,
}: ExerciseHistorySheetProps) {
  if (!exerciseId) return null;

  const history = exerciseHistoryData[exerciseId] || {
    name: 'Exercise',
    sessions: [],
    personalRecord: { weight: 0, reps: 0, date: 'N/A' },
  };

  // Convert weight if needed
  const convertWeight = (kg: number) => unit === 'lbs' ? Math.round(kg * 2.205) : kg;

  // Prepare chart data
  const weightChartData = history.sessions.map((session) => ({
    value: convertWeight(Math.max(...session.sets.map(s => s.weight))),
    label: session.date,
  })).reverse();

  const volumeChartData = history.sessions.map((session) => ({
    value: session.sets.reduce((acc, s) => acc + convertWeight(s.weight) * s.reps, 0),
    label: session.date,
  })).reverse();

  // Calculate progress
  const getProgress = () => {
    if (history.sessions.length < 2) return null;
    const latest = Math.max(...history.sessions[0].sets.map(s => s.weight));
    const previous = Math.max(...history.sessions[1].sets.map(s => s.weight));
    const delta = latest - previous;
    return { value: convertWeight(Math.abs(delta)), isPositive: delta >= 0 };
  };

  const progress = getProgress();

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80">
        <Pressable className="flex-1" onPress={onClose} />
        
        <View className="h-[85%] bg-background rounded-t-3xl border-t border-border overflow-hidden">
              {/* Stats Summary */}
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
                        <Text className={cn(
                          'text-2xl font-bold',
                          progress.isPositive ? 'text-success' : 'text-destructive'
                        )}>
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
              </View   )}>
                    {progress.isPositive ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    {progress.value}
                  </p>
                  <p className="text-xs text-muted-foreground">Last Δ ({unit})</p>
                </>
              ) : (
                <>
                  <Minus className="w-5 h-5 mx-auto text-muted-foreground" />
              {/* Weight Progress Chart */}
              <GlassCard>
                <View className="flex-row items-center gap-2 mb-3">
                  <Dumbbell size={16} color="#31D5E3" />
                  <Text className="font-semibold text-sm text-foreground">Weight Progress</Text>
                </View>
                <View className="h-48">
                  <LineChart
                    data={weightChartData}
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
                        strokeWidth={2}
                    fill="url(#weightGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Volume Chart */}
          <GlassCard>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Volume Progress
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
              {/* Volume Chart */}
              <GlassCard>
                <View className="flex-row items-center gap-2 mb-3">
                  <TrendingUp size={16} color="#4ADE80" />
                  <Text className="font-semibold text-sm text-foreground">Volume Progress</Text>
                </View>
                <View className="h-48">
                  <LineChart
                    data={volumeChartData}
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
                        <span className="font-medium text-sm">{session.date}</span>
                    <span className="text-xs text-muted-foreground">{session.sets.length} sets</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session.sets.map((set, j) => (
                      <span key={j} className="px-2 py-1 text-xs bg-muted/50 rounded">
                        {convertWeight(set.weight)} × {set.reps}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Personal Record */}
          <GlassCard variant="glow" glowColor="success">
            <div className="text-center">
              {/* Session History */}
              <View>
                <View className="flex-row items-center gap-2 mb-3">
                  <Calendar size={16} color="#31D5E3" />
                  <Text className="font-semibold text-sm text-foreground">Recent Sessions</Text>
                </View>
                <View className="gap-2">
                  {history.sessions.map((session, i) => (
                    <GlassCard key={i}>
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-medium text-sm text-foreground">{session.date}</Text>
                        <Text className="text-xs text-muted-foreground">{session.sets.length} sets</Text>
                      </View>
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
              </View    {/* Personal Record */}
              <GlassCard className="border-2 border-success/30">
                <View className="items-center">
                  <Text className="text-xs text-success uppercase tracking-wide mb-1">Personal Record</Text>
                  <Text className="text-3xl font-bold text-foreground">
                    {convertWeight(history.personalRecord.weight)} {unit} × {history.personalRecord.reps}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-1">{history.personalRecord.date}</Text>
                </View>
              </GlassCard>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal