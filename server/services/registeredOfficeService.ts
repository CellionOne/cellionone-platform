import { db } from "../db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { 
  serviceAddresses, 
  registeredOfficeSubscriptions, 
  identityVerifications,
  featureFlags,
  type ServiceAddress,
  type RegisteredOfficeSubscription,
  type InsertRegisteredOfficeSubscription
} from "@shared/schema";

export interface RegisteredOfficeOptions {
  tiers: {
    id: string;
    name: string;
    priceNgn: number;
    description: string;
    features: string[];
  }[];
  location: {
    label: string;
    city: string;
    state: string;
    country: string;
  };
  policyText: string;
  termMonths: number;
}

export interface MaskedAddress {
  label: string;
  city: string;
  state: string;
  country: string;
}

export interface FullAddress extends MaskedAddress {
  line1: string;
  line2: string | null;
  floorDetails: string | null;
}

const PRICING = {
  office_only_ngn: 75000,
  office_plus_mail_ngn: 150000,
  registered_office_term_months: 12,
};

export const registeredOfficeService = {
  async getOptions(): Promise<RegisteredOfficeOptions> {
    const activeAddress = await db.select()
      .from(serviceAddresses)
      .where(eq(serviceAddresses.isActive, true))
      .limit(1);
    
    const address = activeAddress[0];
    
    return {
      tiers: [
        {
          id: "office_only",
          name: "Registered Office Only",
          priceNgn: PRICING.office_only_ngn,
          description: "Use our prestigious Ikoyi address as your company's registered office",
          features: [
            "Official CAC registered office address",
            "Business presence in Ikoyi, Lagos",
            "Annual address renewal",
            "CAC compliance",
          ],
        },
        {
          id: "office_plus_mail",
          name: "Registered Office + Mail Handling",
          priceNgn: PRICING.office_plus_mail_ngn,
          description: "Full virtual office with mail handling services",
          features: [
            "Everything in Registered Office Only",
            "Mail receiving and notification",
            "Mail scanning and forwarding",
            "Secure mail storage",
            "Email delivery of scanned documents",
          ],
        },
      ],
      location: address ? {
        label: address.label,
        city: address.city,
        state: address.state,
        country: address.country || "Nigeria",
      } : {
        label: "Celion One Registered Office (Ikoyi)",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
      },
      policyText: "Full address is provided after payment to prevent misuse. Your registered office subscription is valid for 12 months from activation.",
      termMonths: PRICING.registered_office_term_months,
    };
  },

  async selectForApplication(applicationId: number, founderId: string, tier: "office_only" | "office_plus_mail"): Promise<RegisteredOfficeSubscription> {
    const activeAddress = await db.select()
      .from(serviceAddresses)
      .where(eq(serviceAddresses.isActive, true))
      .limit(1);
    
    if (!activeAddress[0]) {
      throw new Error("No active service address available");
    }

    const existing = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.applicationId, applicationId),
        eq(registeredOfficeSubscriptions.founderId, founderId)
      ))
      .limit(1);

    if (existing[0]) {
      const [updated] = await db.update(registeredOfficeSubscriptions)
        .set({ 
          tier, 
          status: "pending_payment",
          updatedAt: new Date() 
        })
        .where(eq(registeredOfficeSubscriptions.id, existing[0].id))
        .returning();
      return updated;
    }

    const [subscription] = await db.insert(registeredOfficeSubscriptions)
      .values({
        founderId,
        applicationId,
        tier,
        serviceAddressId: activeAddress[0].id,
        status: "pending_payment",
      })
      .returning();

    return subscription;
  },

  async subscribeStandalone(founderId: string, tier: "office_only" | "office_plus_mail"): Promise<RegisteredOfficeSubscription> {
    const verificationFlag = await db.select()
      .from(featureFlags)
      .where(eq(featureFlags.key, "enable_verification_required_for_registered_office"))
      .limit(1);

    const requireVerification = verificationFlag[0]?.isEnabled !== false;

    if (requireVerification) {
      const isVerified = await this.isFounderVerified(founderId);
      if (!isVerified) {
        const error = new Error("Identity verification is required before activating registered office services");
        (error as any).code = "VERIFICATION_REQUIRED";
        throw error;
      }
    }

    const activeAddress = await db.select()
      .from(serviceAddresses)
      .where(eq(serviceAddresses.isActive, true))
      .limit(1);
    
    if (!activeAddress[0]) {
      throw new Error("No active service address available");
    }

    const existing = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(and(
        isNull(registeredOfficeSubscriptions.applicationId),
        eq(registeredOfficeSubscriptions.founderId, founderId),
        eq(registeredOfficeSubscriptions.status, "active")
      ))
      .limit(1);

    if (existing[0]) {
      throw new Error("You already have an active standalone registered office subscription");
    }

    const [subscription] = await db.insert(registeredOfficeSubscriptions)
      .values({
        founderId,
        applicationId: null,
        tier,
        serviceAddressId: activeAddress[0].id,
        status: "pending_payment",
      })
      .returning();

    return subscription;
  },

  async getSubscription(params: { applicationId?: number; founderId: string; standalone?: boolean }): Promise<RegisteredOfficeSubscription | null> {
    if (params.standalone) {
      const [subscription] = await db.select()
        .from(registeredOfficeSubscriptions)
        .where(and(
          isNull(registeredOfficeSubscriptions.applicationId),
          eq(registeredOfficeSubscriptions.founderId, params.founderId)
        ))
        .orderBy(desc(registeredOfficeSubscriptions.createdAt))
        .limit(1);
      return subscription || null;
    }

    if (params.applicationId) {
      const [subscription] = await db.select()
        .from(registeredOfficeSubscriptions)
        .where(and(
          eq(registeredOfficeSubscriptions.applicationId, params.applicationId),
          eq(registeredOfficeSubscriptions.founderId, params.founderId)
        ))
        .limit(1);
      return subscription || null;
    }

    return null;
  },

  async getSubscriptionById(subscriptionId: number): Promise<RegisteredOfficeSubscription | null> {
    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .limit(1);
    return subscription || null;
  },

  async activateFromPayment(paymentId: number): Promise<RegisteredOfficeSubscription | null> {
    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.paymentId, paymentId))
      .limit(1);

    if (!subscription) return null;

    return this.activateSubscription(subscription.id);
  },

  async activateBeta(subscriptionId: number, adminId: string, reason: string): Promise<RegisteredOfficeSubscription> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + PRICING.registered_office_term_months);

    const [updated] = await db.update(registeredOfficeSubscriptions)
      .set({
        status: "active",
        startDate,
        endDate,
        updatedAt: new Date(),
      })
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .returning();

    return updated;
  },

  async activateSubscription(subscriptionId: number): Promise<RegisteredOfficeSubscription> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + PRICING.registered_office_term_months);

    const [updated] = await db.update(registeredOfficeSubscriptions)
      .set({
        status: "active",
        startDate,
        endDate,
        updatedAt: new Date(),
      })
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .returning();

    return updated;
  },

  async getMaskedAddress(): Promise<MaskedAddress | null> {
    const [address] = await db.select()
      .from(serviceAddresses)
      .where(eq(serviceAddresses.isActive, true))
      .limit(1);

    if (!address) return null;

    return {
      label: address.label,
      city: address.city,
      state: address.state,
      country: address.country || "Nigeria",
    };
  },

  async getFullAddress(subscriptionId: number): Promise<FullAddress | null> {
    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription || subscription.status !== "active") {
      return null;
    }

    const [address] = await db.select()
      .from(serviceAddresses)
      .where(eq(serviceAddresses.id, subscription.serviceAddressId))
      .limit(1);

    if (!address) return null;

    return {
      label: address.label,
      city: address.city,
      state: address.state,
      country: address.country || "Nigeria",
      line1: address.line1,
      line2: address.line2,
      floorDetails: address.floorDetails,
    };
  },

  async getAddressForSubscription(subscriptionId: number): Promise<MaskedAddress | FullAddress | null> {
    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) return null;

    if (subscription.status === "active") {
      return this.getFullAddress(subscriptionId);
    }

    return this.getMaskedAddress();
  },

  async isFounderVerified(founderId: string): Promise<boolean> {
    const [verification] = await db.select()
      .from(identityVerifications)
      .where(and(
        eq(identityVerifications.founderUserId, founderId),
        eq(identityVerifications.status, "verified")
      ))
      .limit(1);

    return !!verification;
  },

  async getAllSubscriptionsForFounder(founderId: string): Promise<RegisteredOfficeSubscription[]> {
    return db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.founderId, founderId))
      .orderBy(desc(registeredOfficeSubscriptions.createdAt));
  },

  async cancelSubscription(subscriptionId: number): Promise<RegisteredOfficeSubscription> {
    const [updated] = await db.update(registeredOfficeSubscriptions)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .returning();

    return updated;
  },
};
