/**
 * Subscription Service - RevenueCat Integration
 * 
 * Manages subscription status and purchases via RevenueCat SDK.
 * Handles both Google Play (Android) and App Store (iOS) subscriptions.
 * 
 * Features:
 * - Pro status checking
 * - Package purchases
 * - Purchase restoration
 * - Subscription management
 */

import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOfferings,
  LOG_LEVEL,
} from 'react-native-purchases';
import { addBreadcrumb } from '@/lib/monitoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

// RevenueCat API Keys - Store these in .env for production
const REVENUECAT_GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const REVENUECAT_APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || 'YOUR_APPLE_API_KEY';

// Entitlement ID for pro features
const PRO_ENTITLEMENT_ID = 'pro';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionStatus {
  isPro: boolean;
  expirationDate: Date | null;
  willRenew: boolean;
  productIdentifier: string | null;
}

export interface IntroPrice {
  price: number;
  priceString: string;
  period: string;
  periodUnit: string;
  periodNumberOfUnits: number;
  cycles: number;
}

export interface SubscriptionPackage {
  identifier: string;
  packageType: string;
  product: {
    title: string;
    description: string;
    priceString: string;
    price: number;
    currencyCode: string;
    introPrice?: IntroPrice | null;
  };
  offeringIdentifier: string;
}

// ============================================================================
// SUBSCRIPTION SERVICE CLASS
// ============================================================================

class SubscriptionService {
  private isInitialized: boolean = false;
  private currentOfferings: PurchasesOfferings | null = null;

  /**
   * Initialize RevenueCat SDK
   * Call this early in app startup after user authentication
   */
  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) {
      if (__DEV__) console.log('📦 RevenueCat already initialized');
      return;
    }

    try {
      // Set log level in development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Get platform-specific API key
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_APPLE_API_KEY 
        : REVENUECAT_GOOGLE_API_KEY;

      // Check if API key is configured
      if (apiKey.startsWith('YOUR_')) {
        if (__DEV__) {
          console.warn('⚠️ RevenueCat API key not configured - subscriptions disabled');
        }
        return;
      }

      // Configure RevenueCat
      await Purchases.configure({ apiKey });

      // If user ID provided, identify the user
      if (userId) {
        await Purchases.logIn(userId);
      }

      this.isInitialized = true;

      // Add breadcrumb for debugging
      addBreadcrumb('RevenueCat initialized', 'user-action', { userId });

      if (__DEV__) {
        console.log('✅ RevenueCat initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize RevenueCat:', error);
      addBreadcrumb('RevenueCat init failed', 'user-action', { error: String(error) }, 'error');
    }
  }

  /**
   * Identify user with RevenueCat
   * Call after user logs in to associate purchases with their account
   */
  async identifyUser(userId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(userId);
      return;
    }

    try {
      await Purchases.logIn(userId);
      addBreadcrumb('User identified with RevenueCat', 'auth', { userId });
      
      if (__DEV__) {
        console.log('✅ User identified with RevenueCat:', userId);
      }
    } catch (error) {
      console.error('❌ Failed to identify user with RevenueCat:', error);
    }
  }

  /**
   * Log out user from RevenueCat
   * Call when user logs out to reset anonymous ID
   */
  async logOut(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await Purchases.logOut();
      addBreadcrumb('User logged out from RevenueCat', 'auth');
      
      if (__DEV__) {
        console.log('✅ User logged out from RevenueCat');
      }
    } catch (error) {
      console.error('❌ Failed to log out from RevenueCat:', error);
    }
  }

  /**
   * Check if user has an active Pro subscription
   */
  async isProUser(): Promise<boolean> {
    if (!this.isInitialized) {
      if (__DEV__) {
        console.warn('⚠️ RevenueCat not initialized - defaulting to free user');
      }
      return false;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
      
      if (__DEV__) {
        console.log('📦 Pro status:', isPro);
      }
      
      return isPro;
    } catch (error) {
      console.error('❌ Failed to check pro status:', error);
      return false;
    }
  }

  /**
   * Get detailed subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    if (!this.isInitialized) {
      return {
        isPro: false,
        expirationDate: null,
        willRenew: false,
        productIdentifier: null,
      };
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];

      if (!proEntitlement) {
        return {
          isPro: false,
          expirationDate: null,
          willRenew: false,
          productIdentifier: null,
        };
      }

      return {
        isPro: true,
        expirationDate: proEntitlement.expirationDate 
          ? new Date(proEntitlement.expirationDate) 
          : null,
        willRenew: proEntitlement.willRenew,
        productIdentifier: proEntitlement.productIdentifier,
      };
    } catch (error) {
      console.error('❌ Failed to get subscription status:', error);
      return {
        isPro: false,
        expirationDate: null,
        willRenew: false,
        productIdentifier: null,
      };
    }
  }

  /**
   * Get available subscription packages/offerings
   */
  async getOfferings(): Promise<SubscriptionPackage[]> {
    if (!this.isInitialized) {
      return [];
    }

    try {
      const offerings = await Purchases.getOfferings();
      this.currentOfferings = offerings;

      if (!offerings.current) {
        if (__DEV__) {
          console.warn('⚠️ No current offering available');
        }
        return [];
      }

      // Map packages to our format
      const packages: SubscriptionPackage[] = offerings.current.availablePackages.map((pkg) => ({
        identifier: pkg.identifier,
        packageType: pkg.packageType,
        product: {
          title: pkg.product.title,
          description: pkg.product.description,
          priceString: pkg.product.priceString,
          price: pkg.product.price,
          currencyCode: pkg.product.currencyCode,
          introPrice: pkg.product.introPrice ? {
            price: pkg.product.introPrice.price,
            priceString: pkg.product.introPrice.priceString,
            period: pkg.product.introPrice.period,
            periodUnit: pkg.product.introPrice.periodUnit,
            periodNumberOfUnits: pkg.product.introPrice.periodNumberOfUnits,
            cycles: pkg.product.introPrice.cycles,
          } : null,
        },
        offeringIdentifier: pkg.offeringIdentifier,
      }));

      if (__DEV__) {
        console.log('📦 Available packages:', packages.length);
      }

      return packages;
    } catch (error) {
      console.error('❌ Failed to get offerings:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription package
   * This triggers the Google Play / App Store purchase sheet
   */
  async purchasePackage(packageIdentifier: string): Promise<{ success: boolean; isPro: boolean; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, isPro: false, error: 'Subscriptions not available' };
    }

    try {
      // Get offerings if not cached
      if (!this.currentOfferings) {
        await this.getOfferings();
      }

      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p) => p.identifier === packageIdentifier
      );

      if (!pkg) {
        return { success: false, isPro: false, error: 'Package not found' };
      }

      // Add breadcrumb for debugging
      addBreadcrumb('Starting purchase', 'user-action', { packageIdentifier });

      // Trigger purchase
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Check if purchase was successful
      const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;

      addBreadcrumb('Purchase completed', 'user-action', { packageIdentifier, isPro });

      if (__DEV__) {
        console.log('✅ Purchase successful, isPro:', isPro);
      }

      return { success: true, isPro };
    } catch (error: any) {
      // Handle user cancellation
      if (error.userCancelled) {
        if (__DEV__) {
          console.log('📦 Purchase cancelled by user');
        }
        return { success: false, isPro: false, error: 'cancelled' };
      }

      console.error('❌ Purchase failed:', error);
      addBreadcrumb('Purchase failed', 'user-action', { error: error.message }, 'error');

      return { 
        success: false, 
        isPro: false, 
        error: error.message || 'Purchase failed' 
      };
    }
  }

  /**
   * Restore previous purchases
   * Use for users who reinstall the app or switch devices
   */
  async restorePurchases(): Promise<{ success: boolean; isPro: boolean; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, isPro: false, error: 'Subscriptions not available' };
    }

    try {
      addBreadcrumb('Restoring purchases', 'user-action');

      const customerInfo = await Purchases.restorePurchases();
      const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;

      addBreadcrumb('Purchases restored', 'user-action', { isPro });

      if (__DEV__) {
        console.log('✅ Purchases restored, isPro:', isPro);
      }

      return { success: true, isPro };
    } catch (error: any) {
      console.error('❌ Restore failed:', error);
      addBreadcrumb('Restore failed', 'user-action', { error: error.message }, 'error');

      return { 
        success: false, 
        isPro: false, 
        error: error.message || 'Restore failed' 
      };
    }
  }

  /**
   * Add listener for subscription changes
   * Useful for updating UI when subscription status changes
   */
  addCustomerInfoUpdateListener(
    callback: (customerInfo: CustomerInfo) => void
  ): void {
    if (!this.isInitialized) {
      return;
    }

    // RevenueCat listener - call removeCustomerInfoUpdateListener to stop listening
    Purchases.addCustomerInfoUpdateListener(callback);
  }

  /**
   * Remove customer info update listener
   */
  removeCustomerInfoUpdateListener(): void {
    // Note: In newer versions of RevenueCat, listeners are managed differently
    // The listener will be active for the lifetime of the app or until explicitly removed
  }

  /**
   * Check if RevenueCat is properly configured
   */
  isConfigured(): boolean {
    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_APPLE_API_KEY 
      : REVENUECAT_GOOGLE_API_KEY;
    
    return !apiKey.startsWith('YOUR_');
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
export default subscriptionService;
