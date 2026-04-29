import { db } from "../db";
import { companyApplications, users, featureFlags } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendAbandonedCartReminderEmail } from "./emailService";

const SITE_URL = process.env.SITE_URL || "https://cellionone.com";

const ONE_DAY_MS    = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS   = 2  * ONE_DAY_MS;
const THREE_DAYS_MS = 3  * ONE_DAY_MS;
const FOUR_DAYS_MS  = 4  * ONE_DAY_MS;
const SEVEN_DAYS_MS = 7  * ONE_DAY_MS;

// DB flag key used to guard the one-time legacy cleanup so it never re-runs
// after a process restart or re-deployment.
const LEGACY_CLEANUP_FLAG = "abandoned_cart_legacy_cleanup_done";

// Minimum fields that must be present for a draft to be resumable with the
// current wizard. Any draft missing one of these is flagged as a legacy draft.
function isDraftResumable(app: typeof companyApplications.$inferSelect): boolean {
  if (!app.companyType || app.companyType.trim() === "") return false;
  if (!app.companyName1 || app.companyName1.trim() === "") return false;

  const reg = app.registeredAddress as Record<string, unknown> | null | undefined;
  if (!reg || !reg.line1 || !reg.city) return false;

  const ops = app.operatingAddress as Record<string, unknown> | null | undefined;
  if (!ops || !ops.line1 || !ops.city) return false;

  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// One-time legacy draft cleanup
// Guarded by a persistent DB flag so it only runs once across all deployments.
// ──────────────────────────────────────────────────────────────────────────────
export async function runLegacyDraftCleanup(): Promise<void> {
  // Persistent guard: check the DB flag first
  const [existing] = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, LEGACY_CLEANUP_FLAG));

  if (existing?.isEnabled) {
    console.log("[AbandonedCart] Legacy draft cleanup already completed — skipping");
    return;
  }

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

    // Persist the completion flag so the cleanup never reruns after restart/deploy
    await db.insert(featureFlags).values({
      key: LEGACY_CLEANUP_FLAG,
      description: "Guards the one-time legacy draft cleanup — set automatically",
      isEnabled: true,
    }).onConflictDoUpdate({
      target: featureFlags.key,
      set: { isEnabled: true, updatedAt: now },
    });

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
