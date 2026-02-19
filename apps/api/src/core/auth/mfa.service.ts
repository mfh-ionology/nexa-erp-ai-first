import * as OTPAuth from 'otpauth';

// ---------------------------------------------------------------------------
// TOTP Secret Generation
// ---------------------------------------------------------------------------

export function generateTotpSecret(issuer: string, label: string): { secret: string; uri: string } {
  const secret = new OTPAuth.Secret({ size: 20 });

  const totp = new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

// ---------------------------------------------------------------------------
// TOTP Token Verification
// ---------------------------------------------------------------------------

export function verifyTotpToken(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: 'Nexa ERP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
