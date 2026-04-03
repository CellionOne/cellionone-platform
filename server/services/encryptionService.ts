import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (key) {
    return crypto.createHash('sha256').update(key).digest();
  }

  // Legacy fallback — warn loudly, will be removed in a future release
  const legacy = process.env.SESSION_SECRET;
  if (legacy) {
    console.warn(
      '[Security] ENCRYPTION_KEY is not set — falling back to SESSION_SECRET for field encryption. ' +
      'Please set a dedicated ENCRYPTION_KEY secret to decouple encryption from session signing.'
    );
    return crypto.createHash('sha256').update(legacy).digest();
  }

  throw new Error('[Security] Neither ENCRYPTION_KEY nor SESSION_SECRET is set. Cannot perform field encryption.');
}

export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

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

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
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
