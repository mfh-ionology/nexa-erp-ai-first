import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { PrismaClient, TransactionClient } from '@nexa/db';
import { resolveUserRole } from '@nexa/db';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_DAYS = 7;

function getAccessExpiry(): string {
  return process.env.JWT_ACCESS_EXPIRY ?? DEFAULT_ACCESS_EXPIRY;
}

function getRefreshExpiryDays(): number {
  return Number(process.env.JWT_REFRESH_EXPIRY_DAYS) || DEFAULT_REFRESH_DAYS;
}

const MIN_JWT_SECRET_LENGTH = 32;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${String(MIN_JWT_SECRET_LENGTH)} characters (got ${String(secret.length)})`,
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// JWT Access Token Payload
// ---------------------------------------------------------------------------

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  role: string;
  enabledModules: string[];
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

// ---------------------------------------------------------------------------
// JWT Access Token
// ---------------------------------------------------------------------------

export async function generateAccessToken(payload: {
  sub: string;
  tenantId: string;
  role: string;
  enabledModules: string[];
}): Promise<string> {
  return new SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
    enabledModules: payload.enabledModules,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(getAccessExpiry())
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as AccessTokenPayload;
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
  prisma: PrismaClient,
  userId: string,
  tokenHash: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + getRefreshExpiryDays());

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

export async function revokeRefreshToken(prisma: PrismaClient, tokenHash: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(
  prisma: PrismaClient | TransactionClient,
  userId: string,
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findValidRefreshToken(prisma: PrismaClient, tokenHash: string) {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

// ---------------------------------------------------------------------------
// Role Resolution (delegates to @nexa/db)
// ---------------------------------------------------------------------------

export { resolveUserRole };

// ---------------------------------------------------------------------------
// Constants (exported for consumers)
// ---------------------------------------------------------------------------

/**
 * Parse a jose-style expiry string (e.g. '15m', '1h', '7d') into seconds.
 * Keeps `expiresIn` in the response consistent with the actual JWT TTL.
 */
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
