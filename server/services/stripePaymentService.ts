/**
 * Stripe Payment Service
 * 
 * Handles Stripe Checkout session creation and service activation logic.
 */

import Stripe from 'stripe';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { storage } from '../storage';
import priceBook, { type ServiceType, type RegisteredOfficeTier } from '../config/priceBook';
import type { InsertStripeCheckoutSession } from '@shared/schema';

export interface CheckoutItem {
  serviceType: ServiceType;
  tier?: RegisteredOfficeTier;
  contextId?: number; // applicationId or subscriptionId depending on context
}

export interface CheckoutContext {
  applicationId?: number;
  subscriptionId?: number;
  step?: number;
  pendingOneOffSessionId?: number;
}

export interface CreateCheckoutSessionResult {
  sessionUrl: string;
  sessionId: string;
  dbSessionId: number;
  mode: 'payment' | 'subscription';
  requiresSecondStep: boolean;
}

/**
 * Create a Stripe Checkout session for the given items
 */
export async function createStripeCheckoutSession(
  userId: string,
  items: CheckoutItem[],
  context: CheckoutContext,
  baseUrl: string
): Promise<CreateCheckoutSessionResult> {
  const stripe = await getUncachableStripeClient();
  
  // Validate items
  const validation = priceBook.validateItems(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    'stripe'
  );
  
  if (!validation.valid) {
    throw new Error(`Invalid items: ${validation.errors.join(', ')}`);
  }
  
  // Check for mixed payment modes
  const hasMixed = priceBook.hasMixedPaymentModes(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier }))
  );
  
  // Split items if mixed
  const { oneOff, recurring } = priceBook.splitByPaymentMode(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier }))
  );
  
  // Determine which items to process in this session
  let itemsToProcess: typeof items;
  let mode: 'payment' | 'subscription';
  let step = context.step || 1;
  let requiresSecondStep = false;
  
  if (hasMixed) {
    if (step === 1) {
      // First step: process one-off items only
      itemsToProcess = items.filter(i => {
        const price = priceBook.getStripePrice(i.serviceType, i.tier);
        return price && !price.isRecurring;
      });
      mode = 'payment';
      requiresSecondStep = true;
    } else {
      // Second step: process recurring items
      itemsToProcess = items.filter(i => {
        const price = priceBook.getStripePrice(i.serviceType, i.tier);
        return price && price.isRecurring;
      });
      mode = 'subscription';
      requiresSecondStep = false;
    }
  } else {
    itemsToProcess = items;
    const hasRecurring = recurring.length > 0;
    mode = hasRecurring ? 'subscription' : 'payment';
    requiresSecondStep = false;
  }
  
  // Build line items for Stripe
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const dbLineItems: InsertStripeCheckoutSession['lineItems'] = [];
  let totalAmount = 0;
  
  for (const item of itemsToProcess) {
    const price = priceBook.getStripePrice(item.serviceType, item.tier);
    if (!price || !price.stripePriceId) {
      throw new Error(`No Stripe price found for ${item.serviceType}${item.tier ? ` (${item.tier})` : ''}`);
    }
    
    lineItems.push({
      price: price.stripePriceId,
      quantity: 1,
    });
    
    dbLineItems.push({
      serviceType: item.serviceType,
      tier: item.tier,
      stripePriceId: price.stripePriceId,
      quantity: 1,
      amount: price.amount,
    });
    
    totalAmount += price.amount;
  }
  
  // Get or create Stripe customer
  let stripeCustomerId: string | undefined;
  const user = await storage.getUser(userId);
  
  if (user?.email) {
    // Search for existing customer or create one
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
      });
      stripeCustomerId = customer.id;
    }
  }
  
  // Build success/cancel URLs with session ID placeholder
  const successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&step=${step}`;
  const cancelUrl = `${baseUrl}/payment/cancel?step=${step}`;
  
  // Create Stripe Checkout session
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: false,
    metadata: {
      userId,
      step: String(step),
      applicationId: context.applicationId ? String(context.applicationId) : '',
      subscriptionId: context.subscriptionId ? String(context.subscriptionId) : '',
    },
  };
  
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  } else if (user?.email) {
    sessionParams.customer_email = user.email;
  }
  
  const stripeSession = await stripe.checkout.sessions.create(sessionParams);
  
  // Save session to database
  const dbSession = await storage.createStripeCheckoutSession({
    userId,
    stripeSessionId: stripeSession.id,
    stripeCustomerId: stripeCustomerId || stripeSession.customer as string || null,
    mode,
    status: 'pending',
    currency: 'GBP',
    amountTotal: totalAmount,
    lineItems: dbLineItems,
    contextJson: {
      applicationId: context.applicationId,
      subscriptionId: context.subscriptionId,
      step,
      pendingOneOffSessionId: context.pendingOneOffSessionId,
    },
    successUrl,
    cancelUrl,
    expiresAt: new Date(stripeSession.expires_at * 1000),
  });
  
  return {
    sessionUrl: stripeSession.url!,
    sessionId: stripeSession.id,
    dbSessionId: dbSession.id,
    mode,
    requiresSecondStep,
  };
}

/**
 * Handle a completed Stripe Checkout session
 */
export async function handleCheckoutSessionCompleted(
  stripeSessionId: string
): Promise<void> {
  const stripe = await getUncachableStripeClient();
  
  // Get the session with expanded line items
  const stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId, {
    expand: ['line_items', 'subscription', 'payment_intent'],
  });
  
  // Find our database record
  const dbSession = await storage.getStripeCheckoutSessionByStripeId(stripeSessionId);
  if (!dbSession) {
    console.error(`No database session found for Stripe session ${stripeSessionId}`);
    return;
  }
  
  // Update session status
  await storage.updateStripeCheckoutSession(dbSession.id, {
    status: 'completed',
    completedAt: new Date(),
    stripePaymentIntentId: typeof stripeSession.payment_intent === 'string' 
      ? stripeSession.payment_intent 
      : stripeSession.payment_intent?.id,
    stripeSubscriptionId: typeof stripeSession.subscription === 'string'
      ? stripeSession.subscription
      : stripeSession.subscription?.id,
  });
  
  // Process line items and activate services
  const lineItems = dbSession.lineItems || [];
  const context = dbSession.contextJson || {};
  const userId = dbSession.userId;
  
  for (const item of lineItems) {
    await activateService(userId, item.serviceType as ServiceType, item.tier as RegisteredOfficeTier | undefined, context);
  }
  
  // Create audit log
  await storage.createAuditLog({
    actorUserId: userId,
    action: 'stripe_payment_completed',
    entityType: 'stripe_checkout_session',
    entityId: String(dbSession.id),
    details: {
      stripeSessionId,
      mode: dbSession.mode,
      amountTotal: dbSession.amountTotal,
      currency: dbSession.currency,
      lineItems: lineItems.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    },
  });
  
  // Create notification for user
  await storage.createNotification({
    userId,
    title: 'Payment Successful',
    message: `Your payment of £${((dbSession.amountTotal || 0) / 100).toFixed(2)} has been processed successfully.`,
    type: 'success',
    linkUrl: '/founder/dashboard',
  });
}

/**
 * Activate a service after successful payment
 */
async function activateService(
  userId: string,
  serviceType: ServiceType,
  tier: RegisteredOfficeTier | undefined,
  context: { applicationId?: number; subscriptionId?: number }
): Promise<void> {
  switch (serviceType) {
    case 'verification': {
      // Mark identity verification as paid
      const verification = await storage.getIdentityVerification(userId);
      if (verification) {
        await storage.upsertIdentityVerification({
          founderUserId: userId,
          status: verification.status === 'not_started' ? 'pending' : verification.status,
          notes: `${verification.notes || ''}\nVerification fee paid via Stripe.`.trim(),
        });
      } else {
        await storage.upsertIdentityVerification({
          founderUserId: userId,
          status: 'pending',
          notes: 'Verification fee paid via Stripe.',
        });
      }
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: 'verification_fee_paid',
        entityType: 'identity_verification',
        entityId: userId,
        details: { provider: 'stripe' },
      });
      break;
    }
    
    case 'incorporation': {
      // Update application payment state if we have context
      if (context.applicationId) {
        const application = await storage.getApplication(context.applicationId);
        if (application && application.founderUserId === userId) {
          await storage.updateApplication(context.applicationId, {
            paymentState: 'paid_escrowed',
            paymentStateUpdatedAt: new Date(),
          });
          
          await storage.createAuditLog({
            actorUserId: userId,
            action: 'incorporation_fee_paid',
            entityType: 'company_application',
            entityId: String(context.applicationId),
            details: { provider: 'stripe', paymentState: 'paid_escrowed' },
          });
        }
      }
      break;
    }
    
    case 'registered_office': {
      // Activate registered office subscription
      if (context.subscriptionId) {
        const now = new Date();
        const oneYearFromNow = new Date(now);
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        
        await storage.updateRegisteredOfficeSubscription(context.subscriptionId, {
          status: 'active',
          startDate: now,
          endDate: oneYearFromNow,
        });
        
        await storage.createAuditLog({
          actorUserId: userId,
          action: 'registered_office_activated_paid',
          entityType: 'registered_office_subscription',
          entityId: String(context.subscriptionId),
          details: { provider: 'stripe', tier, startDate: now.toISOString(), endDate: oneYearFromNow.toISOString() },
        });
        
        await storage.createNotification({
          userId,
          title: 'Registered Office Activated',
          message: `Your registered office subscription (${tier === 'office_plus_mail' ? 'Office + Mail' : 'Office Only'}) is now active until ${oneYearFromNow.toLocaleDateString()}.`,
          type: 'success',
          linkUrl: '/founder/registered-office',
        });
      }
      break;
    }
  }
}

/**
 * Get Stripe publishable key for frontend
 */
export async function getPublishableKey(): Promise<string> {
  return getStripePublishableKey();
}

/**
 * Check if Stripe is properly configured
 */
export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getUncachableStripeClient();
    return true;
  } catch {
    return false;
  }
}

export default {
  createStripeCheckoutSession,
  handleCheckoutSessionCompleted,
  getPublishableKey,
  isStripeConfigured,
};
