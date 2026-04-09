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

    const body = await resp.json() as any;

    if (!resp.ok || !body.data?.id) {
      console.error("[Youverify] createCandidate failed:", resp.status, body);
      return null;
    }

    return body.data.id as string;
  } catch (err: any) {
    console.error("[Youverify] createCandidate error:", err.message);
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

    const body = await resp.json() as any;

    if (!resp.ok || !body.data?.id) {
      console.error("[Youverify] submitBusinessAddressVerification failed:", resp.status, body);
      return null;
    }

    return body.data.id as string;
  } catch (err: any) {
    console.error("[Youverify] submitBusinessAddressVerification error:", err.message);
    return null;
  }
}

/**
 * Fetch current job result from Youverify.
 * Returns raw result object, or null on error.
 */
export async function getJobResult(referenceId: string): Promise<any | null> {
  if (!isConfigured()) {
    console.warn("[Youverify] YOUVERIFY_API_TOKEN not set — skipping getJobResult");
    return null;
  }

  try {
    const resp = await fetch(`${YOUVERIFY_BASE}/v2/api/addresses/business/${referenceId}`, {
      method: "GET",
      headers: headers(),
    });

    const body = await resp.json() as any;

    if (!resp.ok) {
      console.error("[Youverify] getJobResult failed:", resp.status, body);
      return null;
    }

    return body.data || null;
  } catch (err: any) {
    console.error("[Youverify] getJobResult error:", err.message);
    return null;
  }
}

export { isConfigured as isYouverifyConfigured };
