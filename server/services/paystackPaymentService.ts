/**
 * Paystack Payment Service
 * 
 * Handles Paystack transaction initialization and verification for Nigerian Naira (NGN) payments.
 */

import crypto from 'crypto';
import { storage } from '../storage';
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
}

/**
 * Get Paystack secret key from environment
 */
function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_TEST_SECRET_KEY is not configured');
  }
  return key;
}

/**
 * Make a request to Paystack API
 */
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

/**
 * Initialize a Paystack transaction
 */
export async function initializeTransaction(
  userId: string,
  items: PaystackCheckoutItem[],
  context: PaystackCheckoutContext,
  baseUrl: string
): Promise<InitializeTransactionResult> {
  // Validate items
  const validation = priceBook.validateItems(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    'paystack'
  );
  
  if (!validation.valid) {
    throw new Error(`Invalid items: ${validation.errors.join(', ')}`);
  }
  
  // Calculate total amount
  const { total } = priceBook.calculateTotal(
    items.map(i => ({ serviceType: i.serviceType, tier: i.tier })),
    'paystack'
  );
  
  // Get user email
  const user = await storage.getUser(userId);
  if (!user?.email) {
    throw new Error('User email is required for Paystack payments');
  }
  
  // Generate unique reference
  const reference = `celion_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  
  // Build line items for metadata
  const lineItems = items.map(item => {
    const price = priceBook.getPaystackPrice(item.serviceType, item.tier);
    return {
      serviceType: item.serviceType,
      tier: item.tier,
      amount: price?.amount || 0,
      description: price?.description || item.serviceType,
    };
  });
  
  // Initialize transaction with Paystack
  const result = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', 'POST', {
    email: user.email,
    amount: total, // Amount in kobo
    reference,
    callback_url: `${baseUrl}/payment/success?provider=paystack&reference=${reference}`,
    metadata: {
      userId,
      applicationId: context.applicationId,
      subscriptionId: context.subscriptionId,
      lineItems,
      custom_fields: [
        {
          display_name: 'User ID',
          variable_name: 'user_id',
          value: userId,
        },
        {
          display_name: 'Application ID',
          variable_name: 'application_id',
          value: context.applicationId?.toString() || 'N/A',
        },
      ],
    },
  });
  
  // Store transaction in database
  await storage.createPaystackTransaction({
    userId,
    reference,
    accessCode: result.access_code,
    status: 'pending',
    currency: 'NGN',
    amountTotal: total,
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
  };
}

/**
 * Verify a Paystack transaction
 */
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

/**
 * Verify Paystack webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secretKey = getPaystackSecretKey();
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');
  
  return hash === signature;
}

/**
 * Check if Paystack is properly configured
 */
export function isPaystackConfigured(): boolean {
  try {
    getPaystackSecretKey();
    return true;
  } catch {
    return false;
  }
}

export default {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  isPaystackConfigured,
};
