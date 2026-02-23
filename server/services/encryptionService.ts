import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!key) {
    throw new Error('ENCRYPTION_KEY or SESSION_SECRET must be set for field encryption');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decryptField(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskSensitiveField(value: string, showLast: number = 4): string {
  if (!value || value.length <= showLast) {
    return '****';
  }
  const masked = '*'.repeat(value.length - showLast);
  return masked + value.slice(-showLast);
}

export function isEncryptedField(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2 && parts[1].length === TAG_LENGTH * 2;
}
