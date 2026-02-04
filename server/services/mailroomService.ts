import { db } from "../db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { 
  mailHandlingPreferences,
  mailItems,
  mailApprovalRequests,
  registeredOfficeSubscriptions,
  featureFlags,
  notifications,
  type MailHandlingPreference,
  type MailItem,
  type MailApprovalRequest,
  type InsertMailItem,
  type InsertMailHandlingPreference,
  type InsertMailApprovalRequest,
} from "@shared/schema";

export type PreferenceType = "scan_all" | "approve_before_scan" | "forward_only";

export const mailroomService = {
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
    isSensitive: boolean = false
  ): Promise<{ mailItem: MailItem; approvalRequest?: MailApprovalRequest }> {
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

    return { mailItem, approvalRequest };
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
