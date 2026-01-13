import { useState, useEffect } from 'react';
import { View, Text, Platform, Alert, ActivityIndicator, StyleSheet, Pressable, Linking as RNLinking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking'; // ✅ Added for createURL
import Constants from 'expo-constants';
import { GlassCard } from '@/components/ui/GlassCard';
import { Sparkles, Dumbbell } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

/**
 * Login Screen - Guest-First Architecture
 * * Features:
 * - Continue with Apple (native iOS flow)
 * - Continue with Google (OAuth browser flow)
 * - Syncs local guest data to cloud on successful sign-in
 */

// Required for web browser auth to complete properly
WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get store actions for syncing guest data
  const isGuest = useAppStore((s) => s.isGuest);
  const syncGuestDataToCloud = useAppStore((s) => s.syncGuestDataToCloud);

  /**
   * Google Sign-In using OAuth browser flow
   */
  const performGoogleSignIn = async () => {
    try {
      setIsLoading(true);

      // 1. Create the Deep Link
      // Ensure this matches your Supabase > Auth > URL Configuration > Site URL
      // Force the 'symmetry' scheme to avoid redirecting to Expo Go in production
      const redirectUri = Linking.createURL('/', { scheme: 'symmetry' });

      console.log('🔗 OAuth redirect URI:', redirectUri);

      // 2. Setup Listener
      let linkingListener: any;
      const authPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (linkingListener) linkingListener.remove();
          reject(new Error('OAuth timed out after 2 minutes'));
        }, 120000);

        linkingListener = RNLinking.addEventListener('url', (event) => {
          if (event.url.includes('access_token') || event.url.includes('refresh_token')) {
            clearTimeout(timeout);
            if (linkingListener) linkingListener.remove();
            resolve(event.url);
          }
        });
      });

      // 3. Start Flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      // 4. Handle Browser & Return
      if (data?.url) {
        await WebBrowser.openBrowserAsync(data.url);
        const callbackUrl = await authPromise;
        WebBrowser.dismissBrowser();

        // 5. Parse Tokens
        let params: URLSearchParams | null = null;
        if (callbackUrl.includes('#')) {
          const hashPart = callbackUrl.split('#')[1];
          params = new URLSearchParams(hashPart);
        }
        if ((!params || !params.get('access_token')) && callbackUrl.includes('?')) {
            const queryPart = callbackUrl.split('?')[1].split('#')[0];
            params = new URLSearchParams(queryPart);
        }
        
        if (!params) throw new Error('Could not parse callback URL');
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';

        if (!accessToken) throw new Error('No access token in callback URL');

        // 6. Set Session
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) throw sessionError;

        // === CRITICAL FIX STARTS HERE ===
        
        // A. Force Onboarding Completion immediately
        // This overrides the "Profile Not Found" check so the router doesn't bounce you back
        useAppStore.getState().completeOnboarding();

        if (__DEV__) {
          console.log('✅ Session set & Onboarding forced to TRUE');
        }

        // B. Sync Guest Data (if needed)
        if (isGuest && sessionData?.user) {
          // We don't await this here to prevent navigation delay
          syncGuestDataToCloud({
            id: sessionData.user.id,
            email: sessionData.user.email || '',
          }).catch(err => console.error('Background sync failed:', err));
        }

        // C. Safe Navigation with Timeout
        // We wait 100ms to allow the Root Layout to process the new Auth State
        // This prevents the "Attempted to navigate before mounting" error
        setTimeout(() => {
          if (router.canDismiss()) router.dismissAll(); // Clear stack
          router.replace('/(tabs)');
        }, 100);

        // === CRITICAL FIX ENDS HERE ===
      }
    } catch (error: any) {
      console.error('❌ Google Sign-In error:', error);
      if (error.message !== 'OAuth timed out after 2 minutes') {
          Alert.alert('Sign-In Failed', error.message);
      }
    } finally {
      setIsLoading(false);
      WebBrowser.dismissBrowser();
    }
  };


  return (
    <View className="flex-1">
      {/* Gradient Background */}
      <LinearGradient
        colors={['#0A0A0F', '#0F1419', '#0A0A0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Accent Glow Effects */}
      <View 
        style={[StyleSheet.absoluteFill, styles.glowTop]}
        pointerEvents="none"
      />
      <View 
        style={[StyleSheet.absoluteFill, styles.glowBottom]}
        pointerEvents="none"
      />
      
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 px-6 justify-center">
          {/* Logo / Branding */}
          <View className="items-center mb-12">
            {/* Animated Icon with Glow */}
            <View className="relative mb-6">
              <View className="absolute inset-0 bg-primary/30 rounded-3xl blur-xl scale-125" />
              <View className="w-28 h-28 rounded-3xl bg-card/80 items-center justify-center overflow-hidden">
                <View className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                  <Image source={require('../assets/logo.png')} style={{ width: 120, height: 100, borderRadius: 24 }} />
              </View>
            </View>
            
            <Text className="text-5xl font-bold text-foreground mb-3" style={styles.titleShadow}>
              Symmetry
            </Text>
            <View className="flex-row items-center gap-2">
              <Sparkles size={16} color="#31D5E3" />
              <Text className="text-lg text-primary font-medium">
                Unlock your potential
              </Text>
              <Sparkles size={16} color="#31D5E3" />
            </View>
          </View>

          {/* Auth Card */}
          <GlassCard variant="glow" glowColor="primary" className="p-6">
            <Text className="text-center text-muted-foreground mb-6 text-sm leading-relaxed">
              Sign in to sync your workouts, track progress, and unlock AI-powered training insights.
            </Text>

            <View className="gap-3">
            {/* Google Sign-In Button */}
            <Pressable
              onPress={performGoogleSignIn}
              disabled={isLoading}
              // We apply the base styles, and conditional styles based on state
              style={({ pressed }) => [
                styles.googleButtonContainer,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                // Use standard Gray for spinner on white background
                <ActivityIndicator size="small" color="#333333" />
              ) : (
                <View style={styles.googleContentContainer}>
                  {/* The "G" Icon placeholder */}
                  <Text style={styles.googleGText}>G</Text>

                  {/* The Main Text */}
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              )}
            </Pressable>
          </View>

            <Text className="text-xs text-muted-foreground/70 text-center mt-6 leading-5">
              By continuing, you agree to our{' '}
              <Text className="text-primary">Terms of Service</Text>
              {' '}and{' '}
              <Text className="text-primary">Privacy Policy</Text>.
            </Text>
          </GlassCard>

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <GlassCard className="p-6 items-center">
                <ActivityIndicator size="large" color="#31D5E3" />
                <Text className="text-foreground mt-3 font-medium">
                  Signing in with Google...
                </Text>
              </GlassCard>
            </View>
          )}
        </View>

        <View className="px-6 pb-4">
          <Text className="text-xs text-muted-foreground/40 text-center">
            Symmetry Fitness v1.0.0
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  glowTop: {
    backgroundColor: 'transparent',
    opacity: 0.15,
    shadowColor: '#31D5E3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 100,
  },
  glowBottom: {
    backgroundColor: 'transparent',
    opacity: 0.1,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 120,
  },
  titleShadow: {
    textShadowColor: 'rgba(49, 213, 227, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 10,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonContainer: {
    backgroundColor: '#FFFFFF', // White background for contrast
    flexDirection: 'row', // Align items horizontally
    justifyContent: 'center', // Center content horizontally
    alignItems: 'center', // Center content vertically
    paddingVertical: 14, // Taller buttons are easier to tap
    paddingHorizontal: 24,
    borderRadius: 30, // Modern "stadium" roundness
    borderWidth: 1,
    borderColor: '#E0E0E0', // Subtle border so it doesn't blend into white backgrounds
    // Optional: Add a subtle shadow for elevation
    shadowColor: "#000",
    shadowOffset: {
	width: 0,
	height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.00,
    elevation: 1,
  },
  // Inner container to ensure the text and icon stay together when centered
  googleContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The style for the "G" text
  googleGText: {
    fontSize: 22,
    fontWeight: 'bold',
    // Using the standard Google Blue for the 'G'
    color: '#4285F4',
    marginRight: 12, // Space between icon and text
  },
  // The main button text style
  googleButtonText: {
    color: '#333333', // Dark gray/almost black for high visibility
    fontSize: 16,
    fontWeight: '600', // Semi-bold makes it pop more
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});