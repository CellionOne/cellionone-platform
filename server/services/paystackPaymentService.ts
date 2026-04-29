import crypto from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import { orderPayments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import priceBook, { type ServiceType, type RegisteredOfficeTier } from '../config/priceBook';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface PaystackCheckoutItem {
  serviceType: ServiceType;
  tier?: RegisteredOfficeTier;
  contextId?: number;
}

export interface PaystackCheckoutContext {
  applicationId?: number;
  subscriptionId?: number;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  subtotalKobo?: number;
  adminFeeKobo?: number;
  grandTotalKobo?: number;
}

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }
  return key;
}

function getLawyerSubaccountCode(): string | null {
  return process.env.PAYSTACK_LAWYER_SUBACCOUNT_CODE || null;
}

async function paystackRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const secretKey = getPaystackSecretKey();

  const response = await fetch(`${PAYSTACK_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || `Paystack API error: ${response.status}`);
  }

  return data.data;
}

export async function initializeTransaction(
  userId: string,
  items: PaystackCheckoutItem[],
  context: PaystackCheckoutContext,
  baseUrl: string
): Promise<InitializeTransactionResult> {
  const validation = priceBook.validateItems(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    'paystack'
  );

  if (!validation.valid) {
    throw new Error(`Invalid items: ${validation.errors.join(', ')}`);
  }

  const { total } = priceBook.calculateTotal(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    'paystack'
  );

  // Apply 10% administration fee on top of subtotal
  const adminFeeKobo = Math.round(total * 0.10);
  const grandTotal = total + adminFeeKobo;

  const user = await storage.getUser(userId);
  if (!user?.email) {
    throw new Error('User email is required for Paystack payments');
  }

  const reference = `celion_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  const lineItems = items.map(item => {
    const price = priceBook.getPaystackPrice(item.serviceType, item.tier);
    return {
      serviceType: item.serviceType,
      tier: item.tier,
      amount: price?.amount || 0,
      description: price?.description || item.serviceType,
    };
  });

  const result = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', 'POST', {
    email: user.email,
    amount: grandTotal,
    reference,
    callback_url: `${baseUrl}/payment/success?provider=paystack&reference=${reference}`,
    metadata: {
      userId,
      applicationId: context.applicationId,
      subscriptionId: context.subscriptionId,
      subtotalKobo: total,
      adminFeeKobo,
      lineItems,
      custom_fields: [
        { display_name: 'User ID', variable_name: 'user_id', value: userId },
        { display_name: 'Application ID', variable_name: 'application_id', value: context.applicationId?.toString() || 'N/A' },
      ],
    },
  });

  await storage.createPaystackTransaction({
    userId,
    reference,
    accessCode: result.access_code,
    status: 'pending',
    currency: 'NGN',
    amountTotal: grandTotal,
    lineItems,
    contextJson: {
      applicationId: context.applicationId,
      subscriptionId: context.subscriptionId,
    },
  });

  return {
    authorizationUrl: result.authorization_url,
    accessCode: result.access_code,
    reference,
    subtotalKobo: total,
    adminFeeKobo,
    grandTotalKobo: grandTotal,
  };
}

export interface SplitCheckoutInput {
  orderId: number;
  email: string;
  totalAmount: number;
  totalCellionCut: number;
  founderId: string;
  applicationId?: number | null;
  itemSkus: string[];
  baseUrl: string;
}

export async function initializeSplitTransaction(input: SplitCheckoutInput): Promise<InitializeTransactionResult> {
  // Use celion_order_ prefix for new non-split payments.
  // Legacy split payments used celion_split_ prefix (retained for backfill/webhook routing).
  const reference = `celion_order_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  // Full amount always collected by Cellion — no checkout-time split.
  // Lawyer payout is handled separately by admin via the "Release to Lawyer" transfer action.
  const body: Record<string, unknown> = {
    email: input.email,
    amount: input.totalAmount,
    reference,
    currency: 'NGN',
    callback_url: `${input.baseUrl}/payment/success?provider=paystack&reference=${reference}&orderId=${input.orderId}`,
    metadata: {
      orderId: input.orderId,
      founderId: input.founderId,
      applicationId: input.applicationId,
      items: input.itemSkus,
      custom_fields: [
        { display_name: 'Order ID', variable_name: 'order_id', value: String(input.orderId) },
        { display_name: 'Founder ID', variable_name: 'founder_id', value: input.founderId },
      ],
    },
  };

  const result = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', 'POST', body);

  const [payment] = await db.insert(orderPayments).values({
    orderId: input.orderId,
    provider: 'paystack',
    status: 'pending',
    amount: input.totalAmount,
    currency: 'NGN',
    paystackReference: reference,
    authorizationUrl: result.authorization_url,
  }).returning();

  return {
    authorizationUrl: result.authorization_url,
    accessCode: result.access_code,
    reference,
  };
}

export async function verifyTransaction(reference: string): Promise<{
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  paidAt?: Date;
}> {
  const result = await paystackRequest<{
    status: string;
    amount: number;
    currency: string;
    paid_at?: string;
    metadata?: Record<string, unknown>;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);

  return {
    status: result.status === 'success' ? 'success' :
            result.status === 'failed' ? 'failed' : 'pending',
    amount: result.amount,
    currency: result.currency,
    paidAt: result.paid_at ? new Date(result.paid_at) : undefined,
  };
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secretKey = getPaystackSecretKey();
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

export function isPaystackConfigured(): boolean {
  try {
    getPaystackSecretKey();
    return true;
  } catch {
    return false;
  }
}

export interface PaystackBank {
  id: number;
  name: string;
  code: string;
  type: string;
}

export async function getAvailableBanks(): Promise<PaystackBank[]> {
  return paystackRequest<PaystackBank[]>('/bank?currency=NGN&perPage=200');
}

export async function createTransferRecipient(name: string, accountNumber: string, bankCode: string): Promise<string> {
  const result = await paystackRequest<{ recipient_code: string }>('/transferrecipient', 'POST', {
    type: 'nuban',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  });
  return result.recipient_code;
}

export async function initiateTransfer(
  recipientCode: string,
  amountKobo: number,
  reason: string,
  reference: string
): Promise<{ transferCode: string; status: string }> {
  const result = await paystackRequest<{ transfer_code: string; status: string }>('/transfer', 'POST', {
    source: 'balance',
    amount: amountKobo,
    recipient: recipientCode,
    reason,
    reference,
  });
  return { transferCode: result.transfer_code, status: result.status };
}

export default {
  initializeTransaction,
  initializeSplitTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  isPaystackConfigured,
  getAvailableBanks,
  createTransferRecipient,
  initiateTransfer,
};
