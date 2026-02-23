import crypto from 'crypto';
import { storage } from '../storage';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;

const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function getAfricasTalkingSMS() {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || 'sandbox';

  if (!apiKey) {
    console.warn('[2FA] Africa\'s Talking API key not set — using console-only mode');
    return null;
  }

  const AfricasTalking = (await import('africastalking')).default;
  const client = AfricasTalking({ apiKey, username });
  return client.SMS;
}

export async function sendOTP(userId: string, phoneNumber: string): Promise<{ success: boolean; message: string }> {
  const existing = otpStore.get(userId);
  if (existing && existing.expiresAt > Date.now() && (Date.now() - (existing.expiresAt - OTP_EXPIRY_MS)) < 30000) {
    return { success: false, message: 'Please wait 30 seconds before requesting a new code' };
  }

  const otp = generateOTP();
  otpStore.set(userId, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0 });

  try {
    const sms = await getAfricasTalkingSMS();
    if (sms) {
      await sms.send({
        to: [phoneNumber],
        message: `Your Cellion One verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        enqueue: true,
      });
    } else {
      console.log(`[2FA] OTP for user ${userId}: ${otp} (console mode — Africa's Talking not configured)`);
    }

    return { success: true, message: 'Verification code sent' };
  } catch (error: any) {
    console.error('[2FA] Failed to send OTP:', error?.message || error);
    otpStore.delete(userId);
    return { success: false, message: 'Failed to send verification code. Please try again.' };
  }
}

export function verifyOTP(userId: string, otp: string): { success: boolean; message: string } {
  const stored = otpStore.get(userId);

  if (!stored) {
    return { success: false, message: 'No verification code found. Please request a new one.' };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(userId);
    return { success: false, message: 'Verification code has expired. Please request a new one.' };
  }

  stored.attempts += 1;
  if (stored.attempts > MAX_ATTEMPTS) {
    otpStore.delete(userId);
    return { success: false, message: 'Too many failed attempts. Please request a new code.' };
  }

  if (stored.otp !== otp) {
    return { success: false, message: `Invalid code. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.` };
  }

  otpStore.delete(userId);
  return { success: true, message: 'Verification successful' };
}

export async function setupTwoFactor(userId: string, phoneNumber: string): Promise<{ success: boolean; message: string }> {
  const result = await sendOTP(userId, phoneNumber);
  return result;
}

export async function confirmTwoFactorSetup(userId: string, otp: string, phoneNumber: string): Promise<{ success: boolean; message: string; backupCodes?: string[] }> {
  const verification = verifyOTP(userId, otp);
  if (!verification.success) {
    return verification;
  }

  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  await storage.updateUserTwoFactor(userId, {
    twoFactorEnabled: true,
    twoFactorMethod: 'sms',
    twoFactorPhone: phoneNumber,
    twoFactorBackupCodes: backupCodes.join(','),
    lastTwoFactorAt: new Date(),
  });

  return {
    success: true,
    message: 'Two-factor authentication enabled successfully',
    backupCodes,
  };
}

export async function disableTwoFactor(userId: string): Promise<{ success: boolean; message: string }> {
  await storage.updateUserTwoFactor(userId, {
    twoFactorEnabled: false,
    twoFactorMethod: null as any,
    twoFactorPhone: null as any,
    twoFactorSecret: null as any,
    twoFactorBackupCodes: null as any,
  });

  return { success: true, message: 'Two-factor authentication disabled' };
}

export function verifyBackupCode(storedCodes: string, providedCode: string): { success: boolean; remainingCodes: string } {
  const codes = storedCodes.split(',').filter(Boolean);
  const codeIndex = codes.findIndex(c => c === providedCode.toUpperCase());

  if (codeIndex === -1) {
    return { success: false, remainingCodes: storedCodes };
  }

  codes.splice(codeIndex, 1);
  return { success: true, remainingCodes: codes.join(',') };
}

export async function sendLoginOTP(userId: string, phoneNumber: string): Promise<{ success: boolean; message: string }> {
  return sendOTP(userId, phoneNumber);
}

export function verifyLoginOTP(userId: string, otp: string): { success: boolean; message: string } {
  return verifyOTP(userId, otp);
}
