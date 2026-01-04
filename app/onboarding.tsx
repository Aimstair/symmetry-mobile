import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronRight,
  ChevronLeft,
  User,
  Target,
  Dumbbell,
  Calendar,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { dataService, isUsingCloudService } from '@/services/dataServiceProvider';

/**
 * Onboarding Page - React Native Implementation
 * 
 * Migration Notes:
 * - Removed framer-motion (AnimatePresence, motion.div)
 * - Replaced div with View, p/h1 with Text
 * - Replaced useNavigate with router from expo-router
 * - Icons from lucide-react-native with size/color props
 * - Grid layouts converted to Flexbox
 * - Added KeyboardAvoidingView for form inputs
 * - SafeAreaView for notch/dynamic island
 * - Removed hover states, using Pressable active states
 */

const steps = [
  { id: 1, title: 'Biometrics', icon: User },
  { id: 2, title: 'Goals', icon: Target },
  { id: 3, title: 'Equipment', icon: Dumbbell },
  { id: 4, title: 'Schedule', icon: Calendar },
  { id: 5, title: 'Consent', icon: Shield },
];

const experienceLevels = [
  { value: 'beginner', label: 'Beginner', desc: 'Less than 1 year' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years' },
];

const goals = [
  { value: 'bulk', label: 'Build Muscle', desc: 'Gain strength & size' },
  { value: 'cut', label: 'Lose Fat', desc: 'Get lean & shredded' },
  { value: 'maintain', label: 'Maintain', desc: 'Stay where I am' },
  { value: 'recomp', label: 'Recomposition', desc: 'Build muscle, lose fat' },
];

const equipmentTypes = [
  { value: 'gym', label: 'Full Gym', desc: 'Access to all equipment' },
  { value: 'home', label: 'Home Gym', desc: 'Limited equipment' },
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Onboarding() {
  const { updateOnboarding, completeOnboarding, setUser } = useAppStore();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // Get the current Supabase session on mount
  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSessionUserId(session.user.id);
        setSessionEmail(session.user.email || null);
        
        if (__DEV__) {
          console.log('👤 Onboarding for user:', session.user.email, session.user.id);
        }
      } else {
        // No session - redirect back to login
        if (__DEV__) {
          console.log('⚠️ No session in onboarding, redirecting to login');
        }
        router.replace('/login');
      }
    }
    getSession();
  }, []);

  const [formData, setFormData] = useState({
    height: '',
    weight: '',
    age: '',
    gender: 'male' as 'male' | 'female' | 'other',
    experience: '' as 'beginner' | 'intermediate' | 'advanced' | '',
    goal: '' as 'bulk' | 'cut' | 'maintain' | 'recomp' | '',
    equipment: '' as 'gym' | 'home' | '',
    frequency: 7 as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    selectedDays: [] as string[],
    biometricConsent: false,
    ageVerified: false,
    termsAccepted: false,
  });

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.height && formData.weight && formData.age && formData.gender;
      case 2:
        return formData.experience && formData.goal;
      case 3:
        return formData.equipment;
      case 4:
        return formData.selectedDays.length === formData.frequency;
      case 5:
        return formData.biometricConsent && formData.ageVerified && formData.termsAccepted;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      // Complete onboarding - save user with Supabase session ID
      if (!sessionUserId) {
        Alert.alert('Error', 'No authenticated session found. Please sign in again.');
        router.replace('/login');
        return;
      }

      setIsSubmitting(true);

      try {
        // Create the user object with the Supabase user ID
        const newUser = {
          id: sessionUserId,
          name: sessionEmail?.split('@')[0] || 'Athlete', // Use email prefix as default name
          email: sessionEmail || '',
          height: Number(formData.height),
          weight: Number(formData.weight),
          age: Number(formData.age),
          gender: formData.gender,
          experienceLevel: formData.experience as 'beginner' | 'intermediate' | 'advanced',
          goal: (formData.goal === 'maintain' ? 'maintenance' : formData.goal) as 'bulk' | 'cut' | 'recomp' | 'maintenance',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Save to cloud if using cloud service
        if (isUsingCloudService()) {
          try {
            await dataService.user.createUser(newUser);
            if (__DEV__) {
              console.log('✅ User profile saved to Supabase:', newUser.id);
            }
          } catch (error: any) {
            // If user already exists, try updating instead
            if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
              await dataService.user.updateUser(newUser.id, newUser);
              if (__DEV__) {
                console.log('✅ User profile updated in Supabase:', newUser.id);
              }
            } else {
              throw error;
            }
          }
        }

        // Update local store
        setUser(newUser);
        completeOnboarding();

        if (__DEV__) {
          console.log('🎉 Onboarding completed for user:', newUser.id);
        }

        router.replace('/(tabs)');
      } catch (error: any) {
        console.error('❌ Error saving user profile:', error);
        Alert.alert(
          'Error',
          error.message || 'Failed to save your profile. Please try again.'
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDayToggle = (day: string) => {
    const newDays = formData.selectedDays.includes(day)
      ? formData.selectedDays.filter((d) => d !== day)
      : formData.selectedDays.length < formData.frequency
        ? [...formData.selectedDays, day]
        : formData.selectedDays;
    setFormData({ ...formData, selectedDays: newDays });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          {/* Progress */}
          <View className="flex-row items-center justify-between mb-8">
            {steps.map((s, i) => (
              <View key={s.id} className="flex-row items-center">
                <View
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    step >= s.id
                      ? 'bg-primary'
                      : 'bg-muted'
                  )}
                >
                  <s.icon
                    size={20}
                    color={step >= s.id ? '#0A0A0F' : '#71717A'}
                  />
                </View>
                {i < steps.length - 1 && (
                  <View
                    className={cn(
                      'w-6 h-0.5 mx-1',
                      step > s.id ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Step Content */}
          <View>
            {/* Step 1: Biometrics */}
            {step === 1 && (
              <View>
                <Text className="text-2xl font-bold mb-2 text-foreground">
                  Let's get to know you
                </Text>
                <Text className="text-muted-foreground mb-6">
                  We'll use this to customize your training
                </Text>

                <View className="gap-4">
                  <View className="flex-row gap-4">
                    <View className="flex-1">
                      <Label>Height (cm)</Label>
                      <Input
                        keyboardType="numeric"
                        value={formData.height}
                        onChangeText={(text) => setFormData({ ...formData, height: text })}
                        placeholder="175"
                        className="mt-1"
                      />
                    </View>
                    <View className="flex-1">
                      <Label>Weight (kg)</Label>
                      <Input
                        keyboardType="numeric"
                        value={formData.weight}
                        onChangeText={(text) => setFormData({ ...formData, weight: text })}
                        placeholder="80"
                        className="mt-1"
                      />
                    </View>
                  </View>

                  <View>
                    <Label>Age</Label>
                    <Input
                      keyboardType="numeric"
                      value={formData.age}
                      onChangeText={(text) => setFormData({ ...formData, age: text })}
                      placeholder="25"
                      className="mt-1"
                    />
                  </View>

                  <View>
                    <Label className="mb-2">Gender</Label>
                    <View className="flex-row gap-2">
                      {(['male', 'female', 'other'] as const).map((g) => (
                        <View key={g} className="flex-1">
                          <Button
                            variant={formData.gender === g ? 'default' : 'outline'}
                            className={cn(
                              'w-full',
                              formData.gender === g && 'bg-primary'
                            )}
                            onPress={() => setFormData({ ...formData, gender: g })}
                          >
                            <Text className={cn(
                              'font-semibold',
                              formData.gender === g ? 'text-primary-foreground' : 'text-foreground'
                            )}>
                              {g.charAt(0).toUpperCase() + g.slice(1)}
                            </Text>
                          </Button>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Step 2: Experience & Goals */}
            {step === 2 && (
              <View>
                <Text className="text-2xl font-bold mb-2 text-foreground">
                  Your Training Background
                </Text>
                <Text className="text-muted-foreground mb-6">
                  This helps us calibrate your program
                </Text>

                <View className="gap-6">
                  <View>
                    <Label className="mb-3">Experience Level</Label>
                    <View className="gap-2">
                      {experienceLevels.map((level) => (
                        <GlassCard
                          key={level.value}
                          className={cn(
                            formData.experience === level.value && 'border-primary'
                          )}
                          onPress={() =>
                            setFormData({ ...formData, experience: level.value as any })
                          }
                        >
                          <View className="flex-row items-center justify-between">
                            <View>
                              <Text className="font-semibold text-foreground">
                                {level.label}
                              </Text>
                              <Text className="text-sm text-muted-foreground">
                                {level.desc}
                              </Text>
                            </View>
                            {formData.experience === level.value && (
                              <View className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <ChevronRight size={16} color="#0A0A0F" />
                              </View>
                            )}
                          </View>
                        </GlassCard>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Label className="mb-3">Primary Goal</Label>
                    <View className="flex-row flex-wrap gap-2">
                      {goals.map((goal) => (
                        <View key={goal.value} className="w-[48%]">
                          <GlassCard
                            className={cn(
                              'items-center py-4',
                              formData.goal === goal.value && 'border-primary'
                            )}
                            onPress={() =>
                              setFormData({ ...formData, goal: goal.value as any })
                            }
                          >
                            <Text className="font-semibold text-foreground text-center">
                              {goal.label}
                            </Text>
                            <Text className="text-xs text-muted-foreground text-center">
                              {goal.desc}
                            </Text>
                          </GlassCard>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Step 3: Equipment */}
            {step === 3 && (
              <View>
                <Text className="text-2xl font-bold mb-2 text-foreground">
                  Your Equipment
                </Text>
                <Text className="text-muted-foreground mb-6">
                  Where will you be training?
                </Text>

                <View className="gap-3">
                  {equipmentTypes.map((eq) => (
                    <GlassCard
                      key={eq.value}
                      className={cn(
                        formData.equipment === eq.value && 'border-primary'
                      )}
                      onPress={() =>
                        setFormData({ ...formData, equipment: eq.value as any })
                      }
                    >
                      <View className="flex-row items-center gap-4">
                        <View
                          className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center',
                            formData.equipment === eq.value ? 'bg-primary' : 'bg-muted'
                          )}
                        >
                          <Dumbbell
                            size={24}
                            color={
                              formData.equipment === eq.value ? '#0A0A0F' : '#71717A'
                            }
                          />
                        </View>
                        <View>
                          <Text className="font-semibold text-foreground">
                            {eq.label}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {eq.desc}
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              </View>
            )}

            {/* Step 4: Schedule */}
            {step === 4 && (
              <View>
                <Text className="text-2xl font-bold mb-2 text-foreground">
                  Training Schedule
                </Text>
                <Text className="text-muted-foreground mb-6">
                  How often can you train?
                </Text>

                <View className="gap-6">
                  <View>
                    <Label className="mb-3">Days per week</Label>
                    <View className="flex-row gap-2">
                      {([1, 2, 3, 4, 5, 6, 7] as const).map((num) => (
                        <View key={num} className="flex-1">
                          <Button
                            variant={formData.frequency === num ? 'default' : 'outline'}
                            className={cn(
                              'w-full',
                              formData.frequency === num && 'bg-primary'
                            )}
                            onPress={() =>
                              setFormData({ ...formData, frequency: num, selectedDays: [] })
                            }
                          >
                            <Text className={cn(
                              'font-semibold',
                              formData.frequency === num ? 'text-primary-foreground' : 'text-foreground'
                            )}>
                              {num}
                            </Text>
                          </Button>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Label className="mb-3">
                      Select {formData.frequency} training days
                    </Label>
                    <View className="flex-row flex-wrap gap-4 justify-center">
                      {days.map((day) => {
                        const isSelected = formData.selectedDays.includes(day);
                        const isDisabled = !isSelected && formData.selectedDays.length >= formData.frequency;
                        return (
                          <View key={day} className="w-[48%]">
                            <Button
                              variant={isSelected ? 'default' : 'outline'}
                              className={cn(
                                'w-full',
                                isSelected && 'bg-primary',
                                !isDisabled && 'opacity-100'
                              )}
                              onPress={() => handleDayToggle(day)}
                              disabled={isDisabled}
                            >
                              <Text className={cn(
                                'font-semibold',
                                isSelected ? 'text-primary-foreground' : 'text-foreground'
                              )}>
                                {day.slice(0, 3)}
                              </Text>
                            </Button>
                          </View>
                        );
                      })}
                    </View>
                    <Text className="text-xs text-muted-foreground mt-2 text-center">
                      {formData.selectedDays.length} of {formData.frequency} selected
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Step 5: Consent */}
            {step === 5 && (
              <View>
                <Text className="text-2xl font-bold mb-2 text-foreground">
                  Almost There!
                </Text>
                <Text className="text-muted-foreground mb-6">
                  Please review and accept our terms
                </Text>

                <View className="gap-4">
                  <GlassCard className="gap-6">
                    <View className="flex-row items-start gap-3">
                      <Checkbox
                        checked={formData.biometricConsent}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, biometricConsent: checked })
                        }
                      />
                      <View className="flex-1">
                        <Label className="font-medium">Biometric Data Consent</Label>
                        <Text className="text-xs text-muted-foreground mt-1">
                          I consent to the collection and analysis of my body measurements
                          and physique photos for AI-powered training recommendations.
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-start gap-3">
                      <Checkbox
                        checked={formData.ageVerified}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, ageVerified: checked })
                        }
                      />
                      <View className="flex-1">
                        <Label className="font-medium">Age Verification</Label>
                        <Text className="text-xs text-muted-foreground mt-1">
                          I confirm that I am at least 18 years of age.
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-start gap-3">
                      <Checkbox
                        checked={formData.termsAccepted}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, termsAccepted: checked })
                        }
                      />
                      <View className="flex-1">
                        <Label className="font-medium">Terms of Service</Label>
                        <Text className="text-xs text-muted-foreground mt-1">
                          I agree to the Terms of Service and Privacy Policy.
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                </View>
              </View>
            )}
          </View>

          {/* Bottom padding for fixed navigation */}
          <View className="h-24" />
        </ScrollView>

        {/* Fixed Bottom Navigation */}
        <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border">
          <SafeAreaView edges={['bottom']}>
            <View className="flex-row gap-3 p-4">
              {step > 1 && (
                <View className="flex-1">
                  <Button
                    variant="outline"
                    onPress={() => setStep(step - 1)}
                    className="w-full"
                    disabled={isSubmitting}
                    leftIcon={<ChevronLeft size={16} color="#FAFAFA" />}
                  >
                    <Text className="text-foreground font-semibold">Back</Text>
                  </Button>
                </View>
              )}
              <View className={cn('flex-1', step === 1 && 'w-full')}>
                <Button
                  onPress={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  className={cn(
                    'w-full',
                    canProceed() && !isSubmitting ? 'bg-primary opacity-100' : 'bg-muted opacity-50'
                  )}
                  leftIcon={step === 5 ? (
                    isSubmitting ? (
                      <ActivityIndicator size="small" color="#0A0A0F" />
                    ) : (
                      <Sparkles size={16} color={canProceed() ? '#0A0A0F' : '#71717A'} />
                    )
                  ) : undefined}
                  rightIcon={step !== 5 ? <ChevronRight size={16} color={canProceed() ? '#0A0A0F' : '#71717A'} /> : undefined}
                >
                  <Text className={cn(
                    'font-semibold',
                    canProceed() && !isSubmitting ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}>
                    {step === 5 
                      ? (isSubmitting ? 'Setting up...' : 'Start Training') 
                      : 'Continue'}
                  </Text>
                </Button>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
