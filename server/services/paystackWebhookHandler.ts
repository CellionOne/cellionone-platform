/**
 * Paystack Webhook Handler
 * 
 * Processes Paystack webhook events for transaction completion and service activation.
 */

import { storage } from '../storage';
import { verifyWebhookSignature, verifyTransaction } from './paystackPaymentService';
import type { ServiceType, RegisteredOfficeTier } from '../config/priceBook';

export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message?: string;
    gateway_response: string;
    paid_at?: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address?: string;
    metadata?: {
      userId?: string;
      applicationId?: number;
      subscriptionId?: number;
      lineItems?: Array<{
        serviceType: ServiceType;
        tier?: RegisteredOfficeTier;
        amount: number;
        description: string;
      }>;
    };
    customer: {
      id: number;
      first_name?: string;
      last_name?: string;
      email: string;
      customer_code: string;
      phone?: string;
    };
    authorization?: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
  };
}

/**
 * Process a Paystack webhook request
 */
export async function processWebhook(
  payload: string,
  signature: string
): Promise<{ processed: boolean; event?: string; error?: string }> {
  // Verify signature
  if (!verifyWebhookSignature(payload, signature)) {
    console.error('[Paystack Webhook] Invalid signature');
    return { processed: false, error: 'Invalid signature' };
  }
  
  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(payload);
  } catch (e) {
    console.error('[Paystack Webhook] Invalid JSON payload');
    return { processed: false, error: 'Invalid JSON' };
  }
  
  console.log(`[Paystack Webhook] Received event: ${event.event}`);
  
  // Handle different event types
  switch (event.event) {
    case 'charge.success':
      await handleChargeSuccess(event.data);
      break;
    case 'charge.failed':
      await handleChargeFailed(event.data);
      break;
    default:
      console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`);
  }
  
  return { processed: true, event: event.event };
}

/**
 * Handle successful charge
 */
async function handleChargeSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const reference = data.reference;
  
  // Get our database record
  const transaction = await storage.getPaystackTransactionByReference(reference);
  if (!transaction) {
    console.error(`[Paystack Webhook] No transaction found for reference: ${reference}`);
    return;
  }
  
  // Verify with Paystack API to be sure (double-check)
  const verification = await verifyTransaction(reference);
  if (verification.status !== 'success') {
    console.error(`[Paystack Webhook] Verification failed for reference: ${reference}`);
    return;
  }
  
  // Update transaction status
  await storage.updatePaystackTransaction(transaction.id, {
    status: 'success',
    paystackTransactionId: String(data.id),
    gatewayResponse: data.gateway_response,
    channel: data.channel,
    completedAt: data.paid_at ? new Date(data.paid_at) : new Date(),
  });
  
  // Activate services based on line items
  const lineItems = transaction.lineItems || [];
  const context = transaction.contextJson || {};
  const userId = transaction.userId;
  
  for (const item of lineItems) {
    await activateService(
      userId, 
      item.serviceType as ServiceType, 
      item.tier as RegisteredOfficeTier | undefined, 
      context
    );
  }
  
  // Create audit log
  await storage.createAuditLog({
    actorUserId: userId,
    action: 'paystack_payment_completed',
    entityType: 'paystack_transaction',
    entityId: String(transaction.id),
    details: {
      reference,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
      lineItems: lineItems.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    },
  });
  
  // Create notification for user
  await storage.createNotification({
    userId,
    title: 'Payment Successful',
    message: `Your payment of ₦${((transaction.amountTotal || 0) / 100).toLocaleString()} has been processed successfully.`,
    type: 'success',
    linkUrl: '/founder/dashboard',
  });
  
  console.log(`[Paystack Webhook] Successfully processed payment for reference: ${reference}`);
}

/**
 * Handle failed charge
 */
async function handleChargeFailed(data: PaystackWebhookEvent['data']): Promise<void> {
  const reference = data.reference;
  
  const transaction = await storage.getPaystackTransactionByReference(reference);
  if (!transaction) {
    console.error(`[Paystack Webhook] No transaction found for failed charge: ${reference}`);
    return;
  }
  
  // Update transaction status
  await storage.updatePaystackTransaction(transaction.id, {
    status: 'failed',
    paystackTransactionId: String(data.id),
    gatewayResponse: data.gateway_response,
  });
  
  // Create notification for user
  await storage.createNotification({
    userId: transaction.userId,
    title: 'Payment Failed',
    message: `Your payment of ₦${((transaction.amountTotal || 0) / 100).toLocaleString()} could not be processed. ${data.gateway_response || 'Please try again.'}`,
    type: 'warning',
    linkUrl: '/payment/checkout',
  });
  
  console.log(`[Paystack Webhook] Payment failed for reference: ${reference}`);
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
      const verification = await storage.getIdentityVerification(userId);
      if (verification) {
        await storage.upsertIdentityVerification({
          founderUserId: userId,
          status: verification.status === 'not_started' ? 'pending' : verification.status,
          notes: `${verification.notes || ''}\nVerification fee paid via Paystack.`.trim(),
        });
      } else {
        await storage.upsertIdentityVerification({
          founderUserId: userId,
          status: 'pending',
          notes: 'Verification fee paid via Paystack.',
        });
      }
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: 'verification_fee_paid',
        entityType: 'identity_verification',
        entityId: userId,
        details: { provider: 'paystack' },
      });
      break;
    }
    
    case 'incorporation': {
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
            details: { provider: 'paystack', paymentState: 'paid_escrowed' },
          });
        }
      }
      break;
    }
    
    case 'registered_office': {
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
          details: { 
            provider: 'paystack', 
            tier, 
            startDate: now.toISOString(), 
            endDate: oneYearFromNow.toISOString() 
          },
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

export default {
  processWebhook,
};
