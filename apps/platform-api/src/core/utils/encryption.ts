// ---------------------------------------------------------------------------
// AES-256-GCM encryption for vendor and BYOK API keys
// Mirrors the @nexa/ai-gateway encryption module (same algorithm + format)
// Story: E13b.4 Task 3
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Output format: base64( IV || ciphertext || authTag )
 */
export function encryptApiKey(plaintext: string, masterKeyHex: string): string {
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

  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt a ciphertext string using AES-256-GCM.
 *
 * Input format: base64( IV || ciphertext || authTag )
 */
export function decryptApiKey(ciphertext: string, masterKeyHex: string): string {
  const key = Buffer.from(masterKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Master key must be exactly 32 bytes (64 hex characters)');
  }

  const combined = Buffer.from(ciphertext, 'base64');
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short — expected IV + data + authTag');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Get the encryption master key from environment.
 * Throws if not configured.
 */
export function getEncryptionKey(): string {
  const key = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!key) {
    throw new Error('AI_KEY_ENCRYPTION_SECRET is not configured');
  }
  return key;
}
