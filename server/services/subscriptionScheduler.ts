import { db } from "../db";
import { eq, and, lt, lte, gte } from "drizzle-orm";
import { 
  registeredOfficeSubscriptions,
  notifications,
  auditLogs,
} from "@shared/schema";

// Scheduler for subscription expiry and renewal nudges
// Runs daily checks for expiring/expired subscriptions

export const subscriptionScheduler = {
  // Process expired subscriptions (endDate < today)
  async processExpiredSubscriptions(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.status, "active"),
        lt(registeredOfficeSubscriptions.endDate, today)
      ));

    let expiredCount = 0;

    for (const sub of expiredSubscriptions) {
      // Update status to expired
      await db.update(registeredOfficeSubscriptions)
        .set({ 
          status: "expired",
          updatedAt: new Date()
        })
        .where(eq(registeredOfficeSubscriptions.id, sub.id));

      // Create notification for founder
      await db.insert(notifications).values({
        userId: sub.founderId,
        title: "Registered Office Subscription Expired",
        message: "Your registered office subscription has expired. Your address is no longer active and mail cannot be processed. Renew to reactivate your services.",
        type: "error",
        linkUrl: "/founder/registered-office",
      });

      // Log audit action
      await db.insert(auditLogs).values({
        actorUserId: sub.founderId,
        action: "registered_office_expired",
        entityType: "registered_office_subscription",
        entityId: sub.id.toString(),
        details: { 
          endDate: sub.endDate?.toISOString(),
          tier: sub.tier 
        },
      });

      expiredCount++;
      console.log(`[Scheduler] Expired subscription ${sub.id} for founder ${sub.founderId}`);
    }

    return expiredCount;
  },

  // Send renewal nudge notifications
  async sendRenewalNudges(): Promise<{ sent30d: number; sent7d: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate target dates
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // For simplicity, we'll use a date range approach
    // 30-day notice: endDate is between 29 and 31 days from now
    const thirtyDayStart = new Date(today);
    thirtyDayStart.setDate(thirtyDayStart.getDate() + 29);
    const thirtyDayEnd = new Date(today);
    thirtyDayEnd.setDate(thirtyDayEnd.getDate() + 31);

    // 7-day notice: endDate is between 6 and 8 days from now
    const sevenDayStart = new Date(today);
    sevenDayStart.setDate(sevenDayStart.getDate() + 6);
    const sevenDayEnd = new Date(today);
    sevenDayEnd.setDate(sevenDayEnd.getDate() + 8);

    let sent30d = 0;
    let sent7d = 0;

    // 30-day renewal notices
    const subs30d = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.status, "active"),
        gte(registeredOfficeSubscriptions.endDate, thirtyDayStart),
        lte(registeredOfficeSubscriptions.endDate, thirtyDayEnd)
      ));

    for (const sub of subs30d) {
      await db.insert(notifications).values({
        userId: sub.founderId,
        title: "Registered Office Renewal - 30 Days Notice",
        message: "Your registered office subscription will expire in 30 days. Renew now to ensure uninterrupted service.",
        type: "warning",
        linkUrl: "/founder/registered-office",
      });

      await db.insert(auditLogs).values({
        actorUserId: sub.founderId,
        action: "registered_office_renewal_notice_sent",
        entityType: "registered_office_subscription",
        entityId: sub.id.toString(),
        details: { 
          noticePeriod: "30_days",
          endDate: sub.endDate?.toISOString() 
        },
      });

      sent30d++;
      console.log(`[Scheduler] Sent 30-day renewal notice for subscription ${sub.id}`);
    }

    // 7-day renewal notices
    const subs7d = await db.select()
      .from(registeredOfficeSubscriptions)
      .where(and(
        eq(registeredOfficeSubscriptions.status, "active"),
        gte(registeredOfficeSubscriptions.endDate, sevenDayStart),
        lte(registeredOfficeSubscriptions.endDate, sevenDayEnd)
      ));

    for (const sub of subs7d) {
      await db.insert(notifications).values({
        userId: sub.founderId,
        title: "Registered Office Renewal - 7 Days Notice",
        message: "Your registered office subscription will expire in 7 days. Renew immediately to avoid service interruption.",
        type: "error",
        linkUrl: "/founder/registered-office",
      });

      await db.insert(auditLogs).values({
        actorUserId: sub.founderId,
        action: "registered_office_renewal_notice_sent",
        entityType: "registered_office_subscription",
        entityId: sub.id.toString(),
        details: { 
          noticePeriod: "7_days",
          endDate: sub.endDate?.toISOString() 
        },
      });

      sent7d++;
      console.log(`[Scheduler] Sent 7-day renewal notice for subscription ${sub.id}`);
    }

    return { sent30d, sent7d };
  },

  // Run all scheduled tasks
  async runDailyTasks(): Promise<void> {
    console.log("[Scheduler] Running daily subscription tasks...");
    
    try {
      const expiredCount = await this.processExpiredSubscriptions();
      console.log(`[Scheduler] Processed ${expiredCount} expired subscriptions`);

      const { sent30d, sent7d } = await this.sendRenewalNudges();
      console.log(`[Scheduler] Sent ${sent30d} 30-day notices, ${sent7d} 7-day notices`);

      console.log("[Scheduler] Daily tasks completed successfully");
    } catch (error) {
      console.error("[Scheduler] Error running daily tasks:", error);
    }
  },
};

// Start scheduler (run daily at midnight)
let schedulerInterval: NodeJS.Timeout | null = null;

export function startSubscriptionScheduler() {
  if (schedulerInterval) {
    console.log("[Scheduler] Scheduler already running");
    return;
  }

  // Run immediately on startup (after a short delay to let DB connect)
  setTimeout(() => {
    subscriptionScheduler.runDailyTasks();
  }, 5000);

  // Then run every 24 hours
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  schedulerInterval = setInterval(() => {
    subscriptionScheduler.runDailyTasks();
  }, ONE_DAY_MS);

  console.log("[Scheduler] Subscription scheduler started (runs daily)");
}

export function stopSubscriptionScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Subscription scheduler stopped");
  }
}
