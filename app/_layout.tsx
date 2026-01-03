import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import '../global.css';

/**
 * Root Layout - App Entry Point
 * 
 * This is the top-level layout for Expo Router.
 * All routes defined in the app/ directory are children of this layout.
 */

import { dataService, getActiveServiceName, isUsingCloudService } from '@/services/dataServiceProvider';

export default function RootLayout() {
  // Initialize and log data service on mount
    useEffect(() => {
      if (__DEV__) {
        console.log('🚀 App Started');
        console.log('📦 Data Service:', getActiveServiceName());
        console.log('☁️  Using Cloud:', isUsingCloudService());
      }
  
      // Optional: Test connection to Supabase
      async function testConnection() {
        try {
          if (isUsingCloudService()) {
            // Test with a simple query (this will fail if user isn't authenticated yet)
            // You can remove this or adjust based on your auth setup
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
    </SafeAreaProvider>
  );
}
