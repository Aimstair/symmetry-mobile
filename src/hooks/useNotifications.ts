/**
 * useNotifications Hook
 * 
 * Handles incoming push notifications when the app is open or tapped.
 * Provides deep linking functionality based on notification data.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// ============================================================================
// TYPES
// ============================================================================

interface NotificationData {
  type?: 'ai_job_complete' | 'workout_reminder' | 'progress_update' | 'scan_available' | 'general';
  url?: string;
  deepLink?: string;
  jobId?: string;
  scanId?: string;
  [key: string]: any;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to handle incoming notifications and deep linking
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useNotificationHandler();
 *   return <YourApp />;
 * }
 * ```
 */
export function useNotificationHandler() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (__DEV__) {
          console.log('🔔 Notification received in foreground:', notification.request.content.title);
        }
        // You can handle in-app UI updates here if needed
        // For example, show a toast or update a badge count
      }
    );

    // Listener for notification taps (user interaction)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData;

        if (__DEV__) {
          console.log('🔔 Notification tapped:', data);
        }

        handleNotificationNavigation(data);
      }
    );

    // Clean up listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);
}

/**
 * Handle navigation based on notification data
 * Supports both `url` field and `type`-based routing
 */
function handleNotificationNavigation(data: NotificationData) {
  // Check for explicit URL-based deep links first
  if (data.url) {
    navigateToUrl(data.url);
    return;
  }

  // Check for deepLink field (alternative naming)
  if (data.deepLink) {
    navigateToUrl(data.deepLink);
    return;
  }

  // Fall back to type-based navigation
  switch (data.type) {
    case 'ai_job_complete':
      // Navigate to scan history to view results
      router.push('/symmetry-history');
      break;

    case 'workout_reminder':
      // Navigate to workout plan
      router.push('/(tabs)/workout-plan');
      break;

    case 'progress_update':
      // Navigate to progress tab
      router.push('/(tabs)/progress');
      break;

    case 'scan_available':
      // Navigate to physique scan
      router.push('/(tabs)/physique-scan');
      break;

    default:
      // No specific navigation for general notifications
      if (__DEV__) {
        console.log('🔔 No specific navigation for notification type:', data.type);
      }
      break;
  }
}

/**
 * Navigate to a URL/route within the app
 * Handles symmetry:// scheme URLs
 */
function navigateToUrl(url: string) {
  // Handle symmetry:// scheme URLs
  if (url.startsWith('symmetry://')) {
    const path = url.replace('symmetry://', '/');
    
    // Map known paths to actual routes
    const routeMap: Record<string, string> = {
      '/history': '/symmetry-history',
      '/paywall': '/paywall',
      '/workout': '/(tabs)/workout-plan',
      '/progress': '/(tabs)/progress',
      '/scan': '/(tabs)/physique-scan',
      '/settings': '/(tabs)/settings',
    };

    const mappedRoute = routeMap[path] || path;
    
    try {
      router.push(mappedRoute as any);
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to navigate to:', mappedRoute);
      }
    }
    return;
  }

  // Handle regular paths (starts with /)
  if (url.startsWith('/')) {
    try {
      router.push(url as any);
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to navigate to:', url);
      }
    }
    return;
  }

  // Log unknown URL format
  if (__DEV__) {
    console.warn('Unknown URL format:', url);
  }
}

export default useNotificationHandler;
