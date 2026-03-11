// ---------------------------------------------------------------------------
// Impersonation Service — Start, end, query impersonation sessions
// Source: API Contracts §21.3, FR199-FR200, BR-PLT-012, BR-PLT-013
// Story: E13b.5 Task 1
// ---------------------------------------------------------------------------

import { SignJWT } from 'jose';

import { getPlatformPrisma } from '../client.js';
import { AppError, NotFoundError } from '../core/errors/app-error.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 480;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartImpersonationParams {
  platformUserId: string;
  tenantId: string;
  reason: string;
  durationMinutes?: number;
}

export interface StartImpersonationResult {
  sessionId: string;
  token: string;
  expiresAt: string;
}

export interface EndImpersonationResult {
  sessionId: string;
  endedAt: string;
  duration: number; // seconds
}

export interface ImpersonationSessionDetail {
  id: string;
  platformUser: { id: string; email: string; displayName: string };
  tenant: { id: string; code: string; displayName: string };
  reason: string;
  startedAt: string;
  endedAt: string | null;
  expiresAt: string;
  actionsCount: number;
}

export interface ListSessionsFilters {
  tenantId?: string;
  platformUserId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// JWT helper
// ---------------------------------------------------------------------------

function getJwtSecret(): Uint8Array {
  const secret = process.env.PLATFORM_JWT_SECRET;
  if (!secret) {
    throw new Error('PLATFORM_JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

async function generateImpersonationJwt(
  platformUserId: string,
  tenantId: string,
  sessionId: string,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT({ tenantId, sessionId, type: 'impersonation' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(platformUserId)
    .setIssuer('nexa-platform')
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getJwtSecret());
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Start an impersonation session for a platform admin on a tenant.
 * Validates reason is non-empty (BR-PLT-012), creates session with expiry
 * (BR-PLT-013), generates impersonation JWT, emits event.
 */
export async function startImpersonation(
  params: StartImpersonationParams,
): Promise<StartImpersonationResult> {
  const { platformUserId, tenantId, reason, durationMinutes } = params;

  // BR-PLT-012: Mandatory reason
  if (!reason || reason.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Impersonation reason is required (BR-PLT-012)', 400);
  }

  const duration = durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (duration < 1 || duration > MAX_DURATION_MINUTES) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Duration must be between 1 and ${String(MAX_DURATION_MINUTES)} minutes`,
      400,
    );
  }

  const prisma = getPlatformPrisma();

  // Verify tenant exists and is ACTIVE
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true },
  });

  if (!tenant) {
    throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
  }

  if (tenant.status !== 'ACTIVE') {
    throw new AppError('TENANT_NOT_ACTIVE', 'Can only impersonate active tenants', 422);
  }

  // E13b.5 Fix #7: Prevent concurrent impersonation sessions for the same admin
  const existingActive = await prisma.impersonationSession.findFirst({
    where: {
      platformUserId,
      endedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (existingActive) {
    throw new AppError(
      'CONCURRENT_SESSION',
      'You already have an active impersonation session. End it before starting a new one.',
      409,
    );
  }

  // BR-PLT-013: Time-limited session
  const expiresAt = new Date(Date.now() + duration * 60 * 1000);

  const session = await prisma.impersonationSession.create({
    data: {
      platformUserId,
      tenantId,
      reason: reason.trim(),
      expiresAt,
    },
  });

  const token = await generateImpersonationJwt(platformUserId, tenantId, session.id, expiresAt);

  return {
    sessionId: session.id,
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * End an active impersonation session.
 * Sets endedAt, emits platform.impersonation_ended event.
 */
export async function endImpersonation(
  sessionId: string,
  platformUserId: string,
): Promise<EndImpersonationResult> {
  const prisma = getPlatformPrisma();

  const session = await prisma.impersonationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError('SESSION_NOT_FOUND', 'Impersonation session not found');
  }

  if (session.platformUserId !== platformUserId) {
    throw new AppError('FORBIDDEN', 'Session does not belong to caller', 403);
  }

  if (session.endedAt) {
    throw new AppError('SESSION_ALREADY_ENDED', 'Impersonation session has already ended', 422);
  }

  const endedAt = new Date();
  await prisma.impersonationSession.update({
    where: { id: sessionId },
    data: { endedAt },
  });

  const durationSeconds = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);

  return {
    sessionId: session.id,
    endedAt: endedAt.toISOString(),
    duration: durationSeconds,
  };
}

/**
 * Get the active impersonation session for a platform user, if any.
 * Active = endedAt is null AND expiresAt > now.
 */
export async function getActiveSession(
  platformUserId: string,
): Promise<ImpersonationSessionDetail | null> {
  const prisma = getPlatformPrisma();

  const session = await prisma.impersonationSession.findFirst({
    where: {
      platformUserId,
      endedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      platformUser: { select: { id: true, email: true, displayName: true } },
      tenant: { select: { id: true, code: true, displayName: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) return null;

  return formatSessionDetail(session);
}

/**
 * List impersonation sessions with pagination and optional filters.
 */
export async function listSessions(
  filters: ListSessionsFilters = {},
): Promise<{ items: ImpersonationSessionDetail[]; total: number; hasMore: boolean }> {
  const prisma = getPlatformPrisma();
  const limit = filters.limit ?? 50;

  const where: Record<string, unknown> = {};
  if (filters.tenantId) where.tenantId = filters.tenantId;
  if (filters.platformUserId) where.platformUserId = filters.platformUserId;
  if (filters.from || filters.to) {
    const startedAt: Record<string, Date> = {};
    if (filters.from) startedAt.gte = new Date(filters.from);
    if (filters.to) startedAt.lte = new Date(filters.to);
    where.startedAt = startedAt;
  }

  const cursorObj = filters.cursor ? { id: filters.cursor } : undefined;

  const [sessions, total] = await Promise.all([
    prisma.impersonationSession.findMany({
      where,
      include: {
        platformUser: { select: { id: true, email: true, displayName: true } },
        tenant: { select: { id: true, code: true, displayName: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: limit + 1,
      ...(cursorObj ? { cursor: cursorObj, skip: 1 } : {}),
    }),
    prisma.impersonationSession.count({ where }),
  ]);

  const hasMore = sessions.length > limit;
  const items = sessions.slice(0, limit).map(formatSessionDetail);

  return { items, total, hasMore };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSessionDetail(session: {
  id: string;
  platformUser: { id: string; email: string; displayName: string };
  tenant: { id: string; code: string; displayName: string };
  reason: string;
  startedAt: Date;
  endedAt: Date | null;
  expiresAt: Date;
  actionsLog: unknown;
}): ImpersonationSessionDetail {
  const actionsLog = session.actionsLog;
  const actionsCount = Array.isArray(actionsLog) ? actionsLog.length : 0;

  return {
    id: session.id,
    platformUser: session.platformUser,
    tenant: session.tenant,
    reason: session.reason,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    expiresAt: session.expiresAt.toISOString(),
    actionsCount,
  };
}
