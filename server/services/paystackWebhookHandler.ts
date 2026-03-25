import { storage } from '../storage';
import { db } from '../db';
import { orderPayments, orders, orderItems, serviceRequests, companyApplications, users, companyPeople, productCatalog, kycVerificationRequests } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { verifyWebhookSignature, verifyTransaction } from './paystackPaymentService';
import { sendNewOrderNotificationEmail, ADMIN_NOTIFICATION_EMAIL } from './emailService';
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
      founderId?: string;
      orderId?: number;
      applicationId?: number;
      subscriptionId?: number;
      items?: string[];
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

export async function processWebhook(
  payload: string,
  signature: string
): Promise<{ processed: boolean; event?: string; error?: string }> {
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

  switch (event.event) {
    case 'charge.success':
      await handleChargeSuccess(event.data, payload);
      break;
    case 'charge.failed':
      await handleChargeFailed(event.data, payload);
      break;
    default:
      console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`);
  }

  return { processed: true, event: event.event };
}

async function handleChargeSuccess(data: PaystackWebhookEvent['data'], rawPayload: string): Promise<void> {
  const reference = data.reference;

  if (reference.startsWith('kyc_credit_')) {
    await handleKycCreditPurchaseSuccess(data);
  } else if (reference.startsWith('kyc_')) {
    await handleKycPaymentSuccess(data);
  } else if (reference.startsWith('celion_split_')) {
    await handleSplitOrderSuccess(data, rawPayload);
  } else {
    await handleLegacyPaymentSuccess(data);
  }
}

async function handleSplitOrderSuccess(data: PaystackWebhookEvent['data'], rawPayload: string): Promise<void> {
  const reference = data.reference;

  const [payment] = await db.select().from(orderPayments)
    .where(eq(orderPayments.paystackReference, reference));

  if (!payment) {
    console.error(`[Paystack Webhook] No order payment found for reference: ${reference}`);
    return;
  }

  if (payment.status === 'paid') {
    console.log(`[Paystack Webhook] Payment already processed for reference: ${reference}`);
    return;
  }

  const verification = await verifyTransaction(reference);
  if (verification.status !== 'success') {
    console.error(`[Paystack Webhook] Verification failed for reference: ${reference}`);
    return;
  }

  if (verification.amount !== payment.amount) {
    console.error(`[Paystack Webhook] Amount mismatch: expected ${payment.amount}, got ${verification.amount} for reference: ${reference}`);
    return;
  }

  if (verification.currency !== 'NGN') {
    console.error(`[Paystack Webhook] Currency mismatch: expected NGN, got ${verification.currency} for reference: ${reference}`);
    return;
  }

  await db.update(orderPayments)
    .set({
      status: 'paid',
      paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
      rawEvent: JSON.parse(rawPayload),
      updatedAt: new Date(),
    })
    .where(eq(orderPayments.id, payment.id));

  const [order] = await db.select().from(orders)
    .where(eq(orders.id, payment.orderId));

  if (!order) {
    console.error(`[Paystack Webhook] No order found for orderId: ${payment.orderId}`);
    return;
  }

  await db.update(orders)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  const items = await db.select().from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  if (order.applicationId) {
    try {
      await storage.updateApplication(order.applicationId, {
        paymentState: 'paid_escrowed',
        paymentStateUpdatedAt: new Date(),
      });

      await storage.createAuditLog({
        actorUserId: order.founderId,
        action: 'incorporation_fee_paid_split',
        entityType: 'company_application',
        entityId: String(order.applicationId),
        details: {
          provider: 'paystack',
          orderId: order.id,
          paymentState: 'paid_escrowed',
          totalAmount: order.totalAmount,
          cellionCut: order.totalCellionCut,
          lawyerNet: order.totalLawyerNet,
        },
      });
    } catch (err) {
      console.error(`[Paystack Webhook] Error updating application ${order.applicationId}:`, err);
    }
  }

  for (const item of items) {
    const serviceType = item.sku;
    if (['SCUML', 'TM', 'TIN', 'ADD_DIR'].includes(serviceType)) {
      try {
        await db.insert(serviceRequests).values({
          founderId: order.founderId,
          orderId: order.id,
          orderItemId: item.id,
          serviceType,
          status: 'queued',
          notes: `Auto-created from paid order #${order.id}`,
        });

        await storage.createAuditLog({
          actorUserId: order.founderId,
          action: 'service_request_created',
          entityType: 'service_request',
          entityId: `${serviceType}_order_${order.id}`,
          details: { serviceType, orderId: order.id, sku: item.sku },
        });
      } catch (err) {
        console.error(`[Paystack Webhook] Error creating service request for ${serviceType}:`, err);
      }
    }

    if (serviceType === 'VERIFY') {
      try {
        await db.update(users)
          .set({ isIdentityVerified: true, identityVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, order.founderId));

        await storage.createAuditLog({
          actorUserId: order.founderId,
          action: 'identity_verification_activated',
          entityType: 'user',
          entityId: order.founderId,
          details: { orderId: order.id, method: 'payment', sku: 'VERIFY' },
        });

        const founderPeople = await storage.getCompanyPeopleByFounder(order.founderId);
        const unverifiedPeople = founderPeople.filter(p => !p.isVerified && p.personUserId);
        for (const person of unverifiedPeople) {
          await db.update(companyPeople)
            .set({ isVerified: true, updatedAt: new Date() })
            .where(eq(companyPeople.id, person.id));

          if (person.personUserId) {
            await db.update(users)
              .set({ isIdentityVerified: true, identityVerifiedAt: new Date(), updatedAt: new Date() })
              .where(eq(users.id, person.personUserId));
          }

          await storage.createAuditLog({
            actorUserId: order.founderId,
            action: 'company_person_verification_activated',
            entityType: 'company_person',
            entityId: String(person.id),
            details: { orderId: order.id, personUserId: person.personUserId, role: person.role },
          });
        }

        console.log(`[Paystack Webhook] User ${order.founderId} and ${unverifiedPeople.length} company people marked as verified`);
      } catch (err) {
        console.error(`[Paystack Webhook] Error marking user as verified:`, err);
      }
    }
  }

  await storage.createAuditLog({
    actorUserId: order.founderId,
    action: 'split_payment_completed',
    entityType: 'order',
    entityId: String(order.id),
    details: {
      reference,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
      totalAmount: order.totalAmount,
      cellionCut: order.totalCellionCut,
      lawyerNet: order.totalLawyerNet,
      items: items.map(i => ({ sku: i.sku, unitPrice: i.unitPrice, cellionCut: i.cellionCut, lawyerNet: i.lawyerNet })),
    },
  });

  await storage.createAuditLog({
    actorUserId: order.founderId,
    action: 'payout_split_recorded',
    entityType: 'order',
    entityId: String(order.id),
    details: {
      cellionCut: order.totalCellionCut,
      lawyerNet: order.totalLawyerNet,
      subaccountSettlement: true,
    },
  });

  await storage.createNotification({
    userId: order.founderId,
    title: 'Payment Successful',
    message: `Your payment of ₦${(order.totalAmount / 100).toLocaleString()} has been processed successfully.`,
    type: 'success',
    linkUrl: `/founder/orders/${order.id}`,
  });

  try {
    const founder = await storage.getUser(order.founderId);
    const catalogItems = await db.select().from(productCatalog);
    const itemDetails = items.map(item => {
      const catalogItem = catalogItems.find(c => c.sku === item.sku);
      return {
        sku: item.sku,
        name: catalogItem?.name || item.sku,
        unitPrice: item.unitPrice,
      };
    });

    await sendNewOrderNotificationEmail(ADMIN_NOTIFICATION_EMAIL, {
      orderId: order.id,
      founderName: founder ? `${founder.firstName || ''} ${founder.lastName || ''}`.trim() || founder.email || 'Unknown' : 'Unknown',
      founderEmail: founder?.email || 'Unknown',
      totalAmount: order.totalAmount,
      items: itemDetails,
    });
  } catch (emailErr) {
    console.error(`[Paystack Webhook] Failed to send admin order notification email:`, emailErr);
  }

  console.log(`[Paystack Webhook] Split payment processed for order #${order.id}, reference: ${reference}`);
}

async function handleLegacyPaymentSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const reference = data.reference;

  const transaction = await storage.getPaystackTransactionByReference(reference);
  if (!transaction) {
    console.error(`[Paystack Webhook] No transaction found for reference: ${reference}`);
    return;
  }

  const verification = await verifyTransaction(reference);
  if (verification.status !== 'success') {
    console.error(`[Paystack Webhook] Verification failed for reference: ${reference}`);
    return;
  }

  await storage.updatePaystackTransaction(transaction.id, {
    status: 'success',
    paystackTransactionId: String(data.id),
    gatewayResponse: data.gateway_response,
    channel: data.channel,
    completedAt: data.paid_at ? new Date(data.paid_at) : new Date(),
  });

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

  await storage.createNotification({
    userId,
    title: 'Payment Successful',
    message: `Your payment of ₦${((transaction.amountTotal || 0) / 100).toLocaleString()} has been processed successfully.`,
    type: 'success',
    linkUrl: '/founder/dashboard',
  });

  console.log(`[Paystack Webhook] Legacy payment processed for reference: ${reference}`);
}

async function handleChargeFailed(data: PaystackWebhookEvent['data'], rawPayload: string): Promise<void> {
  const reference = data.reference;
  const isSplitOrder = reference.startsWith('celion_split_');

  if (isSplitOrder) {
    const [payment] = await db.select().from(orderPayments)
      .where(eq(orderPayments.paystackReference, reference));

    if (payment) {
      await db.update(orderPayments)
        .set({ status: 'failed', rawEvent: JSON.parse(rawPayload), updatedAt: new Date() })
        .where(eq(orderPayments.id, payment.id));

      await db.update(orders)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(orders.id, payment.orderId));

      const [order] = await db.select().from(orders).where(eq(orders.id, payment.orderId));
      if (order) {
        await storage.createNotification({
          userId: order.founderId,
          title: 'Payment Failed',
          message: `Your payment of ₦${(order.totalAmount / 100).toLocaleString()} could not be processed. ${data.gateway_response || 'Please try again.'}`,
          type: 'warning',
          linkUrl: '/payment/checkout',
        });

        await storage.createAuditLog({
          actorUserId: order.founderId,
          action: 'split_payment_failed',
          entityType: 'order',
          entityId: String(order.id),
          details: { reference, gatewayResponse: data.gateway_response },
        });
      }
    }
  } else {
    const transaction = await storage.getPaystackTransactionByReference(reference);
    if (transaction) {
      await storage.updatePaystackTransaction(transaction.id, {
        status: 'failed',
        paystackTransactionId: String(data.id),
        gatewayResponse: data.gateway_response,
      });

      await storage.createNotification({
        userId: transaction.userId,
        title: 'Payment Failed',
        message: `Your payment of ₦${((transaction.amountTotal || 0) / 100).toLocaleString()} could not be processed. ${data.gateway_response || 'Please try again.'}`,
        type: 'warning',
        linkUrl: '/payment/checkout',
      });
    }
  }

  console.log(`[Paystack Webhook] Payment failed for reference: ${reference}`);
}

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
            endDate: oneYearFromNow.toISOString(),
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

async function handleKycPaymentSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const metadata = data.metadata as any;
  const verificationRequestId = metadata?.verificationRequestId;

  if (!verificationRequestId) {
    console.log('[Paystack Webhook] KYC payment missing verificationRequestId in metadata');
    return;
  }

  const reqId = parseInt(verificationRequestId);
  const [request] = await db.select().from(kycVerificationRequests)
    .where(eq(kycVerificationRequests.id, reqId));

  if (!request) {
    console.error(`[Paystack Webhook] KYC verification request ${reqId} not found`);
    return;
  }

  if (request.paymentStatus === 'paid') {
    console.log(`[Paystack Webhook] KYC request ${reqId} already paid, skipping`);
    return;
  }

  await db.update(kycVerificationRequests)
    .set({
      paymentStatus: 'paid',
      paymentReference: data.reference,
      status: request.status === 'pending_payment' ? 'in_progress' : request.status,
      updatedAt: new Date(),
    })
    .where(eq(kycVerificationRequests.id, reqId));

  console.log(`[Paystack Webhook] KYC payment processed for request ${reqId}, reference: ${data.reference}`);

  try {
    const { getResendClient } = await import('./emailService');
    const { client, fromEmail } = await getResendClient();
    const amount = data.amount / 100;
    await client.emails.send({
      from: fromEmail,
      to: request.subjectEmail,
      subject: `Payment of ₦${amount.toLocaleString()} received for your verification`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0d9668;">Payment Confirmed</h2>
        <p>Your payment of <strong>₦${amount.toLocaleString()}</strong> for verification has been received. You can now proceed with uploading your documents.</p>
      </div>`,
    });
  } catch (emailError) {
    console.error('[Paystack Webhook] Failed to send KYC payment email:', emailError);
  }
}

async function handleKycCreditPurchaseSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const metadata = data.metadata as any;
  const organisationId = metadata?.organisationId;
  const quantity = metadata?.quantity;
  const verificationType = metadata?.verificationType;

  if (!organisationId || !quantity || !verificationType) {
    console.error('[Paystack Webhook] KYC credit purchase missing required metadata');
    return;
  }

  try {
    const { addCredits } = await import('./kycBillingService');
    const unitLabel = verificationType === 'supplier' ? 'supplier' : 'individual';
    await addCredits(
      organisationId,
      quantity,
      verificationType,
      `Purchased ${quantity} ${unitLabel} verification credit${quantity > 1 ? 's' : ''} via Paystack`,
      data.reference
    );

    console.log(`[Paystack Webhook] KYC credit purchase processed: ${quantity} ${unitLabel} credits for org ${organisationId}, reference: ${data.reference}`);
  } catch (err) {
    console.error(`[Paystack Webhook] Error processing KYC credit purchase:`, err);
  }
}

export default {
  processWebhook,
};
