/**
 * Account Lockout Service
 * 
 * Protects against brute force attacks by locking accounts after
 * multiple failed login attempts.
 * 
 * Configuration:
 * - 5 failed attempts = 15 minute lockout
 * - Successful login resets the counter
 * - Lockout info stored in memory (use Redis in production)
 */

interface LockoutInfo {
  failedAttempts: number;
  lockoutUntil: Date | null;
  lastAttempt: Date;
}

// In-memory storage (use Redis or database in production for persistence across restarts)
const lockoutStore = new Map<string, LockoutInfo>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const CLEANUP_INTERVAL_MINUTES = 60;

// Clean up old entries periodically
setInterval(() => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  Array.from(lockoutStore.entries()).forEach(([key, info]) => {
    // Remove entries that haven't been accessed in an hour and aren't locked
    if (info.lastAttempt < oneHourAgo && (!info.lockoutUntil || info.lockoutUntil < now)) {
      lockoutStore.delete(key);
    }
  });
}, CLEANUP_INTERVAL_MINUTES * 60 * 1000);

export interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutUntil: Date | null;
  lockoutMinutesRemaining: number | null;
}

export function checkAccountLockout(identifier: string): LockoutStatus {
  const info = lockoutStore.get(identifier);
  
  if (!info) {
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockoutUntil: null,
      lockoutMinutesRemaining: null,
    };
  }
  
  const now = new Date();
  
  // Check if lockout has expired
  if (info.lockoutUntil && info.lockoutUntil > now) {
    const minutesRemaining = Math.ceil((info.lockoutUntil.getTime() - now.getTime()) / (60 * 1000));
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: info.lockoutUntil,
      lockoutMinutesRemaining: minutesRemaining,
    };
  }
  
  // Lockout expired - reset if necessary
  if (info.lockoutUntil && info.lockoutUntil <= now) {
    info.failedAttempts = 0;
    info.lockoutUntil = null;
  }
  
  return {
    isLocked: false,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - info.failedAttempts),
    lockoutUntil: null,
    lockoutMinutesRemaining: null,
  };
}

export function recordFailedAttempt(identifier: string): LockoutStatus {
  const now = new Date();
  let info = lockoutStore.get(identifier);
  
  if (!info) {
    info = {
      failedAttempts: 0,
      lockoutUntil: null,
      lastAttempt: now,
    };
    lockoutStore.set(identifier, info);
  }
  
  // If currently locked, just return the status
  if (info.lockoutUntil && info.lockoutUntil > now) {
    const minutesRemaining = Math.ceil((info.lockoutUntil.getTime() - now.getTime()) / (60 * 1000));
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: info.lockoutUntil,
      lockoutMinutesRemaining: minutesRemaining,
    };
  }
  
  // Reset if previous lockout expired
  if (info.lockoutUntil && info.lockoutUntil <= now) {
    info.failedAttempts = 0;
    info.lockoutUntil = null;
  }
  
  // Record the failed attempt
  info.failedAttempts++;
  info.lastAttempt = now;
  
  // Check if we should lock the account
  if (info.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    info.lockoutUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    console.log(`[Security] Account locked: ${identifier} until ${info.lockoutUntil.toISOString()}`);
    
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutUntil: info.lockoutUntil,
      lockoutMinutesRemaining: LOCKOUT_DURATION_MINUTES,
    };
  }
  
  return {
    isLocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - info.failedAttempts,
    lockoutUntil: null,
    lockoutMinutesRemaining: null,
  };
}

export function recordSuccessfulLogin(identifier: string): void {
  // Clear all failed attempts on successful login
  lockoutStore.delete(identifier);
  console.log(`[Security] Login successful, lockout cleared for: ${identifier}`);
}

export function clearLockout(identifier: string): void {
  lockoutStore.delete(identifier);
  console.log(`[Security] Manual lockout clear for: ${identifier}`);
}

// Admin function to get current lockout stats
export function getLockoutStats(): { totalLocked: number; totalTracked: number } {
  const now = new Date();
  let totalLocked = 0;
  
  Array.from(lockoutStore.values()).forEach((info) => {
    if (info.lockoutUntil && info.lockoutUntil > now) {
      totalLocked++;
    }
  });
  
  return {
    totalLocked,
    totalTracked: lockoutStore.size,
  };
}
