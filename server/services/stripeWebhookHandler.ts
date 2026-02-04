/**
 * Stripe Webhook Handler
 * 
 * Handles incoming Stripe webhook events.
 * Uses stripe-replit-sync for processing, with custom handlers for service activation.
 */

import { getStripeSync, getUncachableStripeClient, getStripeSecretKey } from './stripeClient';
import { handleCheckoutSessionCompleted } from './stripePaymentService';
import { storage } from '../storage';
import Stripe from 'stripe';

/**
 * Process a Stripe webhook event
 * 
 * This is called after stripe-replit-sync has verified and stored the event.
 * We handle specific events that require business logic.
 */
export async function processWebhook(payload: Buffer, signature: string): Promise<void> {
  // First, let stripe-replit-sync process and store the webhook data
  const sync = await getStripeSync();
  await sync.processWebhook(payload, signature);
  
  // Now parse the event for our custom handling
  const stripe = await getUncachableStripeClient();
  const webhookSecret = await getWebhookSecret();
  
  if (!webhookSecret) {
    console.warn('[Stripe Webhook] No webhook secret configured, skipping custom processing');
    return;
  }
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Failed to construct event:', err.message);
    throw err;
  }
  
  // Handle specific event types
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);
      await handleCheckoutSessionCompleted(session.id);
      break;
    }
    
    case 'invoice.paid': {
      // Handle successful subscription payment
      const invoice = event.data.object as any;
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Invoice paid for subscription: ${invoice.subscription}`);
        await handleSubscriptionRenewal(invoice);
      }
      break;
    }
    
    case 'customer.subscription.updated': {
      // Handle subscription updates (cancellation, etc.)
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}`);
      await handleSubscriptionUpdate(subscription);
      break;
    }
    
    case 'customer.subscription.deleted': {
      // Handle subscription cancellation
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`);
      await handleSubscriptionCancellation(subscription);
      break;
    }
    
    case 'charge.refunded': {
      // Handle refunds
      const charge = event.data.object as Stripe.Charge;
      console.log(`[Stripe Webhook] Charge refunded: ${charge.id}`);
      await handleRefund(charge);
      break;
    }
    
    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

/**
 * Get the webhook secret from the managed webhook
 */
async function getWebhookSecret(): Promise<string | null> {
  try {
    const sync = await getStripeSync();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const webhookUrl = `${baseUrl}/api/payments/stripe/webhook`;
    
    // Find or create the managed webhook to get its secret
    const { webhook } = await sync.findOrCreateManagedWebhook(webhookUrl);
    return webhook.secret || null;
  } catch (error) {
    console.error('[Stripe Webhook] Failed to get webhook secret:', error);
    return null;
  }
}

/**
 * Handle subscription renewal (invoice.paid for recurring subscription)
 */
async function handleSubscriptionRenewal(invoice: any): Promise<void> {
  const stripeSubscriptionId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : invoice.subscription?.id;
  
  if (!stripeSubscriptionId) return;
  
  // Find our checkout session that created this subscription
  // The subscription ID is stored when checkout completes
  // For now, we log this - in production, you'd look up the subscription
  console.log(`[Stripe Webhook] Subscription renewal processed: ${stripeSubscriptionId}`);
  
  // If we had a mapping table, we could renew the registered office subscription here
  // For MVP, annual renewals would be a manual process or separate subscription lookup
}

/**
 * Handle subscription status changes
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  // Check if subscription is past_due or canceled
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    console.log(`[Stripe Webhook] Subscription ${subscription.id} is ${subscription.status}`);
    // In production, you might send a warning notification
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
  // Find sessions with this subscription ID
  const sessions = await storage.getStripeCheckoutSessionsByUser('');
  // This would require a more sophisticated lookup in production
  console.log(`[Stripe Webhook] Subscription cancelled: ${subscription.id}`);
}

/**
 * Handle refunds
 */
async function handleRefund(charge: Stripe.Charge): Promise<void> {
  console.log(`[Stripe Webhook] Processing refund for charge: ${charge.id}`);
  
  // In production, you would:
  // 1. Find the original checkout session
  // 2. Update the payment status
  // 3. Potentially deactivate services
  // 4. Create audit log
}

export default {
  processWebhook,
};
