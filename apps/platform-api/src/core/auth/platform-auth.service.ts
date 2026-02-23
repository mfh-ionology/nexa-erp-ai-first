import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import * as OTPAuth from 'otpauth';

import { getPlatformPrisma } from '../../client.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_DAYS = 7;
const MIN_JWT_SECRET_LENGTH = 32;

function getAccessExpiry(): string {
  return process.env.PLATFORM_JWT_ACCESS_EXPIRY ?? DEFAULT_ACCESS_EXPIRY;
}

export function getRefreshExpiryDays(): number {
  return Number(process.env.PLATFORM_JWT_REFRESH_EXPIRY_DAYS) || DEFAULT_REFRESH_DAYS;
}

export function getRefreshExpirySeconds(): number {
  return getRefreshExpiryDays() * 24 * 60 * 60;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.PLATFORM_JWT_SECRET;
  if (!secret) {
    throw new Error('PLATFORM_JWT_SECRET environment variable is required');
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `PLATFORM_JWT_SECRET must be at least ${String(MIN_JWT_SECRET_LENGTH)} characters (got ${String(secret.length)})`,
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// JWT Payload
// ---------------------------------------------------------------------------

export interface PlatformAccessTokenPayload extends JWTPayload {
  sub: string;
  role: string;
  iss: string;
}

// ---------------------------------------------------------------------------
// Password Hashing (Argon2id — OWASP recommended settings)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Pre-computed Argon2id hash of a random string, used to equalise timing when
// the user does not exist (prevents email enumeration via Argon2id latency).
let dummyHash: string | undefined;
export async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword('__platform_dummy_timing_equaliser__');
  }
  return dummyHash;
}

// ---------------------------------------------------------------------------
// JWT Access Token
// ---------------------------------------------------------------------------

export async function generatePlatformJwt(
  platformUserId: string,
  platformRole: string,
): Promise<string> {
  return new SignJWT({ role: platformRole })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(platformUserId)
    .setIssuer('nexa-platform')
    .setIssuedAt()
    .setExpirationTime(getAccessExpiry())
    .sign(getJwtSecret());
}

export async function verifyPlatformJwt(token: string): Promise<PlatformAccessTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: 'nexa-platform',
  });
  return payload as PlatformAccessTokenPayload;
}

// ---------------------------------------------------------------------------
// TOTP Verification
// ---------------------------------------------------------------------------

export function verifyTotp(mfaSecret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: 'Nexa Platform',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(mfaSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export function generateTotpSecret(email: string): { secret: string; uri: string } {
  const secret = new OTPAuth.Secret({ size: 20 });

  const totp = new OTPAuth.TOTP({
    issuer: 'Nexa Platform',
    label: email,
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
// Refresh Token
// ---------------------------------------------------------------------------

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Refresh Token DB Operations
// ---------------------------------------------------------------------------

export async function createRefreshTokenRecord(
  platformUserId: string,
  tokenHash: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const prisma = getPlatformPrisma();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + getRefreshExpiryDays());

  await prisma.platformRefreshToken.create({
    data: {
      platformUserId,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  const prisma = getPlatformPrisma();
  await prisma.platformRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(platformUserId: string): Promise<void> {
  const prisma = getPlatformPrisma();
  await prisma.platformRefreshToken.updateMany({
    where: { platformUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findValidRefreshToken(tokenHash: string) {
  const prisma = getPlatformPrisma();
  return prisma.platformRefreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

export async function findRevokedRefreshToken(tokenHash: string) {
  const prisma = getPlatformPrisma();
  return prisma.platformRefreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: { not: null },
    },
    select: { platformUserId: true },
  });
}

// ---------------------------------------------------------------------------
// Expiry Helpers
// ---------------------------------------------------------------------------

function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)\s*([smhd])$/);
  if (!match) {
    throw new Error(
      `Invalid JWT expiry format "${expiry}". Expected format: <number><unit> where unit is s, m, h, or d (e.g. "15m", "1h", "7d")`,
    );
  }
  const value = Number(match[1]);
  switch (match[2]) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Unexpected expiry unit: ${match[2] ?? 'unknown'}`);
  }
}

export function getAccessTokenExpirySeconds(): number {
  return parseExpiryToSeconds(getAccessExpiry());
}
