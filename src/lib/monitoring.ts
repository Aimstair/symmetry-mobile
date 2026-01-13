/**
 * Monitoring & Crash Reporting
 * 
 * Sentry integration for:
 * - Unhandled exception capture
 * - React render error tracking
 * - Performance monitoring
 * - User context and breadcrumbs
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Sentry DSN - Replace with your actual DSN from sentry.io
// Store this in .env as EXPO_PUBLIC_SENTRY_DSN for production
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE';

// App version from app.json
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

// Environment detection
const ENVIRONMENT = __DEV__ ? 'development' : 'production';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Sentry SDK
 * Call this early in app startup (e.g., in _layout.tsx before any rendering)
 */
export function initializeSentry() {
  // Skip initialization if no DSN configured (development)
  if (SENTRY_DSN === 'YOUR_SENTRY_DSN_HERE') {
    if (__DEV__) {
      console.log('⚠️ Sentry DSN not configured - crash reporting disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Set environment
    environment: ENVIRONMENT,
    
    // Set release version
    release: `symmetry-mobile@${APP_VERSION}`,
    
    // Capture 100% of transactions for performance monitoring in dev
    // Reduce to 0.1-0.2 in production
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    
    // Enable native crash reporting
    enableNativeCrashHandling: true,
    
    // Auto session tracking
    enableAutoSessionTracking: true,
    
    // Session timeout (seconds)
    sessionTrackingIntervalMillis: 30000,
    
    // Attach stack traces to all messages
    attachStacktrace: true,
    
    // Debug mode in development
    debug: __DEV__,
    
    // Don't send events in development unless explicitly testing
    enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
    
    // Before send hook - can filter/modify events
    beforeSend(event, hint) {
      // Filter out certain errors if needed
      if (__DEV__) {
        console.log('📊 Sentry event:', event.message || event.exception?.values?.[0]?.value);
      }
      return event;
    },
    
    // Integrations
    integrations: [
      // Add React Native specific integrations
      Sentry.reactNativeTracingIntegration(),
    ],
  });

  if (__DEV__) {
    console.log('✅ Sentry initialized for crash reporting');
  }
}

// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set user context for crash reports
 * Call after user authentication
 */
export function setUserContext(user: { id: string; email?: string; name?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

// ============================================================================
// BREADCRUMBS
// ============================================================================

export type BreadcrumbCategory = 
  | 'navigation'
  | 'user-action'
  | 'workout'
  | 'sync'
  | 'storage'
  | 'auth'
  | 'network';

/**
 * Add a breadcrumb to track user actions before a crash
 */
export function addBreadcrumb(
  message: string,
  category: BreadcrumbCategory,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info'
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// ============================================================================
// ERROR CAPTURE
// ============================================================================

/**
 * Manually capture an exception
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, any>
) {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Capture a message (non-exception event)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
) {
  Sentry.captureMessage(message, level);
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

/**
 * Create a Sentry-wrapped error boundary component
 * Use this to wrap your root component
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC to wrap root component with Sentry
 */
export const withSentry = Sentry.wrap;

// ============================================================================
// PERFORMANCE
// ============================================================================

/**
 * Start a custom transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, () => {});
}

// ============================================================================
// EXPORTS
// ============================================================================

export { Sentry };
