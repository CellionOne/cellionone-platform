/**
 * CIE Scheduler
 *
 * Runs two nightly jobs:
 *   18:30 WAT (17:30 UTC) — Price reconciliation check (log missing data, send alerts)
 *   19:00 WAT (18:00 UTC) — Full IAS/RS/CS score recomputation via CIE Score Engine
 *
 * Uses setInterval pattern consistent with existing schedulers in this codebase.
 *
 * Alert deduplication: module-level Set<string> keyed on `${alertType}-${YYYY-MM-DD}`
 * prevents the same alert type from being sent more than once per server uptime day.
 */

import { computeAndPersistScores } from "./cieScoreEngine";
import { generateCieMarketCommentary, isOpenAIAvailable } from "./aiService";
import { sendCieDataAlert } from "./emailService";
import { storage } from "../storage";
import { db } from "../db";
import { cieIngestionLogs } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const WAT_OFFSET_HOURS = 1; // WAT = UTC+1
const STALE_THRESHOLD_DAYS = 3;

/** Tracks which alert+date combos have already been sent this server uptime session */
const alertsSent = new Set<string>();

function getWATHours(): { hours: number; minutes: number } {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const watHours = (utcHours + WAT_OFFSET_HOURS) % 24;
  return { hours: watHours, minutes: utcMinutes };
}

function msUntilNextWAT(targetHour: number, targetMin: number): number {
  const now = new Date();
  const utcNow = now.getTime();

  // Next occurrence at targetHour:targetMin WAT = (targetHour - 1):targetMin UTC
  const targetUtcHour = (targetHour - WAT_OFFSET_HOURS + 24) % 24;
  const next = new Date();
  next.setUTCHours(targetUtcHour, targetMin, 0, 0);

  // If that time has already passed today, schedule for tomorrow
  if (next.getTime() <= utcNow) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - utcNow;
}

/** Returns the committedAt date of the most recent committed price ingestion, or null if none. */
async function getLatestPriceIngestionCommittedAt(): Promise<Date | null> {
  const rows = await db
    .select({ committedAt: cieIngestionLogs.committedAt })
    .from(cieIngestionLogs)
    .where(and(eq(cieIngestionLogs.dataType, "prices"), eq(cieIngestionLogs.status, "committed")))
    .orderBy(desc(cieIngestionLogs.committedAt))
    .limit(1);

  return rows[0]?.committedAt ?? null;
}

/**
 * True calendar-day difference between a past date and now, computed in WAT (UTC+1).
 * Avoids the off-by-one that occurs near midnight when using elapsed milliseconds.
 */
function calendarDaysDiffWAT(past: Date): number {
  const WAT_OFFSET_MS = WAT_OFFSET_HOURS * 60 * 60 * 1000;
  // Shift both dates into WAT, then compare their UTC date components
  const nowWAT = new Date(Date.now() + WAT_OFFSET_MS);
  const pastWAT = new Date(past.getTime() + WAT_OFFSET_MS);
  const nowMidnight = Date.UTC(nowWAT.getUTCFullYear(), nowWAT.getUTCMonth(), nowWAT.getUTCDate());
  const pastMidnight = Date.UTC(pastWAT.getUTCFullYear(), pastWAT.getUTCMonth(), pastWAT.getUTCDate());
  return Math.round((nowMidnight - pastMidnight) / (24 * 60 * 60 * 1000));
}

let priceCheckTimer: NodeJS.Timeout | null = null;
let scoreRunTimer: NodeJS.Timeout | null = null;

async function runPriceReconciliation(): Promise<void> {
  try {
    const flag = await storage.getFeatureFlag("enable_cie_service");
    if (!flag?.isEnabled) {
      console.log("[CIEScheduler] CIE service disabled — skipping price reconciliation");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const securities = await storage.listCieSecurities(true);

    let missingCount = 0;
    for (const sec of securities) {
      const latest = await storage.getLatestCiePrice(sec.id);
      if (!latest || latest.tradeDate < today) {
        missingCount++;
      }
    }

    if (missingCount > 0) {
      console.warn(`[CIEScheduler] Price reconciliation: ${missingCount}/${securities.length} securities missing today's price data`);
      await storage.createAuditLog({
        actorUserId: "system",
        action: "cie_price_data_gap",
        entityType: "cie_scheduler",
        entityId: today,
        details: { missingSecurities: missingCount, totalSecurities: securities.length, date: today },
      });

      // Alert 1 — today's data is missing
      const alert1Key = `missing_today-${today}`;
      if (!alertsSent.has(alert1Key)) {
        try {
          const admins = await storage.getUsersByRole("admin");
          await sendCieDataAlert(admins, {
            kind: "missing_today",
            missingCount,
            totalCount: securities.length,
          });
          alertsSent.add(alert1Key);
          console.log(`[CIEScheduler] Missing-data alert sent to ${admins.length} admin(s)`);
        } catch (err: any) {
          console.error("[CIEScheduler] Failed to send missing-data alert:", err.message);
        }
      } else {
        console.log("[CIEScheduler] Missing-data alert already sent today — skipping");
      }
    } else {
      console.log(`[CIEScheduler] Price reconciliation: all ${securities.length} securities have today's data ✓`);
    }

    // Alert 2 — multi-day staleness check (independent of today's gap check)
    const alert2Key = `stale-${today}`;
    if (!alertsSent.has(alert2Key)) {
      const latestCommittedAt = await getLatestPriceIngestionCommittedAt();

      if (latestCommittedAt === null) {
        // No upload ever — covered by Alert 1 above when missingCount > 0.
        // No separate stale email needed; Alert 1 covers the "no data" case.
      } else {
        const daysSince = calendarDaysDiffWAT(latestCommittedAt);

        if (daysSince > STALE_THRESHOLD_DAYS) {
          try {
            const admins = await storage.getUsersByRole("admin");
            await sendCieDataAlert(admins, {
              kind: "stale",
              daysSinceLastUpload: daysSince,
              lastUploadDate: latestCommittedAt,
            });
            alertsSent.add(alert2Key);
            console.log(`[CIEScheduler] Staleness alert sent to ${admins.length} admin(s) — ${daysSince} days since last upload`);
          } catch (err: any) {
            console.error("[CIEScheduler] Failed to send staleness alert:", err.message);
          }
        }
      }
    } else {
      console.log("[CIEScheduler] Staleness alert already sent today — skipping");
    }
  } catch (err: any) {
    console.error("[CIEScheduler] Price reconciliation error:", err.message);
  }
}

async function runScoreComputation(): Promise<void> {
  try {
    const flag = await storage.getFeatureFlag("enable_cie_service");
    if (!flag?.isEnabled) {
      console.log("[CIEScheduler] CIE service disabled — skipping score computation");
      return;
    }

    console.log("[CIEScheduler] Starting nightly score computation...");
    const result = await computeAndPersistScores();
    console.log(`[CIEScheduler] Score computation complete: ${result.scored} scored, ${result.skipped} skipped`);

    await storage.createAuditLog({
      actorUserId: "system",
      action: "cie_scores_computed",
      entityType: "cie_scheduler",
      entityId: new Date().toISOString().slice(0, 10),
      details: { scored: result.scored, skipped: result.skipped },
    });

    // Generate AI market commentary after scoring
    await runMarketCommentary();
  } catch (err: any) {
    console.error("[CIEScheduler] Score computation error:", err.message);
  }
}

async function runMarketCommentary(): Promise<void> {
  if (!isOpenAIAvailable()) {
    console.log("[CIEScheduler] AI commentary skipped — OPENAI_API_KEY not configured");
    return;
  }

  try {
    const pulse = await storage.getLatestCieMarketPulse();
    const scores = await storage.getLatestCieScores();

    const topSecurities = [...scores]
      .filter(s => s.ias != null)
      .sort((a, b) => (b.ias ?? 0) - (a.ias ?? 0))
      .slice(0, 5)
      .map(s => ({
        ticker: s.symbol,
        name: s.name,
        ias: s.ias ?? 0,
        recommendation: s.recommendation ?? "",
        sector: s.sector,
      }));

    const today = new Date().toISOString().slice(0, 10);
    const commentary = await generateCieMarketCommentary({
      asiIndex: pulse?.asiIndex != null ? pulse.asiIndex / 100 : null,
      asiChangePct: pulse?.asiChange != null ? pulse.asiChange / 10000 : null,
      brentCrudeUsd: pulse?.brentCrudeUsdCents != null ? pulse.brentCrudeUsdCents / 100 : null,
      ngnPerUsd: pulse?.ngnPerUsd != null ? pulse.ngnPerUsd / 100 : null,
      topSecurities,
      scoreDate: today,
    });

    if (commentary) {
      const stored = await storage.updateLatestCieMarketPulseCommentary(commentary);
      if (stored) {
        console.log("[CIEScheduler] AI market commentary generated and stored");
      } else {
        console.warn("[CIEScheduler] AI commentary generated but no market pulse row exists to attach it to");
      }
    }
  } catch (err: any) {
    console.error("[CIEScheduler] Market commentary generation error:", err.message);
  }
}

function scheduleJob(name: string, targetHour: number, targetMin: number, job: () => Promise<void>): NodeJS.Timeout {
  const msUntilFirst = msUntilNextWAT(targetHour, targetMin);
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  console.log(`[CIEScheduler] '${name}' scheduled in ${Math.round(msUntilFirst / 60000)}m (${targetHour}:${String(targetMin).padStart(2, "0")} WAT daily)`);

  const timer = setTimeout(async () => {
    await job();
    // Re-schedule every 24 hours after first run
    setInterval(job, TWENTY_FOUR_HOURS);
  }, msUntilFirst);

  return timer;
}

export function startCieScheduler(): void {
  // 18:30 WAT — price reconciliation check
  priceCheckTimer = scheduleJob("price-check", 18, 30, runPriceReconciliation);

  // 19:00 WAT — full score recomputation
  scoreRunTimer = scheduleJob("score-run", 19, 0, runScoreComputation);

  console.log("[CIEScheduler] CIE scheduler initialised");
}

export function stopCieScheduler(): void {
  if (priceCheckTimer) { clearTimeout(priceCheckTimer); priceCheckTimer = null; }
  if (scoreRunTimer) { clearTimeout(scoreRunTimer); scoreRunTimer = null; }
  console.log("[CIEScheduler] CIE scheduler stopped");
}

/** Trigger an immediate score run (used after data ingestion) */
export async function triggerImmediateScoreRun(): Promise<{ scored: number; skipped: number }> {
  const flag = await storage.getFeatureFlag("enable_cie_service");
  if (!flag?.isEnabled) {
    return { scored: 0, skipped: 0 };
  }
  return computeAndPersistScores();
}
