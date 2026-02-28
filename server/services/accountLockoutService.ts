import { storage } from "../storage";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutUntil: Date | null;
  lockoutMinutesRemaining: number | null;
}

export async function checkAccountLockout(identifier: string): Promise<LockoutStatus> {
  const attempt = await storage.getLoginAttempt(identifier);

  if (!attempt) {
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockoutUntil: null,
      lockoutMinutesRemaining: null,
    };
  }

  const now = new Date();

  if (attempt.lockoutUntil && attempt.lockoutUntil > now) {
    const minutesRemaining = Math.ceil((attempt.lockoutUntil.getTime() - now.getTime()) / (60 * 1000));
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: attempt.lockoutUntil,
      lockoutMinutesRemaining: minutesRemaining,
    };
  }

  if (attempt.lockoutUntil && attempt.lockoutUntil <= now) {
    await storage.upsertLoginAttempt(identifier, {
      failedAttempts: 0,
      lockoutUntil: null,
      lastAttempt: now,
    });
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockoutUntil: null,
      lockoutMinutesRemaining: null,
    };
  }

  return {
    isLocked: false,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - attempt.failedAttempts),
    lockoutUntil: null,
    lockoutMinutesRemaining: null,
  };
}

export async function recordFailedAttempt(identifier: string): Promise<LockoutStatus> {
  const now = new Date();
  const attempt = await storage.getLoginAttempt(identifier);

  let currentFailed = 0;

  if (attempt) {
    if (attempt.lockoutUntil && attempt.lockoutUntil > now) {
      const minutesRemaining = Math.ceil((attempt.lockoutUntil.getTime() - now.getTime()) / (60 * 1000));
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutUntil: attempt.lockoutUntil,
        lockoutMinutesRemaining: minutesRemaining,
      };
    }

    if (attempt.lockoutUntil && attempt.lockoutUntil <= now) {
      currentFailed = 0;
    } else {
      currentFailed = attempt.failedAttempts;
    }
  }

  currentFailed++;

  let lockoutUntil: Date | null = null;
  if (currentFailed >= MAX_FAILED_ATTEMPTS) {
    lockoutUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    console.log(`[Security] Account locked: ${identifier} until ${lockoutUntil.toISOString()}`);

    try {
      await storage.createSecurityEvent({
        eventType: "account_locked",
        severity: "medium",
        ipAddress: null,
        details: { identifier, lockoutUntil: lockoutUntil.toISOString(), failedAttempts: currentFailed },
      });
    } catch (e) {
      console.error("[Security] Failed to log account_locked event:", e);
    }
  }

  await storage.upsertLoginAttempt(identifier, {
    failedAttempts: currentFailed,
    lockoutUntil,
    lastAttempt: now,
  });

  if (lockoutUntil) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil,
      lockoutMinutesRemaining: LOCKOUT_DURATION_MINUTES,
    };
  }

  return {
    isLocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - currentFailed,
    lockoutUntil: null,
    lockoutMinutesRemaining: null,
  };
}

export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  await storage.deleteLoginAttempt(identifier);
  console.log(`[Security] Login successful, lockout cleared for: ${identifier}`);
}

export async function clearLockout(identifier: string): Promise<void> {
  await storage.deleteLoginAttempt(identifier);
  console.log(`[Security] Manual lockout clear for: ${identifier}`);
}

export async function getLockoutStats(): Promise<{ totalLocked: number; totalTracked: number }> {
  const locked = await storage.getLockedAccounts();
  return {
    totalLocked: locked.length,
    totalTracked: locked.length,
  };
}
