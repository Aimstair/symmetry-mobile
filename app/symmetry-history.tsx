import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  TrendingUp, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Target,
  Camera,
  Dumbbell,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { LineChart } from 'react-native-gifted-charts';
import type { PhysiqueScan } from '@/types';

const { width } = Dimensions.get('window');
const chartWidth = width - 64;

// Pagination constants
const PAGE_SIZE = 20;

// Muscle display name mapping
const MUSCLE_DISPLAY_NAMES: Record<string, string> = {
  chest: 'Chest',
  back: 'Back (Lats)',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
};

// Get status based on score threshold
function getScoreStatus(score: number): 'strong' | 'balanced' | 'lagging' {
  if (score >= 90) return 'strong';
  if (score >= 75) return 'balanced';
  return 'lagging';
}

// Format date for display
function formatScanDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format date for chart label
function formatChartDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

// Transform physique scans for chart data
function transformToChartData(scans: PhysiqueScan[]) {
  // Sort ascending by date for chart (oldest first)
  const sorted = [...scans].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  return sorted.map((scan, index) => ({
    value: scan.symmetryScore,
    label: formatChartDate(scan.date),
    date: scan.date,
  }));
}

// Transform scans for history list (sorted descending - newest first)
function transformToHistoryList(scans: PhysiqueScan[]) {
  const sorted = [...scans].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return sorted.map((scan, index) => {
    const prevScan = sorted[index + 1];
    const change = prevScan ? scan.symmetryScore - prevScan.symmetryScore : 0;
    
    const muscles = Object.entries(scan.muscleScores).map(([key, score]) => ({
      muscle: MUSCLE_DISPLAY_NAMES[key] || key,
      status: getScoreStatus(score),
      score,
    }));

    return {
      id: scan.id,
      date: formatScanDate(scan.date),
      rawDate: scan.date,
      score: scan.symmetryScore,
      change,
      muscles,
    };
  });
}

// Get current muscle analysis from latest scan with trends
function getCurrentMuscleAnalysis(scans: PhysiqueScan[]) {
  if (scans.length === 0) return [];
  
  const sorted = [...scans].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  const latestScan = sorted[0];
  const prevScan = sorted[1];

  return Object.entries(latestScan.muscleScores).map(([key, score]) => {
    const prevScore = prevScan?.muscleScores?.[key as keyof typeof prevScan.muscleScores] || score;
    const trend = score - prevScore;
    
    return {
      muscle: MUSCLE_DISPLAY_NAMES[key] || key,
      key,
      status: getScoreStatus(score),
      score,
      trend,
    };
  });
}

// Get per-muscle history for charts
function getMuscleHistoryData(scans: PhysiqueScan[]) {
  if (scans.length === 0) return {};
  
  const sorted = [...scans].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const muscleKeys = Object.keys(sorted[0].muscleScores) as (keyof PhysiqueScan['muscleScores'])[];
  
  const result: Record<string, { value: number; label: string }[]> = {};
  
  for (const key of muscleKeys) {
    result[key] = sorted.map(scan => ({
      value: scan.muscleScores[key],
      label: formatChartDate(scan.date),
    }));
  }
  
  return result;
}

// Count muscles by status
function countMusclesByStatus(muscleScores: PhysiqueScan['muscleScores']) {
  const counts = { strong: 0, balanced: 0, lagging: 0 };
  
  Object.values(muscleScores).forEach(score => {
    const status = getScoreStatus(score);
    counts[status]++;
  });
  
  return counts;
}

export default function SymmetryHistory() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // Pagination state for History tab
  const [paginatedScans, setPaginatedScans] = useState<PhysiqueScan[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasMoreScans, setHasMoreScans] = useState(true);
  const [lastCursor, setLastCursor] = useState<string | null>(null);

  // Connect to store (used for overview/chart - always has all local data)
  const physiqueScans = useAppStore((state) => state.physiqueScans);
  const user = useAppStore((state) => state.user);

  // Fetch paginated scans from Supabase
  const fetchScans = useCallback(async (cursor?: string | null) => {
    if (!user?.id) return;
    
    try {
      let query = supabase
        .from('physique_scans')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(PAGE_SIZE);
      
      // Cursor-based pagination: fetch scans older than the cursor
      if (cursor) {
        query = query.lt('date', cursor);
      }
      
      const { data, error } = await query;
      
      if (error) {
        if (__DEV__) console.error('Failed to fetch paginated scans:', error);
        return;
      }
      
      if (data) {
        // Transform database records to PhysiqueScan type
        const transformedScans: PhysiqueScan[] = data.map((scan: any) => ({
          id: scan.id,
          userId: scan.user_id,
          date: new Date(scan.date),
          images: scan.images || {},
          muscleScores: scan.muscle_scores || {
            chest: 0,
            back: 0,
            shoulders: 0,
            arms: 0,
            legs: 0,
          },
          symmetryScore: scan.symmetry_score || 0,
          notes: scan.notes,
        }));
        
        if (cursor) {
          // Append to existing scans
          setPaginatedScans(prev => [...prev, ...transformedScans]);
        } else {
          // Initial load - replace
          setPaginatedScans(transformedScans);
        }
        
        // Update cursor for next page
        if (transformedScans.length > 0) {
          const lastScan = transformedScans[transformedScans.length - 1];
          setLastCursor(new Date(lastScan.date).toISOString());
        }
        
        // Check if there are more scans
        setHasMoreScans(transformedScans.length === PAGE_SIZE);
      }
    } catch (error) {
      if (__DEV__) console.error('Error fetching scans:', error);
    }
  }, [user?.id]);

  // Initial load when switching to History tab
  useEffect(() => {
    if (activeTab === 'history' && isInitialLoad && user?.id) {
      setIsInitialLoad(false);
      fetchScans(null);
    }
  }, [activeTab, isInitialLoad, user?.id, fetchScans]);

  // Load more scans handler
  const loadMoreScans = useCallback(async () => {
    if (isLoadingMore || !hasMoreScans || !lastCursor) return;
    
    setIsLoadingMore(true);
    await fetchScans(lastCursor);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreScans, lastCursor, fetchScans]);

  // Transform paginated scans for history list display
  const paginatedHistoryList = useMemo(() => 
    transformToHistoryList(paginatedScans), 
    [paginatedScans]
  );

  // Derive all data from physiqueScans (local store for overview)
  const chartData = useMemo(() => transformToChartData(physiqueScans), [physiqueScans]);
  const muscleAnalysis = useMemo(() => getCurrentMuscleAnalysis(physiqueScans), [physiqueScans]);
  const muscleHistory = useMemo(() => getMuscleHistoryData(physiqueScans), [physiqueScans]);

  // Get current and first scan stats
  const latestScan = physiqueScans.length > 0 
    ? [...physiqueScans].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0] 
    : null;

  const firstScan = physiqueScans.length > 0
    ? [...physiqueScans].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0]
    : null;

  const totalImprovement = latestScan && firstScan 
    ? latestScan.symmetryScore - firstScan.symmetryScore 
    : 0;

  const statusCounts = latestScan 
    ? countMusclesByStatus(latestScan.muscleScores)
    : { strong: 0, balanced: 0, lagging: 0 };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'strong': return 'text-success';
      case 'balanced': return 'text-primary';
      case 'lagging': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'strong': return 'bg-success/20';
      case 'balanced': return 'bg-primary/20';
      case 'lagging': return 'bg-destructive/20';
      default: return 'bg-muted';
    }
  };

  // Empty state - no scans yet
  if (physiqueScans.length === 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="px-4 py-6">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              onPress={() => router.push('/(tabs)/progress')}
              className="shrink-0"
            >
              <ArrowLeft size={20} color="#A1A1AA" />
            </Button>
            <View>
              <Text className="text-2xl font-bold text-foreground">Symmetry Analysis</Text>
              <Text className="text-muted-foreground text-sm">Track your muscle balance over time</Text>
            </View>
          </View>

          {/* Empty State */}
          <View className="flex-1 items-center justify-center py-24">
            <GlassCard variant="glow" glowColor="primary" className="items-center p-8 w-full">
              <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-4">
                <Camera size={32} color="#31D5E3" />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2">No Scans Yet</Text>
              <Text className="text-muted-foreground text-center text-sm mb-6">
                Start your first physique scan to track muscle symmetry and balance over time.
              </Text>
              <Button 
                variant="default"
                onPress={() => router.push('/physique-scan')}
                className="w-full"
              >
                <Text className="text-primary-foreground font-semibold">Start First Scan</Text>
              </Button>
            </GlassCard>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6 pb-24">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              onPress={() => router.push('/(tabs)/progress')}
              className="shrink-0"
            >
              <ArrowLeft size={20} color="#A1A1AA" />
            </Button>
            <View>
              <Text className="text-2xl font-bold text-foreground">Symmetry Analysis</Text>
              <Text className="text-muted-foreground text-sm">Track your muscle balance over time</Text>
            </View>
          </View>

          {/* Current Score Card */}
          <GlassCard variant="glow" glowColor="primary" className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <View className="flex-row items-center gap-1">
                  <Sparkles size={12} color="#31D5E3" />
                  <Text className="text-xs text-primary uppercase tracking-wide">
                    Current Score
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Last scan: {latestScan ? formatScanDate(latestScan.date) : 'N/A'}
                </Text>
              </View>
              <Button 
                variant="outline" 
                size="sm"
                onPress={() => router.push('/physique-scan')}
              >
                <Text className="text-foreground text-sm">New Scan</Text>
              </Button>
            </View>
            
            <View className="flex-row items-end justify-between">
              <View className="flex-row items-end">
                <Text className="text-5xl font-bold text-primary">
                  {latestScan?.symmetryScore ?? 0}
                </Text>
                <Text className="text-2xl text-muted-foreground ml-1">/100</Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center gap-1">
                  {totalImprovement >= 0 ? (
                    <ArrowUp size={16} color="#4ADE80" />
                  ) : (
                    <ArrowDown size={16} color="#EF4444" />
                  )}
                  <Text className={cn(
                    "text-sm font-medium",
                    totalImprovement >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {totalImprovement >= 0 ? '+' : ''}{totalImprovement} pts
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">since first scan</Text>
              </View>
            </View>

            <View className="flex-row justify-between mt-6 pt-4 border-t border-border">
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-success">{statusCounts.strong}</Text>
                <Text className="text-xs text-muted-foreground">Strong</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-primary">{statusCounts.balanced}</Text>
                <Text className="text-xs text-muted-foreground">Balanced</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-destructive">{statusCounts.lagging}</Text>
                <Text className="text-xs text-muted-foreground">Lagging</Text>
              </View>
            </View>
          </GlassCard>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="muscles">Muscles</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="gap-6">
              {/* Symmetry Progress Chart */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <TrendingUp size={20} color="#31D5E3" />
                    <Text className="text-lg font-semibold text-foreground">Score Progress</Text>
                  </View>
                </View>
                <GlassCard className="p-0 overflow-hidden pb-4">
                  <View className="items-center justify-center pt-4">
                    <LineChart
                      data={chartData}
                      curved
                      areaChart
                      height={200}
                      width={chartWidth}
                      spacing={chartData.length > 1 ? Math.min(45, (chartWidth - 30) / (chartData.length - 1)) : 45}
                      initialSpacing={15}
                      color="#31D5E3"
                      thickness={3}
                      startFillColor="#31D5E3"
                      endFillColor="#31D5E3"
                      startOpacity={0.4}
                      endOpacity={0.05}
                      dataPointsColor="#31D5E3"
                      dataPointsRadius={6}
                      hideDataPoints={false}
                      yAxisColor="#27272A"
                      xAxisColor="#27272A"
                      yAxisTextStyle={{ color: '#A1A1AA', fontSize: 11 }}
                      xAxisLabelTextStyle={{ color: '#A1A1AA', fontSize: 10 }}
                      rulesType="solid"
                      rulesColor="#27272A"
                      noOfSections={5}
                      backgroundColor="transparent"
                      pointerConfig={{
                        pointerStripHeight: 180,
                        pointerStripColor: '#31D5E3',
                        pointerStripWidth: 2,
                        pointerColor: '#31D5E3',
                        radius: 7,
                        pointerLabelWidth: 110,
                        pointerLabelHeight: 90,
                        activatePointersOnLongPress: true,
                        autoAdjustPointerLabelPosition: false,
                        pointerLabelComponent: (items: any) => {
                          return (
                            <View className="bg-card border border-primary rounded-lg px-3 py-2">
                              <Text className="text-sm text-primary font-bold">Score: {items[0].value}</Text>
                              <Text className="text-xs text-muted-foreground">{items[0].label}</Text>
                            </View>
                          );
                        },
                      }}
                    />
                  </View>
                </GlassCard>
              </View>

              {/* Current Muscle Analysis */}
              <View>
                <View className="flex-row items-center gap-2 mb-3">
                  <Target size={20} color="#31D5E3" />
                  <Text className="text-lg font-semibold text-foreground">Current Analysis</Text>
                </View>
                <View className="gap-2">
                  {muscleAnalysis.map((muscle) => (
                    <GlassCard key={muscle.key} className="flex-row items-center justify-between py-3">
                      <View className="flex-row items-center gap-3">
                        <View className={cn(
                          'w-3 h-3 rounded-full',
                          muscle.status === 'strong' && 'bg-success',
                          muscle.status === 'balanced' && 'bg-primary',
                          muscle.status === 'lagging' && 'bg-destructive'
                        )} />
                        <Text className="font-medium text-sm text-foreground">{muscle.muscle}</Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        {muscle.trend !== 0 && (
                          <View className="flex-row items-center gap-0.5">
                            {muscle.trend > 0 ? (
                              <>
                                <ArrowUp size={12} color="#4ADE80" />
                                <Text className="text-xs text-success">+{muscle.trend}</Text>
                              </>
                            ) : (
                              <>
                                <ArrowDown size={12} color="#EF4444" />
                                <Text className="text-xs text-destructive">{muscle.trend}</Text>
                              </>
                            )}
                          </View>
                        )}
                        {muscle.trend === 0 && (
                          <View className="flex-row items-center gap-0.5">
                            <Minus size={12} color="#A1A1AA" />
                            <Text className="text-xs text-muted-foreground">0</Text>
                          </View>
                        )}
                        <View className={cn(
                          'px-2 py-0.5 rounded min-w-[40px] items-center',
                          getStatusBg(muscle.status)
                        )}>
                          <Text className={cn(
                            'text-sm font-bold',
                            getStatusColor(muscle.status)
                          )}>
                            {muscle.score}
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              </View>
            </TabsContent>

            {/* Muscles Tab */}
            <TabsContent value="muscles" className="gap-6">
              {Object.entries(muscleHistory).map(([muscleKey, data]) => (
                <View key={muscleKey}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold text-foreground">
                      {MUSCLE_DISPLAY_NAMES[muscleKey] || muscleKey}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Current: <Text className="text-foreground font-medium">
                        {data.length > 0 ? data[data.length - 1].value : 'N/A'}
                      </Text>
                    </Text>
                  </View>
                  <GlassCard className="py-3">
                    <View className="h-24">
                      {data.length > 0 && (
                        <LineChart
                          data={data}
                          curved
                          areaChart
                          height={80}
                          width={chartWidth - 40}
                          spacing={data.length > 3 ? Math.min(60, (chartWidth - 50) / (data.length - 1)) : 80}
                          initialSpacing={10}
                          color="#31D5E3"
                          thickness={2}
                          startFillColor="#31D5E3"
                          endFillColor="#31D5E3"
                          startOpacity={0.2}
                          endOpacity={0.02}
                          hideDataPoints
                          hideAxesAndRules
                          backgroundColor="transparent"
                        />
                      )}
                    </View>
                  </GlassCard>
                </View>
              ))}
            </TabsContent>

            {/* History Tab - Uses FlatList with Infinite Scroll */}
            <TabsContent value="history" className="gap-4">
              <View className="flex-row items-center gap-2 mb-4">
                <Calendar size={20} color="#31D5E3" />
                <Text className="text-lg font-semibold text-foreground">Scan History</Text>
                <Text className="text-xs text-muted-foreground ml-auto">
                  {paginatedHistoryList.length} scans
                </Text>
              </View>

              {paginatedHistoryList.length === 0 && !isInitialLoad ? (
                <GlassCard className="items-center py-8">
                  <Calendar size={32} color="#71717A" style={{ opacity: 0.5 }} />
                  <Text className="text-muted-foreground mt-2">No scan history yet</Text>
                </GlassCard>
              ) : (
                <FlashList
                  data={paginatedHistoryList}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false} // Parent ScrollView handles scrolling
                  onEndReached={loadMoreScans}
                  onEndReachedThreshold={0.5}
                  estimatedItemSize={200}
                  renderItem={({ item: scan }) => (
                    <Pressable
                      onPress={() => setSelectedScanId(selectedScanId === scan.id ? null : scan.id)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        marginBottom: 12,
                      })}
                    >
                      <GlassCard>
                        <View className="flex-row items-center justify-between">
                          <View>
                            <Text className="font-medium text-foreground">{scan.date}</Text>
                            <Text className="text-xs text-muted-foreground">Physique Scan</Text>
                          </View>
                          <View className="flex-row items-center gap-3">
                            {scan.change !== 0 && (
                              <View className="flex-row items-center gap-0.5">
                                {scan.change > 0 ? (
                                  <>
                                    <ArrowUp size={12} color="#4ADE80" />
                                    <Text className="text-success text-xs font-medium">+{scan.change}</Text>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDown size={12} color="#EF4444" />
                                    <Text className="text-destructive text-xs font-medium">{scan.change}</Text>
                                  </>
                                )}
                              </View>
                            )}
                            <Text className="text-2xl font-bold text-primary">{scan.score}</Text>
                          </View>
                        </View>

                        {/* Expanded Details */}
                        {selectedScanId === scan.id && (
                          <View className="mt-4 pt-4 border-t border-border">
                            <Text className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                              Muscle Breakdown
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                              {scan.muscles.map((muscle) => (
                                <View key={muscle.muscle} className="w-[48%] flex-row items-center justify-between">
                                  <View className="flex-row items-center gap-2">
                                    <View className={cn(
                                      'w-2 h-2 rounded-full',
                                      muscle.status === 'strong' && 'bg-success',
                                      muscle.status === 'balanced' && 'bg-primary',
                                      muscle.status === 'lagging' && 'bg-destructive'
                                    )} />
                                    <Text className="text-xs text-foreground">{muscle.muscle}</Text>
                                  </View>
                                  <Text className={cn(
                                    'text-xs font-bold',
                                    getStatusColor(muscle.status)
                                  )}>
                                    {muscle.score}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </GlassCard>
                    </Pressable>
                  )}
                  ListFooterComponent={() => (
                    isLoadingMore ? (
                      <View className="py-4 items-center">
                        <ActivityIndicator size="small" color="#31D5E3" />
                        <Text className="text-xs text-muted-foreground mt-2">Loading more...</Text>
                      </View>
                    ) : !hasMoreScans && paginatedHistoryList.length > 0 ? (
                      <View className="py-4 items-center">
                        <Text className="text-xs text-muted-foreground">No more scans</Text>
                      </View>
                    ) : null
                  )}
                />
              )}
            </TabsContent>
          </Tabs>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
