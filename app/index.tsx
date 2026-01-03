import { View, ActivityIndicator } from 'react-native';

/**
 * Index Route - Initial Entry Point
 * 
 * This component serves as a loading placeholder while the AuthProvider
 * in _layout.tsx determines the correct route based on:
 * - Authentication status (session exists or not)
 * - Onboarding completion status
 * 
 * The actual routing logic is handled in the AuthProvider useEffect.
 */

export default function Index() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color="#31D5E3" />
    </View>
  );
}
