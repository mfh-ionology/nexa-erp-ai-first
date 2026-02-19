import { describe, it, expect } from 'vitest';
import * as OTPAuth from 'otpauth';
import { generateTotpSecret, verifyTotpToken } from './mfa.service.js';

/**
 * Derive an invalid TOTP code by shifting each digit of the valid code by 5.
 * This guarantees the result differs from the current-window valid code.
 */
function deriveInvalidCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'Nexa ERP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const valid = totp.generate();
  return valid
    .split('')
    .map((d) => ((parseInt(d, 10) + 5) % 10).toString())
    .join('');
}

// ---------------------------------------------------------------------------
// Secret generation
// ---------------------------------------------------------------------------

describe('generateTotpSecret', () => {
  it('returns a valid base32 secret', () => {
    const result = generateTotpSecret('Nexa ERP', 'user@example.com');

    expect(result.secret).toBeDefined();
    expect(result.secret.length).toBeGreaterThan(0);
    // base32 alphabet: A-Z, 2-7, optional = padding
    expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it('returns a valid otpauth URI', () => {
    const result = generateTotpSecret('Nexa ERP', 'user@example.com');

    expect(result.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(result.uri).toContain('issuer=Nexa%20ERP');
    expect(result.uri).toContain('secret=');
    expect(result.uri).toContain('algorithm=SHA1');
    expect(result.uri).toContain('digits=6');
    expect(result.uri).toContain('period=30');
  });

  it('generates unique secrets on each call', () => {
    const a = generateTotpSecret('Nexa ERP', 'user@example.com');
    const b = generateTotpSecret('Nexa ERP', 'user@example.com');

    expect(a.secret).not.toBe(b.secret);
  });
});

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

describe('verifyTotpToken', () => {
  it('accepts a valid token generated from the same secret', () => {
    const { secret } = generateTotpSecret('Nexa ERP', 'user@example.com');

    // Generate a valid token from the same secret
    const totp = new OTPAuth.TOTP({
      issuer: 'Nexa ERP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();

    expect(verifyTotpToken(secret, token)).toBe(true);
  });

  it('rejects an invalid token', () => {
    const { secret } = generateTotpSecret('Nexa ERP', 'user@example.com');
    const invalidCode = deriveInvalidCode(secret);

    expect(verifyTotpToken(secret, invalidCode)).toBe(false);
  });

  it('rejects a token from a different secret', () => {
    const result1 = generateTotpSecret('Nexa ERP', 'user1@example.com');
    const result2 = generateTotpSecret('Nexa ERP', 'user2@example.com');

    // Generate token from secret2, try to verify against secret1
    const totp = new OTPAuth.TOTP({
      issuer: 'Nexa ERP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(result2.secret),
    });
    const token = totp.generate();

    expect(verifyTotpToken(result1.secret, token)).toBe(false);
  });

  it('rejects a token outside the time window', () => {
    const { secret } = generateTotpSecret('Nexa ERP', 'user@example.com');

    // Generate a token for a timestamp far in the past (outside window: 1)
    const totp = new OTPAuth.TOTP({
      issuer: 'Nexa ERP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    // Generate token for 5 minutes ago (10 periods back, well outside window: 1)
    const pastTimestamp = Math.floor(Date.now() / 1000) - 300;
    const expiredToken = totp.generate({ timestamp: pastTimestamp * 1000 });

    expect(verifyTotpToken(secret, expiredToken)).toBe(false);
  });
});
