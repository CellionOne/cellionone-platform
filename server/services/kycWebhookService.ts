import crypto from "crypto";
import { db } from "../db";
import { eq, and, desc, lt, lte, isNull, or, sql } from "drizzle-orm";
import {
  kycWebhookConfigs, kycWebhookDeliveryLogs,
  type KycWebhookConfig, type KycWebhookDeliveryLog,
} from "@shared/schema";

const MAX_RETRY_ATTEMPTS = 3;
const WEBHOOK_TIMEOUT_MS = 10000;

function generateSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function registerWebhook(
  orgId: number,
  url: string,
  secret: string | undefined,
  events: string[]
): Promise<KycWebhookConfig> {
  const webhookSecret = secret || generateSecret();
  const [webhook] = await db.insert(kycWebhookConfigs).values({
    organisationId: orgId,
    url,
    secret: webhookSecret,
    events,
    isActive: true,
  }).returning();
  return webhook;
}

export async function updateWebhook(
  id: number,
  updates: { url?: string; events?: string[]; isActive?: boolean }
): Promise<KycWebhookConfig | null> {
  const [updated] = await db.update(kycWebhookConfigs)
    .set(updates)
    .where(eq(kycWebhookConfigs.id, id))
    .returning();
  return updated || null;
}

export async function deleteWebhook(id: number): Promise<void> {
  await db.delete(kycWebhookConfigs).where(eq(kycWebhookConfigs.id, id));
}

export async function listWebhooks(orgId: number): Promise<KycWebhookConfig[]> {
  return db.select().from(kycWebhookConfigs)
    .where(eq(kycWebhookConfigs.organisationId, orgId))
    .orderBy(desc(kycWebhookConfigs.createdAt));
}

export async function getWebhook(id: number): Promise<KycWebhookConfig | null> {
  const [webhook] = await db.select().from(kycWebhookConfigs)
    .where(eq(kycWebhookConfigs.id, id));
  return webhook || null;
}

export async function getDeliveryLogs(
  webhookConfigId: number,
  limit = 50
): Promise<KycWebhookDeliveryLog[]> {
  return db.select().from(kycWebhookDeliveryLogs)
    .where(eq(kycWebhookDeliveryLogs.webhookConfigId, webhookConfigId))
    .orderBy(desc(kycWebhookDeliveryLogs.createdAt))
    .limit(limit);
}

export async function deliverWebhook(
  orgId: number,
  event: string,
  payload: Record<string, any>,
  verificationRequestId?: number
): Promise<void> {
  const webhooks = await db.select().from(kycWebhookConfigs)
    .where(
      and(
        eq(kycWebhookConfigs.organisationId, orgId),
        eq(kycWebhookConfigs.isActive, true)
      )
    );

  const matchingWebhooks = webhooks.filter(wh =>
    (wh.events as string[]).includes(event)
  );

  for (const webhook of matchingWebhooks) {
    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    await attemptDelivery(webhook, event, webhookPayload, verificationRequestId);
  }
}

async function attemptDelivery(
  webhook: KycWebhookConfig,
  event: string,
  payload: Record<string, any>,
  verificationRequestId?: number
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, webhook.secret);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let deliveredAt: Date | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cellion-Signature": signature,
        "X-Cellion-Event": event,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;
    responseBody = await response.text().catch(() => "");

    if (response.ok) {
      deliveredAt = new Date();
    }
  } catch (error: any) {
    responseBody = error.message || "Connection failed";
  }

  const nextRetryAt = !deliveredAt
    ? new Date(Date.now() + getRetryDelay(1))
    : null;

  await db.insert(kycWebhookDeliveryLogs).values({
    webhookConfigId: webhook.id,
    event,
    verificationRequestId: verificationRequestId || null,
    payload,
    responseStatus,
    responseBody,
    attempts: 1,
    nextRetryAt,
    deliveredAt,
  });
}

function getRetryDelay(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 60 * 1000, 30 * 60 * 1000);
}

export async function retryFailedWebhooks(): Promise<number> {
  const now = new Date();
  const failedDeliveries = await db.select().from(kycWebhookDeliveryLogs)
    .where(
      and(
        isNull(kycWebhookDeliveryLogs.deliveredAt),
        lt(kycWebhookDeliveryLogs.attempts, MAX_RETRY_ATTEMPTS),
        lte(kycWebhookDeliveryLogs.nextRetryAt, now)
      )
    )
    .limit(100);

  let retried = 0;

  for (const delivery of failedDeliveries) {
    const [webhook] = await db.select().from(kycWebhookConfigs)
      .where(eq(kycWebhookConfigs.id, delivery.webhookConfigId));

    if (!webhook || !webhook.isActive) {
      await db.update(kycWebhookDeliveryLogs)
        .set({ nextRetryAt: null, responseBody: "Webhook config inactive or deleted" })
        .where(eq(kycWebhookDeliveryLogs.id, delivery.id));
      continue;
    }

    const payloadString = JSON.stringify(delivery.payload);
    const signature = signPayload(payloadString, webhook.secret);

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let deliveredAt: Date | null = null;
    const newAttempts = delivery.attempts + 1;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cellion-Signature": signature,
          "X-Cellion-Event": delivery.event,
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      responseStatus = response.status;
      responseBody = await response.text().catch(() => "");

      if (response.ok) {
        deliveredAt = new Date();
      }
    } catch (error: any) {
      responseBody = error.message || "Connection failed";
    }

    const nextRetryAt = !deliveredAt && newAttempts < MAX_RETRY_ATTEMPTS
      ? new Date(Date.now() + getRetryDelay(newAttempts))
      : null;

    await db.update(kycWebhookDeliveryLogs)
      .set({
        responseStatus,
        responseBody,
        attempts: newAttempts,
        nextRetryAt,
        deliveredAt,
      })
      .where(eq(kycWebhookDeliveryLogs.id, delivery.id));

    retried++;
  }

  return retried;
}

export async function sendTestEvent(webhookId: number): Promise<KycWebhookDeliveryLog> {
  const [webhook] = await db.select().from(kycWebhookConfigs)
    .where(eq(kycWebhookConfigs.id, webhookId));

  if (!webhook) throw new Error("Webhook not found");

  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      requestId: "test_" + crypto.randomBytes(8).toString("hex"),
      status: "verified",
      riskScore: "green",
      message: "This is a test webhook delivery from Cellion One",
    },
  };

  const payloadString = JSON.stringify(testPayload);
  const signature = signPayload(payloadString, webhook.secret);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let deliveredAt: Date | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cellion-Signature": signature,
        "X-Cellion-Event": "test",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;
    responseBody = await response.text().catch(() => "");

    if (response.ok) {
      deliveredAt = new Date();
    }
  } catch (error: any) {
    responseBody = error.message || "Connection failed";
  }

  const [log] = await db.insert(kycWebhookDeliveryLogs).values({
    webhookConfigId: webhook.id,
    event: "test",
    payload: testPayload,
    responseStatus,
    responseBody,
    attempts: 1,
    nextRetryAt: null,
    deliveredAt,
  }).returning();

  return log;
}
