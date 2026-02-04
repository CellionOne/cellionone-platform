/**
 * PriceBook Module
 * 
 * Maps Celion One services to both Stripe (GBP) and Paystack (NGN) pricing.
 * This provides "pricing parity" between international and Nigerian customers
 * using clean, fixed prices (no FX conversion).
 * 
 * Service Types:
 * - verification: Identity & Compliance Verification (one-off)
 * - incorporation: Company Incorporation Service (one-off)
 * - registered_office: Registered Office Address (yearly subscription)
 *   - Tiers: office_only, office_plus_mail
 */

export type ServiceType = 'verification' | 'incorporation' | 'registered_office';
export type RegisteredOfficeTier = 'office_only' | 'office_plus_mail';
export type PaymentProvider = 'stripe' | 'paystack';
export type Currency = 'GBP' | 'NGN';

export interface PriceEntry {
  serviceType: ServiceType;
  tier?: RegisteredOfficeTier;
  provider: PaymentProvider;
  currency: Currency;
  amount: number;
  amountDisplay: string;
  stripePriceId?: string;
  isRecurring: boolean;
  recurringInterval?: 'year' | 'month';
  description: string;
}

// Stripe Price IDs from the Stripe Dashboard (provided by user)
const STRIPE_PRICE_IDS = {
  verification: 'price_1Sx9SmRvA0ZE8wcKrxO7bKVd',
  incorporation: 'price_1Sx9VdRvA0ZE8wcKWriewuV4',
  registered_office_office_only: 'price_1Sx9gERvA0ZE8wcKisFbb9gO',
  registered_office_office_plus_mail: 'price_1Sx9gERvA0ZE8wcKcx5stVmN',
};

// GBP Price Book (for Stripe - international/UK customers)
const GBP_PRICES: PriceEntry[] = [
  {
    serviceType: 'verification',
    provider: 'stripe',
    currency: 'GBP',
    amount: 1200, // £12.00 in pence
    amountDisplay: '£12.00',
    stripePriceId: STRIPE_PRICE_IDS.verification,
    isRecurring: false,
    description: 'Identity & Compliance Verification',
  },
  {
    serviceType: 'incorporation',
    provider: 'stripe',
    currency: 'GBP',
    amount: 5500, // £55.00 in pence (updated from £65.00 to match user input)
    amountDisplay: '£55.00',
    stripePriceId: STRIPE_PRICE_IDS.incorporation,
    isRecurring: false,
    description: 'Company Incorporation Service',
  },
  {
    serviceType: 'registered_office',
    tier: 'office_only',
    provider: 'stripe',
    currency: 'GBP',
    amount: 7500, // £75.00 in pence
    amountDisplay: '£75.00/year',
    stripePriceId: STRIPE_PRICE_IDS.registered_office_office_only,
    isRecurring: true,
    recurringInterval: 'year',
    description: 'Registered Office Address (Office Only)',
  },
  {
    serviceType: 'registered_office',
    tier: 'office_plus_mail',
    provider: 'stripe',
    currency: 'GBP',
    amount: 15000, // £150.00 in pence
    amountDisplay: '£150.00/year',
    stripePriceId: STRIPE_PRICE_IDS.registered_office_office_plus_mail,
    isRecurring: true,
    recurringInterval: 'year',
    description: 'Registered Office Address (Office + Mail Handling)',
  },
];

// NGN Price Book (for Paystack - Nigerian customers)
const NGN_PRICES: PriceEntry[] = [
  {
    serviceType: 'verification',
    provider: 'paystack',
    currency: 'NGN',
    amount: 2500000, // ₦25,000 in kobo
    amountDisplay: '₦25,000',
    isRecurring: false,
    description: 'Identity & Compliance Verification',
  },
  {
    serviceType: 'incorporation',
    provider: 'paystack',
    currency: 'NGN',
    amount: 10000000, // ₦100,000 in kobo
    amountDisplay: '₦100,000',
    isRecurring: false,
    description: 'Company Incorporation Service',
  },
  {
    serviceType: 'registered_office',
    tier: 'office_only',
    provider: 'paystack',
    currency: 'NGN',
    amount: 14000000, // ₦140,000 in kobo
    amountDisplay: '₦140,000/year',
    isRecurring: true,
    recurringInterval: 'year',
    description: 'Registered Office Address (Office Only)',
  },
  {
    serviceType: 'registered_office',
    tier: 'office_plus_mail',
    provider: 'paystack',
    currency: 'NGN',
    amount: 28000000, // ₦280,000 in kobo
    amountDisplay: '₦280,000/year',
    isRecurring: true,
    recurringInterval: 'year',
    description: 'Registered Office Address (Office + Mail Handling)',
  },
];

// Combined price book
const PRICE_BOOK: PriceEntry[] = [...GBP_PRICES, ...NGN_PRICES];

/**
 * Get price entry for a specific service and provider
 */
export function getPrice(
  serviceType: ServiceType,
  provider: PaymentProvider,
  tier?: RegisteredOfficeTier
): PriceEntry | undefined {
  return PRICE_BOOK.find(p => 
    p.serviceType === serviceType && 
    p.provider === provider &&
    (tier ? p.tier === tier : true)
  );
}

/**
 * Get Stripe price entry for a service
 */
export function getStripePrice(
  serviceType: ServiceType,
  tier?: RegisteredOfficeTier
): PriceEntry | undefined {
  return getPrice(serviceType, 'stripe', tier);
}

/**
 * Get Paystack price entry for a service
 */
export function getPaystackPrice(
  serviceType: ServiceType,
  tier?: RegisteredOfficeTier
): PriceEntry | undefined {
  return getPrice(serviceType, 'paystack', tier);
}

/**
 * Get all prices for a specific provider
 */
export function getPricesByProvider(provider: PaymentProvider): PriceEntry[] {
  return PRICE_BOOK.filter(p => p.provider === provider);
}

/**
 * Get all prices for a specific service type
 */
export function getPricesByServiceType(serviceType: ServiceType): PriceEntry[] {
  return PRICE_BOOK.filter(p => p.serviceType === serviceType);
}

/**
 * Check if a cart contains both one-off and recurring items
 * (Stripe requires separate sessions for payment vs subscription modes)
 */
export function hasMixedPaymentModes(items: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[]): boolean {
  const prices = items.map(item => getStripePrice(item.serviceType, item.tier)).filter(Boolean) as PriceEntry[];
  const hasOneOff = prices.some(p => !p.isRecurring);
  const hasRecurring = prices.some(p => p.isRecurring);
  return hasOneOff && hasRecurring;
}

/**
 * Split cart items into one-off and recurring groups
 */
export function splitByPaymentMode(items: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[]): {
  oneOff: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[];
  recurring: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[];
} {
  const oneOff: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[] = [];
  const recurring: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[] = [];
  
  for (const item of items) {
    const price = getStripePrice(item.serviceType, item.tier);
    if (price?.isRecurring) {
      recurring.push(item);
    } else {
      oneOff.push(item);
    }
  }
  
  return { oneOff, recurring };
}

/**
 * Get total amount for a list of items
 */
export function calculateTotal(
  items: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[],
  provider: PaymentProvider
): { total: number; currency: Currency } {
  let total = 0;
  const currency = provider === 'stripe' ? 'GBP' : 'NGN';
  
  for (const item of items) {
    const price = getPrice(item.serviceType, provider, item.tier);
    if (price) {
      total += price.amount;
    }
  }
  
  return { total, currency };
}

/**
 * Validate that all requested items have valid prices
 */
export function validateItems(
  items: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[],
  provider: PaymentProvider
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const item of items) {
    const price = getPrice(item.serviceType, provider, item.tier);
    if (!price) {
      if (item.tier) {
        errors.push(`No price found for ${item.serviceType} (${item.tier}) with ${provider}`);
      } else {
        errors.push(`No price found for ${item.serviceType} with ${provider}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export default {
  getPrice,
  getStripePrice,
  getPaystackPrice,
  getPricesByProvider,
  getPricesByServiceType,
  hasMixedPaymentModes,
  splitByPaymentMode,
  calculateTotal,
  validateItems,
  STRIPE_PRICE_IDS,
};
