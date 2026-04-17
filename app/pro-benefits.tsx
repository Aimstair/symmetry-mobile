import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Crown, Check, ChevronLeft, ExternalLink, ScanLine, Zap, Sparkles, Shield } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { showAppAlert } from '@/store/useAlertStore';
import { subscriptionService, type SubscriptionStatus } from '@/services/SubscriptionService';
import { useAppStore } from '@/store/useAppStore';

const PRO_FEATURES = [
  {
    icon: ScanLine,
    title: 'Weekly Physique Scans',
    description: 'Track physique updates every 7 days instead of monthly.',
  },
  {
    icon: Zap,
    title: 'Advanced Metrics (RPE)',
    description: 'Use exertion tracking inside workouts for smarter progressive overload.',
  },
  {
    icon: Sparkles,
    title: 'AI Analysis & Insights',
    description: 'Get guided execution, progression, and recovery insights for each exercise.',
  },
  {
    icon: Shield,
    title: 'Priority Support',
    description: 'Receive faster support for setup, billing, and feature issues.',
  },
];

export default function ProBenefits() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isPro = useAppStore((s) => s.isPro);

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningManage, setIsOpeningManage] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      try {
        if (user?.id) {
          await subscriptionService.initialize(user.id);
        }

        const nextStatus = await subscriptionService.getSubscriptionStatus();
        if (mounted) {
          setStatus(nextStatus);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to load subscription status:', error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const renewalText = useMemo(() => {
    if (!status?.expirationDate) return 'No active renewal date available.';

    const date = status.expirationDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return status.willRenew ? `Renews on ${date}` : `Ends on ${date}`;
  }, [status?.expirationDate, status?.willRenew]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/settings');
  };

  const handleManageSubscription = async () => {
    setIsOpeningManage(true);
    try {
      const opened = await subscriptionService.openManageSubscriptionSettings();
      if (!opened) {
        showAppAlert(
          'Unable to Open Subscription Settings',
          'Please open your App Store or Google Play subscriptions page manually to manage or cancel your plan.'
        );
      }
    } finally {
      setIsOpeningManage(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-border">
        <Pressable onPress={handleBack} className="w-10 h-10 rounded-full bg-card items-center justify-center">
          <ChevronLeft size={20} color="#A1A1AA" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">Pro Plan</Text>
          <Text className="text-xs text-muted-foreground">Benefits and subscription management</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <GlassCard variant="glow" glowColor="primary" className="mb-4">
          <View className="flex-row items-center gap-3 mb-2">
            <View className="w-12 h-12 rounded-xl bg-primary items-center justify-center">
              <Crown size={22} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-foreground text-base">{isPro ? 'Pro Active' : 'Free Plan'}</Text>
              <Text className="text-xs text-muted-foreground">{isPro ? renewalText : 'Upgrade to unlock all premium features.'}</Text>
            </View>
          </View>
          {status?.productIdentifier && isPro && (
            <Text className="text-xs text-muted-foreground mt-1">Current plan: {status.productIdentifier}</Text>
          )}
        </GlassCard>

        <View className="gap-3 mb-5">
          {PRO_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <GlassCard key={feature.title}>
                <View className="flex-row items-start gap-3">
                  <View className="w-9 h-9 rounded-lg bg-primary/15 items-center justify-center">
                    <Icon size={18} color="#31D5E3" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="font-semibold text-foreground">{feature.title}</Text>
                      <Check size={14} color="#22C55E" />
                    </View>
                    <Text className="text-sm text-muted-foreground">{feature.description}</Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
        </View>

        {isLoading ? (
          <View className="items-center py-3">
            <ActivityIndicator size="small" color="#31D5E3" />
            <Text className="text-xs text-muted-foreground mt-2">Loading subscription details...</Text>
          </View>
        ) : isPro ? (
          <>
            <Button
              className="w-full h-12"
              variant="outline"
              onPress={handleManageSubscription}
              disabled={isOpeningManage}
            >
              <ExternalLink size={16} color="#31D5E3" />
              <Text className="text-foreground font-semibold ml-2">
                {isOpeningManage ? 'Opening...' : 'Manage or Cancel Subscription'}
              </Text>
            </Button>
            <Text className="text-xs text-muted-foreground text-center mt-3">
              Subscription changes are managed securely in your App Store or Google Play account.
            </Text>
          </>
        ) : (
          <Button className="w-full h-12 bg-primary" onPress={() => router.push('/paywall')}>
            <Crown size={16} color="#FFFFFF" />
            <Text className="text-primary-foreground font-semibold ml-2">Upgrade to Pro</Text>
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
