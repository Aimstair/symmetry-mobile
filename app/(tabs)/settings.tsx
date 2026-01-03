import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
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
  Save
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
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

  // Get store data and actions
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const equipment = useAppStore((s) => s.equipment);
  const nutritionTargets = useAppStore((s) => s.nutritionTargets);
  const syncUpdateUserToCloud = useAppStore((s) => s.syncUpdateUserToCloud);
  const setNutritionTargets = useAppStore((s) => s.setNutritionTargets);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetStore = useAppStore((s) => s.resetStore);
  const isLoading = useAppStore((s) => s.isLoading);

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
      setProfileForm({
        name: user.name || '',
        age: user.age?.toString() || '',
        gender: user.gender || 'male',
        height: user.height?.toString() || '',
        weight: user.weight?.toString() || '',
        goal: user.goal || 'maintenance',
      });
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      headerAnim.setValue(0);
      section1Anim.setValue(0);
      section2Anim.setValue(0);
      section3Anim.setValue(0);
      section4Anim.setValue(0);
      section5Anim.setValue(0);
      section6Anim.setValue(0);
      
      Animated.stagger(60, [
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section3Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section4Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section5Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(section6Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, [headerAnim, section1Anim, section2Anim, section3Anim, section4Anim, section5Anim, section6Anim])
  );

  const createAnimStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
  });

  // Handle profile save
  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      await syncUpdateUserToCloud(user.id, {
        name: profileForm.name,
        age: parseInt(profileForm.age) || user.age,
        gender: profileForm.gender as UserType['gender'],
        height: parseFloat(profileForm.height) || user.height,
        weight: parseFloat(profileForm.weight) || user.weight,
        goal: profileForm.goal as UserType['goal'],
      });
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
              // Still reset store and redirect even if signOut fails
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

  // Notification toggles - synced with store
  const workoutReminders = settings.notifications.workoutReminders;
  const restTimerSound = settings.notifications.restTimerSound;
  const progressUpdates = settings.notifications.progressUpdates;

  const handleNotificationChange = (key: 'workoutReminders' | 'restTimerSound' | 'progressUpdates', value: boolean) => {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });
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
                  <Text className="text-sm text-muted-foreground">{user?.email || 'No email set'}</Text>
                  {user?.goal && (
                    <Text className="text-xs text-primary capitalize mt-0.5">
                      Goal: {user.goal.replace('-', ' ')}
                    </Text>
                  )}
                </View>
                <Edit3 size={20} color="#71717A" />
              </GlassCard>
            </Pressable>
          </Animated.View>

          {/* Gym & Training Section */}
          <Animated.View style={createAnimStyle(section2Anim)} className="mb-6">
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
          <Animated.View style={createAnimStyle(section3Anim)} className="mb-6">
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
          <Animated.View style={createAnimStyle(section4Anim)} className="mb-6">
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
          <Animated.View style={createAnimStyle(section5Anim)} className="mb-6">
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
          <Animated.View style={createAnimStyle(section6Anim)} className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              App Management
            </Text>
            <View className="gap-2">
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

              <Pressable
                onPress={() => setShowDeleteConfirm(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <GlassCard className="flex-row items-center justify-between border-destructive/30">
                  <View className="flex-row items-center gap-3">
                    <Trash2 size={20} color="#EF4444" />
                    <Text className="text-destructive">Delete Account</Text>
                  </View>
                  <ChevronRight size={20} color="#EF4444" />
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
                <Label>Height (in)</Label>
                <Input 
                  value={profileForm.height}
                  onChangeText={(text) => setProfileForm({ ...profileForm, height: text })}
                  placeholder="70"
                  keyboardType="numeric"
                  className="mt-1"
                />
              </View>
              <View className="flex-1">
                <Label>Weight (lbs)</Label>
                <Input 
                  value={profileForm.weight}
                  onChangeText={(text) => setProfileForm({ ...profileForm, weight: text })}
                  placeholder="180"
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
                  <SelectValue />
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
              onPress={() => setShowDeleteConfirm(false)}
              className="flex-1"
            >
              <Text className="text-foreground">Cancel</Text>
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteInput !== 'DELETE'}
              onPress={() => {
                // Handle delete
                setShowDeleteConfirm(false);
              }}
              className="flex-1"
            >
              <Text className="text-destructive-foreground">Delete Account</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SafeAreaView>
  );
}
