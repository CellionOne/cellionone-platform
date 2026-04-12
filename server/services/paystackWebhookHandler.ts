import { storage } from '../storage';
import { db } from '../db';
import { orderPayments, orders, orderItems, serviceRequests, companyApplications, users, companyPeople, productCatalog, kycVerificationRequests, addressVerificationJobs, companyProfiles, directorBiometricInvites, founderProfiles, identityVerifications, type InsertFounderProfile, type InsertIdentityVerification } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateCieOrgTierCache } from '../routes/cieApiRoutes';
import { verifyWebhookSignature, verifyTransaction } from './paystackPaymentService';
import { sendNewOrderNotificationEmail, ADMIN_NOTIFICATION_EMAIL } from './emailService';
import type { ServiceType, RegisteredOfficeTier } from '../config/priceBook';
import { createCandidate, submitBusinessAddressVerification } from './youverifyService';
import { upsertVerifiedIndividualByUserId } from './verifiedEntityService';

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
    case 'charge.attempt':
      // Titan DVA Inbound Transfer Approval — respond with approve/reject
      return await handleTitanInboundApproval(event.data);
    case 'dedicatedaccount.assign.success':
      await handleDvaAssignSuccess(event.data);
      break;
    case 'dedicatedaccount.assign.failed':
      console.warn('[Paystack Webhook] DVA assignment failed:', JSON.stringify(event.data));
      break;
    case 'transfer.success':
      await handleTransferSuccess(event.data);
      break;
    case 'transfer.failed':
    case 'transfer.reversed':
      await handleTransferFailed(event.data);
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

  // DVA bank transfer — match by receiver account number
  if ((data as any).channel === 'dedicated_nuban') {
    const receiverAccount = (data as any).authorization?.receiver_bank_account_number
      || (data as any).dedicated_nuban?.account_number;
    if (receiverAccount) {
      const { handleDvaEscrowFunded } = await import('../routes/escrowApiRoutes');
      await handleDvaEscrowFunded(receiverAccount, reference, data.amount);
    } else {
      console.error('[Paystack Webhook] dedicated_nuban charge.success missing receiver_bank_account_number');
    }
    return;
  }

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

async function handleTransferSuccess(data: any): Promise<void> {
  const transferRef = data.reference;
  if (!transferRef) {
    console.error('[Paystack Webhook] transfer.success missing reference');
    return;
  }
  // Only handle escrow transfers (co_esc_ prefix)
  if (!transferRef.startsWith('co_esc_')) {
    console.log(`[Paystack Webhook] transfer.success ref ${transferRef} — not an escrow transfer, skipping`);
    return;
  }
  const { handleEscrowTransferSuccess } = await import('../routes/escrowApiRoutes');
  await handleEscrowTransferSuccess(transferRef);
}

async function handleTransferFailed(data: any): Promise<void> {
  const transferRef = data.reference;
  if (!transferRef) {
    console.error('[Paystack Webhook] transfer.failed/reversed missing reference');
    return;
  }
  if (!transferRef.startsWith('co_esc_')) {
    console.log(`[Paystack Webhook] transfer.failed ref ${transferRef} — not an escrow transfer, skipping`);
    return;
  }
  const { handleEscrowTransferFailed } = await import('../routes/escrowApiRoutes');
  await handleEscrowTransferFailed(transferRef);
}

async function handleTitanInboundApproval(data: any): Promise<{ processed: boolean; event: string; approvalResponse?: any }> {
  const dvaAccountNumber = data?.authorization?.receiver_bank_account_number
    || data?.dedicated_nuban?.account_number
    || data?.account_number;
  const incomingAmount = data?.amount;

  if (!dvaAccountNumber || !incomingAmount) {
    console.error('[Paystack Webhook] charge.attempt missing dva account or amount — rejecting');
    return { processed: true, event: 'charge.attempt', approvalResponse: { data: { approve: false } } };
  }

  const { evaluateDvaTransferApproval } = await import('../routes/escrowApiRoutes');
  const { approve, reason } = await evaluateDvaTransferApproval(dvaAccountNumber, incomingAmount);
  console.log(`[Paystack Webhook] Titan DVA approval for ${dvaAccountNumber} amount=${incomingAmount}: ${approve} — ${reason}`);

  return { processed: true, event: 'charge.attempt', approvalResponse: { data: { approve } } };
}

/**
 * Paystack fires dedicatedaccount.assign.success when a DVA is fully activated.
 * We use this to confirm the DVA is live and log the assignment.
 * If for any reason DVA creation succeeded API-side but the escrow record
 * didn't get the account number, we patch it here from the webhook payload.
 */
async function handleDvaAssignSuccess(data: any): Promise<void> {
  const accountNumber = data?.dedicated_account?.account_number
    || data?.account?.account_number;
  const bankName = data?.dedicated_account?.bank?.name
    || data?.account?.bank?.name;
  const customerEmail = data?.customer?.email;

  if (!accountNumber) {
    console.warn('[Paystack Webhook] dedicatedaccount.assign.success — no account_number in payload');
    return;
  }

  console.log(`[Paystack Webhook] DVA assigned: ${accountNumber} (${bankName}) for customer ${customerEmail}`);

  // Use storage directly to find the escrow transaction with this DVA account
  const tx = await storage.getEscrowApiTransactionByDvaAccount(accountNumber);
  if (!tx) {
    // DVA assigned but no escrow matched — could be a test DVA or timing issue
    console.log(`[Paystack Webhook] DVA ${accountNumber} assigned but no pending escrow matched`);
    return;
  }

  // If DVA was already stored (normal case), just log
  if (tx.dvaAccountNumber === accountNumber) {
    console.log(`[Paystack Webhook] DVA ${accountNumber} already recorded for escrow ${tx.reference} — assignment confirmed`);
  }

  await storage.createAuditLog({
    actorUserId: 'system',
    action: 'dva_assign_success',
    entityType: 'escrow_api_transaction',
    entityId: tx.reference,
    details: { accountNumber, bankName, customerEmail, orgId: tx.orgId },
  });
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
              const companyName = app.companyName1 ?? app.companyName2 ?? app.companyName3 ?? 'Company';
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
    if (['SCUML', 'TM', 'TIN', 'ADD_DIR', 'BANK_ACCOUNT'].includes(serviceType)) {
      try {
        await db.insert(serviceRequests).values({
          founderId: order.founderId,
          orderId: order.id,
          orderItemId: item.id,
          serviceType,
          status: 'queued',
          notes: serviceType === 'BANK_ACCOUNT'
            ? `Bank account opening request from order #${order.id}. Manual pricing — our team will follow up with pricing details.`
            : `Auto-created from paid order #${order.id}`,
        });

        await storage.createAuditLog({
          actorUserId: order.founderId,
          action: 'service_request_created',
          entityType: 'service_request',
          entityId: `${serviceType}_order_${order.id}`,
          details: { serviceType, orderId: order.id, sku: item.sku },
        });

        if (serviceType === 'BANK_ACCOUNT') {
          await storage.createNotification({
            userId: order.founderId,
            title: 'Bank Account Opening — Request Received',
            message: 'Your corporate bank account opening request has been received. Our team will contact you shortly with pricing and next steps.',
            type: 'info',
            linkUrl: '/founder/services',
          });
        }
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

    if (serviceType === 'EXISTING_CO_VERIFY') {
      try {
        // Find the company profile linked to this order
        const [profile] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.existingCoVerifyOrderId, order.id));

        if (profile) {
          await db.update(companyProfiles)
            .set({ existingCompanyStatus: 'pending_review', updatedAt: new Date() })
            .where(eq(companyProfiles.id, profile.id));

          await storage.createAuditLog({
            actorUserId: order.founderId,
            action: 'existing_company_payment_confirmed',
            entityType: 'company_profile',
            entityId: String(profile.id),
            details: { orderId: order.id, companyName: profile.companyName },
          });

          await storage.createNotification({
            userId: order.founderId,
            title: 'Payment Confirmed — Verification Running',
            message: `Payment received for ${profile.companyName}. Our automated verification pipeline is running. You will be notified when complete.`,
            type: 'success',
            linkUrl: '/founder/existing-company',
          });

          // Post-payment pipeline: KYB (Smile ID Job Type 7) → TIN (FIRS) → director BVN/NIN/AML → auto-approve/flag
          interface PipelineDirector {
            name: string; email?: string; role?: string; phone?: string;
            bvn?: string; nin?: string; // AES-256-GCM encrypted
            bvnVerified?: boolean; ninVerified?: boolean;
            amlIsHit?: boolean; amlHitTypes?: string[];
            amlChecked?: boolean; // true only when AML service returned a definitive result
            amlCheckError?: string;
            biometricStatus?: string;
          }

          // Fetch founder email once for notifications
          const founderUser = await storage.getUser(order.founderId);
          const founderEmail = founderUser?.email ?? order.founderId;

          try {
            const { verifyBusiness, verifyTin, verifyBvn, verifyNin, performAmlCheck } = await import('./smileIdService');
            const { decryptField } = await import('./encryptionService');

            // Normalise company names for comparison: uppercase, strip common legal suffixes, strip punctuation
            const normalizeCoName = (s: string) =>
              s.toUpperCase()
                .replace(/\b(LIMITED|LTD|PUBLIC LIMITED COMPANY|PLC|LLC|LLP|CO|COMPANY|INC|INCORPORATED)\b/g, '')
                .replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
            const nameMatch = (a: string, b: string) => {
              const na = normalizeCoName(a); const nb = normalizeCoName(b);
              return na === nb || na.includes(nb) || nb.includes(na);
            };

            // Step 1: Authoritative KYB — company found + active status + name/RC consistency + director-CAC match
            let kybPassed = false;
            let kybResultText = 'No KYB data';
            let kybFailReason: string | undefined;
            let kybDirectorMismatches: string[] = [];
            let freshKybResult: Record<string, unknown> | undefined;
            let kybMatchedData: { registryName?: string; status?: string; type?: string; rcNumber?: string; registrationDate?: string } | undefined;
            const KYB_ACTIVE_STATUSES = ['active', 'approved and active', 'registered'];
            try {
              const companyTypeToBusinessType: Record<string, string> = {
                LTD: 'co', PLC: 'co', LLP: 'co', LBG: 'co', UC: 'co',
                Sole_Proprietorship: 'bn', Business_Name: 'bn', BN: 'bn',
                Incorporated_Trustee: 'it', IT: 'it',
              };
              const businessType = companyTypeToBusinessType[profile.companyType || ''] || 'co';
              const kybJob = await verifyBusiness(profile.rcNumber || '', order.founderId, `kyb-post-pay-${profile.id}-${Date.now()}`, businessType);
              kybMatchedData = {
                registryName: kybJob.companyName ?? undefined,
                status: kybJob.status ?? undefined,
                type: kybJob.companyType ?? undefined,
                rcNumber: kybJob.rcNumber ?? undefined,
                registrationDate: kybJob.registrationDate ?? undefined,
              };
              const { rawResult: _kybRaw, ...safeKyb } = kybJob;
              freshKybResult = safeKyb as Record<string, unknown>;

              if (!kybJob.found) {
                kybResultText = 'Not found in CAC registry';
                kybFailReason = 'not_found';
              } else {
                const statusOk = KYB_ACTIVE_STATUSES.includes((kybJob.status || '').toLowerCase());
                const regNameOk = kybJob.companyName ? nameMatch(profile.companyName, kybJob.companyName) : true;

                // Director-CAC matching: if CAC returns a non-empty director list, every submitted director
                // must be present in the CAC list (normalized name match). If CAC returns no directors,
                // we skip the check (inconclusive) to avoid false negatives from incomplete CAC data.
                const cacDirectors = (kybJob.directors || []) as { name: string; role?: string }[];
                const submittedDirectors = (profile.directors as PipelineDirector[] | null) || [];
                let directorCacOk = true;
                if (cacDirectors.length > 0 && submittedDirectors.length > 0) {
                  for (const sd of submittedDirectors) {
                    const found = cacDirectors.some(cd => nameMatch(sd.name, cd.name));
                    if (!found) kybDirectorMismatches.push(sd.name);
                  }
                  directorCacOk = kybDirectorMismatches.length === 0;
                }

                if (!statusOk) {
                  kybResultText = `Company status is not active: ${kybJob.status || 'unknown'}`;
                  kybFailReason = 'status_not_active';
                } else if (!regNameOk) {
                  kybResultText = `Name mismatch: submitted "${profile.companyName}" vs registry "${kybJob.companyName}"`;
                  kybFailReason = 'name_mismatch';
                } else if (!directorCacOk) {
                  kybResultText = `Director(s) not found in CAC records: ${kybDirectorMismatches.join(', ')}`;
                  kybFailReason = 'director_not_in_cac';
                } else {
                  kybPassed = true;
                  kybResultText = kybJob.status || 'Active';
                }
              }
            } catch (kybErr: unknown) {
              const msg = kybErr instanceof Error ? kybErr.message : String(kybErr);
              console.error(`[Webhook] Post-payment KYB failed for profile ${profile.id}: ${msg}`);
              kybResultText = `KYB check error: ${msg}`;
              kybFailReason = 'service_error';
            }

            // KYB fallback: if the fresh post-payment KYB check failed (not found OR service error),
            // fall back to the stored KYB result from Step 1 (run server-side during profile creation).
            // This prevents Smile ID API intermittent failures from incorrectly routing a company
            // to manual review when the Step-1 lookup already confirmed it in the CAC registry.
            if (!kybPassed && profile.smileKybResult) {
              try {
                const stored = profile.smileKybResult as Record<string, unknown>;
                if (stored.found === true) {
                  const storedStatus = String(stored.status || '');
                  const storedName = String(stored.companyName || '');
                  const storedDirs = (Array.isArray(stored.directors) ? stored.directors : []) as { name: string; role?: string }[];
                  const submittedDirs = (profile.directors as PipelineDirector[] | null) || [];

                  const statusOkFb = KYB_ACTIVE_STATUSES.includes(storedStatus.toLowerCase());
                  const regNameOkFb = storedName ? nameMatch(profile.companyName, storedName) : true;
                  let dirCacOkFb = true;
                  const storedMismatches: string[] = [];
                  if (storedDirs.length > 0 && submittedDirs.length > 0) {
                    for (const sd of submittedDirs) {
                      const dirFound = storedDirs.some(cd => nameMatch(sd.name, String(cd.name || '')));
                      if (!dirFound) storedMismatches.push(sd.name);
                    }
                    dirCacOkFb = storedMismatches.length === 0;
                  }

                  if (statusOkFb && regNameOkFb && dirCacOkFb) {
                    kybPassed = true;
                    kybFailReason = undefined;
                    kybDirectorMismatches = [];
                    kybResultText = `${storedStatus || 'Active'} (Step-1 KYB)`;
                    kybMatchedData = {
                      registryName: storedName,
                      status: storedStatus,
                      type: String(stored.companyType || ''),
                      rcNumber: String(stored.rcNumber || ''),
                      registrationDate: String(stored.registrationDate || ''),
                    };
                    console.log(`[Webhook] Profile ${profile.id}: fresh KYB failed, using stored Step-1 KYB (status=${storedStatus}, name=${storedName})`);
                  } else {
                    console.log(`[Webhook] Profile ${profile.id}: stored KYB fallback also did not pass — statusOk=${statusOkFb}, nameOk=${regNameOkFb}, dirOk=${dirCacOkFb}`);
                    if (storedMismatches.length > 0) kybDirectorMismatches = storedMismatches;
                  }
                }
              } catch (fbErr: unknown) {
                console.error(`[Webhook] KYB fallback evaluation error for profile ${profile.id}:`, fbErr);
              }
            }

            // Step 2: TIN verification — found + company name consistent with profile
            const tinProvided = !!profile.tinNumber;
            let tinPassed = !tinProvided;
            let tinResultText = tinProvided ? 'Not checked' : 'Not provided';
            let tinFailReason: string | undefined;
            let freshTinResult: Record<string, unknown> | undefined;
            let tinMatchedData: { found?: boolean; registryName?: string; status?: string } | undefined;
            if (tinProvided) {
              try {
                const tinJob = await verifyTin(profile.tinNumber!, order.founderId, `tin-post-pay-${profile.id}-${Date.now()}`);
                tinMatchedData = {
                  found: tinJob.found,
                  registryName: tinJob.companyName ?? undefined,
                  status: tinJob.status ?? undefined,
                };
                const { rawResult: _tinRaw, ...safeTin } = tinJob;
                freshTinResult = safeTin as Record<string, unknown>;

                if (!tinJob.found) {
                  tinResultText = 'TIN not found in FIRS database';
                  tinFailReason = 'not_found';
                } else {
                  const tinNameOk = tinJob.companyName ? nameMatch(profile.companyName, tinJob.companyName) : true;
                  if (!tinNameOk) {
                    tinResultText = `TIN name mismatch: profile "${profile.companyName}" vs FIRS "${tinJob.companyName}"`;
                    tinFailReason = 'name_mismatch';
                  } else {
                    tinPassed = true;
                    tinResultText = 'Verified with FIRS';
                  }
                }
              } catch (tinErr: unknown) {
                const msg = tinErr instanceof Error ? tinErr.message : String(tinErr);
                console.error(`[Webhook] Post-payment TIN verification failed for profile ${profile.id}: ${msg}`);
                tinResultText = `TIN check error: ${msg}`;
                tinFailReason = 'service_error';
              }
            }

            // Persist fresh KYB + TIN results to profile
            await db.update(companyProfiles)
              .set({
                smileKybResult: freshKybResult || profile.smileKybResult as Record<string, unknown> | undefined,
                smileTinResult: tinProvided ? (freshTinResult || profile.smileTinResult as Record<string, unknown> | undefined) : (profile.smileTinResult as Record<string, unknown> | undefined),
                updatedAt: new Date(),
              })
              .where(eq(companyProfiles.id, profile.id));

            // Step 3: Director BVN/NIN + AML — decrypts PII in-flight, never logs plaintext
            const directors: PipelineDirector[] = (profile.directors as PipelineDirector[] | null) || [];
            const updatedDirectors: PipelineDirector[] = [...directors];

            for (let idx = 0; idx < directors.length; idx++) {
              const director = directors[idx];
              const dirJobBase = `dir-${profile.id}-${idx}-${Date.now()}`;
              let bvnVerified: boolean | undefined;
              let ninVerified: boolean | undefined;

              if (director.bvn) {
                try {
                  const plainBvn = decryptField(director.bvn);
                  const bvnRes = await verifyBvn(plainBvn, order.founderId, `bvn-${dirJobBase}`);
                  bvnVerified = bvnRes.success;
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error(`[Webhook] Director BVN verification failed (idx ${idx}): ${msg}`);
                }
              }

              if (director.nin) {
                try {
                  const plainNin = decryptField(director.nin);
                  const ninRes = await verifyNin(plainNin, order.founderId, `nin-${dirJobBase}`);
                  ninVerified = ninRes.success;
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error(`[Webhook] Director NIN verification failed (idx ${idx}): ${msg}`);
                }
              }

              let amlIsHit: boolean | undefined;
              let amlHitTypes: string[] | undefined;
              let amlChecked = false;
              let amlCheckError: string | undefined;
              try {
                const amlRes = await performAmlCheck(director.name, order.founderId);
                amlIsHit = amlRes.isHit;
                amlHitTypes = amlRes.hitTypes;
                amlChecked = true; // service returned a definitive result
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                amlCheckError = msg;
                console.error(`[Webhook] Director AML check failed (idx ${idx}): ${msg}`);
                // amlChecked stays false — pipeline will route to under_review
              }

              updatedDirectors[idx] = {
                ...director,
                bvnVerified: bvnVerified !== undefined ? bvnVerified : director.bvnVerified,
                ninVerified: ninVerified !== undefined ? ninVerified : director.ninVerified,
                amlIsHit: amlIsHit !== undefined ? amlIsHit : director.amlIsHit,
                amlHitTypes: amlHitTypes !== undefined ? amlHitTypes : director.amlHitTypes,
                amlChecked,
                amlCheckError,
                biometricStatus: 'pending_selfie',
              };
            }

            // Persist updated director verification statuses
            if (updatedDirectors.length > 0) {
              await db.update(companyProfiles)
                .set({ directors: updatedDirectors as typeof profile.directors, updatedAt: new Date() })
                .where(eq(companyProfiles.id, profile.id));

              // Issue per-director biometric invite tokens
              const emailSvcForBio = await import('./emailService');
              const { client: resendBio, fromEmail: fromBio } = await emailSvcForBio.getResendClient();
              const crypto = await import('crypto');
              // Look up founder's email so we can skip the director invite email for them
              const [founderUserForBio] = await db.select({ email: users.email, id: users.id })
                .from(users).where(eq(users.id, order.founderId));
              const founderEmailForBio = founderUserForBio?.email?.toLowerCase();
              for (let dirIdx = 0; dirIdx < updatedDirectors.length; dirIdx++) {
                const director = updatedDirectors[dirIdx];
                try {
                  const inviteToken = crypto.randomBytes(48).toString('hex');
                  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
                  // If this director is the founder, link the invite to their user account
                  const isFounderDirector = founderEmailForBio && director.email?.toLowerCase() === founderEmailForBio;
                  await db.insert(directorBiometricInvites).values({
                    token: inviteToken,
                    companyProfileId: profile.id,
                    directorIndex: dirIdx,
                    directorName: director.name,
                    directorEmail: director.email || null,
                    // founder_selfie = this is the platform founder; they complete via Personal Profile
                    // pending = external director; they receive an email link
                    status: isFounderDirector ? 'founder_selfie' : 'pending',
                    expiresAt,
                    // Link to founder's user account so they can complete via Personal Profile
                    ...(isFounderDirector && founderUserForBio ? { founderUserId: founderUserForBio.id } : {}),
                  });
                  if (director.email && !isFounderDirector) {
                    // External director — send the invite email
                    const appUrl = process.env.REPLIT_DEV_DOMAIN || process.env.APP_URL || 'https://cellionone.com';
                    const biometricUrl = `${appUrl}/director-biometric?token=${inviteToken}`;
                    resendBio.emails.send({
                      from: fromBio,
                      to: director.email,
                      subject: `Action required: Complete identity verification — ${profile.companyName}`,
                      html: `<p>Hi ${director.name},</p><p>You have been listed as a director/officer of <strong>${profile.companyName}</strong> on Cellion One.</p><p>To complete your identity verification, please submit a biometric selfie using the secure link below. This link is valid for 48 hours and can only be used once.</p><p><a href="${biometricUrl}" style="font-weight:bold">Complete Biometric Verification</a></p><p>This step is required before the company can be fully verified on Cellion One.</p><p>The Cellion One Compliance Team</p>`,
                    }).catch((e: Error) => console.error(`[Webhook] Biometric invite email failed for director ${director.name}: ${e.message}`));
                  } else if (isFounderDirector) {
                    console.log(`[Webhook] Director ${director.name} is the founder — skipping email, they will complete biometric via Personal Profile`);
                  }
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error(`[Webhook] Failed to create biometric invite for director ${director.name}: ${msg}`);
                }
              }
            }

            // Step 3b: Founder profile pre-fill and (conditional) identity auto-verify from KYB data.
            //
            // Two separate conditions are evaluated:
            // (A) PREFILL: director email matches founder email AND BVN or NIN was verified.
            //     AML outcome is irrelevant — we always pre-fill when we have verified ID data,
            //     even when the company ends up Under Review due to AML issues.
            // (B) AUTO-VERIFY: director from (A) AND AML explicitly returned clean
            //     (amlChecked=true AND amlIsHit=false). Only then do we mark
            //     isIdentityVerified=true and upsert identity_verifications as 'verified'.
            //     If (A) matches but (B) does not, we record status='in_progress' and leave
            //     isIdentityVerified untouched — admin review will decide.
            try {
              const [founderUser] = await db.select({ email: users.email })
                .from(users).where(eq(users.id, order.founderId));
              const founderEmail = founderUser?.email?.toLowerCase();
              {
                // (A) Pre-fill condition: email match — BVN or NIN verified, AML not required
                let prefillDir = founderEmail
                  ? updatedDirectors.find(d =>
                      d.email?.toLowerCase() === founderEmail &&
                      (d.bvnVerified === true || d.ninVerified === true)
                    )
                  : undefined;

                // (B) Fallback: exactly one verified director with no AML hit
                // Excludes AML-hit directors; allows clean (amlIsHit=false) or not-yet-run (amlIsHit=null/undefined)
                if (!prefillDir) {
                  const verifiedDirs = updatedDirectors.filter(d =>
                    (d.bvnVerified === true || d.ninVerified === true) && d.amlIsHit !== true
                  );
                  if (verifiedDirs.length === 1) prefillDir = verifiedDirs[0];
                }

                if (prefillDir) {
                  const lockedFields: string[] = [];
                  const profilePatch: Partial<InsertFounderProfile> = {
                    kybPrefilled: true,
                    kybSourceCompanyProfileId: profile.id,
                  };
                  if (prefillDir.name) {
                    profilePatch.fullName = prefillDir.name;
                    lockedFields.push('fullName');
                  }
                  if (prefillDir.bvn) {
                    // bvn is already encrypted in the directors array; reuse it as-is
                    profilePatch.bvnEncrypted = prefillDir.bvn;
                    lockedFields.push('bvnEncrypted');
                  }
                  if (prefillDir.nin) {
                    profilePatch.ninEncrypted = prefillDir.nin;
                    lockedFields.push('ninEncrypted');
                  }
                  if (prefillDir.phone) {
                    profilePatch.phone = prefillDir.phone;
                    lockedFields.push('phone');
                  }
                  // Use company registered address as proxy for founder address
                  // registeredAddress shape: { line1, line2, city, state, postalCode, country }
                  const addr = profile.registeredAddress as { line1?: string; state?: string } | null;
                  if (addr?.line1) {
                    profilePatch.addressLine1 = addr.line1;
                    lockedFields.push('addressLine1');
                  }
                  if (addr?.state) {
                    profilePatch.state = addr.state;
                    lockedFields.push('state');
                  }
                  profilePatch.lockedFields = lockedFields;

                  // Upsert founder_profiles (always runs when BVN/NIN is verified)
                  const [existingFProfile] = await db.select({ id: founderProfiles.id })
                    .from(founderProfiles).where(eq(founderProfiles.userId, order.founderId));
                  if (existingFProfile) {
                    await db.update(founderProfiles).set(profilePatch).where(eq(founderProfiles.userId, order.founderId));
                  } else {
                    await db.insert(founderProfiles).values({ userId: order.founderId, ...profilePatch });
                  }

                  const now = new Date();

                  // Auto-verify condition: any director with email matching founder email,
                  // BVN/NIN verified AND AML explicitly clean.
                  // Requires email match to safely confirm identity (founderEmail guard prevents false positives).
                  const verifyDir = founderEmail
                    ? updatedDirectors.find(d =>
                        d.email?.toLowerCase() === founderEmail &&
                        (d.bvnVerified === true || d.ninVerified === true) &&
                        d.amlChecked === true && d.amlIsHit === false
                      )
                    : undefined;

                  if (verifyDir) {
                    // Full auto-verify: mark identity as fully verified
                    const idVPatch: Partial<InsertIdentityVerification> = {
                      status: 'verified',
                      method: 'automated',
                      externalProvider: 'smile_id',
                      identitySource: 'kyb_pipeline',
                      bvnNinVerified: true,
                      verifiedAt: now,
                    };
                    const [existingIdV] = await db.select({ id: identityVerifications.id })
                      .from(identityVerifications).where(eq(identityVerifications.founderUserId, order.founderId));
                    if (existingIdV) {
                      await db.update(identityVerifications).set(idVPatch).where(eq(identityVerifications.id, existingIdV.id));
                    } else {
                      await db.insert(identityVerifications).values({ founderUserId: order.founderId, ...idVPatch });
                    }

                    // Mark the founder as identity-verified on the users table
                    await db.update(users)
                      .set({ isIdentityVerified: true, identityVerifiedAt: now, updatedAt: now })
                      .where(eq(users.id, order.founderId));

                    // Mark any director biometric invite for this company profile as completed
                    await db.update(directorBiometricInvites)
                      .set({ status: 'completed', updatedAt: now })
                      .where(and(
                        eq(directorBiometricInvites.companyProfileId, profile.id),
                        eq(directorBiometricInvites.founderUserId, order.founderId),
                      ));

                    // Register in the verified entity store
                    await upsertVerifiedIndividualByUserId(order.founderId).catch((e: Error) =>
                      console.error(`[Webhook] upsertVerifiedIndividual error (non-fatal): ${e.message}`)
                    );

                    console.log(`[Webhook] Founder ${order.founderId} identity auto-verified via KYB pipeline — fields: ${lockedFields.join(', ')}`);
                  } else {
                    // Pre-fill only — AML pending or flagged; record in_progress unless already verified.
                    // Guard: never downgrade a previously-verified identity_verifications record.
                    const [existingIdV] = await db.select({ id: identityVerifications.id, status: identityVerifications.status })
                      .from(identityVerifications).where(eq(identityVerifications.founderUserId, order.founderId));
                    if (existingIdV?.status !== 'verified') {
                      const idVPatch: Partial<InsertIdentityVerification> = {
                        status: 'in_progress',
                        method: 'automated',
                        externalProvider: 'smile_id',
                        identitySource: 'kyb_pipeline',
                        bvnNinVerified: true,
                      };
                      if (existingIdV) {
                        await db.update(identityVerifications).set(idVPatch).where(eq(identityVerifications.id, existingIdV.id));
                      } else {
                        await db.insert(identityVerifications).values({ founderUserId: order.founderId, ...idVPatch });
                      }
                    }

                    console.log(`[Webhook] Founder ${order.founderId} profile pre-filled from KYB — AML pending/flagged, identity not auto-verified — fields: ${lockedFields.join(', ')}`);
                  }
                }
              }
            } catch (prefillErr: unknown) {
              const msg = prefillErr instanceof Error ? prefillErr.message : String(prefillErr);
              console.error(`[Webhook] Founder profile pre-fill error (non-fatal): ${msg}`);
            }

            // Step 4: Build verification report and auto-approve / flag for review
            const directorsReport = updatedDirectors.map(dir => {
              const hasBvn = !!dir.bvn;
              const hasNin = !!dir.nin;
              // amlStatus: 'clear' | 'hit' | 'error' | 'pending'
              const amlStatus = !dir.amlChecked
                ? (dir.amlCheckError ? 'error' : 'pending')
                : (dir.amlIsHit === false ? 'clear' : 'hit');
              return {
                name: dir.name,
                bvnPassed: hasBvn ? dir.bvnVerified === true : undefined,
                ninPassed: hasNin ? dir.ninVerified === true : undefined,
                amlClear: dir.amlChecked ? dir.amlIsHit === false : undefined, // undefined = not completed
                amlStatus,
                amlCheckError: dir.amlCheckError,
                amlHitTypes: dir.amlHitTypes,
              };
            });

            // Directors pass: must have ≥1 director AND each must have ≥1 verified ID (BVN or NIN)
            // AND AML check completed (fail-closed) AND no AML hit.
            // Empty array is an explicit fail — guards against API bypass reaching the webhook.
            const directorsPass = updatedDirectors.length > 0 && updatedDirectors.every(dir => {
              const bvnPassedCheck = !!dir.bvn && dir.bvnVerified === true;
              const ninPassedCheck = !!dir.nin && dir.ninVerified === true;
              // Fail-closed: require explicit amlIsHit === false (completed + clear).
              // undefined means AML did not complete (service error) — routes to under_review.
              const amlOk = dir.amlChecked === true && dir.amlIsHit === false;
              return (bvnPassedCheck || ninPassedCheck) && amlOk;
            });

            const allPass = kybPassed && tinPassed && directorsPass;

            const verificationReport = {
              kybPassed,
              kybResultText,
              kybFailReason,
              kybDirectorMismatches: kybDirectorMismatches.length > 0 ? kybDirectorMismatches : undefined,
              kybSubmitted: { rcNumber: profile.rcNumber ?? undefined, companyName: profile.companyName },
              kybMatched: kybMatchedData,
              tinPassed,
              tinResultText,
              tinFailReason,
              tinSubmitted: tinProvided ? { tinNumber: profile.tinNumber } : undefined,
              tinMatched: tinMatchedData,
              directorsReport,
              autoApproved: allPass,
              completedAt: new Date().toISOString(),
            };

            const newStatus = allPass ? 'verified' : 'under_review';
            await db.update(companyProfiles)
              .set({ existingCompanyStatus: newStatus, verificationReport: verificationReport as typeof companyProfiles.$inferSelect['verificationReport'], updatedAt: new Date() })
              .where(eq(companyProfiles.id, profile.id));

            await storage.createAuditLog({
              actorUserId: order.founderId,
              action: allPass ? 'existing_company_auto_approved' : 'existing_company_flagged_for_review',
              entityType: 'company_profile',
              entityId: String(profile.id),
              details: { kybPassed, tinPassed, directorsPass, autoApproved: allPass },
            });

            if (allPass) {
              await storage.createNotification({
                userId: order.founderId,
                title: 'Company Verified',
                message: `${profile.companyName} has passed all automated checks and is now verified on Cellion One.`,
                type: 'success',
                linkUrl: '/founder/existing-company',
              });
            } else {
              const failReasons: string[] = [];
              if (!kybPassed) failReasons.push('CAC registry check');
              if (!tinPassed) failReasons.push('TIN verification');
              if (!directorsPass) failReasons.push('director identity/AML check');

              await storage.createNotification({
                userId: order.founderId,
                title: 'Verification Under Review',
                message: `${profile.companyName} requires manual review: ${failReasons.join(', ')}. Our compliance team will contact you shortly.`,
                type: 'warning',
                linkUrl: '/founder/existing-company',
              });

              // Notify admin by email so the compliance team can act promptly
              sendNewOrderNotificationEmail(ADMIN_NOTIFICATION_EMAIL, {
                orderId: order.id,
                founderName: profile.companyName,
                founderEmail: founderEmail,
                totalAmount: order.totalAmount,
                items: [{ sku: 'EXISTING_CO_VERIFY', name: `Manual review required — ${failReasons.join(', ')}`, unitPrice: 0 }],
              }).catch((e: Error) => console.error(`[Webhook] Admin pipeline-fail email error: ${e.message}`));
            }

            console.log(`[Paystack Webhook] Existing company profile ${profile.id} pipeline complete — status: ${newStatus}`);
          } catch (pipelineErr: unknown) {
            const msg = pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
            console.error('[Webhook] Verification pipeline error:', msg);
            // On unhandled pipeline exception, route to under_review (consistent with status semantics)
            // so admin can see the case in the review queue rather than a separate pending_review bucket.
            const errorReport = { kybPassed: false, tinPassed: false, directorsPass: false, pipelineError: msg, autoApproved: false, completedAt: new Date().toISOString() };
            await db.update(companyProfiles)
              .set({ existingCompanyStatus: 'under_review', verificationReport: errorReport as typeof companyProfiles.$inferSelect['verificationReport'], updatedAt: new Date() })
              .where(eq(companyProfiles.id, profile.id));
          }
        }
      } catch (err) {
        console.error('[Paystack Webhook] Error handling EXISTING_CO_VERIFY:', err);
      }
    }

    if (serviceType === 'VERIFY') {
      // Guard: VERIFY in an EXISTING_CO_VERIFY order represents per-director identity fees,
      // NOT founder/company-people identity activation. Skip standard VERIFY processing for
      // existing-company onboarding orders — director BVN/NIN/AML is handled in EXISTING_CO_VERIFY handler.
      const isExistingCoOrder = items.some(i => i.sku === 'EXISTING_CO_VERIFY');
      if (isExistingCoOrder) {
        console.log(`[Paystack Webhook] Skipping standard VERIFY processing for existing-company order #${order.id} — director verification handled by EXISTING_CO_VERIFY handler`);
      } else {
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
