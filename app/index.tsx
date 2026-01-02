import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';

/**
 * Index Route - Initial Entry Point
 * 
 * This component checks if onboarding is completed and redirects accordingly:
 * - If onboarding is not completed → /onboarding
 * - If onboarding is completed → /(tabs)
 */

export default function Index() {
  const router = useRouter();
  const { onboarding } = useAppStore();

  useEffect(() => {
    // Small delay to ensure store is hydrated from storage
    const timer = setTimeout(() => {
      if (onboarding.completed) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [onboarding.completed, router]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color="#31D5E3" />
    </View>
  );
}
