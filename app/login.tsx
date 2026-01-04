import { useState, useEffect } from 'react';
import { View, Text, Platform, Alert, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { GlassCard } from '@/components/ui/GlassCard';
import { Sparkles, Dumbbell } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

/**
 * Login Screen - Glassmorphism Welcome
 * 
 * Features:
 * - Continue with Apple (native iOS flow)
 * - Continue with Google (OAuth browser flow)
 * - Stunning gradient background with glassmorphism card
 * - Apple HIG compliant buttons
 */

// Required for web browser auth to complete properly
WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check if Apple Authentication is available (iOS only)
  useEffect(() => {
    async function checkAppleAuth() {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      }
    }
    checkAppleAuth();
  }, []);

  /**
   * Google Sign-In using OAuth browser flow
   */
  const performGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setLoadingProvider('google');

      // For Expo Go development, we need to use a different approach
      // because Supabase redirects to site_url, not the custom scheme
      const isExpoGo = !Constants.appOwnership || Constants.appOwnership === 'expo';
      
      // Get the Supabase URL from environment
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://192.168.68.104.nip.io:54321';
      
      // In development/Expo Go, use an Edge Function to handle the OAuth callback
      // This displays a nice page that can redirect back to the app
      // In production builds, use the custom scheme directly
      const redirectUri = isExpoGo 
        ? `${supabaseUrl}/functions/v1/auth-callback`  // Edge function handles redirect
        : makeRedirectUri({
            scheme: 'symmetry',
            path: 'auth/callback',
          });

      if (__DEV__) {
        console.log('🔗 Google OAuth Redirect URI:', redirectUri);
        console.log('📱 Running in Expo Go:', isExpoGo);
      }

      // Start OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open the OAuth URL in a web browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri,
          {
            showInRecents: true,
          }
        );

        if (__DEV__) {
          console.log('🌐 WebBrowser result:', result.type, 'url' in result ? result.url?.substring(0, 100) + '...' : 'no url');
        }

        if (result.type === 'success' && result.url) {
          // Extract tokens from the URL hash fragment
          const url = result.url;
          let params: URLSearchParams;
          
          if (url.includes('#')) {
            // Tokens are in hash fragment (most common)
            const hashPart = url.split('#')[1];
            params = new URLSearchParams(hashPart);
          } else if (url.includes('?')) {
            // Tokens might be in query string
            const queryPart = url.split('?')[1];
            params = new URLSearchParams(queryPart);
          } else {
            throw new Error('No tokens found in redirect URL');
          }
          
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            if (__DEV__) {
              console.log('🔑 Found access token, setting session...');
            }
            
            // Set the session with the tokens
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) throw sessionError;

            if (__DEV__) {
              console.log('✅ Google Sign-In successful');
            }
            
            // Navigation handled by auth state change in _layout
          } else {
            throw new Error('No access token in redirect URL');
          }
        } else if (result.type === 'cancel') {
          if (__DEV__) {
            console.log('ℹ️ Google Sign-In cancelled by user');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Google Sign-In error:', error);
      Alert.alert(
        'Sign-In Failed',
        error.message || 'An error occurred during Google sign-in. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  /**
   * Apple Sign-In using native iOS flow
   * Uses the recommended signInWithIdToken approach for Expo
   */
  const performAppleSignIn = async () => {
    try {
      setIsLoading(true);
      setLoadingProvider('apple');

      // Generate a random nonce for security
      const rawNonce = Crypto.getRandomBytes(32).toString();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Request Apple credentials with native UI
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Sign in to Supabase with the Apple ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) throw error;

      if (__DEV__) {
        console.log('✅ Apple Sign-In successful', {
          userId: data.user?.id,
          email: data.user?.email,
        });
      }

      // Navigation handled by auth state change in _layout

    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        if (__DEV__) {
          console.log('ℹ️ Apple Sign-In cancelled by user');
        }
        // User cancelled, don't show error
      } else {
        console.error('❌ Apple Sign-In error:', error);
        Alert.alert(
          'Sign-In Failed',
          error.message || 'An error occurred during Apple sign-in. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
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
              <View className="w-28 h-28 rounded-3xl bg-card/80 items-center justify-center border border-primary/40 overflow-hidden">
                <View className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                <Dumbbell size={56} color="#31D5E3" strokeWidth={1.5} />
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
              {/* Apple Sign-In Button - iOS Native */}
              {Platform.OS === 'ios' && appleAuthAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={12}
                  style={{
                    width: '100%',
                    height: 52,
                  }}
                  onPress={performAppleSignIn}
                />
              )}

              {/* Apple Fallback for Android/Simulator */}
              {(Platform.OS !== 'ios' || !appleAuthAvailable) && (
                <Pressable
                  onPress={performAppleSignIn}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.authButton,
                    styles.appleButton,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                >
                  {loadingProvider === 'apple' ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Text style={styles.appleIcon}></Text>
                      <Text style={styles.appleButtonText}>Continue with Apple</Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Google Sign-In Button */}
              <Pressable
                onPress={performGoogleSignIn}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.authButton,
                  styles.googleButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                {loadingProvider === 'google' ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                  <>
                    {/* Google "G" Logo */}
                    <View style={styles.googleIconContainer}>
                      <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Legal Text */}
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
                  {loadingProvider === 'apple' ? 'Signing in with Apple...' : 'Signing in with Google...'}
                </Text>
              </GlassCard>
            </View>
          )}
        </View>

        {/* Footer */}
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
  appleButton: {
    backgroundColor: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  appleIcon: {
    fontSize: 20,
    color: '#000000',
    marginTop: -2,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F1F1F',
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
