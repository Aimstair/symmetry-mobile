import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Dumbbell, TrendingUp, Settings, Scan } from 'lucide-react-native';

/**
 * Bottom Tab Navigation
 * 
 * Maps to your existing pages:
 * - index.tsx → Dashboard
 * - workout-plan.tsx → WorkoutPlan
 * - progress.tsx → Progress
 * - settings.tsx → Settings
 */

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const activeColor = 'hsl(187, 85%, 53%)'; // Primary cyan
  const inactiveColor = 'hsl(240, 5%, 55%)'; // Muted

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Performance: keep tab scenes attached for smoother switching.
        // Heavy screens (charts/lists) can stutter when freeze/detach toggles every switch.
        lazy: true,
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: 'hsl(240, 10%, 6%)',
          borderTopColor: 'rgb(121, 68, 103)',
          borderTopWidth: 0.2,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workout-plan"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="physique-scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => <Scan color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
