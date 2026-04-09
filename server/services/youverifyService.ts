/**
 * Youverify Field Agent Address Verification Service
 * API base: https://api.youverify.co
 *
 * Used ONLY for physical address verification via field agents — not identity.
 * Gracefully skips all calls when YOUVERIFY_API_TOKEN is not configured.
 */

const YOUVERIFY_BASE = "https://api.youverify.co";

function getToken(): string | null {
  return process.env.YOUVERIFY_API_TOKEN || null;
}

function isConfigured(): boolean {
  return !!getToken();
}

function headers() {
  return {
    "Content-Type": "application/json",
    token: getToken()!,
  };
}

// ---- Typed API response interfaces ----

interface YouverifyCandidateResponse {
  data?: { id?: string };
  error?: string;
  message?: string;
}

interface YouverifyAddressRequestResponse {
  data?: { id?: string };
  error?: string;
  message?: string;
}

export interface YouverifyJobResult {
  id?: string;
  taskStatus?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
  buildingType?: string;
  buildingColor?: string;
  submissionDistanceInMeters?: number;
  agentPhoto?: string;
  agentSignature?: string;
  summary?: string;
}

interface YouverifyJobResultResponse {
  data?: YouverifyJobResult;
  error?: string;
  message?: string;
}

// ---- API Calls ----

/**
 * Create a Youverify candidate (person to verify on behalf of).
 * Returns the candidateId string, or null on error.
 */
export async function createCandidate(params: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<string | null> {
  if (!isConfigured()) {
    console.warn("[Youverify] YOUVERIFY_API_TOKEN not set — skipping createCandidate");
    return null;
  }

  try {
    const resp = await fetch(`${YOUVERIFY_BASE}/v2/api/candidates`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
      }),
    });

    const body = await resp.json() as YouverifyCandidateResponse;

    if (!resp.ok || !body.data?.id) {
      console.error("[Youverify] createCandidate failed:", resp.status, body);
      return null;
    }

    return body.data.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Youverify] createCandidate error:", msg);
    return null;
  }
}

/**
 * Submit a business address verification job.
 * Returns the referenceId string, or null on error.
 */
export async function submitBusinessAddressVerification(params: {
  candidateId: string;
  companyName: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode?: string;
    country?: string;
  };
  callbackUrl?: string;
}): Promise<string | null> {
  if (!isConfigured()) {
    console.warn("[Youverify] YOUVERIFY_API_TOKEN not set — skipping submitBusinessAddressVerification");
    return null;
  }

  try {
    const payload = {
      candidateId: params.candidateId,
      subject: {
        name: params.companyName,
      },
      address: {
        propertyLine1: params.address.line1,
        propertyLine2: params.address.line2 || "",
        city: params.address.city,
        state: params.address.state,
        postCode: params.address.postalCode || "",
        country: params.address.country || "NG",
      },
      callbackUrl: params.callbackUrl || "",
    };

    const resp = await fetch(`${YOUVERIFY_BASE}/v2/api/addresses/business/request`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });

    const body = await resp.json() as YouverifyAddressRequestResponse;

    if (!resp.ok || !body.data?.id) {
      console.error("[Youverify] submitBusinessAddressVerification failed:", resp.status, body);
      return null;
    }

    return body.data.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Youverify] submitBusinessAddressVerification error:", msg);
    return null;
  }
}

/**
 * Fetch current job result from Youverify.
 * Returns typed result object, or null on error.
 */
export async function getJobResult(referenceId: string): Promise<YouverifyJobResult | null> {
  if (!isConfigured()) {
    console.warn("[Youverify] YOUVERIFY_API_TOKEN not set — skipping getJobResult");
    return null;
  }

  try {
    const resp = await fetch(`${YOUVERIFY_BASE}/v2/api/addresses/business/${referenceId}`, {
      method: "GET",
      headers: headers(),
    });

    const body = await resp.json() as YouverifyJobResultResponse;

    if (!resp.ok) {
      console.error("[Youverify] getJobResult failed:", resp.status, body);
      return null;
    }

    return body.data ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Youverify] getJobResult error:", msg);
    return null;
  }
}

export { isConfigured as isYouverifyConfigured };

/**
 * Validates a Youverify webhook request token against the configured secret.
 * FAIL-CLOSED: returns { valid: false } when YOUVERIFY_API_TOKEN is not set.
 * Centralised here so token access stays in a single module.
 */
export function validateYouverifyWebhookToken(
  headers: Record<string, string | string[] | undefined>
): { valid: boolean; reason?: string } {
  const apiToken = getToken();

  if (!apiToken) {
    console.error(
      "[Youverify] YOUVERIFY_API_TOKEN is not configured — rejecting all webhook requests (fail-closed)"
    );
    return { valid: false, reason: "Webhook authentication not configured" };
  }

  const rawHeader =
    headers["token"] ??
    headers["x-youverify-token"] ??
    headers["authorization"];

  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (!headerValue) {
    console.error("[Youverify] Missing authentication token header");
    return { valid: false, reason: "Missing authentication header" };
  }

  const providedToken = headerValue.replace(/^Bearer\s+/i, "").trim();

  if (providedToken !== apiToken) {
    console.error("[Youverify] Token mismatch — rejecting webhook request");
    return { valid: false, reason: "Invalid webhook token" };
  }

  return { valid: true };
}
