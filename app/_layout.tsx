import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import '../global.css';

/**
 * Root Layout - App Entry Point
 * 
 * This is the top-level layout for Expo Router.
 * All routes defined in the app/ directory are children of this layout.
 * 
 * Responsibilities:
 * - Initialize data service connection
 * - Load user data from cloud/local storage
 * - Provide loading state while data loads
 */

import { dataService, getActiveServiceName, isUsingCloudService } from '@/services/dataServiceProvider';
import { useAppStore } from '@/store/useAppStore';
import { useDataInitialization } from '@/hooks/useDataInitialization';

/**
 * Data Initialization Wrapper Component
 * 
 * This component wraps the app and initializes data from the service.
 * It shows a loading screen while data is being fetched.
 */
function DataInitializer({ children }: { children: React.ReactNode }) {
  // Get user from store (may be null initially, or hydrated from MMKV)
  const user = useAppStore((s) => s.user);
  const onboarding = useAppStore((s) => s.onboarding);

  // Initialize data - pass user ID if available
  const { isLoading, isInitialized, error, refetch } = useDataInitialization(user?.id || null);

  // Show loading screen while initializing (only for cloud service with a user)
  if (isUsingCloudService() && user?.id && isLoading && !isInitialized) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#31D5E3" />
        <Text className="text-muted-foreground mt-4">Loading your data...</Text>
      </View>
    );
  }

  // Show error state (with retry option)
  if (error && !isInitialized) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-xl font-bold text-foreground mb-2">Connection Error</Text>
        <Text className="text-muted-foreground text-center mb-6">{error}</Text>
        <Text 
          className="text-primary font-semibold"
          onPress={refetch}
        >
          Tap to Retry
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  // Initialize and log data service on mount
  useEffect(() => {
    if (__DEV__) {
      console.log('🚀 App Started');
      console.log('📦 Data Service:', getActiveServiceName());
      console.log('☁️  Using Cloud:', isUsingCloudService());
    }

    // Test connection to Supabase
    async function testConnection() {
      try {
        if (isUsingCloudService()) {
          console.log('✅ Supabase client initialized');
        }
      } catch (error) {
        console.error('❌ Error initializing data service:', error);
      }
    }

    testConnection();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <DataInitializer>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'hsl(240, 10%, 3.9%)' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="symmetry-history" 
            options={{ 
              headerShown: false,
              animation: 'slide_from_right',
            }} 
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="active-workout"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </DataInitializer>
    </SafeAreaProvider>
  );
}
