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
import { storageAdapter } from '@/lib/storage';

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
  type?:
    | 'ai_job_complete'
    | 'workout_reminder'
    | 'progress_update'
    | 'progress_nudge'
    | 'scan_available'
    | 'pro_upsell'
    | 'general';
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

type ProUpsellReason = 'advanced_metrics' | 'scan_locked' | 'settings';

interface NotificationCadenceMeta {
  proUpsellSentAt: string[];
  lastProgressNudgeAt?: string;
  aiCompletionNotifiedJobIds: string[];
}

const NOTIFICATION_CADENCE_META_KEY = 'notification_cadence_meta_v1';
const PRO_UPSELL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PRO_UPSELL_MIN_GAP_MS = 36 * 60 * 60 * 1000;
const PRO_UPSELL_MAX_PER_WINDOW = 2;
const PRO_UPSELL_DELAY_SECONDS = 8;
const PRO_UPSELL_MAX_TRACKED = 12;
const AI_COMPLETION_MAX_TRACKED = 50;
const PROGRESS_NUDGE_MIN_GAP_MS = 24 * 60 * 60 * 1000;
const PROGRESS_NUDGE_INACTIVITY_MS = 48 * 60 * 60 * 1000;

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

    if (Platform.OS === 'android') {
      await this.setupAndroidChannel();
    }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isMissingFirebaseApp = /Default FirebaseApp is not initialized/i.test(errorMessage);

      if (__DEV__) {
        if (isMissingFirebaseApp) {
          console.warn('Push notifications unavailable: Firebase is not configured for this Android build.');
        } else {
          console.error('Failed to register for push notifications:', error);
        }
      }

      return {
        success: false,
        error: isMissingFirebaseApp ? 'Push notifications unavailable in this build' : errorMessage,
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

      case 'progress_nudge':
        router.push('/(tabs)/workout-plan');
        break;

      case 'scan_available':
        // Navigate to physique scan screen
        router.push('/(tabs)/physique-scan');
        break;

      case 'pro_upsell':
        router.push('/paywall');
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
   * Local fallback notification for completed AI analysis jobs.
   * Used when push delivery is delayed or unavailable.
   */
  async scheduleAiCompletionFallback(options: {
    jobId?: string;
    scanId?: string;
    delaySeconds?: number;
  } = {}): Promise<string | null> {
    const notificationsEnabled = await this.areNotificationsEnabled();
    if (!notificationsEnabled) {
      return null;
    }

    const meta = await this.loadCadenceMeta();
    const normalizedJobId = (options.jobId || '').trim();
    if (normalizedJobId && meta.aiCompletionNotifiedJobIds.includes(normalizedJobId)) {
      return null;
    }

    const id = await this.scheduleLocalNotification(
      'Your AI scan is ready ✨',
      'Open Symmetry to review your latest analysis and plan updates.',
      {
        type: 'ai_job_complete',
        jobId: options.jobId,
        scanId: options.scanId,
        deepLink: '/symmetry-history',
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: options.delaySeconds ?? 1,
      }
    );

    if (normalizedJobId) {
      const nextMeta: NotificationCadenceMeta = {
        ...meta,
        aiCompletionNotifiedJobIds: [
          ...meta.aiCompletionNotifiedJobIds,
          normalizedJobId,
        ].slice(-AI_COMPLETION_MAX_TRACKED),
      };
      await this.saveCadenceMeta(nextMeta);
    }

    return id;
  }

  /**
   * Schedule a Pro upgrade prompt with medium cadence limits.
   */
  async maybeScheduleProUpsellNotification(
    reason: ProUpsellReason,
    options: { delaySeconds?: number } = {}
  ): Promise<string | null> {
    const notificationsEnabled = await this.areNotificationsEnabled();
    if (!notificationsEnabled) {
      return null;
    }

    const now = Date.now();
    const meta = await this.loadCadenceMeta();
    const recentPrompts = meta.proUpsellSentAt
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value) && now - value <= PRO_UPSELL_WINDOW_MS);

    const lastPromptAt = recentPrompts.length > 0 ? Math.max(...recentPrompts) : 0;
    const withinMinGap = lastPromptAt > 0 && now - lastPromptAt < PRO_UPSELL_MIN_GAP_MS;
    if (withinMinGap || recentPrompts.length >= PRO_UPSELL_MAX_PER_WINDOW) {
      return null;
    }

    const copyByReason: Record<ProUpsellReason, { title: string; body: string }> = {
      advanced_metrics: {
        title: 'Unlock Advanced Metrics 📈',
        body: 'Upgrade to Pro to use RPE tracking and deeper performance insights.',
      },
      scan_locked: {
        title: 'Scan More Often With Pro 📸',
        body: 'Pro unlocks weekly physique scans and faster progress feedback.',
      },
      settings: {
        title: 'Take Your Training Further 💎',
        body: 'Go Pro for advanced analytics, weekly scans, and priority support.',
      },
    };

    const copy = copyByReason[reason];

    const id = await this.scheduleLocalNotification(
      copy.title,
      copy.body,
      {
        type: 'pro_upsell',
        deepLink: '/paywall',
        reason,
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: options.delaySeconds ?? PRO_UPSELL_DELAY_SECONDS,
      }
    );

    const updatedPrompts = [...recentPrompts, now]
      .sort((a, b) => a - b)
      .slice(-PRO_UPSELL_MAX_TRACKED)
      .map((value) => new Date(value).toISOString());

    await this.saveCadenceMeta({
      ...meta,
      proUpsellSentAt: updatedPrompts,
    });

    return id;
  }

  /**
   * Schedule a progress nudge when the user has been inactive for 48h.
   */
  async maybeScheduleProgressNudge(options: {
    enabled: boolean;
    lastWorkoutAt?: Date | null;
    delaySeconds?: number;
  }): Promise<string | null> {
    if (!options.enabled) {
      return null;
    }

    const notificationsEnabled = await this.areNotificationsEnabled();
    if (!notificationsEnabled) {
      return null;
    }

    const now = Date.now();
    const lastWorkoutAtMs = options.lastWorkoutAt?.getTime() || 0;
    if (!lastWorkoutAtMs || now - lastWorkoutAtMs < PROGRESS_NUDGE_INACTIVITY_MS) {
      return null;
    }

    const meta = await this.loadCadenceMeta();
    const lastNudgeAtMs = meta.lastProgressNudgeAt
      ? new Date(meta.lastProgressNudgeAt).getTime()
      : 0;
    if (lastNudgeAtMs && now - lastNudgeAtMs < PROGRESS_NUDGE_MIN_GAP_MS) {
      return null;
    }

    const id = await this.scheduleLocalNotification(
      'Quick Workout Check-In 💪',
      'A short session today keeps your streak alive. Tap to jump into your plan.',
      {
        type: 'progress_nudge',
        deepLink: '/(tabs)/workout-plan',
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: options.delaySeconds ?? 60,
      }
    );

    await this.saveCadenceMeta({
      ...meta,
      lastProgressNudgeAt: new Date(now).toISOString(),
    });

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
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  async ensurePermissions(): Promise<boolean> {
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.status === 'granted') {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync();
      if (requested.status !== 'granted') {
        return false;
      }

      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      return true;
    } catch {
      return false;
    }
  }

  private async loadCadenceMeta(): Promise<NotificationCadenceMeta> {
    try {
      const raw = await storageAdapter.getItem(NOTIFICATION_CADENCE_META_KEY);
      if (!raw) {
        return {
          proUpsellSentAt: [],
          aiCompletionNotifiedJobIds: [],
        };
      }

      const parsed = JSON.parse(raw) as Partial<NotificationCadenceMeta>;
      return {
        proUpsellSentAt: Array.isArray(parsed.proUpsellSentAt)
          ? parsed.proUpsellSentAt.filter((value): value is string => typeof value === 'string')
          : [],
        lastProgressNudgeAt:
          typeof parsed.lastProgressNudgeAt === 'string' ? parsed.lastProgressNudgeAt : undefined,
        aiCompletionNotifiedJobIds: Array.isArray(parsed.aiCompletionNotifiedJobIds)
          ? parsed.aiCompletionNotifiedJobIds.filter((value): value is string => typeof value === 'string')
          : [],
      };
    } catch {
      return {
        proUpsellSentAt: [],
        aiCompletionNotifiedJobIds: [],
      };
    }
  }

  private async saveCadenceMeta(meta: NotificationCadenceMeta): Promise<void> {
    await storageAdapter.setItem(NOTIFICATION_CADENCE_META_KEY, JSON.stringify(meta));
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
