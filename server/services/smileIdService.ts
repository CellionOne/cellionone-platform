import { storage } from '../storage';

const PARTNER_ID = process.env.SMILE_ID_PARTNER_ID || '';
const API_KEY = process.env.SMILE_ID_API_KEY || '';
const SID_SERVER = process.env.SMILE_ID_ENVIRONMENT === 'production' ? '1' : '0';

export function isSmileIdConfigured(): boolean {
  return !!(PARTNER_ID && API_KEY);
}

export interface BvnVerificationResult {
  success: boolean;
  resultCode: string;
  resultText: string;
  fullName?: string;
  dob?: string;
  photo?: string;
  smileJobId?: string;
  error?: string;
}

export interface NinVerificationResult {
  success: boolean;
  resultCode: string;
  resultText: string;
  fullName?: string;
  dob?: string;
  photo?: string;
  smileJobId?: string;
  error?: string;
}

export async function verifyBvn(
  bvn: string,
  userId: string,
  jobId: string
): Promise<BvnVerificationResult> {
  if (!isSmileIdConfigured()) {
    console.log(`[SmileID] Not configured — skipping BVN verification for user ${userId}. BVN: ***${bvn.slice(-4)}`);
    return {
      success: false,
      resultCode: 'NOT_CONFIGURED',
      resultText: 'Smile ID is not configured. Set SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY to enable.',
    };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const IDApi = smileIdentityCore.IDApi;
    const connection = new IDApi(PARTNER_ID, API_KEY, SID_SERVER);

    const partnerParams = {
      job_id: jobId,
      user_id: userId,
      job_type: 5,
    };

    const idInfo = {
      country: 'NG',
      id_type: 'BVN',
      id_number: bvn,
      entered: true,
    };

    const result = await connection.submit_job(partnerParams, idInfo);

    const verified = result?.Actions?.Verify_ID_Number === 'Verified';

    await storage.createAuditLog({
      actorUserId: 'system',
      action: 'smile_id_bvn_verification',
      entityType: 'user',
      entityId: userId,
      details: {
        smileJobId: result?.SmileJobID,
        resultCode: result?.ResultCode,
        resultText: result?.ResultText,
        verified,
        bvnLast4: bvn.slice(-4),
      },
    });

    return {
      success: verified,
      resultCode: result?.ResultCode || 'UNKNOWN',
      resultText: result?.ResultText || 'Unknown result',
      fullName: result?.FullName,
      dob: result?.DOB,
      photo: result?.Photo,
      smileJobId: result?.SmileJobID,
    };
  } catch (error: any) {
    console.error('[SmileID] BVN verification error:', error);

    await storage.createAuditLog({
      actorUserId: 'system',
      action: 'smile_id_bvn_verification_error',
      entityType: 'user',
      entityId: userId,
      details: { error: error.message, bvnLast4: bvn.slice(-4) },
    });

    return {
      success: false,
      resultCode: 'ERROR',
      resultText: error.message || 'BVN verification failed',
      error: error.message,
    };
  }
}

export async function verifyNin(
  nin: string,
  userId: string,
  jobId: string
): Promise<NinVerificationResult> {
  if (!isSmileIdConfigured()) {
    console.log(`[SmileID] Not configured — skipping NIN verification for user ${userId}. NIN: ***${nin.slice(-4)}`);
    return {
      success: false,
      resultCode: 'NOT_CONFIGURED',
      resultText: 'Smile ID is not configured. Set SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY to enable.',
    };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const IDApi = smileIdentityCore.IDApi;
    const connection = new IDApi(PARTNER_ID, API_KEY, SID_SERVER);

    const partnerParams = {
      job_id: jobId,
      user_id: userId,
      job_type: 5,
    };

    const idInfo = {
      country: 'NG',
      id_type: 'NIN_V2',
      id_number: nin,
      entered: true,
    };

    const result = await connection.submit_job(partnerParams, idInfo);

    const verified = result?.Actions?.Verify_ID_Number === 'Verified';

    await storage.createAuditLog({
      actorUserId: 'system',
      action: 'smile_id_nin_verification',
      entityType: 'user',
      entityId: userId,
      details: {
        smileJobId: result?.SmileJobID,
        resultCode: result?.ResultCode,
        resultText: result?.ResultText,
        verified,
        ninLast4: nin.slice(-4),
      },
    });

    return {
      success: verified,
      resultCode: result?.ResultCode || 'UNKNOWN',
      resultText: result?.ResultText || 'Unknown result',
      fullName: result?.FullName,
      dob: result?.DOB,
      photo: result?.Photo,
      smileJobId: result?.SmileJobID,
    };
  } catch (error: any) {
    console.error('[SmileID] NIN verification error:', error);

    await storage.createAuditLog({
      actorUserId: 'system',
      action: 'smile_id_nin_verification_error',
      entityType: 'user',
      entityId: userId,
      details: { error: error.message, ninLast4: nin.slice(-4) },
    });

    return {
      success: false,
      resultCode: 'ERROR',
      resultText: error.message || 'NIN verification failed',
      error: error.message,
    };
  }
}

export interface BiometricResult {
  success: boolean;
  livenessScore?: number;
  biometricMatch?: boolean;
  smileJobId?: string;
  resultCode: string;
  resultText: string;
  error?: string;
}

export async function submitBiometricSelfie(
  selfieBase64: string,
  userId: string,
  jobId: string
): Promise<BiometricResult> {
  if (!isSmileIdConfigured()) {
    console.log(`[SmileID] Not configured — simulating biometric selfie for user ${userId}`);
    await storage.createAuditLog({
      actorUserId: userId,
      action: 'smile_id_biometric_not_configured',
      entityType: 'user',
      entityId: userId,
      details: { jobId, note: 'SmileID not configured; biometric skipped' },
    });
    return {
      success: false,
      resultCode: 'NOT_CONFIGURED',
      resultText: 'Smile ID is not configured. Biometric verification is unavailable.',
    };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const WebApi = smileIdentityCore.WebApi;
    const connection = new WebApi(PARTNER_ID, null, API_KEY, SID_SERVER);

    const partnerParams = {
      job_id: jobId,
      user_id: userId,
      job_type: 4,
    };

    const imageDetails = [
      {
        image_type_id: 0,
        image: selfieBase64,
      },
    ];

    const options = { return_job_status: true };

    const result = await connection.submit_job(partnerParams, imageDetails, {}, options);

    const actions = result?.job_complete_response?.Actions || result?.Actions || {};
    const livenessScore = result?.job_complete_response?.ConfidenceValue || result?.ConfidenceValue;
    const biometricMatch = actions?.Selfie_Provided === 'Passed' || actions?.Human_Face_Detected === 'Passed';

    await storage.createAuditLog({
      actorUserId: userId,
      action: 'smile_id_biometric_verification',
      entityType: 'user',
      entityId: userId,
      details: {
        smileJobId: result?.SmileJobID,
        resultCode: result?.ResultCode,
        livenessScore,
        biometricMatch,
        jobId,
      },
    });

    return {
      success: biometricMatch || false,
      livenessScore: livenessScore ? Math.round(Number(livenessScore)) : undefined,
      biometricMatch: biometricMatch || false,
      smileJobId: result?.SmileJobID,
      resultCode: result?.ResultCode || 'UNKNOWN',
      resultText: result?.ResultText || 'Biometric check processed',
    };
  } catch (error: any) {
    console.error('[SmileID] Biometric selfie submission error:', error);

    await storage.createAuditLog({
      actorUserId: userId,
      action: 'smile_id_biometric_error',
      entityType: 'user',
      entityId: userId,
      details: { error: error.message, jobId },
    });

    return {
      success: false,
      resultCode: 'ERROR',
      resultText: error.message || 'Biometric verification failed',
      error: error.message,
    };
  }
}

export async function getVerificationStatus(): Promise<{
  configured: boolean;
  environment: string;
  partnerId: string;
}> {
  return {
    configured: isSmileIdConfigured(),
    environment: SID_SERVER === '1' ? 'production' : 'sandbox',
    partnerId: PARTNER_ID ? `${PARTNER_ID.substring(0, 4)}...` : 'not set',
  };
}

// ─── Generic ID Lookup (job type 5) ──────────────────────────────────────────

export interface IdLookupResult {
  verified: boolean;
  fullName?: string;
  dob?: string;
  photo?: string;
  gender?: string;
  address?: string;
  phone?: string;
  reason?: string;
  referenceId?: string;
}

async function runIdLookup(
  idType: string,
  idNumber: string,
  lookupRef: string,
  extraFields?: Record<string, string>,
): Promise<IdLookupResult> {
  if (!isSmileIdConfigured()) {
    return {
      verified: false,
      reason: 'Identity verification service not configured. Contact support.',
    };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const IDApi = smileIdentityCore.IDApi;
    const connection = new IDApi(PARTNER_ID, API_KEY, SID_SERVER);

    const partnerParams = {
      job_id: lookupRef,
      user_id: lookupRef,
      job_type: 5,
    };

    const idInfo: Record<string, unknown> = {
      country: 'NG',
      id_type: idType,
      id_number: idNumber,
      entered: true,
      ...extraFields,
    };

    const result = await connection.submit_job(partnerParams, idInfo);
    const verified = result?.Actions?.Verify_ID_Number === 'Verified';

    return {
      verified,
      fullName: result?.FullName ?? undefined,
      dob: result?.DOB ?? undefined,
      photo: result?.Photo ?? undefined,
      gender: result?.Gender ?? undefined,
      address: result?.Address ?? undefined,
      phone: result?.PhoneNumber ?? undefined,
      referenceId: result?.SmileJobID ?? undefined,
      reason: verified ? undefined : (result?.ResultText || 'ID could not be verified'),
    };
  } catch (error: any) {
    console.error(`[SmileID] ${idType} lookup error:`, error.message);
    return {
      verified: false,
      reason: 'Lookup service temporarily unavailable. Please try again.',
    };
  }
}

export async function lookupBvn(bvnNumber: string, ref: string, enrichment?: { firstName?: string; lastName?: string; dob?: string }): Promise<IdLookupResult> {
  const extra: Record<string, string> = {};
  if (enrichment?.firstName) extra.first_name = enrichment.firstName;
  if (enrichment?.lastName) extra.last_name = enrichment.lastName;
  if (enrichment?.dob) extra.dob = enrichment.dob;
  return runIdLookup('BVN', bvnNumber, ref, Object.keys(extra).length ? extra : undefined);
}

export async function lookupNin(ninNumber: string, ref: string, enrichment?: { firstName?: string; lastName?: string; dob?: string }): Promise<IdLookupResult> {
  const extra: Record<string, string> = {};
  if (enrichment?.firstName) extra.first_name = enrichment.firstName;
  if (enrichment?.lastName) extra.last_name = enrichment.lastName;
  if (enrichment?.dob) extra.dob = enrichment.dob;
  return runIdLookup('NIN_V2', ninNumber, ref, Object.keys(extra).length ? extra : undefined);
}

export async function lookupDriversLicence(licenceNumber: string, ref: string, enrichment?: { firstName?: string; lastName?: string; dob?: string }): Promise<IdLookupResult> {
  const extra: Record<string, string> = {};
  if (enrichment?.firstName) extra.first_name = enrichment.firstName;
  if (enrichment?.lastName) extra.last_name = enrichment.lastName;
  if (enrichment?.dob) extra.dob = enrichment.dob;
  return runIdLookup('DRIVERS_LICENSE', licenceNumber, ref, Object.keys(extra).length ? extra : undefined);
}

export async function lookupVoterId(voterIdNumber: string, ref: string, enrichment?: { firstName?: string; lastName?: string; dob?: string }): Promise<IdLookupResult> {
  const extra: Record<string, string> = {};
  if (enrichment?.firstName) extra.first_name = enrichment.firstName;
  if (enrichment?.lastName) extra.last_name = enrichment.lastName;
  if (enrichment?.dob) extra.dob = enrichment.dob;
  return runIdLookup('VOTER_ID', voterIdNumber, ref, Object.keys(extra).length ? extra : undefined);
}

/** expiryDate must be in YYYY-MM-DD format */
export async function lookupPassport(
  passportNumber: string,
  ref: string,
  expiryDate?: string,
  enrichment?: { firstName?: string; lastName?: string; dob?: string },
): Promise<IdLookupResult> {
  const extra: Record<string, string> = {};
  if (expiryDate) extra.expiration_date = expiryDate;
  if (enrichment?.firstName) extra.first_name = enrichment.firstName;
  if (enrichment?.lastName) extra.last_name = enrichment.lastName;
  if (enrichment?.dob) extra.dob = enrichment.dob;
  return runIdLookup('INTERNATIONAL_PASSPORT', passportNumber, ref, Object.keys(extra).length ? extra : undefined);
}

// ─── Photo comparison (job type 6: doc + portrait) ───────────────────────────

export interface PhotoCompareResult {
  matched: boolean;
  confidence?: number;
  reason?: string;
  referenceId?: string;
}

export async function compareDocumentToPortrait(
  documentBase64: string,
  selfieBase64: string,
  ref: string,
): Promise<PhotoCompareResult> {
  if (!isSmileIdConfigured()) {
    return {
      matched: false,
      reason: 'Identity verification service not configured.',
    };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const WebApi = smileIdentityCore.WebApi;
    const connection = new WebApi(PARTNER_ID, null, API_KEY, SID_SERVER);

    const partnerParams = {
      job_id: ref,
      user_id: ref,
      job_type: 6,
    };

    const imageDetails = [
      { image_type_id: 1, image: documentBase64 },
      { image_type_id: 0, image: selfieBase64 },
    ];

    const options = { return_job_status: true };
    const result = await connection.submit_job(partnerParams, imageDetails, {}, options);

    const actions = result?.job_complete_response?.Actions || result?.Actions || {};
    const matched =
      actions?.Face_Comparison === 'Passed' ||
      actions?.Selfie_Provided === 'Passed' ||
      false;
    const confidence = result?.job_complete_response?.ConfidenceValue
      ? Math.round(Number(result.job_complete_response.ConfidenceValue))
      : undefined;

    return {
      matched,
      confidence,
      referenceId: result?.SmileJobID ?? undefined,
      reason: matched ? undefined : 'Photo does not match the document',
    };
  } catch (error: any) {
    console.error('[SmileID] Photo comparison error:', error.message);
    return {
      matched: false,
      reason: 'Photo comparison service temporarily unavailable.',
    };
  }
}

export interface AmlCheckResult {
  isHit: boolean;
  hitTypes: string[];
  matchDetails: Record<string, unknown>[] | null;
  smileJobId?: string;
  error?: string;
}

// ============== KYB (Job Type 7 / Business Verification) ==============

export interface KybResult {
  found: boolean;
  companyName?: string;
  rcNumber?: string;
  companyType?: string;
  registrationDate?: string;
  status?: string;
  address?: string;
  addressLine1?: string;
  addressState?: string;
  addressCountry?: string;
  shareCapital?: string;
  tinNumber?: string;
  directors?: { name: string; role?: string }[];
  smileJobId?: string;
  error?: string;
  rawResult?: Record<string, unknown>;
}

const COMPANY_TYPE_MAP: Record<string, string> = {
  PRIVATE_COMPANY_LIMITED_BY_SHARES: 'LTD',
  PUBLIC_LIMITED_COMPANY: 'PLC',
  LIMITED_LIABILITY_PARTNERSHIP: 'LLP',
  BUSINESS_NAME: 'Sole_Proprietorship',
  INCORPORATED_TRUSTEE: 'IT',
  PRIVATE_UNLIMITED_COMPANY: 'LTD',
  COMPANY_LIMITED_BY_GUARANTEE: 'LTD',
  SOLE_PROPRIETORSHIP: 'Sole_Proprietorship',
};

function mapCompanyType(raw: string): string {
  if (!raw) return '';
  const upper = raw.toUpperCase().replace(/[\s-]/g, '_');
  return COMPANY_TYPE_MAP[upper] || raw;
}

/**
 * Verify a business using Smile ID Job Type 7 (Business Verification / CAC lookup).
 * id_type: BUSINESS_REGISTRATION
 * id_number: RC number (digits only, strip leading "RC")
 */
export async function verifyBusiness(
  rcNumber: string,
  userId: string,
  jobId: string,
  businessType: string = 'co',
): Promise<KybResult> {
  const cleanRc = rcNumber.replace(/^rc/i, '').trim();

  if (!isSmileIdConfigured()) {
    console.log(`[SmileID] Not configured — skipping KYB for RC ${cleanRc}`);
    return { found: false, error: 'NOT_CONFIGURED' };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const IDApi = smileIdentityCore.IDApi;
    const connection = new IDApi(PARTNER_ID, API_KEY, SID_SERVER);

    const partnerParams = { job_id: jobId, user_id: userId, job_type: 7 };
    const idInfo = { country: 'NG', id_type: 'BUSINESS_REGISTRATION', id_number: cleanRc, business_type: businessType };

    const result = await connection.submit_job(partnerParams, idInfo);
    const body: Record<string, unknown> = result?.body || result || {};
    const resultCode = body?.ResultCode || body?.result_code;
    const found = resultCode === '1012' || body?.ResultText === 'Verified' || body?.ResultText === 'Business Verified';

    // Smile ID returns company details nested under company_information
    const ci = (body?.company_information || {}) as Record<string, unknown>;

    const directors: { name: string; role?: string }[] = [];
    const rawDirs = (body?.directors || body?.Directors || []) as Record<string, unknown>[];
    if (Array.isArray(rawDirs)) {
      for (const d of rawDirs) {
        const name = String(d?.name || d?.Name || '').trim();
        const role = String(d?.role || d?.Role || '').trim();
        if (name && name !== 'Not Available') directors.push({ name, role: role && role !== 'Not Available' ? role : undefined });
      }
    }

    await storage.createAuditLog({
      actorUserId: userId,
      action: 'smile_id_kyb_lookup',
      entityType: 'company_profile',
      entityId: userId,
      details: { rcNumber: cleanRc, found, smileJobId: body?.SmileJobID },
    });

    const rawRegDate = String(ci?.registration_date || body?.registration_date || body?.DateOfRegistration || '');
    const registrationDate = rawRegDate.length >= 10 ? rawRegDate.slice(0, 10) : rawRegDate;
    const rawCompanyType = String(ci?.company_type || body?.company_type || body?.CompanyType || '');
    const addressLine1 = String(ci?.address || body?.address || body?.Address || '');
    const addressState = String(ci?.state || body?.state || '');
    const addressCountry = String(ci?.country || body?.country || 'Nigeria');
    return {
      found,
      companyName: String(ci?.legal_name || body?.company_name || body?.CompanyName || body?.Entity || ''),
      rcNumber: String(ci?.registration_number || body?.rc_number || body?.RCNumber || cleanRc),
      companyType: mapCompanyType(rawCompanyType) || rawCompanyType,
      registrationDate,
      status: String(ci?.status || body?.status || body?.Status || ''),
      address: [addressLine1, addressState, addressCountry].filter(Boolean).join(', '),
      addressLine1,
      addressState,
      addressCountry,
      shareCapital: String(ci?.authorized_shared_capital || body?.share_capital || body?.ShareCapital || ''),
      tinNumber: String(ci?.tax_id && ci?.tax_id !== 'Not Available' ? ci?.tax_id : body?.tin || body?.TIN || ''),
      directors,
      smileJobId: String(body?.SmileJobID || ''),
      rawResult: body,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const axiosData = (error as any)?.response?.data;
    console.error('[SmileID] KYB error:', err.message, axiosData ? JSON.stringify(axiosData) : '');
    await storage.createAuditLog({
      actorUserId: userId,
      action: 'smile_id_kyb_error',
      entityType: 'company_profile',
      entityId: userId,
      details: { rcNumber: cleanRc, error: err.message, responseData: axiosData },
    });
    return { found: false, error: err.message };
  }
}

/**
 * Verify a TIN using Smile ID Job Type 7 (Business Verification / TAX_INFORMATION).
 */
export async function verifyTin(
  tinNumber: string,
  userId: string,
  jobId: string,
): Promise<KybResult> {
  if (!isSmileIdConfigured()) {
    console.log(`[SmileID] Not configured — skipping TIN verification`);
    return { found: false, error: 'NOT_CONFIGURED' };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const IDApi = smileIdentityCore.IDApi;
    const connection = new IDApi(PARTNER_ID, API_KEY, SID_SERVER);

    const partnerParams = { job_id: jobId, user_id: userId, job_type: 7 };
    const idInfo = { country: 'NG', id_type: 'TAX_INFORMATION', id_number: tinNumber };

    const result = await connection.submit_job(partnerParams, idInfo, {}, {});
    const body: Record<string, unknown> = result?.body || result || {};
    const found = body?.ResultCode === '1012' || body?.ResultText === 'Verified';

    await storage.createAuditLog({
      actorUserId: userId,
      action: 'smile_id_tin_lookup',
      entityType: 'company_profile',
      entityId: userId,
      details: { tinNumber, found, smileJobId: body?.SmileJobID },
    });

    return {
      found,
      tinNumber,
      companyName: String(body?.company_name || body?.CompanyName || ''),
      smileJobId: String(body?.SmileJobID || ''),
      rawResult: body,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SmileID] TIN verification error:', err);
    return { found: false, error: err.message };
  }
}

interface SmileIdAmlHit {
  PEP?: string | boolean;
  Sanction?: string | boolean;
  Adverse_Media?: string | boolean;
  [key: string]: unknown;
}

interface SmileIdAmlResponse {
  AMLActions?: SmileIdAmlHit[];
  Hits?: SmileIdAmlHit[];
  SmileJobID?: string;
  error?: string;
  message?: string;
}

/**
 * Perform an AML/sanctions re-screening for a named individual using the Smile ID AML REST API.
 * Endpoint: POST https://api.smileidentity.com/v1/aml (production)
 *           POST https://testapi.smileidentity.com/v1/aml (sandbox)
 * Docs: https://docs.smileidentity.com/apis/aml-check
 */
export async function performAmlCheck(
  fullName: string,
  userId: string,
  options?: { dateOfBirth?: string; nationality?: string },
): Promise<AmlCheckResult> {
  if (!isSmileIdConfigured()) {
    console.log(`[SmileID] Not configured — skipping AML check for ${fullName}`);
    return { isHit: false, hitTypes: [], matchDetails: null, error: 'NOT_CONFIGURED' };
  }

  try {
    const smileIdentityCore = require('smile-identity-core');
    const { signature, timestamp } = new smileIdentityCore.Signature(PARTNER_ID, API_KEY).generate_signature();

    const apiBase = SID_SERVER === '1'
      ? 'https://api.smileidentity.com/v1'
      : 'https://testapi.smileidentity.com/v1';

    const requestBody: Record<string, any> = {
      partner_id: PARTNER_ID,
      signature,
      timestamp,
      full_name: fullName,
      user_id: userId,
      countries: options?.nationality ? [options.nationality.toUpperCase()] : ['NG'],
    };
    if (options?.dateOfBirth) requestBody.dob = options.dateOfBirth;

    const response = await fetch(`${apiBase}/aml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data: SmileIdAmlResponse = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || data?.message || `AML API error ${response.status}`);
    }

    const hits: SmileIdAmlHit[] = data?.AMLActions || data?.Hits || [];
    const isHit = hits.length > 0;
    const hitTypes: string[] = [];
    for (const hit of hits) {
      if (hit?.PEP === 'true' || hit?.PEP === true) hitTypes.push('PEP');
      if (hit?.Sanction === 'true' || hit?.Sanction === true) hitTypes.push('Sanction');
      if (hit?.Adverse_Media === 'true' || hit?.Adverse_Media === true) hitTypes.push('Adverse_Media');
    }

    await storage.createAuditLog({
      actorUserId: 'system',
      action: 'smile_id_aml_check',
      entityType: 'user',
      entityId: userId,
      details: {
        smileJobId: data?.SmileJobID,
        fullName,
        isHit,
        hitTypes,
        hitCount: hits.length,
      },
    });

    return {
      isHit,
      hitTypes: [...new Set(hitTypes)],
      matchDetails: hits.length > 0 ? hits : null,
      smileJobId: data?.SmileJobID,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SmileID] AML check error:', err);

    await storage.createAuditLog({
      actorUserId: 'system',
      action: 'smile_id_aml_check_error',
      entityType: 'user',
      entityId: userId,
      details: { error: err.message, fullName },
    });

    return {
      isHit: false,
      hitTypes: [],
      matchDetails: null,
      error: err.message,
    };
  }
}
