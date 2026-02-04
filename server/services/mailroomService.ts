import { db } from "../db";
import { eq, and, desc, isNull, gte, sql } from "drizzle-orm";
import { 
  mailHandlingPreferences,
  mailItems,
  mailApprovalRequests,
  registeredOfficeSubscriptions,
  featureFlags,
  notifications,
  auditLogs,
  type MailHandlingPreference,
  type MailItem,
  type MailApprovalRequest,
  type InsertMailItem,
  type InsertMailHandlingPreference,
  type InsertMailApprovalRequest,
} from "@shared/schema";
import { serviceLimits } from "../config/serviceLimits";

export type PreferenceType = "scan_all" | "approve_before_scan" | "forward_only";

// Types for official sender classification
const OFFICIAL_SENDER_TYPES = ["government", "bank", "legal", "commercial"];
const NON_OFFICIAL_SENDER_TYPES = ["personal", "unknown"];

export const mailroomService = {
  // Get current month's mail item count for a subscription
  async getMonthlyMailCount(subscriptionId: number): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(mailItems)
      .where(and(
        eq(mailItems.subscriptionId, subscriptionId),
        gte(mailItems.receivedAt, startOfMonth)
      ));
    
    return Number(result[0]?.count || 0);
  },

  // Check if sender type is official (allowed without confirmation)
  isOfficialMail(senderType: string): boolean {
    return OFFICIAL_SENDER_TYPES.includes(senderType.toLowerCase());
  },

  // Get service limits for API response
  getServiceLimits() {
    return {
      mailItemsIncludedPerMonth: serviceLimits.mailItemsIncludedPerMonth,
      storageDays: serviceLimits.storageDays,
      officialMailOnly: serviceLimits.officialMailOnly,
      policy: serviceLimits.getPolicyText(),
    };
  },

  async getPreference(subscriptionId: number): Promise<MailHandlingPreference | null> {
    const [preference] = await db.select()
      .from(mailHandlingPreferences)
      .where(eq(mailHandlingPreferences.subscriptionId, subscriptionId))
      .limit(1);
    return preference || null;
  },

  async setPreference(
    subscriptionId: number,
    founderId: string,
    preferenceType: PreferenceType,
    isSensitiveAutoEscalationEnabled: boolean = true
  ): Promise<MailHandlingPreference> {
    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.tier !== "office_plus_mail") {
      throw new Error("Mail handling is only available for office_plus_mail tier");
    }

    if (subscription.status !== "active") {
      throw new Error("Subscription must be active to set mail preferences");
    }

    const existing = await this.getPreference(subscriptionId);

    if (existing) {
      const [updated] = await db.update(mailHandlingPreferences)
        .set({
          preferenceType,
          isSensitiveAutoEscalationEnabled,
          updatedAt: new Date(),
        })
        .where(eq(mailHandlingPreferences.id, existing.id))
        .returning();
      return updated;
    }

    const [preference] = await db.insert(mailHandlingPreferences)
      .values({
        subscriptionId,
        founderId,
        preferenceType,
        isSensitiveAutoEscalationEnabled,
      })
      .returning();

    return preference;
  },

  async intakeMail(
    subscriptionId: number,
    senderName: string,
    senderType: string,
    envelopePhotoDocId?: number,
    isSensitive: boolean = false,
    options?: {
      confirmedOfficialMail?: boolean;  // Admin confirmed this is official mail
      overageReason?: string;  // Admin notes if this is an overage item
    }
  ): Promise<{ mailItem: MailItem; approvalRequest?: MailApprovalRequest; isOverage: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Check for expired subscription
    if (subscription.status === "expired") {
      const error = new Error("Subscription is expired. Cannot accept new mail. Use 'Return to Sender' action instead.");
      (error as any).code = "SUBSCRIPTION_EXPIRED";
      throw error;
    }

    if (subscription.tier !== "office_plus_mail") {
      throw new Error("Mail handling is only available for office_plus_mail tier");
    }

    if (subscription.status !== "active") {
      throw new Error("Subscription must be active to receive mail");
    }

    // Check official mail requirement
    const isOfficial = this.isOfficialMail(senderType);
    if (serviceLimits.officialMailOnly && !isOfficial && !options?.confirmedOfficialMail) {
      const error = new Error("Only official business mail is accepted. Admin must confirm this is official mail to proceed.");
      (error as any).code = "OFFICIAL_MAIL_REQUIRED";
      throw error;
    }

    // Check monthly cap and determine overage
    const monthlyCount = await this.getMonthlyMailCount(subscriptionId);
    const isOverage = monthlyCount >= serviceLimits.mailItemsIncludedPerMonth;
    
    if (isOverage && !options?.overageReason) {
      const error = new Error(`Monthly mail limit (${serviceLimits.mailItemsIncludedPerMonth}) reached. Admin must provide overage reason to proceed.`);
      (error as any).code = "OVERAGE_REASON_REQUIRED";
      throw error;
    }

    const preference = await this.getPreference(subscriptionId);
    const needsApproval = this.needsApproval(preference, isSensitive);

    const [mailItem] = await db.insert(mailItems)
      .values({
        subscriptionId,
        founderId: subscription.founderId,
        senderName,
        senderType,
        envelopePhotoDocId,
        isSensitive,
        isOverage,
        overageReason: isOverage ? options?.overageReason : null,
        status: needsApproval ? "pending_approval" : "received",
        receivedAt: new Date(),
      })
      .returning();

    let approvalRequest: MailApprovalRequest | undefined;

    if (needsApproval) {
      const [request] = await db.insert(mailApprovalRequests)
        .values({
          mailItemId: mailItem.id,
          founderId: subscription.founderId,
          requestedAction: "scan",
        })
        .returning();
      approvalRequest = request;

      await db.insert(notifications).values({
        userId: subscription.founderId,
        title: "Mail Approval Required",
        message: `You have new mail from ${senderName} that requires your approval before scanning.`,
        type: "info",
        linkUrl: "/founder/mail",
      });
    } else {
      await db.insert(notifications).values({
        userId: subscription.founderId,
        title: "New Mail Received",
        message: `New mail received from ${senderName}.`,
        type: "info",
        linkUrl: "/founder/mail",
      });
    }

    // If overage, send additional notification to founder
    if (isOverage) {
      await db.insert(notifications).values({
        userId: subscription.founderId,
        title: "Overage Mail Item Received",
        message: `You have exceeded your monthly mail allowance (${serviceLimits.mailItemsIncludedPerMonth} items). Additional charges may apply for this item from ${senderName}.`,
        type: "warning",
        linkUrl: "/founder/mail",
      });

      // Log audit action for overage
      await db.insert(auditLogs).values({
        actorUserId: subscription.founderId,
        action: "mail_item_overage_recorded",
        entityType: "mail_item",
        entityId: mailItem.id.toString(),
        details: { senderName, overageReason: options?.overageReason, monthlyCount: monthlyCount + 1 },
      });

      warnings.push(`This is an overage item (${monthlyCount + 1}/${serviceLimits.mailItemsIncludedPerMonth} monthly limit)`);
    }

    return { mailItem, approvalRequest, isOverage, warnings };
  },

  // Record mail as "returned to sender" for expired subscriptions
  async returnToSender(
    subscriptionId: number,
    senderName: string,
    senderType: string,
    notes?: string
  ): Promise<MailItem> {
    const [subscription] = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(eq(registeredOfficeSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // This action is specifically for expired subscriptions
    if (subscription.status !== "expired") {
      throw new Error("Return to sender is only for expired subscriptions. Use normal intake for active subscriptions.");
    }

    const [mailItem] = await db.insert(mailItems)
      .values({
        subscriptionId,
        founderId: subscription.founderId,
        senderName,
        senderType,
        status: "returned_to_sender",
        notes: notes || "Subscription expired - mail returned to sender without opening",
        receivedAt: new Date(),
      })
      .returning();

    // Log audit action
    await db.insert(auditLogs).values({
      actorUserId: subscription.founderId,
      action: "mail_intake_blocked_subscription_expired",
      entityType: "mail_item",
      entityId: mailItem.id.toString(),
      details: { senderName, reason: "subscription_expired" },
    });

    // Notify founder
    await db.insert(notifications).values({
      userId: subscription.founderId,
      title: "Mail Returned - Subscription Expired",
      message: `Mail from ${senderName} was returned to sender because your registered office subscription has expired. Renew to continue receiving mail.`,
      type: "warning",
      linkUrl: "/founder/registered-office",
    });

    return mailItem;
  },

  needsApproval(preference: MailHandlingPreference | null, isSensitive: boolean): boolean {
    if (!preference) {
      return true;
    }

    if (preference.preferenceType === "approve_before_scan") {
      return true;
    }

    if (preference.preferenceType === "scan_all" && isSensitive && preference.isSensitiveAutoEscalationEnabled) {
      return true;
    }

    if (preference.preferenceType === "forward_only") {
      return false;
    }

    return false;
  },

  async decideApproval(
    mailItemId: number,
    decision: "approved" | "rejected",
    decisionReason?: string
  ): Promise<{ mailItem: MailItem; approvalRequest: MailApprovalRequest }> {
    const [approvalRequest] = await db.select()
      .from(mailApprovalRequests)
      .where(and(
        eq(mailApprovalRequests.mailItemId, mailItemId),
        isNull(mailApprovalRequests.decision)
      ))
      .limit(1);

    if (!approvalRequest) {
      throw new Error("No pending approval request found for this mail item");
    }

    const [updatedRequest] = await db.update(mailApprovalRequests)
      .set({
        decision,
        decisionReason,
        decidedAt: new Date(),
      })
      .where(eq(mailApprovalRequests.id, approvalRequest.id))
      .returning();

    const newStatus = decision === "approved" ? "approved" : "archived";

    const [mailItem] = await db.update(mailItems)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(mailItems.id, mailItemId))
      .returning();

    return { mailItem, approvalRequest: updatedRequest };
  },

  async uploadScan(mailItemId: number, scannedDocId: number): Promise<MailItem> {
    const [mailItem] = await db.select()
      .from(mailItems)
      .where(eq(mailItems.id, mailItemId))
      .limit(1);

    if (!mailItem) {
      throw new Error("Mail item not found");
    }

    const approvalFlowFlag = await db.select()
      .from(featureFlags)
      .where(eq(featureFlags.key, "enable_mail_approval_flow"))
      .limit(1);

    const approvalFlowEnabled = approvalFlowFlag[0]?.isEnabled !== false;

    if (approvalFlowEnabled && mailItem.status === "pending_approval") {
      throw new Error("Cannot upload scan for mail item pending approval");
    }

    const [updated] = await db.update(mailItems)
      .set({
        scannedDocId,
        status: "scanned",
        scannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mailItems.id, mailItemId))
      .returning();

    await db.insert(notifications).values({
      userId: mailItem.founderId,
      title: "Mail Scanned",
      message: `Your mail from ${mailItem.senderName} has been scanned and is available in your inbox.`,
      type: "success",
      linkUrl: "/founder/mail",
    });

    return updated;
  },

  async markForwarded(
    mailItemId: number,
    courierName: string,
    trackingNumber: string
  ): Promise<MailItem> {
    const [mailItem] = await db.select()
      .from(mailItems)
      .where(eq(mailItems.id, mailItemId))
      .limit(1);

    if (!mailItem) {
      throw new Error("Mail item not found");
    }

    const [updated] = await db.update(mailItems)
      .set({
        status: "forwarded",
        courierName,
        trackingNumber,
        forwardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mailItems.id, mailItemId))
      .returning();

    await db.insert(notifications).values({
      userId: mailItem.founderId,
      title: "Mail Forwarded",
      message: `Your mail from ${mailItem.senderName} has been forwarded via ${courierName}. Tracking: ${trackingNumber}`,
      type: "info",
      linkUrl: "/founder/mail",
    });

    return updated;
  },

  async getMailItemsForFounder(founderId: string): Promise<MailItem[]> {
    return db.select()
      .from(mailItems)
      .where(eq(mailItems.founderId, founderId))
      .orderBy(desc(mailItems.receivedAt));
  },

  async getMailItemsForSubscription(subscriptionId: number): Promise<MailItem[]> {
    return db.select()
      .from(mailItems)
      .where(eq(mailItems.subscriptionId, subscriptionId))
      .orderBy(desc(mailItems.receivedAt));
  },

  async getPendingApprovals(founderId: string): Promise<(MailApprovalRequest & { mailItem: MailItem })[]> {
    const approvals = await db.select()
      .from(mailApprovalRequests)
      .where(and(
        eq(mailApprovalRequests.founderId, founderId),
        isNull(mailApprovalRequests.decision)
      ))
      .orderBy(desc(mailApprovalRequests.requestedAt));

    const results: (MailApprovalRequest & { mailItem: MailItem })[] = [];

    for (const approval of approvals) {
      const [mailItem] = await db.select()
        .from(mailItems)
        .where(eq(mailItems.id, approval.mailItemId))
        .limit(1);

      if (mailItem) {
        results.push({ ...approval, mailItem });
      }
    }

    return results;
  },

  async getAllPendingMailItems(): Promise<MailItem[]> {
    return db.select()
      .from(mailItems)
      .where(eq(mailItems.status, "received"))
      .orderBy(desc(mailItems.receivedAt));
  },

  async getMailItemById(mailItemId: number): Promise<MailItem | null> {
    const [mailItem] = await db.select()
      .from(mailItems)
      .where(eq(mailItems.id, mailItemId))
      .limit(1);
    return mailItem || null;
  },
};
