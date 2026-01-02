import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  TrendingUp, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Calendar,
  Target
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');
const chartWidth = width - 64;

// Mock historical data
const symmetryHistory = [
  { date: 'Aug', score: 65, x: 1 },
  { date: 'Sep', score: 68, x: 2 },
  { date: 'Oct', score: 72, x: 3 },
  { date: 'Nov', score: 76, x: 4 },
  { date: 'Dec', score: 82, x: 5 },
  { date: 'Jan', score: 85, x: 6 },
];

const muscleHistoryData = {
  chest: [
    { date: 'Oct', score: 85, x: 1 },
    { date: 'Nov', score: 88, x: 2 },
    { date: 'Dec', score: 90, x: 3 },
    { date: 'Jan', score: 92, x: 4 },
  ],
  back: [
    { date: 'Oct', score: 78, x: 1 },
    { date: 'Nov', score: 80, x: 2 },
    { date: 'Dec', score: 83, x: 3 },
    { date: 'Jan', score: 85, x: 4 },
  ],
  shoulders: [
    { date: 'Oct', score: 75, x: 1 },
    { date: 'Nov', score: 78, x: 2 },
    { date: 'Dec', score: 81, x: 3 },
    { date: 'Jan', score: 83, x: 4 },
  ],
  arms: [
    { date: 'Oct', score: 68, x: 1 },
    { date: 'Nov', score: 70, x: 2 },
    { date: 'Dec', score: 73, x: 3 },
    { date: 'Jan', score: 76, x: 4 },
  ],
  legs: [
    { date: 'Oct', score: 82, x: 1 },
    { date: 'Nov', score: 84, x: 2 },
    { date: 'Dec', score: 85, x: 3 },
    { date: 'Jan', score: 85, x: 4 },
  ],
  abs: [
    { date: 'Oct', score: 58, x: 1 },
    { date: 'Nov', score: 62, x: 2 },
    { date: 'Dec', score: 65, x: 3 },
    { date: 'Jan', score: 68, x: 4 },
  ],
};

const scanHistory = [
  { 
    date: 'Jan 5, 2026', 
    score: 85, 
    change: 3,
    muscles: [
      { muscle: 'Chest', status: 'strong', score: 92 },
      { muscle: 'Back (Lats)', status: 'balanced', score: 85 },
      { muscle: 'Shoulders', status: 'balanced', score: 83 },
      { muscle: 'Left Bicep', status: 'lagging', score: 72 },
      { muscle: 'Right Bicep', status: 'strong', score: 80 },
      { muscle: 'Left Quad', status: 'balanced', score: 86 },
      { muscle: 'Right Quad', status: 'balanced', score: 84 },
      { muscle: 'Abs', status: 'lagging', score: 68 },
    ]
  },
  { 
    date: 'Dec 20, 2025', 
    score: 82, 
    change: 3,
    muscles: [
      { muscle: 'Chest', status: 'strong', score: 90 },
      { muscle: 'Back (Lats)', status: 'balanced', score: 83 },
      { muscle: 'Shoulders', status: 'balanced', score: 81 },
      { muscle: 'Left Bicep', status: 'lagging', score: 70 },
      { muscle: 'Right Bicep', status: 'balanced', score: 78 },
      { muscle: 'Left Quad', status: 'balanced', score: 84 },
      { muscle: 'Right Quad', status: 'balanced', score: 83 },
      { muscle: 'Abs', status: 'lagging', score: 65 },
    ]
  },
  { 
    date: 'Dec 13, 2025', 
    score: 79, 
    change: 4,
    muscles: [
      { muscle: 'Chest', status: 'balanced', score: 88 },
      { muscle: 'Back (Lats)', status: 'balanced', score: 80 },
      { muscle: 'Shoulders', status: 'balanced', score: 78 },
      { muscle: 'Left Bicep', status: 'lagging', score: 68 },
      { muscle: 'Right Bicep', status: 'balanced', score: 76 },
      { muscle: 'Left Quad', status: 'balanced', score: 82 },
      { muscle: 'Right Quad', status: 'balanced', score: 80 },
      { muscle: 'Abs', status: 'lagging', score: 62 },
    ]
  },
  { 
    date: 'Nov 29, 2025', 
    score: 75, 
    change: 3,
    muscles: [
      { muscle: 'Chest', status: 'balanced', score: 85 },
      { muscle: 'Back (Lats)', status: 'balanced', score: 78 },
      { muscle: 'Shoulders', status: 'balanced', score: 75 },
      { muscle: 'Left Bicep', status: 'lagging', score: 65 },
      { muscle: 'Right Bicep', status: 'balanced', score: 74 },
      { muscle: 'Left Quad', status: 'balanced', score: 80 },
      { muscle: 'Right Quad', status: 'balanced', score: 78 },
      { muscle: 'Abs', status: 'lagging', score: 58 },
    ]
  },
];

const currentMuscleAnalysis = [
  { muscle: 'Chest', status: 'strong', score: 92, trend: 2 },
  { muscle: 'Back (Lats)', status: 'balanced', score: 85, trend: 2 },
  { muscle: 'Shoulders', status: 'balanced', score: 83, trend: 2 },
  { muscle: 'Left Bicep', status: 'lagging', score: 72, trend: 2 },
  { muscle: 'Right Bicep', status: 'strong', score: 80, trend: 2 },
  { muscle: 'Left Quad', status: 'balanced', score: 86, trend: 2 },
  { muscle: 'Right Quad', status: 'balanced', score: 84, trend: 1 },
  { muscle: 'Abs', status: 'lagging', score: 68, trend: 3 },
];

export default function SymmetryHistory() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScan, setSelectedScan] = useState<typeof scanHistory[0] | null>(null);

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

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6 pb-24">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              onPress={() => router.back()}
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
                <Text className="text-xs text-muted-foreground mt-0.5">Last scan: Jan 5, 2026</Text>
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
                <Text className="text-5xl font-bold text-primary">85</Text>
                <Text className="text-2xl text-muted-foreground ml-1">/100</Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center gap-1">
                  <ArrowUp size={16} color="#4ADE80" />
                  <Text className="text-success text-sm font-medium">
                    +20 pts
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">since first scan</Text>
              </View>
            </View>

            <View className="flex-row justify-between mt-6 pt-4 border-t border-border">
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-success">4</Text>
                <Text className="text-xs text-muted-foreground">Strong</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-primary">3</Text>
                <Text className="text-xs text-muted-foreground">Balanced</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-lg font-bold text-destructive">2</Text>
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
                <GlassCard>
                  <View className="h-52 items-center justify-center">
                    <Text className="text-muted-foreground text-sm">Chart temporarily disabled</Text>
                    {/* TODO: Replace with react-native-gifted-charts */}
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
                  {currentMuscleAnalysis.map((muscle) => (
                    <GlassCard key={muscle.muscle} className="flex-row items-center justify-between py-3">
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
                        <View className="flex-row items-center gap-0.5">
                          <ArrowUp size={12} color="#4ADE80" />
                          <Text className="text-xs text-success">
                            +{muscle.trend}
                          </Text>
                        </View>
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
              {Object.entries(muscleHistoryData).map(([muscle, data]) => (
                <View key={muscle}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold capitalize text-foreground">{muscle}</Text>
                    <Text className="text-xs text-muted-foreground">
                      Current: <Text className="text-foreground font-medium">{data[data.length - 1].score}</Text>
                    </Text>
                  </View>
                  <GlassCard className="py-3">
                    <View className="h-24 items-center justify-center">
                      <Text className="text-muted-foreground text-xs">Chart disabled</Text>
                    </View>
                  </GlassCard>
                </View>
              ))}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="gap-4">
              <View className="flex-row items-center gap-2 mb-4">
                <Calendar size={20} color="#31D5E3" />
                <Text className="text-lg font-semibold text-foreground">Scan History</Text>
              </View>

              {scanHistory.map((scan) => (
                <Pressable
                  key={scan.date}
                  onPress={() => setSelectedScan(selectedScan?.date === scan.date ? null : scan)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <GlassCard>
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="font-medium text-foreground">{scan.date}</Text>
                        <Text className="text-xs text-muted-foreground">Front Double Bicep</Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <View className="flex-row items-center gap-0.5">
                          <ArrowUp size={12} color="#4ADE80" />
                          <Text className="text-success text-xs font-medium">
                            +{scan.change}
                          </Text>
                        </View>
                        <Text className="text-2xl font-bold text-primary">{scan.score}</Text>
                      </View>
                    </View>

                    {/* Expanded Details */}
                    {selectedScan?.date === scan.date && (
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
              ))}
            </TabsContent>
          </Tabs>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
