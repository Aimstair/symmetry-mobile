import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Animated, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNetInfo } from '@react-native-community/netinfo';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { useProgressDataInitialization } from '@/hooks/useDataInitialization';
import { generatePlanFromScan } from '@/utils/aiPlanner';
import { initializeExerciseLookup } from '@/hooks/useExercises';
import { supabase } from '@/lib/supabase';
import { subscriptionService } from '@/services/SubscriptionService';
import { notificationService } from '@/services/NotificationService';
import Svg, { Ellipse, Line, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { 
  Camera, 
  ScanLine, 
  ChevronRight,
  Sparkles,
  History,
  ArrowRight,
  ArrowDown,
  ArrowUp
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import type { PhysiqueScan as PhysiqueScanType } from '@/types';

type ScanPhase = 'idle' | 'scanning' | 'analyzing' | 'results';

// Helper to format dates
function formatScanDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Helper to calculate score change between scans
function calculateScoreChange(scans: PhysiqueScanType[]): number {
  if (scans.length < 2) return 0;
  const sorted = scans.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sorted[0].symmetryScore - sorted[1].symmetryScore;
}

// Transform muscle scores to display format
function transformMuscleResults(scan: PhysiqueScanType | null) {
  if (!scan) return [];
  
  const getStatus = (score: number) => {
    if (score >= 85) return 'strong';
    if (score >= 70) return 'balanced';
    return 'lagging';
  };
  
  return [
    { muscle: 'Chest', status: getStatus(scan.muscleScores.chest), score: scan.muscleScores.chest },
    { muscle: 'Back', status: getStatus(scan.muscleScores.back), score: scan.muscleScores.back },
    { muscle: 'Shoulders', status: getStatus(scan.muscleScores.shoulders), score: scan.muscleScores.shoulders },
    { muscle: 'Arms', status: getStatus(scan.muscleScores.arms), score: scan.muscleScores.arms },
    { muscle: 'Legs', status: getStatus(scan.muscleScores.legs), score: scan.muscleScores.legs },
  ];
}

export default function PhysiqueScan() {
  const router = useRouter();
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected ?? false;
  
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [currentScanResult, setCurrentScanResult] = useState<PhysiqueScanType | null>(null);
  const [canScan, setCanScan] = useState<boolean | null>(null);
  const [daysUntilNextScan, setDaysUntilNextScan] = useState<number>(0);
  const [isCheckingQuota, setIsCheckingQuota] = useState(false);
  
  const headerAnim = useRef(new Animated.Value(0)).current;
  const mainCardAnim = useRef(new Animated.Value(0)).current;
  const historyAnim = useRef(new Animated.Value(0)).current;

  // Get user and data from store
  const user = useAppStore((s) => s.user);
  const isPro = useAppStore((s) => s.isPro);
  const physiqueScans = useAppStore((s) => s.physiqueScans);
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const workoutHistory = useAppStore((s) => s.workoutHistory);
  const syncAddPhysiqueScan = useAppStore((s) => s.syncAddPhysiqueScan);
  const syncWorkoutPlanToCloud = useAppStore((s) => s.syncWorkoutPlanToCloud);
  const syncUpdateWorkoutPlanToCloud = useAppStore((s) => s.syncUpdateWorkoutPlanToCloud);
  const addWorkoutPlan = useAppStore((s) => s.addWorkoutPlan);
  const updateWorkoutPlan = useAppStore((s) => s.updateWorkoutPlan);
  const isLoading = useAppStore((s) => s.isLoading);

  // Load progress data on focus
  const { loadProgressData } = useProgressDataInitialization(user?.id ?? null);

  // Derive data from store
  const sortedScans = useMemo(() => 
    physiqueScans
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [physiqueScans]
  );
  
  const latestScan = sortedScans[0] || null;
  const previousScans = sortedScans.slice(0, 3); // Show last 3 scans in history
  const scoreChange = calculateScoreChange(physiqueScans);
  const muscleResults = useMemo(() => 
    transformMuscleResults(currentScanResult || latestScan),
    [currentScanResult, latestScan]
  );

  useFocusEffect(
    useCallback(() => {
      loadProgressData();
      checkScanQuota(); // Check quota on focus
      
      headerAnim.setValue(0);
      mainCardAnim.setValue(0);
      historyAnim.setValue(0);
      if (phase === 'idle' || phase === 'results') {
        const animation =Animated.stagger(100, [
          Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(mainCardAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(historyAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]);
        animation.start();

        return () => {
        animation.stop();
        }
      }
    }, [phase, headerAnim, mainCardAnim, historyAnim, loadProgressData])
  );

  /**
   * Check if user can perform a scan based on their subscription tier
   * Tier is determined SERVER-SIDE to prevent client manipulation
   * Free users: 1 scan per 30 days
   * Pro users: 1 scan per 7 days
   */
  const checkScanQuota = async () => {
    if (!user?.id) {
      setCanScan(false);
      return;
    }
    
    // Skip network call if offline - use cached nextScanDate from store
    if (!isConnected) {
      const nextScanDate = useAppStore.getState().nextScanDate;
      if (nextScanDate) {
        const canScanNow = new Date(nextScanDate) <= new Date();
        setCanScan(canScanNow);
        if (!canScanNow) {
          const daysRemaining = Math.ceil(
            (new Date(nextScanDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          setDaysUntilNextScan(Math.max(0, daysRemaining));
        }
      }
      return;
    }
    
    setIsCheckingQuota(true);
    
    try {
      // Call the secure Postgres function - tier is determined SERVER-SIDE
      // No interval_days parameter to prevent client manipulation
      const { data, error } = await supabase.rpc('check_scan_availability', {
        p_user_id: user.id,
      });
      
      if (error) {
        if (__DEV__) console.error('Failed to check scan availability:', error);
        // On error, allow scan (fail open for better UX)
        setCanScan(true);
        setDaysUntilNextScan(0);
        return;
      }
      
      setCanScan(data);
      
      // If can't scan, get days until next scan (also secure - no interval_days)
      if (!data) {
        const { data: daysData } = await supabase.rpc('get_days_until_next_scan', {
          p_user_id: user.id,
        });
        setDaysUntilNextScan(daysData || 0);
      } else {
        setDaysUntilNextScan(0);
      }
      
      // Update cached next scan date in store
      const { data: nextDate } = await supabase.rpc('get_next_scan_date', {
        p_user_id: user.id,
      });
      if (nextDate) {
        useAppStore.getState().setNextScanDate(nextDate);
      }
    } catch (error) {
      if (__DEV__) console.error('Error checking scan quota:', error);
      setCanScan(true); // Fail open
    } finally {
      setIsCheckingQuota(false);
    }
  };

  /**
   * Log a completed scan to the database for quota tracking
   */
  const logScanUsage = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase.from('scan_logs').insert({
        user_id: user.id,
        scan_type: 'physique',
      });
      
      if (error) {
        console.error('Failed to log scan:', error);
      }
    } catch (error) {
      console.error('Error logging scan:', error);
    }
  };

  /**
   * Compress an image before saving (reduces storage and bandwidth)
   */
  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Resize to max 800px width
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('Failed to compress image:', error);
      return uri; // Return original on failure
    }
  };

  /**
   * Check if user can scan and show appropriate message
   */
  const canPerformScan = (): boolean => {
    // Check network connectivity first - AI analysis requires internet
    if (!isConnected) {
      Alert.alert(
        'No Internet Connection',
        'Internet is required for AI analysis. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    // If still checking, allow to proceed (will check again)
    if (canScan === null || isCheckingQuota) return true;
    
    if (!canScan) {
      const tierName = isPro ? 'Pro' : 'Free';
      const frequency = isPro ? 'once per week' : 'once per month';
      
      Alert.alert(
        'Scan Limit Reached',
        isPro
          ? `Pro users can scan ${frequency}. Your next scan is available in ${daysUntilNextScan} day${daysUntilNextScan !== 1 ? 's' : ''}.`
          : `Free users can scan ${frequency}. Upgrade to Pro to scan weekly!\n\nYour next scan is available in ${daysUntilNextScan} day${daysUntilNextScan !== 1 ? 's' : ''}.`,
        isPro
          ? [{ text: 'OK' }]
          : [
              { text: 'Maybe Later', style: 'cancel' },
              { text: 'Upgrade to Pro', onPress: () => router.push('/paywall') },
            ]
      );
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    headerAnim.setValue(0);
    mainCardAnim.setValue(0);
    historyAnim.setValue(0);
    if (phase === 'idle' || phase === 'results') {
      Animated.stagger(100, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(mainCardAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(historyAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [phase]);

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  const analysisSteps = [
    'Mapping Skeleton...',
    'Volumetric Analysis...',
    'Calculating Symmetry...',
  ];

  const startScan = async () => {
    if (!user) return;
    
    // Check scan quota before proceeding
    if (!canPerformScan()) {
      return;
    }
    
    setPhase('scanning');
    setAnalysisStep(0);
    
    // Simulate camera capture
    setTimeout(() => {
      setPhase('analyzing');
      
      // Run through analysis steps
      let step = 0;
      const interval = setInterval(async () => {
        step++;
        setAnalysisStep(step);
        if (step >= analysisSteps.length) {
          clearInterval(interval);
          
          // Generate mock scan results (in production, this would come from AI analysis)
          const muscleScores = {
            chest: Math.floor(Math.random() * 25) + 70,
            back: Math.floor(Math.random() * 25) + 70,
            shoulders: Math.floor(Math.random() * 25) + 70,
            arms: Math.floor(Math.random() * 25) + 70,
            legs: Math.floor(Math.random() * 25) + 70,
          };
          
          const newScan: PhysiqueScanType = {
            id: Crypto.randomUUID(),
            userId: user.id,
            date: new Date(),
            images: {},
            muscleScores,
            symmetryScore: Math.ceil((muscleScores.chest + muscleScores.back + muscleScores.shoulders + muscleScores.arms + muscleScores.legs) / 5), // Average of muscle scores
            notes: 'AI-generated analysis',
          };
          
          try {
            const savedScan = await syncAddPhysiqueScan(newScan);
            setCurrentScanResult(savedScan);
            
            // Log scan usage for quota tracking (after successful save)
            await logScanUsage();
            
            // Refresh quota status
            await checkScanQuota();
            
            // Schedule notification for next scan availability
            const nextScanDate = useAppStore.getState().nextScanDate;
            if (nextScanDate) {
              await notificationService.scheduleScanAvailability(new Date(nextScanDate));
            }

            // Generate AI workout plan from scan results
            if (user) {
              try {
                // Initialize exercise cache before generating plan
                await initializeExerciseLookup();
                
                const aiPlan = generatePlanFromScan(savedScan, new Date(), {
                  user,
                });

                // Check if a workout plan already exists
                const existingPlan = workoutPlans.length > 0 ? workoutPlans[0] : null;
                
                if (existingPlan) {
                  // Update the existing plan with new workout days from the AI-generated plan
                  // Keep the existing plan's ID and metadata, but preserve completed days
                  
                  let mergedWorkoutDays = aiPlan.workoutDays;
                  
                  // Try to preserve completed workouts if workoutHistory is available
                  try {
                    if (workoutHistory && Array.isArray(workoutHistory) && workoutHistory.length > 0) {
                      // Get completed dates to avoid overwriting finished workouts
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                      const completedDatesSet = new Set<string>();
                      
                      workoutHistory.forEach((session: any) => {
                        if (session.startedAt) {
                          const date = new Date(session.startedAt);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const dateStr = `${year}-${month}-${day}`;
                          completedDatesSet.add(dateStr);
                        }
                      });
                      
                      // Merge workout days: keep existing days that are completed, use new AI days for others
                      mergedWorkoutDays = aiPlan.workoutDays.map(newDay => {
                        // Check if this day is today and if today is completed
                        const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(newDay.dayName || '');
                        const isToday = dayIndex === today.getDay();
                        const isTodayCompleted = completedDatesSet.has(todayStr);
                        
                        // If this is today and it's completed, keep the existing workout day
                        if (isToday && isTodayCompleted) {
                          const existingDay = existingPlan.workoutDays?.find(d => d.dayName === newDay.dayName);
                          if (existingDay) {
                            if (__DEV__) console.log('🔒 Preserving completed workout for today');
                            return existingDay; // Preserve completed workout
                          }
                        }
                        
                        // Otherwise, use the new AI-generated day
                        return newDay;
                      });
                    }
                  } catch (error) {
                    if (__DEV__) console.warn('⚠️ Could not preserve completed workouts:', error);
                    // If there's an error, just use the AI-generated days without merging
                    mergedWorkoutDays = aiPlan.workoutDays;
                  }
                  
                  const updatedPlan = {
                    ...aiPlan,
                    id: existingPlan.id, // Keep the same ID
                    createdAt: existingPlan.createdAt, // Keep original creation date
                    updatedAt: new Date(), // Update timestamp
                    workoutDays: mergedWorkoutDays, // Use merged days
                  };
                  
                  await syncUpdateWorkoutPlanToCloud(existingPlan.id, {
                    name: updatedPlan.name,
                    description: updatedPlan.description,
                    type: updatedPlan.type,
                    daysPerWeek: updatedPlan.daysPerWeek,
                    workoutDays: updatedPlan.workoutDays,
                  });
                  
                  // Update local state
                  updateWorkoutPlan(existingPlan.id, {
                    name: updatedPlan.name,
                    description: updatedPlan.description,
                    type: updatedPlan.type,
                    daysPerWeek: updatedPlan.daysPerWeek,
                    workoutDays: updatedPlan.workoutDays,
                  });
                  
                  console.log('✅ Existing workout plan updated from new scan:', existingPlan.id);
                  
                  setTimeout(() => {
                    Alert.alert(
                      'Workout Plan Updated!',
                      'Your existing workout plan has been updated based on your new scan results. Check the Workout Plan tab to view changes.',
                      [{ text: 'OK' }]
                    );
                  }, 1000);
                } else {
                  // No existing plan, create a new one
                  await syncWorkoutPlanToCloud(aiPlan);
                  addWorkoutPlan(aiPlan);

                  console.log('✅ New AI workout plan generated and saved:', aiPlan.id);

                  setTimeout(() => {
                    Alert.alert(
                      'Workout Plan Generated!',
                      'A new workout plan has been created based on your scan results. Check the Workout Plan tab to view it.',
                      [{ text: 'OK' }]
                    );
                  }, 1000);
                }
              } catch (planError) {
                console.error('❌ Failed to generate AI plan:', planError);
                // Still show scan results even if plan generation fails
              }
            }
          } catch (error) {
            console.error('Failed to save scan:', error);
            setCurrentScanResult(newScan); // Still show results even if save failed
          }
          
          setTimeout(() => {
            setPhase('results');
          }, 500);
        }
      }, 2000);
    }, 2000);
  };

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
        <View className="px-4 py-6">
          {/* Idle State */}
          {phase === 'idle' && (
            <View>
              <Animated.View style={createAnimStyle(headerAnim)} className="mb-6">
                <Text className="text-2xl font-bold text-foreground">Physique Analysis</Text>
                <Text className="text-muted-foreground text-sm mt-1">
                  AI-powered symmetry detection
                </Text>
              </Animated.View>

              {/* Main Scan Card */}
              <Animated.View style={createAnimStyle(mainCardAnim)}>
              <GlassCard variant="glow" glowColor="primary" className="mb-6">
                <View className="rounded-xl bg-muted/30 border border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden" style={{ aspectRatio: 3/4 }}>
                  {/* Silhouette guide overlay */}
                  <View className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.2 }}>
                    <Svg viewBox="0 0 100 150" style={{ height: '80%' }}>
                      <Ellipse cx="50" cy="20" rx="15" ry="18" fill="none" stroke="#31D5E3" strokeWidth="0.5" />
                      <Line x1="50" y1="38" x2="50" y2="85" stroke="#31D5E3" strokeWidth="0.5" />
                      <Line x1="50" y1="45" x2="25" y2="70" stroke="#31D5E3" strokeWidth="0.5" />
                      <Line x1="50" y1="45" x2="75" y2="70" stroke="#31D5E3" strokeWidth="0.5" />
                      <Line x1="50" y1="85" x2="30" y2="130" stroke="#31D5E3" strokeWidth="0.5" />
                      <Line x1="50" y1="85" x2="70" y2="130" stroke="#31D5E3" strokeWidth="0.5" />
                    </Svg>
                  </View>
                  
                  <View className="relative z-10 items-center">
                    <View className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                      <Camera size={40} color="#31D5E3" />
                    </View>
                    <Text className="text-sm text-muted-foreground text-center">
                      Position yourself in the frame
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-1 text-center">
                      Front double bicep pose recommended
                    </Text>
                  </View>
                </View>

                {/* Network Status Warning */}
                {!isConnected && (
                  <View className="bg-destructive/20 border border-destructive/40 rounded-lg p-3 mt-4 mb-2">
                    <Text className="text-destructive text-sm text-center font-medium">
                      No Internet Connection
                    </Text>
                    <Text className="text-destructive/70 text-xs text-center mt-1">
                      Internet required for AI analysis
                    </Text>
                  </View>
                )}

                <Button 
                  onPress={startScan}
                  className={`w-full mt-4 h-12 ${!isConnected || (canScan === false) ? 'bg-muted' : 'bg-primary'}`}
                  disabled={!isConnected || canScan === false || isCheckingQuota}
                >
                  {isCheckingQuota ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-primary-foreground font-semibold ml-2">
                        Checking...
                      </Text>
                    </>
                  ) : (
                    <>
                      <ScanLine size={20} color={!isConnected || canScan === false ? '#71717A' : '#FFFFFF'} />
                      <Text className={`font-semibold ml-2 ${!isConnected || canScan === false ? 'text-muted-foreground' : 'text-primary-foreground'}`}>
                        {!isConnected ? 'Offline' : canScan === false ? `Available in ${daysUntilNextScan} days` : 'Start Scan'}
                      </Text>
                    </>
                  )}
                </Button>
              </GlassCard>
              </Animated.View>

              {/* Previous Scans */}
              <Animated.View style={createAnimStyle(historyAnim)}>
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <History size={20} color="#31D5E3" />
                  <Text className="text-lg font-semibold text-foreground">Previous Scans</Text>
                </View>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex-row items-center"
                  onPress={() => router.push('/symmetry-history')}
                >
                  <Text className="text-primary text-sm">View All</Text>
                  <ChevronRight size={16} color="#31D5E3" />
                </Button>
              </View>

              {previousScans.length > 0 ? (
                <View className="gap-3">
                  {previousScans.map((scan, i) => {
                    const prevScan = sortedScans[i + 1];
                    const change = prevScan ? scan.symmetryScore - prevScan.symmetryScore : 0;
                    return (
                      <GlassCard key={scan.id} className="flex-row items-center justify-between">
                        <View>
                          <Text className="font-medium text-foreground">{formatScanDate(scan.date)}</Text>
                          <Text className="text-sm text-muted-foreground">Front Double Bicep</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-2xl font-bold text-primary">{scan.symmetryScore}</Text>
                          {change !== 0 && (
                            <Text className={cn('text-xs', change > 0 ? 'text-success' : 'text-destructive')}>
                              {change > 0 ? '+' : ''}{change} pts
                            </Text>
                          )}
                        </View>
                      </GlassCard>
                    );
                  })}
                </View>
              ) : (
                <GlassCard className="items-center py-6">
                  <History size={32} color="#71717A" style={{ opacity: 0.5 }} />
                  <Text className="text-muted-foreground mt-2">No previous scans</Text>
                  <Text className="text-xs text-muted-foreground mt-1">Complete your first scan above</Text>
                </GlassCard>
              )}
              </Animated.View>
            </View>
          )}

          {/* Scanning State */}
          {phase === 'scanning' && (
            <View className="flex flex-col items-center justify-center" style={{ minHeight: 500 }}>
              <View className="relative w-48 h-48 mb-8 items-center justify-center">
                <View className="absolute inset-0 rounded-full border-2 border-primary" style={{ opacity: 0.7 }} />
                <View className="absolute inset-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <Camera size={64} color="#31D5E3" />
                </View>
              </View>
              <Text className="text-lg font-medium text-foreground">Capturing...</Text>
              <Text className="text-sm text-muted-foreground">Hold still</Text>
            </View>
          )}

          {/* Analyzing State */}
          {phase === 'analyzing' && (
            <View className="flex flex-col items-center justify-center" style={{ minHeight: 500 }}>
              <View className="relative w-64 h-64 mb-8">
                {/* Body outline with scan effect */}
                <Svg viewBox="0 0 100 150" style={{ width: '100%', height: '100%' }}>
                  <Defs>
                    <LinearGradient id="scanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <Stop offset="0%" stopColor="#31D5E3" stopOpacity="0" />
                      <Stop offset="50%" stopColor="#31D5E3" stopOpacity="1" />
                      <Stop offset="100%" stopColor="#31D5E3" stopOpacity="0" />
                    </LinearGradient>
                  </Defs>
                  
                  {/* Body outline */}
                  <Ellipse cx="50" cy="18" rx="12" ry="15" fill="none" stroke="#31D5E3" strokeWidth="1" opacity="0.5" />
                  <Path 
                    d="M50,33 L50,80 M50,42 L28,65 M50,42 L72,65 M50,80 L32,125 M50,80 L68,125" 
                    stroke="#31D5E3" 
                    strokeWidth="1" 
                    fill="none" 
                    opacity="0.5" 
                  />
                  
                  {/* Static scan line for now - full animation would require Reanimated */}
                  <Rect
                    x="0"
                    y={analysisStep * 40}
                    width="100"
                    height="30"
                    fill="url(#scanGradient)"
                  />
                </Svg>
              </View>

              <View className="items-center">
                {analysisSteps.map((step, i) => (
                  <Text
                    key={step}
                    className={cn(
                      'text-sm mb-2',
                      analysisStep === i && 'text-primary font-medium',
                      analysisStep > i && 'text-success',
                      analysisStep < i && 'text-muted-foreground opacity-30'
                    )}
                  >
                    {analysisStep > i && '✓ '}{step}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Results State */}
          {phase === 'results' && currentScanResult && (
            <View>
              <Animated.View style={createAnimStyle(headerAnim)} className="mb-6">
                <Text className="text-2xl font-bold text-foreground">Analysis Complete</Text>
                <Text className="text-muted-foreground text-sm mt-1">{formatScanDate(currentScanResult.date)}</Text>
              </Animated.View>

              {/* Symmetry Score */}
              <Animated.View style={createAnimStyle(mainCardAnim)}>
              <GlassCard variant="glow" glowColor="primary" className="mb-6 items-center">
                <View className="flex-row items-center justify-center mb-2">
                  <Sparkles size={16} color="#31D5E3" />
                  <Text className="text-xs text-primary uppercase tracking-wide ml-1">
                    Symmetry Score
                  </Text>
                </View>
                <Text className="text-6xl font-bold text-primary mb-2">{currentScanResult.symmetryScore}</Text>
                {scoreChange !== 0 && (
                  <Text className={cn('text-sm', scoreChange > 0 ? 'text-success' : 'text-destructive')}>
                    {scoreChange > 0 ? '+' : ''}{scoreChange} points from last scan
                  </Text>
                )}
                {scoreChange === 0 && previousScans.length === 1 && (
                  <Text className="text-sm text-muted-foreground">
                    First scan recorded!
                  </Text>
                )}
                
                <View className="flex-row justify-between w-full mt-6 pt-4 border-t border-border">
                  <View className="items-center flex-1">
                    <Text className="text-sm font-bold text-success">
                      {muscleResults.filter(m => m.status === 'strong').length}
                    </Text>
                    <Text className="text-xs text-muted-foreground">Strong</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-sm font-bold text-primary">
                      {muscleResults.filter(m => m.status === 'balanced').length}
                    </Text>
                    <Text className="text-xs text-muted-foreground">Balanced</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-sm font-bold text-destructive">
                      {muscleResults.filter(m => m.status === 'lagging').length}
                    </Text>
                    <Text className="text-xs text-muted-foreground">Lagging</Text>
                  </View>
                </View>
              </GlassCard>
              </Animated.View>

              {/* Symmetry Breakdown */}
              <Animated.View style={createAnimStyle(historyAnim)}>
              <View className="mb-4">
                <Text className="text-lg font-semibold mb-3 text-foreground">Muscle Analysis</Text>
                <View className="gap-2">
                  {muscleResults.map((result) => (
                    <GlassCard key={result.muscle} className="flex-row items-center justify-between py-3">
                      <View className="flex-row items-center gap-3">
                        <View className={cn(
                          'w-3 h-3 rounded-full',
                          result.status === 'strong' && 'bg-success',
                          result.status === 'balanced' && 'bg-primary',
                          result.status === 'lagging' && 'bg-destructive'
                        )} />
                        <Text className="font-medium text-sm text-foreground">{result.muscle}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className={cn(
                          'px-2 py-0.5 rounded',
                          getStatusBg(result.status)
                        )}>
                          <Text className={cn(
                            'text-sm font-bold',
                            getStatusColor(result.status)
                          )}>
                            {result.score}
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              </View>

              {/* AI Recommendations */}
              <GlassCard className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={16} color="#31D5E3" />
                  <Text className="font-semibold text-foreground">AI Recommendations</Text>
                </View>
                <View className="gap-2">
                  {muscleResults.filter(m => m.status === 'lagging').length > 0 ? (
                    muscleResults
                      .filter(m => m.status === 'lagging')
                      .map(m => (
                        <View key={m.muscle} className="flex-row items-start gap-2">
                          <ArrowRight size={16} color="#31D5E3" style={{ marginTop: 2 }} />
                          <Text className="text-sm text-muted-foreground flex-1">
                            Focus on {m.muscle.toLowerCase()} training - currently below target
                          </Text>
                        </View>
                      ))
                  ) : (
                    <View className="flex-row items-start gap-2">
                      <ArrowRight size={16} color="#31D5E3" style={{ marginTop: 2 }} />
                      <Text className="text-sm text-muted-foreground flex-1">
                        Great balance! Maintain current training routine
                      </Text>
                    </View>
                  )}
                  {muscleResults.filter(m => m.status === 'strong').length > 0 && (
                    <View className="flex-row items-start gap-2">
                      <ArrowRight size={16} color="#31D5E3" style={{ marginTop: 2 }} />
                      <Text className="text-sm text-muted-foreground flex-1">
                        Excellent {muscleResults.filter(m => m.status === 'strong').map(m => m.muscle.toLowerCase()).join(', ')} development
                      </Text>
                    </View>
                  )}
                </View>
              </GlassCard>

              <Button 
                onPress={() => {
                  setPhase('idle');
                  setCurrentScanResult(null);
                }}
                className="w-full"
                variant="outline"
              >
                <Text className="text-foreground font-medium">New Scan</Text>
              </Button>
              </Animated.View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
