/**
 * PriceBook Module
 * 
 * Maps Cellion One services to Paystack (NGN) pricing.
 * All payments are processed through Paystack in Nigerian Naira.
 * International customers pay in NGN and their bank handles conversion.
 * 
 * Service Types:
 * - verification: Identity & Compliance Verification (one-off)
 * - incorporation: Company Incorporation Service (one-off)
 * - registered_office: Registered Office Address (yearly subscription)
 *   - Tiers: office_only, office_plus_mail
 */

export type ServiceType = 'verification' | 'incorporation' | 'registered_office' | 'kyc_identity_only' | 'kyc_individual' | 'kyc_corporate';
export type RegisteredOfficeTier = 'office_only' | 'office_plus_mail';
export type PaymentProvider = 'paystack';
export type Currency = 'NGN';

export interface PriceEntry {
  serviceType: ServiceType;
  tier?: RegisteredOfficeTier;
  provider: PaymentProvider;
  currency: Currency;
  amount: number;
  amountDisplay: string;
  isRecurring: boolean;
  recurringInterval?: 'year' | 'month';
  description: string;
}

const PRICE_BOOK: PriceEntry[] = [
  {
    serviceType: 'verification',
    provider: 'paystack',
    currency: 'NGN',
    amount: 1000000, // ₦10,000 in kobo
    amountDisplay: '₦10,000',
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
  {
    serviceType: 'kyc_identity_only',
    provider: 'paystack',
    currency: 'NGN',
    amount: 500000,   // ₦5,000 in kobo — AML & sanctions screening only
    amountDisplay: '₦5,000',
    isRecurring: false,
    description: 'KYC Identity Check (AML & Sanctions Screening)',
  },
  {
    serviceType: 'kyc_individual',
    provider: 'paystack',
    currency: 'NGN',
    amount: 1500000,  // ₦15,000 in kobo — Full individual KYC (ID + selfie + AML)
    amountDisplay: '₦15,000',
    isRecurring: false,
    description: 'KYC Full Individual Verification (ID + Biometric + AML)',
  },
  {
    serviceType: 'kyc_corporate',
    provider: 'paystack',
    currency: 'NGN',
    amount: 7500000,  // ₦75,000 in kobo — Supplier/corporate entity verification
    amountDisplay: '₦75,000',
    isRecurring: false,
    description: 'KYC Supplier / Corporate Verification',
  },
];

export function getPrice(
  serviceType: ServiceType,
  provider: PaymentProvider = 'paystack',
  tier?: RegisteredOfficeTier
): PriceEntry | undefined {
  return PRICE_BOOK.find(p => 
    p.serviceType === serviceType && 
    p.provider === provider &&
    (tier ? p.tier === tier : true)
  );
}

export function getPaystackPrice(
  serviceType: ServiceType,
  tier?: RegisteredOfficeTier
): PriceEntry | undefined {
  return getPrice(serviceType, 'paystack', tier);
}

export function getPricesByProvider(provider: PaymentProvider = 'paystack'): PriceEntry[] {
  return PRICE_BOOK.filter(p => p.provider === provider);
}

export function getPricesByServiceType(serviceType: ServiceType): PriceEntry[] {
  return PRICE_BOOK.filter(p => p.serviceType === serviceType);
}

export function calculateTotal(
  items: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[],
  provider: PaymentProvider = 'paystack'
): { total: number; currency: Currency } {
  let total = 0;
  for (const item of items) {
    const price = getPrice(item.serviceType, provider, item.tier);
    if (price) {
      total += price.amount;
    }
  }
  return { total, currency: 'NGN' };
}

export function validateItems(
  items: { serviceType: ServiceType; tier?: RegisteredOfficeTier }[],
  provider: PaymentProvider = 'paystack'
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const item of items) {
    const price = getPrice(item.serviceType, provider, item.tier);
    if (!price) {
      if (item.tier) {
        errors.push(`No price found for ${item.serviceType} (${item.tier})`);
      } else {
        errors.push(`No price found for ${item.serviceType}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export default {
  getPrice,
  getPaystackPrice,
  getPricesByProvider,
  getPricesByServiceType,
  calculateTotal,
  validateItems,
};
