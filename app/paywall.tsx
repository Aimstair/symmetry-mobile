/**
 * Paywall Screen - Subscription Upgrade UI
 * 
 * Shows subscription options and handles purchases via RevenueCat.
 * Displays comparison between Free and Pro tiers.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  X, 
  Crown, 
  Check, 
  Sparkles,
  ScanLine,
  Zap,
  Shield,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { subscriptionService, type SubscriptionPackage } from '@/services/SubscriptionService';

// Package identifiers from RevenueCat
const PACKAGE_YEARLY = '$rc_annual';
const PACKAGE_MONTHLY = '$rc_monthly';

export default function Paywall() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isFromOnboarding = onboarding === 'true';
  
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  
  const isPro = useAppStore((s) => s.isPro);
  const setIsPro = useAppStore((s) => s.setIsPro);
  const user = useAppStore((s) => s.user);

  // Navigate to tabs (used for close/skip/success)
  const navigateToTabs = () => {
    router.replace('/(tabs)');
  };

  // Load available packages on mount
  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        await subscriptionService.initialize(user.id);
      }
      const availablePackages = await subscriptionService.getOfferings();
      setPackages(availablePackages);
      
      // Default to yearly package
      const yearlyPkg = availablePackages.find(p => p.identifier === PACKAGE_YEARLY);
      if (yearlyPkg) {
        setSelectedPackage(yearlyPkg.identifier);
      } else if (availablePackages.length > 0) {
        setSelectedPackage(availablePackages[0].identifier);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    setIsPurchasing(true);
    try {
      const result = await subscriptionService.purchasePackage(packageId);
      
      if (result.success) {
        setIsPro(true);
        Alert.alert(
          'Welcome to Pro! 🎉',
          'You now have access to weekly physique scans and all premium features.',
          [{ text: 'Awesome!', onPress: navigateToTabs }]
        );
      } else if (result.error === 'cancelled') {
        // User cancelled - do nothing
      } else {
        Alert.alert('Purchase Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      const result = await subscriptionService.restorePurchases();
      
      if (result.success && result.isPro) {
        setIsPro(true);
        Alert.alert(
          'Purchases Restored!',
          'Your Pro subscription has been restored.',
          [{ text: 'Great!', onPress: navigateToTabs }]
        );
      } else if (result.success) {
        Alert.alert('No Purchases Found', 'No active subscriptions were found for your account.');
      } else {
        Alert.alert('Restore Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const openTerms = () => {
    Linking.openURL('https://symmetry.app/terms');
  };

  const openPrivacy = () => {
    Linking.openURL('https://symmetry.app/privacy');
  };

  // Find package details
  const yearlyPackage = packages.find(p => p.identifier === PACKAGE_YEARLY);
  const monthlyPackage = packages.find(p => p.identifier === PACKAGE_MONTHLY);

  // If already pro, show confirmation
  if (isPro) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Crown size={64} color="#F59E0B" />
          <Text className="text-2xl font-bold text-foreground mt-4">You're a Pro! 👑</Text>
          <Text className="text-muted-foreground text-center mt-2">
            You already have access to all premium features.
          </Text>
          <Button className="mt-8" onPress={isFromOnboarding ? navigateToTabs : () => router.back()}>
            <Text className="text-primary-foreground font-semibold">
              {isFromOnboarding ? 'Get Started' : 'Go Back'}
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable 
          onPress={isFromOnboarding ? navigateToTabs : () => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-card"
        >
          <X size={24} color="#A1A1AA" />
        </Pressable>
        <View className="flex-1" />
        {/* Skip button only shown when coming from onboarding */}
        {isFromOnboarding && (
          <Pressable onPress={navigateToTabs}>
            <Text className="text-muted-foreground text-base">Skip for now</Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero Section */}
        <View className="items-center px-6 py-8">
          <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-4">
            <Crown size={40} color="#31D5E3" />
          </View>
          <Text className="text-3xl font-bold text-foreground text-center">
            Unlock Symmetry Pro
          </Text>
          <Text className="text-muted-foreground text-center mt-2 text-lg">
            Scan more often. Progress faster.
          </Text>
        </View>

        {/* Comparison Table */}
        <View className="px-6 mb-8">
          <GlassCard className="overflow-hidden">
            {/* Header Row */}
            <View className="flex-row border-b border-border">
              <View className="flex-1 p-4">
                <Text className="text-muted-foreground font-medium">Feature</Text>
              </View>
              <View className="flex-1 p-4 items-center border-l border-border">
                <Text className="text-muted-foreground font-medium">Free</Text>
              </View>
              <View className="flex-1 p-4 items-center border-l border-border bg-primary/10">
                <View className="flex-row items-center gap-1">
                  <Crown size={14} color="#F59E0B" />
                  <Text className="text-primary font-bold">Pro</Text>
                </View>
              </View>
            </View>

            {/* Physique Scans Row */}
            <View className="flex-row border-b border-border">
              <View className="flex-1 p-4 flex-row items-center gap-2">
                <ScanLine size={18} color="#A1A1AA" />
                <Text className="text-foreground">Physique Scans</Text>
              </View>
              <View className="flex-1 p-4 items-center border-l border-border">
                <Text className="text-muted-foreground">1 / month</Text>
              </View>
              <View className="flex-1 p-4 items-center border-l border-border bg-primary/10">
                <Text className="text-primary font-semibold">1 / week</Text>
              </View>
            </View>

            {/* AI Analysis Row */}
            <View className="flex-row border-b border-border">
              <View className="flex-1 p-4 flex-row items-center gap-2">
                <Sparkles size={18} color="#A1A1AA" />
                <Text className="text-foreground">AI Analysis</Text>
              </View>
              <View className="flex-1 p-4 items-center border-l border-border">
                <Check size={20} color="#22C55E" />
              </View>
              <View className="flex-1 p-4 items-center border-l border-border bg-primary/10">
                <Check size={20} color="#22C55E" />
              </View>
            </View>

            {/* Priority Support Row */}
            <View className="flex-row">
              <View className="flex-1 p-4 flex-row items-center gap-2">
                <Zap size={18} color="#A1A1AA" />
                <Text className="text-foreground">Priority Support</Text>
              </View>
              <View className="flex-1 p-4 items-center border-l border-border">
                <X size={20} color="#EF4444" />
              </View>
              <View className="flex-1 p-4 items-center border-l border-border bg-primary/10">
                <Check size={20} color="#22C55E" />
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Package Selection */}
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#31D5E3" />
            <Text className="text-muted-foreground mt-2">Loading plans...</Text>
          </View>
        ) : (
          <View className="px-6 gap-4">
            {/* Yearly Package */}
            {yearlyPackage && (
              <Pressable 
                onPress={() => setSelectedPackage(yearlyPackage.identifier)}
                disabled={isPurchasing}
              >
                <GlassCard 
                  className={`relative overflow-hidden ${
                    selectedPackage === yearlyPackage.identifier 
                      ? 'border-2 border-primary' 
                      : 'border border-border'
                  }`}
                >
                  {/* Best Value Badge */}
                  <View className="absolute top-0 right-0 bg-primary px-3 py-1 rounded-bl-lg">
                    <Text className="text-primary-foreground text-xs font-bold">BEST VALUE</Text>
                  </View>
                  
                  {/* Intro Offer Badge */}
                  {yearlyPackage.product.introPrice && (
                    <View className="absolute top-0 left-0 bg-success px-3 py-1 rounded-br-lg">
                      <Text className="text-white text-xs font-bold">
                        {yearlyPackage.product.introPrice.price === 0 ? '7-Day Free Trial' : 'Intro Offer'}
                      </Text>
                    </View>
                  )}
                  
                  <View className="p-4">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-lg font-bold text-foreground">Yearly</Text>
                        <Text className="text-muted-foreground">
                          {yearlyPackage.product.introPrice?.price === 0 
                            ? '7-day free trial' 
                            : 'Cancel anytime'}
                        </Text>
                      </View>
                      <View className="items-end">
                        {yearlyPackage.product.introPrice && yearlyPackage.product.introPrice.price > 0 ? (
                          <>
                            <Text className="text-sm text-muted-foreground line-through">
                              {yearlyPackage.product.priceString}
                            </Text>
                            <Text className="text-2xl font-bold text-success">
                              {yearlyPackage.product.introPrice.priceString}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                              for 1st {yearlyPackage.product.introPrice.periodNumberOfUnits > 1 
                                ? `${yearlyPackage.product.introPrice.periodNumberOfUnits} ${yearlyPackage.product.introPrice.periodUnit}s` 
                                : yearlyPackage.product.introPrice.periodUnit}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text className="text-2xl font-bold text-foreground">
                              {yearlyPackage.product.priceString}
                            </Text>
                            <Text className="text-muted-foreground text-sm">/year</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            )}

            {/* Monthly Package */}
            {monthlyPackage && (
              <Pressable 
                onPress={() => setSelectedPackage(monthlyPackage.identifier)}
                disabled={isPurchasing}
              >
                <GlassCard 
                  className={`relative overflow-hidden ${
                    selectedPackage === monthlyPackage.identifier 
                      ? 'border-2 border-primary' 
                      : 'border border-border'
                  }`}
                >
                  {/* Intro Offer Badge for Monthly */}
                  {monthlyPackage.product.introPrice && (
                    <View className="absolute top-0 right-0 bg-success px-3 py-1 rounded-bl-lg">
                      <Text className="text-white text-xs font-bold">
                        {monthlyPackage.product.introPrice.price === 0 ? 'Free Trial' : 'Intro Offer'}
                      </Text>
                    </View>
                  )}
                  
                  <View className="p-4">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-lg font-bold text-foreground">Monthly</Text>
                        <Text className="text-muted-foreground">Cancel anytime</Text>
                      </View>
                      <View className="items-end">
                        {monthlyPackage.product.introPrice && monthlyPackage.product.introPrice.price > 0 ? (
                          <>
                            <Text className="text-sm text-muted-foreground line-through">
                              {monthlyPackage.product.priceString}
                            </Text>
                            <Text className="text-2xl font-bold text-success">
                              {monthlyPackage.product.introPrice.priceString}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                              for 1st mo
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text className="text-2xl font-bold text-foreground">
                              {monthlyPackage.product.priceString}
                            </Text>
                            <Text className="text-muted-foreground text-sm">/month</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            )}

            {/* Subscribe Button */}
            <Button
              className="mt-4 h-14"
              onPress={() => selectedPackage && handlePurchase(selectedPackage)}
              disabled={isPurchasing || !selectedPackage}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-primary-foreground font-bold text-lg">
                  {(() => {
                    const pkg = selectedPackage === PACKAGE_YEARLY ? yearlyPackage : monthlyPackage;
                    if (pkg?.product.introPrice?.price === 0) {
                      return 'Start Free Trial';
                    }
                    if (pkg?.product.introPrice) {
                      return `Start at ${pkg.product.introPrice.priceString}`;
                    }
                    return 'Subscribe Now';
                  })()}
                </Text>
              )}
            </Button>

            {/* Trial Info */}
            {(() => {
              const pkg = selectedPackage === PACKAGE_YEARLY ? yearlyPackage : monthlyPackage;
              if (pkg?.product.introPrice?.price === 0) {
                return (
                  <View className="flex-row items-center justify-center gap-2 mt-2">
                    <Shield size={16} color="#22C55E" />
                    <Text className="text-muted-foreground text-sm">
                      Cancel anytime during trial. No charge.
                    </Text>
                  </View>
                );
              }
              if (pkg?.product.introPrice) {
                return (
                  <View className="flex-row items-center justify-center gap-2 mt-2">
                    <Shield size={16} color="#22C55E" />
                    <Text className="text-muted-foreground text-sm">
                      Then {pkg.product.priceString} after intro period.
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>
        )}

        {/* Footer Links */}
        <View className="px-6 mt-8">
          <View className="flex-row items-center justify-center gap-4">
            <Pressable onPress={handleRestore} disabled={isPurchasing}>
              <Text className="text-primary text-sm">Restore Purchases</Text>
            </Pressable>
            <Text className="text-muted-foreground">•</Text>
            <Pressable onPress={openTerms}>
              <Text className="text-primary text-sm">Terms of Service</Text>
            </Pressable>
            <Text className="text-muted-foreground">•</Text>
            <Pressable onPress={openPrivacy}>
              <Text className="text-primary text-sm">Privacy Policy</Text>
            </Pressable>
          </View>
          
          <Text className="text-muted-foreground text-xs text-center mt-4">
            Payment will be charged to your Google Play account at confirmation of purchase. 
            Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
