// Supabase Edge Function: RevenueCat Webhook Handler
// Purpose: Sync subscription status from RevenueCat to Supabase
// 
// Handles the following RevenueCat webhook events:
// - INITIAL_PURCHASE: User purchased a subscription
// - RENEWAL: Subscription renewed
// - CANCELLATION: Subscription cancelled (will downgrade at period end)
// - EXPIRATION: Subscription expired
// - BILLING_ISSUE: Payment failed
// - TRANSFER: Subscription transferred to another user
// - PRODUCT_CHANGE: User changed subscription tier
// - UNCANCELLATION: User re-enabled auto-renewal

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types for RevenueCat webhook payload
interface RevenueCatEvent {
  type: string;
  id: string;
  event_timestamp_ms: number;
  app_user_id: string;
  original_app_user_id: string;
  aliases: string[];
  product_id: string;
  entitlement_ids: string[];
  period_type: string;
  purchased_at_ms: number;
  expiration_at_ms: number | null;
  environment: string;
  store: string;
  is_family_share: boolean;
  takehome_percentage: number;
  offer_code: string | null;
  subscriber_attributes: Record<string, { value: string; updated_at_ms: number }>;
  currency: string;
  price: number;
  price_in_purchased_currency: number;
  cancel_reason: string | null;
  country_code: string;
}

interface RevenueCatWebhook {
  api_version: string;
  event: RevenueCatEvent;
}

// Events that indicate an active Pro subscription
const PRO_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
];

// Events that indicate downgrade to Free
const FREE_EVENTS = [
  'EXPIRATION',
  // Note: CANCELLATION doesn't immediately downgrade - user keeps access until period ends
];

// Events to log but not change tier
const INFORMATIONAL_EVENTS = [
  'CANCELLATION',      // Will still have access until expiration
  'BILLING_ISSUE',     // May recover
  'SUBSCRIBER_ALIAS',
  'TRANSFER',
];

Deno.serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify authorization header matches our secret
  const authHeader = req.headers.get('Authorization');
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

  if (!expectedSecret) {
    console.error('REVENUECAT_WEBHOOK_SECRET not configured');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // RevenueCat sends: "Bearer <secret>"
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (providedSecret !== expectedSecret) {
    console.error('Invalid authorization header');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse the webhook payload
    const payload: RevenueCatWebhook = await req.json();
    const event = payload.event;

    console.log(`Received RevenueCat event: ${event.type} for user: ${event.app_user_id}`);

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // The app_user_id should be the Supabase Auth user ID
    // (set when calling Purchases.logIn(supabaseUserId))
    const userId = event.app_user_id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.log(`Skipping non-UUID app_user_id: ${userId} (likely anonymous or alias)`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Skipped - not a valid Supabase user ID' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let newTier: 'free' | 'pro' | null = null;

    // Determine the new tier based on event type
    if (PRO_EVENTS.includes(event.type)) {
      // Check if the entitlement is for "pro" or if it's a pro product
      // Adjust this logic based on your RevenueCat product/entitlement setup
      const hasProEntitlement = event.entitlement_ids?.includes('pro') || 
                                 event.product_id?.toLowerCase().includes('pro');
      
      if (hasProEntitlement) {
        newTier = 'pro';
      }
    } else if (FREE_EVENTS.includes(event.type)) {
      newTier = 'free';
    } else if (event.type === 'TRANSFER') {
      // Handle transfer - check current entitlements
      const hasProEntitlement = event.entitlement_ids?.includes('pro');
      newTier = hasProEntitlement ? 'pro' : 'free';
    }

    // Update the user's subscription tier if we determined a new tier
    if (newTier !== null) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          subscription_tier: newTier,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update user subscription tier:', updateError);
        // Don't return error to RevenueCat - they'll retry
        // Log it and return success to prevent webhook spam
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: 'Database update failed, will retry on next event',
            error: updateError.message
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Updated user ${userId} subscription tier to: ${newTier}`);
    } else {
      console.log(`Event ${event.type} does not require tier change`);
    }

    // Log the event for audit purposes (optional - could add an events table)
    console.log('Webhook processed successfully:', {
      eventType: event.type,
      userId,
      productId: event.product_id,
      newTier,
      environment: event.environment,
      timestamp: new Date(event.event_timestamp_ms).toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventType: event.type,
        userId,
        newTier: newTier || 'unchanged'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Return 200 to prevent RevenueCat from retrying on parse errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
