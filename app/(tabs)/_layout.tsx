import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, Dumbbell, TrendingUp, Settings } from 'lucide-react-native';

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
  const iconSize = 24;
  const activeColor = 'hsl(187, 85%, 53%)'; // Primary cyan
  const inactiveColor = 'hsl(240, 5%, 55%)'; // Muted

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'hsl(240, 10%, 6%)',
          borderTopColor: 'hsl(240, 5%, 14%)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
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
