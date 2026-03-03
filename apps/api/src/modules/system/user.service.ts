import type { PrismaClient } from '@nexa/db';
import type { UserRole } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateUserRequest, UserListQuery } from './user.schema.js';
import { hashPassword } from '../../core/auth/auth.service.js';
import { revokeAllUserTokens } from '../../core/auth/auth.service.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import { tServer } from '@nexa/i18n/server';
import type { PaginationMeta } from '../../core/utils/response.js';
import { applyViewFilters } from '../../core/views/apply-view-filters.js';

// ---------------------------------------------------------------------------
// Shared select — excludes sensitive fields from all queries
// ---------------------------------------------------------------------------

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  companyId: true,
  enabledModules: true,
  locale: true,
  isActive: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

export async function createUser(
  prisma: PrismaClient,
  data: CreateUserRequest & { companyId: string },
  ctx: RequestContext,
) {
  const hashed = await hashPassword(data.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: hashed,
          firstName: data.firstName,
          lastName: data.lastName,
          companyId: data.companyId,
          enabledModules: data.enabledModules,
          locale: data.locale,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
        select: userSelect,
      });

      // Create global role (companyId=null)
      await tx.userCompanyRole.create({
        data: {
          userId: created.id,
          companyId: null,
          role: data.role,
        },
      });

      return created;
    });

    // TODO: E3 — emit user.created event
    return { ...user, role: data.role };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(
        'DUPLICATE_EMAIL',
        tServer('errors:DUPLICATE_EMAIL'),
        409,
        undefined,
        'errors:DUPLICATE_EMAIL',
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// listUsers — filter transform for relation fields
// ---------------------------------------------------------------------------

/**
 * Rewrites filter conditions that target relation fields not directly on User.
 * - `role` → `companyRoles: { some: { role: <clause>, companyId: null } }`
 *
 * Recursively transforms AND/OR arrays so nested conditions are also handled.
 */
function transformUserFilters(filterWhere: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filterWhere)) {
    if (key === 'role') {
      // role lives on UserCompanyRole — rewrite to a relation filter
      result.companyRoles = { some: { role: value, companyId: null } };
    } else if ((key === 'AND' || key === 'OR') && Array.isArray(value)) {
      result[key] = (value as Record<string, unknown>[]).map(transformUserFilters);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

export async function listUsers(prisma: PrismaClient, companyId: string, query: UserListQuery) {
  const {
    cursor,
    limit,
    sort,
    order,
    search,
    isActive,
    conditions,
    filterLogic,
    sortField,
    sortDir,
  } = query;

  // Base where clause — always scoped by companyId
  const where: Record<string, unknown> = { companyId };
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  // E7.5: Merge metadata-driven filter conditions into where clause
  if (conditions) {
    let filterWhere = await applyViewFilters(prisma, companyId, 'USERS', conditions, filterLogic);
    // Transform relation-based fields (role lives on UserCompanyRole, not User)
    filterWhere = transformUserFilters(filterWhere);
    // Merge filter conditions using AND — preserves companyId scoping
    if (Object.keys(filterWhere).length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? (where.AND as Record<string, unknown>[]) : []),
        filterWhere,
      ];
    }
  }

  // E7.5: Use sortField/sortDir when provided, fall back to legacy sort/order
  // Security: only allow sorting on columns exposed by userSelect (never passwordHash, mfaSecret, etc.)
  const allowedSortFields = new Set(Object.keys(userSelect));
  const orderBy =
    sortField && allowedSortFields.has(sortField)
      ? { [sortField]: sortDir ?? 'asc' }
      : { [sort]: order };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy,
      select: {
        ...userSelect,
        companyRoles: {
          where: { companyId: null },
          select: { role: true },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const hasMore = users.length > limit;
  const data = hasMore ? users.slice(0, -1) : users;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map(({ companyRoles, ...user }) => ({
    ...user,
    role: companyRoles[0]?.role ?? null,
  }));

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// getUserById
// ---------------------------------------------------------------------------

export async function getUserById(prisma: PrismaClient, id: string, companyId: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      companyRoles: {
        where: { companyId: null },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!user || user.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', tServer('errors:USER_NOT_FOUND'), 'errors:USER_NOT_FOUND');
  }

  const { companyRoles, ...rest } = user;
  return { ...rest, role: companyRoles[0]?.role ?? null };
}

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------

export async function updateUser(
  prisma: PrismaClient,
  id: string,
  companyId: string,
  data: { firstName?: string; lastName?: string; locale?: string },
  ctx: RequestContext,
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });

  if (!existing || existing.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', tServer('errors:USER_NOT_FOUND'), 'errors:USER_NOT_FOUND');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...data,
      updatedBy: ctx.userId,
    },
    select: {
      ...userSelect,
      companyRoles: {
        where: { companyId: null },
        select: { role: true },
        take: 1,
      },
    },
  });

  // TODO: E3 — emit user.updated event
  const { companyRoles, ...rest } = updated;
  return { ...rest, role: companyRoles[0]?.role ?? null };
}

// ---------------------------------------------------------------------------
// updateUserRole
// ---------------------------------------------------------------------------

export async function updateUserRole(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
  role: UserRole,
  _ctx: RequestContext,
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true },
  });

  if (!existing || existing.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', tServer('errors:USER_NOT_FOUND'), 'errors:USER_NOT_FOUND');
  }

  // Prisma upsert doesn't support null in composite unique keys.
  // Use updateMany + conditional create inside a transaction to prevent race conditions.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.userCompanyRole.updateMany({
      where: { userId, companyId: null },
      data: { role },
    });

    if (updated.count === 0) {
      await tx.userCompanyRole.create({
        data: { userId, companyId: null, role },
      });
    }
  });

  // TODO: E3 — emit user.role.updated event
  return { userId, role };
}

// ---------------------------------------------------------------------------
// updateUserModules
// ---------------------------------------------------------------------------

export async function updateUserModules(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
  enabledModules: string[],
  ctx: RequestContext,
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true },
  });

  if (!existing || existing.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', tServer('errors:USER_NOT_FOUND'), 'errors:USER_NOT_FOUND');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      enabledModules,
      updatedBy: ctx.userId,
    },
    select: {
      ...userSelect,
      companyRoles: {
        where: { companyId: null },
        select: { role: true },
        take: 1,
      },
    },
  });

  // TODO: E3 — emit user.modules.updated event
  const { companyRoles, ...rest } = updated;
  return { ...rest, role: companyRoles[0]?.role ?? null };
}

// ---------------------------------------------------------------------------
// deactivateUser
// ---------------------------------------------------------------------------

export async function deactivateUser(
  prisma: PrismaClient,
  id: string,
  companyId: string,
  ctx: RequestContext,
) {
  // Security: prevent self-deactivation to avoid orphaning the company
  if (id === ctx.userId) {
    throw new DomainError(
      'SELF_DEACTIVATION',
      tServer('errors:SELF_DEACTIVATION'),
      undefined,
      'errors:SELF_DEACTIVATION',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });

  if (!existing || existing.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', tServer('errors:USER_NOT_FOUND'), 'errors:USER_NOT_FOUND');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const [result] = await Promise.all([
      tx.user.update({
        where: { id },
        data: {
          isActive: false,
          updatedBy: ctx.userId,
        },
        select: {
          ...userSelect,
          companyRoles: {
            where: { companyId: null },
            select: { role: true },
            take: 1,
          },
        },
      }),
      revokeAllUserTokens(tx, id),
    ]);
    return result;
  });

  // TODO: E3 — emit user.deactivated event
  const { companyRoles, ...rest } = updated;
  return { ...rest, role: companyRoles[0]?.role ?? null };
}
