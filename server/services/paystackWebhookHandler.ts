import { storage } from '../storage';
import { db } from '../db';
import { orderPayments, orders, orderItems, serviceRequests, companyApplications, users, companyPeople, productCatalog, kycVerificationRequests, addressVerificationJobs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateCieOrgTierCache } from '../routes/cieApiRoutes';
import { verifyWebhookSignature, verifyTransaction } from './paystackPaymentService';
import { sendNewOrderNotificationEmail, ADMIN_NOTIFICATION_EMAIL } from './emailService';
import type { ServiceType, RegisteredOfficeTier } from '../config/priceBook';
import { createCandidate, submitBusinessAddressVerification } from './youverifyService';

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
    case 'invoice.payment_failed':
      await handleCieInvoicePaymentFailed(event.data);
      break;
    case 'subscription.disable':
      await handleCieSubscriptionDisable(event.data);
      break;
    default:
      console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`);
  }

  return { processed: true, event: event.event };
}

async function handleChargeSuccess(data: PaystackWebhookEvent['data'], rawPayload: string): Promise<void> {
  const reference = data.reference;
  const metaType = (data.metadata as any)?.type;

  if (metaType === 'cie_subscription') {
    await handleCieSubscriptionSuccess(data);
  } else if (metaType === 'procurement_escrow') {
    await handleProcurementEscrowSuccess(data);
  } else if (metaType === 'api_escrow') {
    await handleApiEscrowSuccess(data);
  } else if (reference.startsWith('kyc_credit_')) {
    await handleKycCreditPurchaseSuccess(data);
  } else if (reference.startsWith('kyc_')) {
    await handleKycPaymentSuccess(data);
  } else if (reference.startsWith('celion_split_')) {
    await handleSplitOrderSuccess(data, rawPayload);
  } else {
    await handleLegacyPaymentSuccess(data);
  }
}

async function handleProcurementEscrowSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const meta = data.metadata as any;
  const escrowId = parseInt(meta?.escrowId);
  if (!escrowId) {
    console.error('[Paystack Webhook] Procurement escrow missing escrowId in metadata');
    return;
  }

  const existing = await storage.getEscrowTransactionById(escrowId);
  if (!existing) {
    console.error(`[Paystack Webhook] Procurement escrow ${escrowId} not found`);
    return;
  }
  if (existing.status === 'funded') {
    console.log(`[Paystack Webhook] Procurement escrow ${escrowId} already funded, skipping`);
    return;
  }

  await storage.updateEscrowFunded(escrowId, data.reference);

  await storage.createAuditLog({
    actorUserId: 'system',
    action: 'procurement_escrow_funded',
    entityType: 'escrow_transaction',
    entityId: String(escrowId),
    details: { reference: data.reference, amount: data.amount, contractId: meta?.contractId },
  });

  console.log(`[Paystack Webhook] Procurement escrow ${escrowId} funded, ref: ${data.reference}`);
}

async function handleApiEscrowSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const meta = data.metadata as any;
  const reference = meta?.reference;
  if (!reference) {
    console.error('[Paystack Webhook] API escrow missing reference in metadata');
    return;
  }
  const { handleApiEscrowFunded } = await import('../routes/escrowApiRoutes');
  await handleApiEscrowFunded(reference, data.reference, data.amount);
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

      // Dispatch deferred invitations for draft company people linked to this application
      try {
        const draftPeople = await db.select().from(companyPeople).where(
          and(
            eq(companyPeople.applicationId, order.applicationId),
            eq(companyPeople.inviteStatus, 'draft'),
          )
        );

        if (draftPeople.length > 0) {
          const crypto = await import('crypto');
          const emailSvc = await import('./emailService');
          const { client: resend, fromEmail } = await emailSvc.getResendClient();
          const founderUser = await storage.getUser(order.founderId);
          const founderName = founderUser ? `${founderUser.firstName || ''} ${founderUser.lastName || ''}`.trim() : 'A founder';
          const appUrl = process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

          for (const person of draftPeople) {
            const inviteToken = crypto.randomBytes(32).toString('hex');
            await db.update(companyPeople)
              .set({ inviteStatus: 'pending', inviteToken, inviteSentAt: new Date() })
              .where(eq(companyPeople.id, person.id));

            const roleLabel = person.role === 'director_shareholder'
              ? 'Director & Shareholder'
              : person.role.charAt(0).toUpperCase() + person.role.slice(1);

            await resend.emails.send({
              from: fromEmail,
              to: person.inviteEmail!.toLowerCase().trim(),
              subject: `You've been invited as a ${roleLabel} on Cellion One`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Company Director/Shareholder Invitation</h2>
                  <p>${founderName} has invited you to join as a <strong>${roleLabel}</strong> for their company on Cellion One.</p>
                  <p>The incorporation payment has been confirmed. Please complete your profile by clicking below:</p>
                  <p><a href="${appUrl}/invite/${inviteToken}" style="background: #1a8a5c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
                  <p>If the button doesn't work, copy and paste this URL:<br/>${appUrl}/invite/${inviteToken}</p>
                  <hr style="margin: 24px 0;" />
                  <p style="color: #666; font-size: 12px;">This invitation was sent from Cellion One. If you didn't expect this, you can ignore this email.</p>
                </div>
              `,
            }).catch((emailErr: any) => {
              console.warn(`[Paystack Webhook] Failed to send deferred invite to ${person.inviteEmail}:`, emailErr?.message);
            });
          }

          console.log(`[Paystack Webhook] Dispatched ${draftPeople.length} deferred invitation(s) for application ${order.applicationId}`);
        }
      } catch (inviteErr) {
        console.error(`[Paystack Webhook] Error dispatching deferred invitations for application ${order.applicationId}:`, inviteErr);
      }

      // Auto-submit Youverify field-agent address verification if this order
      // contains a CAC incorporation SKU and the application has an operating address.
      const CAC_SKUS = ['CAC_1M', 'CAC_5M', 'CAC_10M', 'CAC_20M', 'CAC_100M'];
      const hasCacSku = items.some(i => CAC_SKUS.includes(i.sku));
      if (hasCacSku) {
        try {
          const [app] = await db.select().from(companyApplications).where(eq(companyApplications.id, order.applicationId));
          if (app && app.operatingAddress && app.addressVerificationStatus === 'none') {
            const addr = app.operatingAddress;
            const founder = await storage.getUser(order.founderId);
            const firstName = founder?.firstName ?? 'Company';
            const lastName = founder?.lastName ?? 'Director';
            const email = founder?.email ?? 'noreply@cellionone.com';

            const candidateId = await createCandidate({ firstName, lastName, email });
            if (candidateId) {
              const companyName = app.companyName ?? 'Company';
              const appUrl = process.env.REPLIT_DEV_DOMAIN
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
              const callbackUrl = `${appUrl}/api/webhooks/youverify`;

              const referenceId = await submitBusinessAddressVerification({
                candidateId,
                companyName,
                address: {
                  line1: addr.line1 ?? '',
                  line2: addr.line2 ?? '',
                  city: addr.city ?? '',
                  state: addr.state ?? '',
                  postalCode: addr.postalCode ?? '',
                  country: addr.country ?? 'NG',
                },
                callbackUrl,
              });

              const [newJob] = await db.insert(addressVerificationJobs).values({
                applicationId: order.applicationId,
                founderId: order.founderId,
                youverifyCandidateId: candidateId,
                youverifyReferenceId: referenceId ?? null,
                status: referenceId ? 'submitted' : 'failed',
              }).returning();

              await db.update(companyApplications)
                .set({ addressVerificationStatus: referenceId ? 'submitted' : 'failed', updatedAt: new Date() })
                .where(eq(companyApplications.id, order.applicationId));

              await storage.createAuditLog({
                actorUserId: order.founderId,
                action: 'youverify_address_submitted',
                entityType: 'address_verification_job',
                entityId: String(newJob.id),
                details: { candidateId, referenceId, applicationId: order.applicationId, success: !!referenceId },
              });

              if (referenceId) {
                console.log(`[Paystack Webhook] Youverify address verification submitted — referenceId: ${referenceId}, jobId: ${newJob.id}`);
              } else {
                console.warn(`[Paystack Webhook] Youverify submission failed for application ${order.applicationId} — job recorded as failed`);
              }
            } else {
              // Candidate creation failed — record a failed job row so admins have
              // full operational visibility and can trigger a retry manually.
              const [failedJob] = await db.insert(addressVerificationJobs).values({
                applicationId: order.applicationId,
                founderId: order.founderId,
                youverifyCandidateId: null,
                youverifyReferenceId: null,
                status: 'failed',
              }).returning();

              await db.update(companyApplications)
                .set({ addressVerificationStatus: 'failed', updatedAt: new Date() })
                .where(eq(companyApplications.id, order.applicationId));

              await storage.createAuditLog({
                actorUserId: order.founderId,
                action: 'youverify_candidate_failed',
                entityType: 'address_verification_job',
                entityId: String(failedJob.id),
                details: { applicationId: order.applicationId, reason: 'createCandidate returned null' },
              });

              console.warn(`[Paystack Webhook] Youverify candidate creation failed for application ${order.applicationId} — failed job row created (id: ${failedJob.id})`);
            }
          }
        } catch (yvErr: unknown) {
          const msg = yvErr instanceof Error ? yvErr.message : String(yvErr);
          console.error(`[Paystack Webhook] Youverify submission error for application ${order.applicationId}:`, msg);
        }
      }

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

    if (serviceType === 'OFFICE_ONLY' || serviceType === 'OFFICE_PLUS_MAIL') {
      try {
        const tier = serviceType === 'OFFICE_ONLY' ? 'office_only' : 'office_plus_mail';
        const { registeredOfficeService } = await import('./registeredOfficeService');
        if (order.applicationId) {
          await registeredOfficeService.selectForApplication(order.applicationId, order.founderId, tier);
        } else {
          await registeredOfficeService.subscribeStandalone(order.founderId, tier);
        }
        await storage.createAuditLog({
          actorUserId: order.founderId,
          action: 'registered_office_activated_sku',
          entityType: 'registered_office_subscription',
          entityId: `${serviceType}_order_${order.id}`,
          details: { tier, orderId: order.id, sku: serviceType, applicationId: order.applicationId },
        });
        await storage.createNotification({
          userId: order.founderId,
          title: 'Registered Office Activated',
          message: `Your registered office subscription (${tier === 'office_plus_mail' ? 'Office + Mail' : 'Office Only'}) is now active for one year.`,
          type: 'success',
          linkUrl: '/founder/registered-office',
        });
        console.log(`[Paystack Webhook] Registered office (${tier}) activated for founder ${order.founderId}`);
      } catch (err) {
        console.error(`[Paystack Webhook] Error activating registered office for ${serviceType}:`, err);
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

  // CIE pending subscription reconciliation:
  // If the failed reference matches a pending CIE subscription, mark it as 'failed'
  // so the user can re-initiate without hitting the duplicate-pending check.
  const ciePending = await storage.getCieSubscriptionByReference(reference);
  if (ciePending && ciePending.status === 'pending') {
    await storage.updateCieSubscription(ciePending.id, { status: 'failed' });
    console.log(`[Paystack Webhook] Marked pending CIE subscription ${ciePending.id} as failed for reference ${reference}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// CIE Subscription Webhook Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleCieSubscriptionSuccess(data: PaystackWebhookEvent['data']): Promise<void> {
  const meta = data.metadata as any;
  const userId = meta?.userId;
  const tier = meta?.tier as 'subscriber' | 'pro' | undefined;
  const orgId = meta?.orgId ? Number(meta.orgId) : null;
  const previousSubscriptionId = meta?.previousSubscriptionId ? Number(meta.previousSubscriptionId) : null;

  if (!userId || !tier) {
    console.error('[Paystack Webhook] CIE subscription missing userId or tier in metadata');
    return;
  }

  const paystackReference = data.reference;
  const planData = (data as any).plan;
  const subscriptionCode = (data as any).subscription_code || null;
  const customerCode = data.customer?.customer_code || null;
  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  const periodStart = paidAt;
  const periodEnd = new Date(paidAt);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const periodEndStr = periodEnd.toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const authorizationCode = (data as any).authorization?.authorization_code || null;

  // Lookup order:
  // 1. By subscription code (Paystack recurring renewal — same sub code, new reference each cycle)
  // 2. By transaction reference (initial payment creating pending→active)
  let targetSub = subscriptionCode
    ? await storage.getCieSubscriptionByPaystackCode(subscriptionCode)
    : undefined;

  if (!targetSub) {
    targetSub = await storage.getCieSubscriptionByReference(paystackReference);
  }

  if (targetSub) {
    // Update: activate (initial) or renew (recurring) the subscription record
    await storage.updateCieSubscription(targetSub.id, {
      status: 'active',
      tier,
      orgId: orgId || targetSub.orgId || undefined,
      paystackSubscriptionCode: subscriptionCode || targetSub.paystackSubscriptionCode,
      paystackCustomerCode: customerCode || targetSub.paystackCustomerCode,
      paystackAuthorizationCode: authorizationCode || targetSub.paystackAuthorizationCode,
      paystackEmail: data.customer?.email || targetSub.paystackEmail,
      paystackPlanCode: planData?.plan_code || targetSub.paystackPlanCode,
      paystackReference,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,  // Renewal clears any pending cancel flag
    });

    const effectiveOrgId = orgId || (targetSub.orgId ? Number(targetSub.orgId) : null);
    if (effectiveOrgId) {
      try { invalidateCieOrgTierCache(effectiveOrgId); } catch {}
    }

    // 2. If this was an upgrade, expire the previous subscription
    if (previousSubscriptionId) {
      const prevSub = await storage.getCieSubscriptionById(previousSubscriptionId);
      if (prevSub && prevSub.status === 'active') {
        await storage.updateCieSubscription(previousSubscriptionId, {
          status: 'expired',
          cancelledAt: new Date(),
        });
        console.log(`[Paystack Webhook] CIE previous subscription #${previousSubscriptionId} expired (superseded by upgrade)`);
      }
    }

    await storage.createNotification({
      userId,
      title: `CIE ${tier === 'pro' ? 'Pro' : 'Subscriber'} Activated`,
      message: `Your CIE ${tier === 'pro' ? 'Pro' : 'Subscriber'} subscription is now active until ${periodEndStr}.`,
      type: 'success',
      linkUrl: '/cie/subscribe',
    });

    await storage.createAuditLog({
      actorUserId: userId,
      action: 'cie_subscription_activated',
      entityType: 'cie_subscription',
      entityId: String(targetSub.id),
      details: { tier, subscriptionCode, reference: paystackReference, periodEnd, previousSubscriptionId },
    });

    console.log(`[Paystack Webhook] CIE ${tier} subscription #${targetSub.id} activated for user ${userId}`);
  } else {
    // No pending record found by reference — create a fresh active record (idempotent safety net)
    const newSub = await storage.createCieSubscription({
      userId,
      orgId: orgId || undefined,
      tier,
      status: 'active',
      paystackSubscriptionCode: subscriptionCode,
      paystackCustomerCode: customerCode,
      paystackAuthorizationCode: authorizationCode,
      paystackEmail: data.customer?.email || undefined,
      paystackPlanCode: planData?.plan_code || undefined,
      paystackReference,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    if (orgId) {
      try { invalidateCieOrgTierCache(orgId); } catch {}
    }

    await storage.createNotification({
      userId,
      title: `CIE ${tier === 'pro' ? 'Pro' : 'Subscriber'} Activated`,
      message: `Your CIE subscription is now active until ${periodEndStr}.`,
      type: 'success',
      linkUrl: '/cie/subscribe',
    });

    await storage.createAuditLog({
      actorUserId: userId,
      action: 'cie_subscription_activated',
      entityType: 'cie_subscription',
      entityId: String(newSub.id),
      details: { tier, subscriptionCode, reference: paystackReference, source: 'safety_net' },
    });

    console.log(`[Paystack Webhook] CIE ${tier} subscription created (safety net) for user ${userId}`);
  }
}

async function handleCieInvoicePaymentFailed(data: any): Promise<void> {
  const subscriptionCode = data?.subscription?.subscription_code;
  if (!subscriptionCode) {
    console.warn('[Paystack Webhook] invoice.payment_failed missing subscription_code');
    return;
  }

  const sub = await storage.getCieSubscriptionByPaystackCode(subscriptionCode);
  if (!sub) {
    console.warn(`[Paystack Webhook] No CIE subscription found for code ${subscriptionCode}`);
    return;
  }

  await storage.updateCieSubscription(sub.id, { status: 'past_due' });

  if (sub.orgId) {
    try { invalidateCieOrgTierCache(sub.orgId); } catch {}
  }

  await storage.createNotification({
    userId: sub.userId,
    title: 'CIE Payment Failed',
    message: 'Your CIE subscription payment failed. Please update your payment method to maintain access.',
    type: 'warning',
    linkUrl: '/cie/subscribe',
  });

  await storage.createAuditLog({
    actorUserId: sub.userId,
    action: 'cie_subscription_payment_failed',
    entityType: 'cie_subscription',
    entityId: String(sub.id),
    details: { subscriptionCode },
  });

  console.log(`[Paystack Webhook] CIE subscription ${subscriptionCode} marked past_due`);
}

async function handleCieSubscriptionDisable(data: any): Promise<void> {
  const subscriptionCode = data?.subscription_code || data?.code;
  if (!subscriptionCode) {
    console.warn('[Paystack Webhook] subscription.disable missing subscription_code');
    return;
  }

  const sub = await storage.getCieSubscriptionByPaystackCode(subscriptionCode);
  if (!sub) {
    console.warn(`[Paystack Webhook] No CIE subscription found for code ${subscriptionCode}`);
    return;
  }

  // Keep status='active' so access continues until currentPeriodEnd.
  // The daily subscription scheduler will transition to 'cancelled' when the period expires.
  // Only invalidate the tier cache immediately if the period has already ended.
  const now = new Date();
  const periodAlreadyEnded = sub.currentPeriodEnd ? sub.currentPeriodEnd <= now : true;

  await storage.updateCieSubscription(sub.id, {
    ...(periodAlreadyEnded ? { status: 'cancelled' } : {}),
    cancelAtPeriodEnd: true,
    cancelledAt: new Date(),  // Records when Paystack fired the disable event
  });

  if (sub.orgId && periodAlreadyEnded) {
    try { invalidateCieOrgTierCache(sub.orgId); } catch {}
  }

  const periodEndStr = sub.currentPeriodEnd
    ? sub.currentPeriodEnd.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'the end of your billing period';

  const message = periodAlreadyEnded
    ? 'Your CIE subscription has been cancelled. You now have free-tier access.'
    : `Your CIE subscription has been cancelled and will expire on ${periodEndStr}. You retain paid access until then.`;

  await storage.createNotification({
    userId: sub.userId,
    title: 'CIE Subscription Cancelled',
    message,
    type: 'info',
    linkUrl: '/cie/subscribe',
  });

  await storage.createAuditLog({
    actorUserId: sub.userId,
    action: 'cie_subscription_cancelled',
    entityType: 'cie_subscription',
    entityId: String(sub.id),
    details: { subscriptionCode },
  });

  console.log(`[Paystack Webhook] CIE subscription ${subscriptionCode} cancelled`);
}

export default {
  processWebhook,
};
