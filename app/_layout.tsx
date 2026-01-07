import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import '../global.css';

// Prevent auto-hide splash screen
SplashScreen.preventAutoHideAsync();

/**
 * Root Layout - App Entry Point with Authentication Gate
 * 
 * This is the top-level layout for Expo Router.
 * All routes defined in the app/ directory are children of this layout.
 * 
 * Responsibilities:
 * - Manage Supabase authentication session
 * - Route protection (login vs authenticated routes)
 * - Initialize data service connection
 * - Load user data from cloud/local storage
 * - Provide loading state while data loads
 */

import { dataService, getActiveServiceName, isUsingCloudService } from '@/services/dataServiceProvider';
import { useAppStore } from '@/store/useAppStore';
import { useDataInitialization } from '@/hooks/useDataInitialization';
import { supabase } from '@/lib/supabase';
import { initializeExerciseLookup } from '@/hooks/useExercises';

/**
 * Extract OAuth tokens from a deep link URL
 */
function extractTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } | null {
  try {
    // Handle both hash fragments (#) and query params (?)
    let params: URLSearchParams;
    
    if (url.includes('#')) {
      const fragment = url.split('#')[1];
      params = new URLSearchParams(fragment);
    } else if (url.includes('?')) {
      const query = url.split('?')[1];
      params = new URLSearchParams(query);
    } else {
      return null;
    }

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token) {
      return { access_token, refresh_token: refresh_token || undefined };
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.error('Error extracting tokens from URL:', error);
    }
    return null;
  }
}

/**
 * Authentication Provider Component
 * 
 * Manages the Supabase session and handles routing based on auth state.
 * Fetches user profile from cloud when session exists.
 */
function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const isFetchingProfile = useRef(false); // Prevent concurrent fetches
  
  // Get user and onboarding state from store
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const onboarding = useAppStore((s) => s.onboarding);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  // Handle deep link URL for OAuth callback
  const handleDeepLink = useCallback(async (url: string) => {
    if (__DEV__) {
      console.log('🔗 Deep link received:', url);
    }

    // Check if this is an auth callback
    if (url.includes('auth/callback') || url.includes('access_token')) {
      const tokens = extractTokensFromUrl(url);
      
      if (tokens?.access_token) {
        if (__DEV__) {
          console.log('🔐 Setting session from deep link tokens...');
        }
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || '',
          });

          if (error) {
            console.error('Failed to set session:', error.message);
          } else if (data.session) {
            if (__DEV__) {
              console.log('✅ Session set successfully from deep link');
            }
          }
        } catch (error) {
          console.error('Error setting session:', error);
        }
      }
    }
  }, []);

  // Initialize auth session and set up listeners
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        // Check for initial URL (app opened via deep link)
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          if (__DEV__) {
            console.log('📱 App opened with URL:', initialUrl);
          }
          await handleDeepLink(initialUrl);
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted) {
          setSession(session);
          setIsAuthLoading(false);
          
          if (__DEV__) {
            console.log('🔐 Initial session:', session ? `User: ${session.user.email}` : 'No session');
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error initializing auth:', error);
        }
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen for deep link events while app is running
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      if (__DEV__) {
        console.log('🔄 Auth state changed:', _event, session?.user?.email || 'No user');
      }
      
      setSession(session);
      
      // Reset profile check when auth changes
      if (!session) {
        setProfileChecked(false);
        return;
      }
      
      // Handle profile fetch for SIGNED_IN and INITIAL_SESSION
      // INITIAL_SESSION = existing session restored from storage
      // SIGNED_IN = new sign-in completed
      const shouldFetchProfile = (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') 
        && session?.user?.id 
        && !isFetchingProfile.current;
      
      if (shouldFetchProfile) {
        if (__DEV__) {
          console.log(`🔍 ${_event} - Starting profile fetch for:`, session.user.email);
          console.log('🔍 Session user ID:', session.user.id);
        }
        
        isFetchingProfile.current = true;
        setIsProfileLoading(true);
        setProfileChecked(false);
        
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (isFetchingProfile.current) {
            if (__DEV__) {
              console.log('⚠️ Profile fetch timeout - proceeding without profile');
            }
            isFetchingProfile.current = false;
            setIsProfileLoading(false);
            setProfileChecked(true);
            // Session is preserved - user will go to onboarding
          }
        }, 4000); // 4 second timeout
        
        try {
          if (!isUsingCloudService()) {
            if (__DEV__) {
              console.log('⚠️ Not using cloud service, skipping profile fetch');
            }
            clearTimeout(timeoutId);
            isFetchingProfile.current = false;
            setIsProfileLoading(false);
            setProfileChecked(true);
            return;
          }
          
          if (__DEV__) {
            console.log('🔍 Fetching user profile for ID:', session.user.id);
          }
          
          const cloudUser = await dataService.user.getUser(session.user.id);
          
          if (__DEV__) {
            console.log('🔍 User fetch result:', cloudUser ? `Found: ${cloudUser.email}` : 'Not found');
          }
          
          if (cloudUser) {
            // User exists in database - update store
            setUser(cloudUser);
            completeOnboarding();
            
            if (__DEV__) {
              console.log('✅ User profile loaded and store updated');
            }
          } else {
            if (__DEV__) {
              console.log('ℹ️ No user profile found - user needs onboarding');
            }
          }
        } catch (error) {
          console.error('❌ Error fetching user profile:', error);
          if (error instanceof Error) {
            console.error('❌ Error details:', error.message, error.stack);
          }
          // Don't throw - proceed to onboarding even on error
        } finally {
          clearTimeout(timeoutId);
          isFetchingProfile.current = false;
          if (__DEV__) {
            console.log('✅ Profile fetch complete, clearing loading state');
          }
          setIsProfileLoading(false);
          setProfileChecked(true);
        }
      }
    });

    // Refresh token when app comes to foreground
    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      isMounted = false;
      linkingSubscription.remove();
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [handleDeepLink]);

  // Note: Profile fetch is now handled in the SIGNED_IN event above
  // This useEffect is disabled to prevent duplicate fetches
  
  // Initialize exercise lookup cache for sync access
  useEffect(() => {
    if (session && profileChecked && isUsingCloudService()) {
      // Initialize exercise cache in background
      initializeExerciseLookup().catch((error) => {
        if (__DEV__) {
          console.log('⚠️ Failed to initialize exercise cache:', error);
        }
      });
    }
  }, [session, profileChecked]);

  // Handle routing based on auth state
  useEffect(() => {
    if (isAuthLoading || isProfileLoading) return;
    if (session && !profileChecked) return; // Wait for profile check

    // Mark as ready and hide splash screen first
    if (!isReady) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [session, isAuthLoading, isProfileLoading, profileChecked, isReady]);

  // Show loading while checking auth or loading profile
  if (isAuthLoading || isProfileLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#31D5E3" />
        <Text className="text-muted-foreground mt-4">
          {isProfileLoading ? 'Loading profile...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Navigation Guard Component (Guest-First Architecture)
 * 
 * Handles navigation after the Stack is mounted.
 * No login required - new users go straight to onboarding.
 * Login is optional via Settings screen.
 */
function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  
  // Get onboarding state from store (no session check needed for navigation)
  const onboarding = useAppStore((s) => s.onboarding);
  
  // Check if navigation is ready
  const navigationReady = rootNavigationState?.key != null;

  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationReady) {
      return;
    }

    if (__DEV__) {
      console.log('🧭 Navigation check (Guest-First):', {
        onboardingCompleted: onboarding.completed,
        currentSegment: segments[0],
      });
    }

    // Get current route info
    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'login';
    const inAuthCallback = currentSegment === 'auth';
    const inOnboarding = currentSegment === 'onboarding';
    const inTabs = currentSegment === '(tabs)';
    const onIndex = currentSegment === 'index' || currentSegment === undefined;

    // Don't redirect if we're in the auth callback or login (user explicitly navigated there)
    if (inAuthCallback || inAuthGroup) {
      return;
    }

    // Guest-First Navigation Logic:
    // 1. Not onboarded? → Go to onboarding
    // 2. Onboarded? → Go to tabs
    if (!onboarding.completed) {
      // User hasn't completed onboarding
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else {
      // User has completed onboarding - go to main app
      if (onIndex || inOnboarding) {
        router.replace('/(tabs)');
      }
    }
  }, [navigationReady, segments, onboarding.completed, router]);

  return null; // This component just handles navigation, doesn't render anything
}

/**
 * Data Initialization Wrapper Component
 * 
 * This component wraps the app and initializes data from the service.
 * It shows a loading screen while data is being fetched.
 * Also handles auto-finishing stale workouts from previous days.
 */
function DataInitializer({ children }: { children: React.ReactNode }) {
  // Get user from store (may be null initially, or hydrated from MMKV)
  const user = useAppStore((s) => s.user);
  const onboarding = useAppStore((s) => s.onboarding);
  const activeWorkout = useAppStore((s) => s.activeWorkout);
  const endWorkout = useAppStore((s) => s.endWorkout);

  // Initialize data - pass user ID if available
  const { isLoading, isInitialized, error, refetch } = useDataInitialization(user?.id || null);

  // Auto-finish stale workouts from previous days
  useEffect(() => {
    if (!activeWorkout.isActive || !activeWorkout.startTime) return;

    const checkAndAutoFinish = async () => {
      const startTime = new Date(activeWorkout.startTime!);
      const now = new Date();
      
      // Check if the workout was started on a different day
      const startDay = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (startDay < today) {
        if (__DEV__) {
          console.log('🔄 Auto-finishing stale workout from:', startTime.toISOString());
        }

        // Check if there are any completed sets to save
        const exerciseSets = activeWorkout.exerciseSets || {};
        const hasCompletedSets = Object.values(exerciseSets).some(
          (sets) => sets.some((s) => s.isCompleted)
        );

        if (hasCompletedSets && user?.id) {
          try {
            // Prepare session data from stored exercise sets
            const sessionExercises = Object.entries(exerciseSets)
              .filter(([_, sets]) => sets.some((s) => s.isCompleted))
              .map(([exerciseId, sets]) => ({
                exerciseId,
                sets: sets
                  .filter((s) => s.isCompleted)
                  .map((s) => ({
                    weight: s.weight || 0,
                    reps: s.reps || 0,
                    isWarmup: s.isWarmup || false,
                    isCompleted: s.isCompleted || false,
                  })),
              }));

            // Save to cloud
            await dataService.history.saveWorkoutSession({
              userId: user.id,
              planId: activeWorkout.workoutId || undefined,
              name: 'Auto-saved Workout',
              startedAt: startTime,
              endedAt: new Date(startDay.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000), // End of that day
              warmupMode: activeWorkout.warmupMode,
              deloadMode: activeWorkout.deloadMode,
              exercises: sessionExercises,
            });

            if (__DEV__) {
              console.log('✅ Stale workout auto-saved to cloud');
            }
          } catch (error) {
            console.error('❌ Failed to auto-save stale workout:', error);
          }
        }

        // End the workout regardless
        endWorkout();
        
        if (__DEV__) {
          console.log('✅ Stale workout ended');
        }
      }
    };

    checkAndAutoFinish();
  }, [activeWorkout.isActive, activeWorkout.startTime, user?.id]);

  // Also check when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && activeWorkout.isActive && activeWorkout.startTime) {
        const startTime = new Date(activeWorkout.startTime);
        const now = new Date();
        
        const startDay = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (startDay < today) {
          // Trigger re-render to run the auto-finish check
          // The above useEffect will handle the actual auto-finish
          if (__DEV__) {
            console.log('🔄 App resumed with stale workout, will auto-finish');
          }
        }
      }
    });

    return () => subscription.remove();
  }, [activeWorkout.isActive, activeWorkout.startTime]);

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
      <AuthProvider>
        <DataInitializer>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'hsl(240, 10%, 3.9%)' },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="workout-builder" options={{ headerShown: false }} />
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
          <NavigationGuard />
        </DataInitializer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
