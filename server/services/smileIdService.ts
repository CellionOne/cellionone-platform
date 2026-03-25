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
