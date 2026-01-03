// /**
//  * Integration Example for app/_layout.tsx
//  * 
//  * This file shows how to integrate the data service provider into your app.
//  * Copy the relevant parts into your actual app/_layout.tsx file.
//  */

// import { Stack } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { useEffect } from 'react';
// import '../global.css';

// // Import the data service provider
// import { dataService, getActiveServiceName, isUsingCloudService } from '@/services/dataServiceProvider';

// /**
//  * Root Layout - App Entry Point
//  * 
//  * This is the top-level layout for Expo Router.
//  * All routes defined in the app/ directory are children of this layout.
//  */
// export default function RootLayout() {
//   // Initialize and log data service on mount
//   useEffect(() => {
//     if (__DEV__) {
//       console.log('🚀 App Started');
//       console.log('📦 Data Service:', getActiveServiceName());
//       console.log('☁️  Using Cloud:', isUsingCloudService());
//     }

//     // Optional: Test connection to Supabase
//     async function testConnection() {
//       try {
//         if (isUsingCloudService()) {
//           // Test with a simple query (this will fail if user isn't authenticated yet)
//           // You can remove this or adjust based on your auth setup
//           console.log('✅ Supabase client initialized');
//         }
//       } catch (error) {
//         console.error('❌ Error initializing data service:', error);
//       }
//     }

//     testConnection();
//   }, []);

//   return (
//     <SafeAreaProvider>
//       <StatusBar style="light" />
//       <Stack
//         screenOptions={{
//           headerShown: false,
//           contentStyle: { backgroundColor: 'hsl(240, 10%, 3.9%)' },
//           animation: 'slide_from_right',
//         }}
//       >
//         <Stack.Screen name="index" options={{ headerShown: false }} />
//         <Stack.Screen name="onboarding" options={{ headerShown: false }} />
//         <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
//         <Stack.Screen
//           name="active-workout"
//           options={{
//             presentation: 'fullScreenModal',
//             animation: 'slide_from_bottom',
//           }}
//         />
//       </Stack>
//     </SafeAreaProvider>
//   );
// }

// /**
//  * USAGE IN YOUR COMPONENTS/SCREENS:
//  * 
//  * Instead of importing localService directly, import dataService:
//  * 
//  * ```typescript
//  * import { dataService } from '@/services/dataServiceProvider';
//  * 
//  * // In your component
//  * const MyComponent = () => {
//  *   const userId = 'some-user-id';
//  * 
//  *   useEffect(() => {
//  *     async function loadData() {
//  *       // This will automatically use either LocalService or CloudService
//  *       const plans = await dataService.workout.getWorkoutPlans(userId);
//  *       console.log('Workout plans:', plans);
//  *     }
//  *     loadData();
//  *   }, [userId]);
//  * 
//  *   return <View>...</View>;
//  * };
//  * ```
//  * 
//  * SWITCHING BETWEEN SERVICES:
//  * 
//  * Local Development:
//  * - Set EXPO_PUBLIC_DATA_SERVICE=local in .env
//  * - Uses AsyncStorage (no network required)
//  * 
//  * Testing with Supabase locally:
//  * - Set EXPO_PUBLIC_DATA_SERVICE=cloud in .env
//  * - Set EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
//  * - Set EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-key
//  * 
//  * Production:
//  * - Set EXPO_PUBLIC_DATA_SERVICE=cloud in .env
//  * - Set EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//  * - Set EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-key
//  */
