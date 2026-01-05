import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
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
      
      // **FIX: Immediately fetch user profile on SIGNED_IN to prevent login loop**
      if (_event === 'SIGNED_IN' && session?.user?.id) {
        if (__DEV__) {
          console.log('🔍 SIGNED_IN - Starting profile fetch for:', session.user.email);
          console.log('🔍 Session user ID:', session.user.id);
        }
        
        setIsProfileLoading(true);
        setProfileChecked(false); // Reset to ensure this handler completes
        
        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          const isCloud = isUsingCloudService();
          if (__DEV__) {
            console.log('🔍 isUsingCloudService:', isCloud);
          }
          
          if (isCloud) {
            if (__DEV__) {
              console.log('🔍 Fetching user profile for ID:', session.user.id);
            }
            
            // Add timeout to prevent infinite hang
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Profile fetch timeout after 10s')), 10000)
            );
            
            let cloudUser: Awaited<ReturnType<typeof dataService.user.getUser>> = null;
            try {
              cloudUser = await Promise.race([
                dataService.user.getUser(session.user.id),
                timeoutPromise
              ]);
            } catch (fetchError) {
              if (__DEV__) {
                console.log('⚠️ User fetch error/timeout:', fetchError);
              }
              // Treat timeout/error as user not found - redirect to onboarding
              cloudUser = null;
            }
            
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
          } else {
            if (__DEV__) {
              console.log('⚠️ Not using cloud service, skipping profile fetch');
            }
          }
        } catch (error) {
          console.error('❌ Error fetching user profile:', error);
          if (error instanceof Error) {
            console.error('❌ Error details:', error.message, error.stack);
          }
        } finally {
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

  // Fetch user profile from cloud when session exists
  useEffect(() => {
    async function fetchUserProfile() {
      if (!session?.user?.id || profileChecked || user) return;
      
      setIsProfileLoading(true);
      
      try {
        if (isUsingCloudService()) {
          const cloudUser = await dataService.user.getUser(session.user.id);
          
          if (cloudUser) {
            // User exists in database - update store
            setUser(cloudUser);
            completeOnboarding();
            
            if (__DEV__) {
              console.log('✅ User profile loaded from cloud:', cloudUser.email);
            }
          } else {
            if (__DEV__) {
              console.log('ℹ️ No user profile found - needs onboarding');
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.log('⚠️ Could not fetch user profile:', error);
        }
      } finally {
        setIsProfileLoading(false);
        setProfileChecked(true);
      }
    }

    if (session && !profileChecked) {
      fetchUserProfile();
    }
  }, [session, profileChecked, user, setUser, completeOnboarding]);

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
 * Navigation Guard Component
 * 
 * Handles navigation after the Stack is mounted.
 * This component is rendered INSIDE the Stack, ensuring navigation is safe.
 */
function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  
  // Get user and onboarding state from store
  const user = useAppStore((s) => s.user);
  const onboarding = useAppStore((s) => s.onboarding);
  
  // Track session state for navigation decisions
  const [hasSession, setHasSession] = useState(false);
  
  // Check for active Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Check if navigation is ready
  const navigationReady = rootNavigationState?.key != null;

  useEffect(() => {
    if (!navigationReady) {
      if (__DEV__) {
        console.log('🧭 Waiting for navigation to be ready...');
      }
      return;
    }

    if (__DEV__) {
      console.log('🧭 Navigation check:', {
        hasSession,
        hasUser: !!user,
        onboardingCompleted: onboarding.completed,
        currentSegment: segments[0],
        segmentsLength: segments.length,
      });
    }

    // Get current route info
    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'login';
    const inAuthCallback = currentSegment === 'auth';
    const inOnboarding = currentSegment === 'onboarding';
    const inTabs = currentSegment === '(tabs)';
    const onIndex = currentSegment === 'index' || currentSegment === undefined;

    // Don't redirect if we're in the auth callback
    if (inAuthCallback) {
      return;
    }

    // Navigation logic based on session and user profile
    if (hasSession) {
      // User is authenticated with Supabase
      if (user) {
        // Has profile - go to tabs (or onboarding if not completed)
        if (inAuthGroup || onIndex) {
          if (!onboarding.completed) {
            if (__DEV__) {
              console.log('🧭 Redirecting to onboarding (has user, not completed)');
            }
            router.replace('/onboarding');
          } else {
            if (__DEV__) {
              console.log('🧭 Redirecting to tabs (has user, completed)');
            }
            router.replace('/(tabs)');
          }
        }
      } else {
        // Has session but no profile - needs onboarding (first-time user)
        if (!inOnboarding) {
          if (__DEV__) {
            console.log('🧭 Redirecting to onboarding (has session, no profile)');
          }
          router.replace('/onboarding');
        }
      }
    } else {
      // No session - needs login
      if (!inAuthGroup && (onIndex || inOnboarding)) {
        if (__DEV__) {
          console.log('🧭 Redirecting to login (no session)');
        }
        router.replace('/login');
      }
    }
  }, [navigationReady, segments, user, onboarding.completed, router, hasSession]);

  return null; // This component just handles navigation, doesn't render anything
}

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
