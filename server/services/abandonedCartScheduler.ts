import { db } from "../db";
import { companyApplications, users } from "@shared/schema";
import { eq, and, lt, isNull, or, sql } from "drizzle-orm";
import { sendAbandonedCartReminderEmail } from "./emailService";

const SITE_URL = process.env.SITE_URL || "https://cellionone.com";

const ONE_DAY_MS   = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * ONE_DAY_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// Minimum fields that must be present for a draft to be resumable with the
// current wizard. Any draft missing these is flagged as a legacy draft.
const REQUIRED_WIZARD_FIELDS: Array<keyof typeof companyApplications.$inferSelect> = [
  "companyType",
  "companyName1",
  "registeredAddress",
  "operatingAddress",
];

function isDraftResumable(app: typeof companyApplications.$inferSelect): boolean {
  return REQUIRED_WIZARD_FIELDS.every((field) => {
    const val = app[field as keyof typeof app];
    if (val === null || val === undefined) return false;
    if (typeof val === "object" && !Array.isArray(val)) {
      // For address JSON objects, require at least line1 and city
      const addr = val as Record<string, unknown>;
      return !!(addr.line1 && addr.city);
    }
    if (typeof val === "string") return val.trim().length > 0;
    return true;
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// One-time legacy draft cleanup
// Run at startup, guarded by a flag stored on the process object so it only
// executes once even if the scheduler is invoked multiple times.
// ──────────────────────────────────────────────────────────────────────────────
let legacyCleanupDone = false;

export async function runLegacyDraftCleanup(): Promise<void> {
  if (legacyCleanupDone) return;
  legacyCleanupDone = true;

  console.log("[AbandonedCart] Running one-time legacy draft cleanup...");

  try {
    const drafts = await db
      .select()
      .from(companyApplications)
      .where(
        and(
          eq(companyApplications.status, "draft"),
          eq(companyApplications.isLegacyDraft, false),
        ),
      );

    let flagged = 0;
    const now = new Date();

    for (const app of drafts) {
      if (!isDraftResumable(app)) {
        await db
          .update(companyApplications)
          .set({ isLegacyDraft: true, updatedAt: now })
          .where(eq(companyApplications.id, app.id));
        flagged++;
      }
    }

    console.log(
      `[AbandonedCart] Legacy cleanup complete — inspected ${drafts.length}, flagged ${flagged} as legacy drafts`,
    );
  } catch (err) {
    console.error("[AbandonedCart] Legacy draft cleanup failed:", err);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Daily abandoned cart scheduler
// ──────────────────────────────────────────────────────────────────────────────
export async function runAbandonedCartCheck(): Promise<void> {
  console.log("[AbandonedCart] Running abandoned cart reminder check...");

  const now = new Date();
  let sent = 0;
  let skipped = 0;

  try {
    // Fetch all draft, unpaid, non-legacy applications that haven't maxed out reminders
    const candidates = await db
      .select({
        app: companyApplications,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        },
      })
      .from(companyApplications)
      .innerJoin(users, eq(companyApplications.founderUserId, users.id))
      .where(
        and(
          eq(companyApplications.status, "draft"),
          eq(companyApplications.paymentState, "unpaid"),
          eq(companyApplications.isLegacyDraft, false),
          sql`${companyApplications.abandonedCartReminderCount} < 3`,
        ),
      );

    for (const { app, user } of candidates) {
      if (!user.email) {
        skipped++;
        continue;
      }

      const ageMs = now.getTime() - new Date(app.createdAt!).getTime();
      const reminderCount = app.abandonedCartReminderCount ?? 0;
      const lastSentMs = app.abandonedCartLastReminderAt
        ? now.getTime() - new Date(app.abandonedCartLastReminderAt).getTime()
        : null;

      // Determine which reminder to send, if any
      let reminderNumber: 1 | 2 | 3 | null = null;

      if (reminderCount === 0 && ageMs >= ONE_DAY_MS) {
        reminderNumber = 1;
      } else if (
        reminderCount === 1 &&
        lastSentMs !== null &&
        lastSentMs >= TWO_DAYS_MS &&
        ageMs >= THREE_DAYS_MS
      ) {
        reminderNumber = 2;
      } else if (
        reminderCount === 2 &&
        lastSentMs !== null &&
        lastSentMs >= FOUR_DAYS_MS &&
        ageMs >= SEVEN_DAYS_MS
      ) {
        reminderNumber = 3;
      }

      if (reminderNumber === null) {
        skipped++;
        continue;
      }

      const resumeUrl = `${SITE_URL}/applications/${app.id}`;

      try {
        await sendAbandonedCartReminderEmail({
          to: user.email,
          firstName: user.firstName || "",
          companyName: app.companyName1 || "",
          companyType: app.companyType || "LTD",
          resumeUrl,
          reminderNumber,
        });

        await db
          .update(companyApplications)
          .set({
            abandonedCartReminderCount: reminderCount + 1,
            abandonedCartLastReminderAt: now,
            updatedAt: now,
          })
          .where(eq(companyApplications.id, app.id));

        sent++;
      } catch (emailErr) {
        console.error(
          `[AbandonedCart] Failed to send reminder for application ${app.id}:`,
          emailErr,
        );
        skipped++;
      }
    }

    console.log(
      `[AbandonedCart] Reminder check complete — sent ${sent}, skipped ${skipped}`,
    );
  } catch (err) {
    console.error("[AbandonedCart] Scheduler error:", err);
  }
}

// Gap constants — how long to wait between consecutive reminders
const TWO_DAYS_MS  = 2 * ONE_DAY_MS;
const FOUR_DAYS_MS = 4 * ONE_DAY_MS;
