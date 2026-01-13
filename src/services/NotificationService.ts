/**
 * Notification Service
 * 
 * Handles push notification registration, permissions, and event handling.
 * 
 * Features:
 * - Register for push notifications (Expo Push Token)
 * - Store token in Supabase for server-side notifications
 * - Handle notification received/tapped events
 * - Deep linking support for notification actions
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationData {
  type?: 'ai_job_complete' | 'workout_reminder' | 'progress_update' | 'scan_available' | 'general';
  jobId?: string;
  scanId?: string;
  deepLink?: string;
  [key: string]: any;
}

export interface PushTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

class NotificationService {
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private expoPushToken: string | null = null;

  /**
   * Initialize notification service
   * Sets up listeners and registers for push notifications if user is logged in
   */
  async initialize(userId?: string): Promise<void> {
    // Set up notification listeners
    this.setupListeners();

    // Register for push notifications if we have a user
    if (userId) {
      await this.registerForPushNotifications(userId);
    }
  }

  /**
   * Register for push notifications
   * Gets permission, obtains Expo Push Token, and stores in database
   */
  async registerForPushNotifications(userId: string): Promise<PushTokenResult> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        if (__DEV__) {
          console.log('📱 Push notifications require a physical device');
        }
        return {
          success: false,
          error: 'Push notifications require a physical device',
        };
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // If permission denied, return early
      if (finalStatus !== 'granted') {
        if (__DEV__) {
          console.log('🔔 Push notification permission denied');
        }
        return {
          success: false,
          error: 'Permission denied',
        };
      }

      // Get the Expo Push Token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID || undefined,
      });
      
      const token = tokenData.data;
      this.expoPushToken = token;

      if (__DEV__) {
        console.log('🔔 Expo Push Token:', token);
      }

      // Store token in Supabase
      await this.upsertPushToken(userId, token);

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      return {
        success: true,
        token,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to register for push notifications:', error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upsert push token to Supabase
   */
  private async upsertPushToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error) {
        if (__DEV__) {
          console.error('Failed to upsert push token:', error);
        }
      } else {
        if (__DEV__) {
          console.log('✅ Push token saved to database');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error upserting push token:', error);
      }
    }
  }

  /**
   * Remove push token from database (on logout)
   */
  async removePushToken(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        if (__DEV__) {
          console.error('Failed to remove push token:', error);
        }
      } else {
        if (__DEV__) {
          console.log('🔔 Push token removed from database');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error removing push token:', error);
      }
    }
  }

  /**
   * Set up Android notification channel
   */
  private async setupAndroidChannel(): Promise<void> {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#31D5E3',
      sound: 'default',
    });

    // Create a separate channel for AI job completions
    await Notifications.setNotificationChannelAsync('ai_analysis', {
      name: 'AI Analysis',
      description: 'Notifications for completed AI physique analysis',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#31D5E3',
      sound: 'default',
    });
  }

  /**
   * Set up notification event listeners
   */
  private setupListeners(): void {
    // Clean up existing listeners
    this.cleanup();

    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (__DEV__) {
          console.log('🔔 Notification received:', notification);
        }
        this.handleNotificationReceived(notification);
      }
    );

    // Listener for notification taps (user interaction)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (__DEV__) {
          console.log('🔔 Notification tapped:', response);
        }
        this.handleNotificationResponse(response);
      }
    );
  }

  /**
   * Handle notification received while app is in foreground
   */
  private handleNotificationReceived(notification: Notifications.Notification): void {
    const data = notification.request.content.data as NotificationData;
    
    // You can update UI state here, show in-app alerts, etc.
    // For now, we just log it
    if (__DEV__) {
      console.log('📬 Notification data:', data);
    }
  }

  /**
   * Handle notification tap (deep link to relevant screen)
   */
  private handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): void {
    const data = response.notification.request.content.data as NotificationData;

    // Handle different notification types
    switch (data.type) {
      case 'ai_job_complete':
        // Navigate to physique scan results
        if (data.scanId) {
          router.push(`/symmetry-history`);
        } else {
          router.push('/(tabs)/physique-scan');
        }
        break;

      case 'workout_reminder':
        // Navigate to today's workout
        router.push('/(tabs)/workout-plan');
        break;

      case 'progress_update':
        // Navigate to progress tab
        router.push('/(tabs)/progress');
        break;

      case 'scan_available':
        // Navigate to physique scan screen
        router.push('/(tabs)/physique-scan');
        break;

      default:
        // Handle custom deep links
        if (data.deepLink) {
          try {
            router.push(data.deepLink as any);
          } catch (error) {
            if (__DEV__) {
              console.warn('Failed to navigate to deep link:', data.deepLink);
            }
          }
        }
        break;
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: trigger || null, // null = immediate
    });

    return id;
  }

  /**
   * Schedule daily workout reminder
   * Sets up a repeating notification at the specified time
   */
  async scheduleWorkoutReminder(hour: number, minute: number): Promise<string> {
    // Cancel any existing workout reminders first
    await this.cancelWorkoutReminders();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to Train! 💪",
        body: "Your workout is waiting. Let's make progress today.",
        data: { type: 'workout_reminder' as const, deepLink: '/(tabs)/workout-plan' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    if (__DEV__) {
      console.log(`🔔 Scheduled daily workout reminder for ${hour}:${String(minute).padStart(2, '0')}`);
    }

    return id;
  }

  /**
   * Cancel all workout reminder notifications
   */
  async cancelWorkoutReminders(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const workoutReminders = scheduled.filter(
      (n) => (n.content.data as NotificationData)?.type === 'workout_reminder'
    );

    for (const reminder of workoutReminders) {
      await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
    }

    if (__DEV__ && workoutReminders.length > 0) {
      console.log(`🔔 Cancelled ${workoutReminders.length} workout reminder(s)`);
    }
  }

  /**
   * Schedule a one-time notification for when scan quota resets
   * Called after a successful physique scan
   */
  async scheduleScanAvailability(date: Date): Promise<string> {
    // Cancel any existing scan availability notifications first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scanNotifications = scheduled.filter(
      (n) => (n.content.data as NotificationData)?.type === 'scan_available'
    );
    for (const n of scanNotifications) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }

    // Schedule notification for the given date at 9 AM
    const triggerDate = new Date(date);
    triggerDate.setHours(9, 0, 0, 0);

    // Don't schedule if date is in the past
    if (triggerDate <= new Date()) {
      if (__DEV__) {
        console.log('🔔 Scan already available, not scheduling notification');
      }
      return '';
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Scan Available 📸",
        body: "You can now perform your weekly physique scan.",
        data: { type: 'scan_available' as const, deepLink: '/(tabs)/physique-scan' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    if (__DEV__) {
      console.log(`🔔 Scheduled scan availability notification for ${triggerDate.toLocaleDateString()}`);
    }

    return id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (__DEV__) {
      console.log('🔔 Cancelled all scheduled notifications');
    }
  }

  /**
   * Get the current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear badge
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const notificationService = new NotificationService();

// ============================================================================
// HOOK FOR REACT COMPONENTS
// ============================================================================

import { useEffect, useState } from 'react';

export function useNotifications(userId?: string) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (userId) {
        const result = await notificationService.registerForPushNotifications(userId);
        if (result.success && result.token) {
          setToken(result.token);
          setIsEnabled(true);
        }
      }
      
      const enabled = await notificationService.areNotificationsEnabled();
      setIsEnabled(enabled);
    }

    init();

    return () => {
      notificationService.cleanup();
    };
  }, [userId]);

  return {
    isEnabled,
    token,
    scheduleNotification: notificationService.scheduleLocalNotification.bind(notificationService),
    cancelNotification: notificationService.cancelNotification.bind(notificationService),
  };
}

export default notificationService;
