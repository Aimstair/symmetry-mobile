import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * OAuth Callback Route
 * 
 * This route handles the redirect from OAuth providers (Google, Apple).
 * It catches the `symmetry://auth/callback` URL and extracts the session tokens.
 * 
 * Flow:
 * 1. OAuth provider redirects to symmetry://auth/callback#access_token=...
 * 2. This component extracts tokens from URL fragment
 * 3. Sets the Supabase session with extracted tokens
 * 4. Redirects to root (/) where AuthProvider handles routing
 */

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    async function handleCallback() {
      try {
        if (__DEV__) {
          console.log('🔄 Auth callback triggered');
          console.log('📋 Params:', params);
        }

        // The tokens are typically in the URL hash fragment
        // Expo Router should parse them into params
        const accessToken = params.access_token as string | undefined;
        const refreshToken = params.refresh_token as string | undefined;

        if (accessToken) {
          if (__DEV__) {
            console.log('🔑 Found access token, setting session...');
          }

          // Set the session with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('❌ Error setting session:', error.message);
          } else if (data.session) {
            if (__DEV__) {
              console.log('✅ Session set successfully:', data.session.user.email);
            }
          }
        } else {
          if (__DEV__) {
            console.log('ℹ️ No access token in params, checking existing session...');
          }
          
          // Check if session was already set by Supabase's URL detection
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            if (__DEV__) {
              console.log('✅ Existing session found:', session.user.email);
            }
          }
        }

        // Small delay to ensure state updates propagate
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redirect to root - AuthProvider will handle the rest
        router.replace('/');

      } catch (error) {
        console.error('❌ Auth callback error:', error);
        // Still redirect to root on error - AuthProvider will handle it
        router.replace('/');
      }
    }

    handleCallback();
  }, [params, router]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color="#31D5E3" />
      <Text className="text-muted-foreground mt-4">Completing sign in...</Text>
    </View>
  );
}
