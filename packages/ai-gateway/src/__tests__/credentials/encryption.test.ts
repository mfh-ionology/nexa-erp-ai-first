import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '../../credentials/encryption.js';

/** Generate a random 32-byte hex master key. */
function randomMasterKey(): string {
  return randomBytes(32).toString('hex');
}

describe('encryption', () => {
  const masterKey = randomMasterKey();

  // ─── Round-trip ────────────────────────────────────────────────────────

  it('encrypts and decrypts a plaintext string', () => {
    const plaintext = 'sk-ant-api03-real-key-here';
    const encrypted = encrypt(plaintext, masterKey);
    const decrypted = decrypt(encrypted, masterKey);
    expect(decrypted).toBe(plaintext);
  });

  it('handles empty strings', () => {
    const encrypted = encrypt('', masterKey);
    const decrypted = decrypt(encrypted, masterKey);
    expect(decrypted).toBe('');
  });

  it('handles long strings', () => {
    const plaintext = 'a'.repeat(10_000);
    const encrypted = encrypt(plaintext, masterKey);
    const decrypted = decrypt(encrypted, masterKey);
    expect(decrypted).toBe(plaintext);
  });

  it('handles unicode strings', () => {
    const plaintext = 'sk-key-with-unicode-\u{1F512}-lock';
    const encrypted = encrypt(plaintext, masterKey);
    const decrypted = decrypt(encrypted, masterKey);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-key-value';
    const encrypted1 = encrypt(plaintext, masterKey);
    const encrypted2 = encrypt(plaintext, masterKey);
    expect(encrypted1).not.toBe(encrypted2);
    // But both decrypt to the same plaintext
    expect(decrypt(encrypted1, masterKey)).toBe(plaintext);
    expect(decrypt(encrypted2, masterKey)).toBe(plaintext);
  });

  // ─── Wrong key → error ─────────────────────────────────────────────────

  it('throws on decryption with a different key', () => {
    const plaintext = 'sk-secret';
    const encrypted = encrypt(plaintext, masterKey);
    const wrongKey = randomMasterKey();
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  // ─── Tampered ciphertext → error ──────────────────────────────────────

  it('throws when ciphertext is tampered with', () => {
    const plaintext = 'sk-tamper-test';
    const encrypted = encrypt(plaintext, masterKey);
    const buf = Buffer.from(encrypted, 'base64');

    // Flip a byte in the middle of the ciphertext (after the IV, before the auth tag)
    const tamperedIndex = 12 + Math.floor((buf.length - 12 - 16) / 2);
    buf[tamperedIndex] = buf[tamperedIndex]! ^ 0xff;

    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered, masterKey)).toThrow();
  });

  it('throws when auth tag is tampered with', () => {
    const plaintext = 'sk-auth-tag-test';
    const encrypted = encrypt(plaintext, masterKey);
    const buf = Buffer.from(encrypted, 'base64');

    // Tamper with the last byte (part of auth tag)
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;

    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered, masterKey)).toThrow();
  });

  // ─── Invalid inputs ───────────────────────────────────────────────────

  it('throws on too-short ciphertext', () => {
    const shortData = Buffer.alloc(10).toString('base64');
    expect(() => decrypt(shortData, masterKey)).toThrow('too short');
  });

  it('throws on invalid master key length (too short)', () => {
    const shortKey = randomBytes(16).toString('hex'); // 16 bytes, not 32
    expect(() => encrypt('test', shortKey)).toThrow('32 bytes');
  });

  it('throws on invalid master key length (too long)', () => {
    const longKey = randomBytes(48).toString('hex');
    expect(() => encrypt('test', longKey)).toThrow('32 bytes');
  });

  it('throws on decrypt with invalid master key length', () => {
    const encrypted = encrypt('test', masterKey);
    const shortKey = randomBytes(16).toString('hex');
    expect(() => decrypt(encrypted, shortKey)).toThrow('32 bytes');
  });
});
