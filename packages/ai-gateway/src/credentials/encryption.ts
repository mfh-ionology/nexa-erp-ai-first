import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Output format: base64( IV || ciphertext || authTag )
 *
 * @param plaintext - The plaintext to encrypt
 * @param masterKeyHex - 32-byte master key as a 64-char hex string
 * @returns base64-encoded ciphertext with IV and auth tag prepended/appended
 */
export function encrypt(plaintext: string, masterKeyHex: string): string {
  if (plaintext.length === 0) {
    throw new Error('Plaintext must not be empty — refusing to encrypt an empty API key');
  }

  const key = Buffer.from(masterKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Master key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // IV || ciphertext || authTag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt a ciphertext string encrypted with AES-256-GCM.
 *
 * Expects base64( IV || ciphertext || authTag ) format.
 *
 * @param encryptedBase64 - base64-encoded string from `encrypt()`
 * @param masterKeyHex - 32-byte master key as a 64-char hex string
 * @returns the decrypted plaintext
 * @throws on wrong key, tampered ciphertext, or invalid format
 */
export function decrypt(encryptedBase64: string, masterKeyHex: string): string {
  const key = Buffer.from(masterKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Master key must be exactly 32 bytes (64 hex characters)');
  }

  const combined = Buffer.from(encryptedBase64, 'base64');
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
