import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, Animated, Alert, Linking, Platform, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/NotificationService';
import { calculateNutritionTargets } from '@/utils/nutrition';
import { dataService } from '@/services/dataServiceProvider';
import { exportUserData } from '@/services/ExportService';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Dumbbell, 
  Calculator, 
  Bell, 
  Crown, 
  Download,
  Upload,
  Trash2,
  ChevronRight,
  Minus,
  Plus,
  Ban,
  Search,
  X,
  Sparkles,
  LogOut,
  Edit3,
  Save,
  Cloud,
  Star,
  Clock,
  FileText,
  Shield,
  MessageSquare,
  Send
} from 'lucide-react-native';
import { cn, convert } from '@/lib/utils';
import type { User as UserType } from '@/types';

export default function Settings() {
  const router = useRouter();
  const headerAnim = useRef(new Animated.Value(0)).current;
  const section1Anim = useRef(new Animated.Value(0)).current;
  const section2Anim = useRef(new Animated.Value(0)).current;
  const section3Anim = useRef(new Animated.Value(0)).current;
  const section4Anim = useRef(new Animated.Value(0)).current;
  const section5Anim = useRef(new Animated.Value(0)).current;
  const section6Anim = useRef(new Animated.Value(0)).current;
  const section7Anim = useRef(new Animated.Value(0)).current;

  // Get store data and actions
  const user = useAppStore((s) => s.user);
  const isGuest = useAppStore((s) => s.isGuest);
  
  // ✅ FIX: Derive the real guest state. 
  // If we have an email, we are NOT a guest, even if the store flag is stuck.
  const isGuestAccount = isGuest && (!user?.email || user.email === '');

  const settings = useAppStore((s) => s.settings);
  const nutritionTargets = useAppStore((s) => s.nutritionTargets);
  const syncUpdateUserToCloud = useAppStore((s) => s.syncUpdateUserToCloud);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetStore = useAppStore((s) => s.resetStore);
  const isLoading = useAppStore((s) => s.isLoading);
  const workoutPlans = useAppStore((s) => s.workoutPlans);
  const syncUpdateNutritionTargets = useAppStore((s) => s.syncUpdateNutritionTargets);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    age: user?.age?.toString() || '',
    gender: user?.gender || 'male' as 'male' | 'female' | 'other',
    height: user?.height?.toString() || '',
    weight: user?.weight?.toString() || '',
    goal: user?.goal || 'maintenance' as 'bulk' | 'cut' | 'recomp' | 'maintenance',
  });

  // Update form when user changes
  useEffect(() => {
    if (user) {
      // Convert stored metric values to display unit if needed
      let displayHeight = user.height?.toString() || '';
      let displayWeight = user.weight?.toString() || '';

      if (settings.measurementUnit === 'in' && user.height) {
        displayHeight = convert.toIn(user.height).toString();
      }
      if (settings.unit === 'lbs' && user.weight) {
        displayWeight = convert.toLbs(user.weight).toString();
      }

      setProfileForm({
        name: user.name || '',
        age: user.age?.toString() || '',
        gender: user.gender || 'male',
        height: displayHeight,
        weight: displayWeight,
        goal: user.goal || 'maintenance',
      });
    }
  }, [user, settings.unit, settings.measurementUnit]);

  useFocusEffect(
    useCallback(() => {
      headerAnim.setValue(0);
      section1Anim.setValue(0);
      section2Anim.setValue(0);
      section3Anim.setValue(0);
      section4Anim.setValue(0);
      section5Anim.setValue(0);
      section6Anim.setValue(0);
      section7Anim.setValue(0);
      
      const animation = Animated.stagger(60, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section3Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section4Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section5Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section6Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section7Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]);
      
      animation.start();

      // CLEANUP: Stop animation if user navigates away before it finishes
      return () => {
        animation.stop();
      };
    }, [])
  );

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  // Get display name for fitness goal
  const getGoalDisplayName = (goal: string | undefined) => {
    if (!goal) return '';
    const goalMap: Record<string, string> = {
      'bulk': 'Build Muscle',
      'cut': 'Lose Fat',
      'maintenance': 'Maintain',
      'recomp': 'Recomposition',
    };
    return goalMap[goal] || goal;
  };

  // Handle profile save
  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      // Convert input values to metric if user is in imperial mode
      let heightInCm = parseFloat(profileForm.height) || user.height;
      let weightInKg = parseFloat(profileForm.weight) || user.weight;

      if (settings.measurementUnit === 'in') {
        heightInCm = convert.toCm(parseFloat(profileForm.height) || user.height);
      }
      if (settings.unit === 'lbs') {
        weightInKg = convert.toKg(parseFloat(profileForm.weight) || user.weight);
      }

      const updatedUser = await syncUpdateUserToCloud(user.id, {
        name: profileForm.name,
        age: parseInt(profileForm.age) || user.age,
        gender: profileForm.gender as UserType['gender'],
        height: heightInCm,
        weight: weightInKg,
        goal: profileForm.goal as UserType['goal'],
        trainingDays: user.trainingDays, // Preserve existing training days
      });

      // Recalculate Nutrition Targets
      const frequency = workoutPlans[0]?.daysPerWeek || 3;
      
      const newTargets = calculateNutritionTargets(
        {
          weight: updatedUser.weight,
          height: updatedUser.height,
          age: updatedUser.age,
          gender: updatedUser.gender,
          goal: updatedUser.goal,
        },
        frequency
      );

      await syncUpdateNutritionTargets(newTargets);
      setShowProfileEdit(false);

    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              resetStore();
              router.replace('/onboarding');
            } catch (error) {
              console.error('Sign out error:', error);
              resetStore();
              router.replace('/onboarding');
            }
          },
        },
      ]
    );
  };

  const [showMacroCalc, setShowMacroCalc] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'general' | 'bug' | 'feature' | 'support'>('general');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Workout reminder time state
  const [reminderHour, setReminderHour] = useState(settings.workoutReminderHour ?? 18);
  const [reminderMinute, setReminderMinute] = useState(settings.workoutReminderMinute ?? 0);

  // Notification toggles
  const workoutReminders = settings.notifications.workoutReminders;
  const restTimerSound = settings.notifications.restTimerSound;
  const progressUpdates = settings.notifications.progressUpdates;

  const handleNotificationChange = async (key: 'workoutReminders' | 'restTimerSound' | 'progressUpdates', value: boolean) => {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });

    // Handle workout reminder scheduling
    if (key === 'workoutReminders') {
      if (value) {
        // Schedule the reminder
        await notificationService.scheduleWorkoutReminder(reminderHour, reminderMinute);
      } else {
        // Cancel all workout reminders
        await notificationService.cancelWorkoutReminders();
      }
    }
  };

  // Handle reminder time change
  const handleReminderTimeChange = async (hour: number, minute: number) => {
    setReminderHour(hour);
    setReminderMinute(minute);
    
    // Save to settings
    updateSettings({
      workoutReminderHour: hour,
      workoutReminderMinute: minute,
    });

    // Reschedule if reminders are enabled
    if (workoutReminders) {
      await notificationService.scheduleWorkoutReminder(hour, minute);
    }
  };

  // Export data handler
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await exportUserData();
    } catch (error) {
      console.error('Failed to export data:', error);
      Alert.alert(
        'Export Failed',
        error instanceof Error ? error.message : 'Unable to export your data. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Rate app handler
  const handleRateApp = async () => {
    if (await StoreReview.hasAction()) {
      try {
        await StoreReview.requestReview();
      } catch (error) {
        // Fallback to store page if in-app review fails
        const storeUrl = Platform.OS === 'ios'
          ? 'https://apps.apple.com/app/symmetry-fitness/id1234567890'
          : 'https://play.google.com/store/apps/details?id=com.symmetry.fitness';
        Linking.openURL(storeUrl);
      }
    }
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    
    setIsDeletingAccount(true);
    try {
      // Call the secure RPC function to delete user account
      const { error } = await supabase.rpc('delete_user_account');
      
      if (error) {
        console.error('Failed to delete account:', error);
        Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
        return;
      }

      // Cancel all notifications
      await notificationService.cancelAllNotifications();
      
      // Sign out
      await supabase.auth.signOut();
      resetStore();
      
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [{ text: 'OK', onPress: () => router.replace('/onboarding') }]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
      setDeleteInput('');
    }
  };

  // Handle feedback submission
  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert('Error', 'Please enter your feedback message.');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      await dataService.user.submitFeedback(user?.id || null, {
        message: feedbackMessage.trim(),
        category: feedbackCategory,
        email: user?.email,
        deviceModel: Device.modelName || undefined,
        deviceOs: `${Platform.OS} ${Device.osVersion || ''}`.trim(),
        appVersion: Application.nativeApplicationVersion || undefined,
      });

      Alert.alert(
        'Thank You! 🙏',
        'Your feedback has been submitted. We appreciate you helping us improve Symmetry!',
        [{ text: 'OK', onPress: () => setShowFeedbackModal(false) }]
      );
      setFeedbackMessage('');
      setFeedbackCategory('general');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again later.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Legal links
  const openPrivacyPolicy = () => {
    Linking.openURL('https://symmetry.app/privacy');
  };

  const openTermsOfService = () => {
    Linking.openURL('https://symmetry.app/terms');
  };

  // Blacklist from store
  const blacklist = settings.blacklistedExercises;
  const addBlacklistedExercise = useAppStore((s) => s.addBlacklistedExercise);
  const removeBlacklistedExercise = useAppStore((s) => s.removeBlacklistedExercise);
  const [searchExercise, setSearchExercise] = useState('');

  // Macro calculator state
  const [macroForm, setMacroForm] = useState({
    age: '',
    gender: 'male',
    weight: '',
    height: '',
    activity: 'moderate',
    goal: 'maintain',
  });
  const [macroResults, setMacroResults] = useState<{
    bmr: number;
    tdee: number;
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
  } | null>(null);

  // Plate inventory state
  const [inventory, setInventory] = useState({
    barWeight: 45,
    plates: {
      45: 4,
      35: 2,
      25: 4,
      10: 4,
      5: 4,
      2.5: 2,
    } as Record<number, number>,
  });

  const calculateMacros = () => {
    const { age, gender, weight, height, activity, goal } = macroForm;
    
    // Mifflin-St Jeor formula
    let bmr: number;
    if (gender === 'male') {
      bmr = 10 * Number(weight) * 0.453592 + 6.25 * Number(height) * 2.54 - 5 * Number(age) + 5;
    } else {
      bmr = 10 * Number(weight) * 0.453592 + 6.25 * Number(height) * 2.54 - 5 * Number(age) - 161;
    }

    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9,
    };

    const tdee = bmr * activityMultipliers[activity];
    
    let calories: number;
    switch (goal) {
      case 'cut': calories = tdee - 500; break;
      case 'bulk': calories = tdee + 300; break;
      default: calories = tdee;
    }

    const protein = Number(weight) * 1; // 1g per lb
    const fats = (calories * 0.25) / 9;
    const carbs = (calories - protein * 4 - fats * 9) / 4;

    setMacroResults({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fats: Math.round(fats),
    });
  };

  const updatePlateCount = (weight: number, delta: number) => {
    setInventory((prev) => ({
      ...prev,
      plates: {
        ...prev.plates,
        [weight]: Math.max(0, (prev.plates[weight] || 0) + delta),
      },
    }));
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="px-4 py-6 pb-24">
          <Animated.View style={createAnimStyle(headerAnim)} className="mb-6">
            <Text className="text-2xl font-bold text-foreground">Settings</Text>
            <Text className="text-muted-foreground text-sm mt-1">
              Customize your experience
            </Text>
          </Animated.View>

          {/* Cloud Sync Section - Show for GUESTS only */}
          {isGuestAccount && (
            <Animated.View style={createAnimStyle(section1Anim)} className="mb-6">
              <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Cloud Sync
              </Text>
              <Pressable
                onPress={() => router.push('/login')}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center gap-4">
                  <View className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                    <Cloud size={28} color="#0A0A0F" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-foreground">Sign In to Sync</Text>
                    <Text className="text-sm text-muted-foreground">
                      Backup your data and sync across devices
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#71717A" />
                </GlassCard>
              </Pressable>
            </Animated.View>
          )}

          {/* Profile Section */}
          <Animated.View style={createAnimStyle(section1Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Profile
            </Text>
            <Pressable
              onPress={() => setShowProfileEdit(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <GlassCard className="flex-row items-center gap-4">
                <View className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                  <User size={28} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-foreground">{user?.name || 'Athlete'}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {isGuestAccount ? 'Guest Account' : (user?.email || 'No email set')}
                  </Text>
                  {user?.goal && (
                    <Text className="text-xs text-primary mt-0.5">
                      Goal: {getGoalDisplayName(user.goal)}
                    </Text>
                  )}
                </View>
                <Edit3 size={20} color="#71717A" />
              </GlassCard>
            </Pressable>
          </Animated.View>

          {/* Preferences Section */}
          <Animated.View style={createAnimStyle(section2Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Preferences
            </Text>
            <GlassCard className="gap-4">
              <View>
                <Text className="text-sm font-medium text-foreground mb-3">Weight Unit</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => updateSettings({ unit: 'lbs' })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg border-2",
                      settings.unit === 'lbs'
                        ? "bg-primary/20 border-primary"
                        : "bg-card/50 border-border"
                    )}
                  >
                    <Text className={cn(
                      "text-center font-semibold",
                      settings.unit === 'lbs' ? "text-primary" : "text-muted-foreground"
                    )}>
                      Imperial (lbs)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateSettings({ unit: 'kg' })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg border-2",
                      settings.unit === 'kg'
                        ? "bg-primary/20 border-primary"
                        : "bg-card/50 border-border"
                    )}
                  >
                    <Text className={cn(
                      "text-center font-semibold",
                      settings.unit === 'kg' ? "text-primary" : "text-muted-foreground"
                    )}>
                      Metric (kg)
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-3">Height Unit</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => updateSettings({ measurementUnit: 'in' })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg border-2",
                      settings.measurementUnit === 'in'
                        ? "bg-primary/20 border-primary"
                        : "bg-card/50 border-border"
                    )}
                  >
                    <Text className={cn(
                      "text-center font-semibold",
                      settings.measurementUnit === 'in' ? "text-primary" : "text-muted-foreground"
                    )}>
                      Imperial (in)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateSettings({ measurementUnit: 'cm' })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg border-2",
                      settings.measurementUnit === 'cm'
                        ? "bg-primary/20 border-primary"
                        : "bg-card/50 border-border"
                    )}
                  >
                    <Text className={cn(
                      "text-center font-semibold",
                      settings.measurementUnit === 'cm' ? "text-primary" : "text-muted-foreground"
                    )}>
                      Metric (cm)
                    </Text>
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Gym & Training Section */}
          <Animated.View style={createAnimStyle(section3Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Gym & Training
            </Text>
            <View className="gap-2">
              <Pressable
                onPress={() => setShowInventory(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Dumbbell size={20} color="#31D5E3" />
                    <Text className="text-foreground">Plate Inventory</Text>
                  </View>
                  <ChevronRight size={20} color="#71717A" />
                </GlassCard>
              </Pressable>

              <Pressable
                onPress={() => setShowBlacklist(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ban size={20} color="#EF4444" />
                    <Text className="text-foreground">Exercise Blacklist</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">{blacklist.length} exercises</Text>
                </GlassCard>
              </Pressable>
            </View>
          </Animated.View>

          {/* Calculators Section */}
          <Animated.View style={createAnimStyle(section4Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Calculators
            </Text>
            <Pressable
              onPress={() => setShowMacroCalc(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <GlassCard className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <Calculator size={20} color="#F59E0B" />
                  <View>
                    <Text className="text-foreground">Macro Calculator</Text>
                    <Text className="text-xs text-muted-foreground">Mifflin-St Jeor formula</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#71717A" />
              </GlassCard>
            </Pressable>
          </Animated.View>

          {/* Notifications Section */}
          <Animated.View style={createAnimStyle(section5Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Notifications
            </Text>
            <GlassCard className="gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Bell size={20} color="#31D5E3" />
                  <Text className="text-foreground">Workout Reminders</Text>
                </View>
                <Switch 
                  value={workoutReminders}
                  onValueChange={(value) => handleNotificationChange('workoutReminders', value)}
                />
              </View>
              
              {/* Reminder Time Picker - only show when workout reminders are enabled */}
              {workoutReminders && (
                <View className="flex-row items-center justify-between pl-8">
                  <View className="flex-row items-center gap-2">
                    <Clock size={16} color="#71717A" />
                    <Text className="text-muted-foreground text-sm">Reminder Time</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Select 
                      value={reminderHour.toString()} 
                      onValueChange={(v) => handleReminderTimeChange(parseInt(v), reminderMinute)}
                    >
                      <SelectTrigger className="w-16 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Text className="text-muted-foreground">:</Text>
                    <Select 
                      value={reminderMinute.toString()} 
                      onValueChange={(v) => handleReminderTimeChange(reminderHour, parseInt(v))}
                    >
                      <SelectTrigger className="w-16 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {m.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </View>
                </View>
              )}
              
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Bell size={20} color="#31D5E3" />
                  <Text className="text-foreground">Rest Timer Sound</Text>
                </View>
                <Switch 
                  value={restTimerSound}
                  onValueChange={(value) => handleNotificationChange('restTimerSound', value)}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Bell size={20} color="#31D5E3" />
                  <Text className="text-foreground">Progress Updates</Text>
                </View>
                <Switch 
                  value={progressUpdates}
                  onValueChange={(value) => handleNotificationChange('progressUpdates', value)}
                />
              </View>
            </GlassCard>
          </Animated.View>

          {/* Subscription Section */}
          <Animated.View style={createAnimStyle(section6Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Subscription
            </Text>
            <GlassCard variant="glow" glowColor="primary">
              <View className="flex-row items-center gap-3 mb-4">
                <View className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Crown size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text className="font-bold text-foreground">Free Plan</Text>
                  <Text className="text-xs text-muted-foreground">Basic features</Text>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2 mb-4">
                <View className="w-[48%] flex-row items-center gap-2">
                  <Sparkles size={16} color="#31D5E3" />
                  <Text className="text-sm text-foreground">AI Analysis</Text>
                </View>
                <View className="w-[48%] flex-row items-center gap-2">
                  <X size={16} color="#71717A" />
                  <Text className="text-sm text-muted-foreground">Unlimited Scans</Text>
                </View>
                <View className="w-[48%] flex-row items-center gap-2">
                  <Sparkles size={16} color="#31D5E3" />
                  <Text className="text-sm text-foreground">Workout Tracking</Text>
                </View>
                <View className="w-[48%] flex-row items-center gap-2">
                  <X size={16} color="#71717A" />
                  <Text className="text-sm text-muted-foreground">Custom Plans</Text>
                </View>
              </View>
              <Button className="w-full bg-primary">
                <Text className="text-primary-foreground font-semibold">Upgrade to Pro</Text>
              </Button>
            </GlassCard>
          </Animated.View>

          {/* App Management Section */}
          <Animated.View style={createAnimStyle(section7Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              App Management
            </Text>
            <View className="gap-2">
              {/* Send Feedback */}
              <Pressable
                onPress={() => setShowFeedbackModal(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <MessageSquare size={20} color="#31D5E3" />
                    <View>
                      <Text className="text-foreground">Send Feedback</Text>
                      <Text className="text-xs text-muted-foreground">Help us improve the app</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#71717A" />
                </GlassCard>
              </Pressable>

              {/* Rate App */}
              <Pressable
                onPress={handleRateApp}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Star size={20} color="#F59E0B" />
                    <View>
                      <Text className="text-foreground">Rate Symmetry</Text>
                      <Text className="text-xs text-muted-foreground">Share your feedback</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#71717A" />
                </GlassCard>
              </Pressable>

              {/* Export Data */}
              <Pressable
                onPress={handleExportData}
                disabled={isExporting}
                style={({ pressed }) => ({ opacity: pressed || isExporting ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Upload size={20} color="#31D5E3" />
                    <View>
                      <Text className="text-foreground">Export Data</Text>
                      <Text className="text-xs text-muted-foreground">Download your data as JSON</Text>
                    </View>
                  </View>
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#31D5E3" />
                  ) : (
                    <ChevronRight size={20} color="#71717A" />
                  )}
                </GlassCard>
              </Pressable>

              <GlassCard className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Download size={20} color="#31D5E3" />
                  <View>
                    <Text className="text-foreground">Download Assets</Text>
                    <Text className="text-xs text-muted-foreground">For offline use</Text>
                  </View>
                </View>
                <Button variant="outline" size="sm">
                  <Text className="text-foreground text-sm">Download</Text>
                </Button>
              </GlassCard>

              {/* Sign Out - only show for authenticated users */}
              {!isGuestAccount && (
                <Pressable
                  onPress={handleSignOut}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <GlassCard className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <LogOut size={20} color="#F59E0B" />
                      <Text className="text-foreground">Sign Out</Text>
                    </View>
                    <ChevronRight size={20} color="#71717A" />
                  </GlassCard>
                </Pressable>
              )}

              <Pressable
                onPress={() => setShowDeleteConfirm(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between border-destructive/30">
                  <View className="flex-row items-center gap-3">
                    <Trash2 size={20} color="#EF4444" />
                    <Text className="text-destructive">
                      {isGuestAccount ? 'Reset App Data' : 'Delete Account'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#EF4444" />
                </GlassCard>
              </Pressable>
            </View>
          </Animated.View>

          {/* Legal Section */}
          <Animated.View style={createAnimStyle(section7Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Legal
            </Text>
            <View className="gap-2">
              <Pressable
                onPress={openPrivacyPolicy}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Shield size={20} color="#71717A" />
                    <Text className="text-foreground">Privacy Policy</Text>
                  </View>
                  <ChevronRight size={20} color="#71717A" />
                </GlassCard>
              </Pressable>

              <Pressable
                onPress={openTermsOfService}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <FileText size={20} color="#71717A" />
                    <Text className="text-foreground">Terms of Service</Text>
                  </View>
                  <ChevronRight size={20} color="#71717A" />
                </GlassCard>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Dialog open={showProfileEdit} onOpenChange={setShowProfileEdit}>
        <DialogContent>
          <DialogHeader onClose={() => setShowProfileEdit(false)}>
            <View className="flex-row items-center gap-2">
              <Edit3 size={20} color="#31D5E3" />
              <DialogTitle>Edit Profile</DialogTitle>
            </View>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View>
              <Label>Name</Label>
              <Input 
                value={profileForm.name}
                onChangeText={(text) => setProfileForm({ ...profileForm, name: text })}
                placeholder="Your name"
                className="mt-1"
              />
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Label>Age</Label>
                <Input 
                  value={profileForm.age}
                  onChangeText={(text) => setProfileForm({ ...profileForm, age: text })}
                  placeholder="25"
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
              <View className="flex-1">
                <Label>Gender</Label>
                <Select 
                  value={profileForm.gender} 
                  onValueChange={(v) => setProfileForm({ ...profileForm, gender: v as 'male' | 'female' | 'other' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Label>Height ({settings.measurementUnit === 'cm' ? 'cm' : 'in'})</Label>
                <Input 
                  value={profileForm.height}
                  onChangeText={(text) => setProfileForm({ ...profileForm, height: text })}
                  placeholder={settings.measurementUnit === 'cm' ? '175' : '69'}
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
              <View className="flex-1">
                <Label>Weight ({settings.unit === 'kg' ? 'kg' : 'lbs'})</Label>
                <Input 
                  value={profileForm.weight}
                  onChangeText={(text) => setProfileForm({ ...profileForm, weight: text })}
                  placeholder={settings.unit === 'kg' ? '80' : '176'}
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
            </View>

            <View>
              <Label>Fitness Goal</Label>
              <Select 
                value={profileForm.goal} 
                onValueChange={(v) => setProfileForm({ ...profileForm, goal: v as 'bulk' | 'cut' | 'recomp' | 'maintenance' })}
              >
                <SelectTrigger className="mt-1">
                  <Text className="text-foreground">{getGoalDisplayName(profileForm.goal)}</Text>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulk">Build Muscle</SelectItem>
                  <SelectItem value="cut">Lose Fat</SelectItem>
                  <SelectItem value="maintenance">Maintain</SelectItem>
                  <SelectItem value="recomp">Recomposition</SelectItem>
                </SelectContent>
              </Select>
            </View>

            <Button 
              className="w-full mt-2"
              onPress={handleSaveProfile}
              disabled={isLoading}
            >
              <Save size={16} color="#FFFFFF" />
              <Text className="text-white font-medium ml-2">
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      {/* Macro Calculator Modal */}
      <Dialog open={showMacroCalc} onOpenChange={setShowMacroCalc}>
        <DialogContent>
          <DialogHeader onClose={() => setShowMacroCalc(false)}>
            <View className="flex-row items-center gap-2">
              <Calculator size={20} color="#F59E0B" />
              <DialogTitle>Macro Calculator</DialogTitle>
            </View>
            <DialogDescription>
              Calculate your daily macro targets using the Mifflin-St Jeor formula
            </DialogDescription>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View className="flex-row gap-4">
              <View className="flex-1">
                <Label>Age</Label>
                <Input 
                  value={macroForm.age}
                  onChangeText={(text) => setMacroForm({ ...macroForm, age: text })}
                  placeholder="25"
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
              <View className="flex-1">
                <Label>Gender</Label>
                <Select 
                  value={macroForm.gender} 
                  onValueChange={(v) => setMacroForm({ ...macroForm, gender: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Label>Weight (lbs)</Label>
                <Input 
                  value={macroForm.weight}
                  onChangeText={(text) => setMacroForm({ ...macroForm, weight: text })}
                  placeholder="180"
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
              <View className="flex-1">
                <Label>Height (in)</Label>
                <Input 
                  value={macroForm.height}
                  onChangeText={(text) => setMacroForm({ ...macroForm, height: text })}
                  placeholder="70"
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
            </View>

            <View>
              <Label>Activity Level</Label>
              <Select 
                value={macroForm.activity} 
                onValueChange={(v) => setMacroForm({ ...macroForm, activity: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (desk job)</SelectItem>
                  <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                  <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                  <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                  <SelectItem value="veryActive">Very Active (2x/day)</SelectItem>
                </SelectContent>
              </Select>
            </View>

            <View>
              <Label>Goal</Label>
              <Select 
                value={macroForm.goal} 
                onValueChange={(v) => setMacroForm({ ...macroForm, goal: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cut">Cut (-500 cal)</SelectItem>
                  <SelectItem value="maintain">Maintain</SelectItem>
                  <SelectItem value="bulk">Bulk (+300 cal)</SelectItem>
                </SelectContent>
              </Select>
            </View>

            <Button onPress={calculateMacros} className="w-full bg-primary">
              <Text className="text-primary-foreground font-semibold">Calculate</Text>
            </Button>

            {macroResults && (
              <GlassCard className="mt-4">
                <View className="flex-row justify-between mb-4">
                  <View className="items-center flex-1">
                    <Text className="text-2xl font-bold text-primary">{macroResults.calories}</Text>
                    <Text className="text-xs text-muted-foreground">Calories</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-2xl font-bold text-foreground">{macroResults.tdee}</Text>
                    <Text className="text-xs text-muted-foreground">TDEE</Text>
                  </View>
                </View>
                <View className="flex-row justify-between pt-4 border-t border-border">
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-primary">{macroResults.protein}g</Text>
                    <Text className="text-xs text-muted-foreground">Protein</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-warning">{macroResults.carbs}g</Text>
                    <Text className="text-xs text-muted-foreground">Carbs</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-lg font-bold text-success">{macroResults.fats}g</Text>
                    <Text className="text-xs text-muted-foreground">Fats</Text>
                  </View>
                </View>
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onPress={() => setShowMacroCalc(false)}
                >
                  <Text className="text-foreground font-medium">Save Targets</Text>
                </Button>
              </GlassCard>
            )}
          </View>
        </DialogContent>
      </Dialog>

      {/* Inventory Modal */}
      <Dialog open={showInventory} onOpenChange={setShowInventory}>
        <DialogContent>
          <DialogHeader onClose={() => setShowInventory(false)}>
            <View className="flex-row items-center gap-2">
              <Dumbbell size={20} color="#31D5E3" />
              <DialogTitle>Plate Inventory</DialogTitle>
            </View>
            <DialogDescription>
              Set your available plates for accurate plate calculations
            </DialogDescription>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View>
              <Label>Bar Weight (lbs)</Label>
              <View className="flex-row items-center gap-4 mt-2 justify-center">
                <Button 
                  variant="outline" 
                  size="icon"
                  onPress={() => setInventory({ ...inventory, barWeight: Math.max(0, inventory.barWeight - 5) })}
                >
                  <Minus size={16} color="#A1A1AA" />
                </Button>
                <Text className="text-2xl font-bold text-foreground w-16 text-center">{inventory.barWeight}</Text>
                <Button 
                  variant="outline" 
                  size="icon"
                  onPress={() => setInventory({ ...inventory, barWeight: inventory.barWeight + 5 })}
                >
                  <Plus size={16} color="#A1A1AA" />
                </Button>
              </View>
            </View>

            <View>
              <Label>Plates (pairs)</Label>
              <View className="gap-3 mt-2">
                {Object.entries(inventory.plates).map(([weight, count]) => (
                  <View key={weight} className="flex-row items-center justify-between">
                    <Text className="font-medium text-foreground">{weight} lbs</Text>
                    <View className="flex-row items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-8 w-8"
                        onPress={() => updatePlateCount(Number(weight), -1)}
                      >
                        <Minus size={12} color="#A1A1AA" />
                      </Button>
                      <Text className="text-lg font-bold text-foreground w-8 text-center">{count}</Text>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-8 w-8"
                        onPress={() => updatePlateCount(Number(weight), 1)}
                      >
                        <Plus size={12} color="#A1A1AA" />
                      </Button>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <Button className="w-full" onPress={() => setShowInventory(false)}>
              <Text className="text-primary-foreground font-semibold">Save Inventory</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      {/* Blacklist Modal */}
      <Dialog open={showBlacklist} onOpenChange={setShowBlacklist}>
        <DialogContent>
          <DialogHeader onClose={() => setShowBlacklist(false)}>
            <View className="flex-row items-center gap-2">
              <Ban size={20} color="#EF4444" />
              <DialogTitle>Exercise Blacklist</DialogTitle>
            </View>
            <DialogDescription>
              Banned exercises will be excluded from AI-generated plans
            </DialogDescription>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            <View className="relative">
              <View className="absolute left-3 top-1/2 z-10" style={{ transform: [{ translateY: -10 }] }}>
                <Search size={16} color="#71717A" />
              </View>
              <Input 
                placeholder="Search exercises..." 
                value={searchExercise}
                onChangeText={setSearchExercise}
                className="pl-10"
              />
            </View>

            <View className="gap-2">
              {blacklist.map((exercise) => (
                <View key={exercise} className="flex-row items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Text className="text-foreground">{exercise}</Text>
                  <Pressable 
                    onPress={() => removeBlacklistedExercise(exercise)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <X size={16} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>

            {blacklist.length === 0 && (
              <Text className="text-center text-muted-foreground py-4">
                No blacklisted exercises
              </Text>
            )}

            <Button 
              variant="outline" 
              className="w-full"
              onPress={() => {
                if (searchExercise && !blacklist.includes(searchExercise)) {
                  addBlacklistedExercise(searchExercise);
                  setSearchExercise('');
                }
              }}
            >
              <Plus size={16} color="#31D5E3" />
              <Text className="text-foreground ml-2">Add to Blacklist</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="border-destructive/30">
          <DialogHeader onClose={() => setShowDeleteConfirm(false)}>
            <View className="flex-row items-center gap-2">
              <Trash2 size={20} color="#EF4444" />
              <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            </View>
            <DialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          
          <View className="py-4">
            <Label>Type "DELETE" to confirm</Label>
            <Input 
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="DELETE"
              className="mt-2"
            />
          </View>

          <DialogFooter>
            <Button 
              variant="outline" 
              onPress={() => {
                setShowDeleteConfirm(false);
                setDeleteInput('');
              }}
              className="flex-1"
              disabled={isDeletingAccount}
            >
              <Text className="text-foreground">Cancel</Text>
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteInput !== 'DELETE' || isDeletingAccount}
              onPress={handleDeleteAccount}
              className="flex-1"
            >
              <Text className="text-destructive-foreground">
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent>
          <DialogHeader onClose={() => setShowFeedbackModal(false)}>
            <View className="flex-row items-center gap-2">
              <MessageSquare size={20} color="#31D5E3" />
              <DialogTitle>Send Feedback</DialogTitle>
            </View>
            <DialogDescription>
              Help us improve Symmetry by sharing your thoughts
            </DialogDescription>
          </DialogHeader>
          
          <View className="gap-4 py-4">
            {/* Category Selection */}
            <View>
              <Label className="mb-2">Category</Label>
              <View className="flex-row gap-2 flex-wrap">
                {[
                  { value: 'general', label: '💬 General' },
                  { value: 'bug', label: '🐛 Bug Report' },
                  { value: 'feature', label: '✨ Feature' },
                  { value: 'support', label: '🆘 Support' },
                ].map((cat) => (
                  <Pressable
                    key={cat.value}
                    onPress={() => setFeedbackCategory(cat.value as typeof feedbackCategory)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className={cn(
                      "px-3 py-2 rounded-lg border",
                      feedbackCategory === cat.value 
                        ? "bg-primary/20 border-primary" 
                        : "bg-muted/30 border-border"
                    )}>
                      <Text className={cn(
                        "text-sm",
                        feedbackCategory === cat.value ? "text-primary" : "text-muted-foreground"
                      )}>
                        {cat.label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Feedback Message */}
            <View>
              <Label className="mb-2">Your Feedback</Label>
              <TextInput
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                placeholder="Tell us what's on your mind..."
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 12,
                  color: '#FAFAFA',
                  minHeight: 120,
                  fontSize: 14,
                }}
              />
            </View>

            {/* User email display */}
            {user?.email && (
              <View className="bg-muted/30 rounded-lg p-3">
                <Text className="text-xs text-muted-foreground">
                  Feedback will be associated with: <Text className="text-foreground">{user.email}</Text>
                </Text>
              </View>
            )}
          </View>

          <DialogFooter>
            <Button 
              variant="outline" 
              onPress={() => {
                setShowFeedbackModal(false);
                setFeedbackMessage('');
                setFeedbackCategory('general');
              }}
              className="flex-1"
              disabled={isSubmittingFeedback}
            >
              <Text className="text-foreground">Cancel</Text>
            </Button>
            <Button 
              onPress={handleSubmitFeedback}
              className="flex-1 bg-primary"
              disabled={isSubmittingFeedback || !feedbackMessage.trim()}
            >
              {isSubmittingFeedback ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <Send size={16} color="#09090B" />
                  <Text className="text-primary-foreground font-semibold">Send</Text>
                </View>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SafeAreaView>
  );
}