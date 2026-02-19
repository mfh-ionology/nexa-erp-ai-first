import type { PrismaClient } from '@nexa/db';
import type { UserRole } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateUserRequest, UserListQuery } from './user.schema.js';
import { hashPassword } from '../../core/auth/auth.service.js';
import { revokeAllUserTokens } from '../../core/auth/auth.service.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

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
      throw new AppError('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

export async function listUsers(prisma: PrismaClient, companyId: string, query: UserListQuery) {
  const { cursor, limit, sort, order, search, isActive } = query;

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

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { [sort]: order },
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
    throw new NotFoundError('NOT_FOUND', 'User not found');
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
  data: { firstName?: string; lastName?: string },
  ctx: RequestContext,
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });

  if (!existing || existing.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', 'User not found');
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
    throw new NotFoundError('NOT_FOUND', 'User not found');
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
    throw new NotFoundError('NOT_FOUND', 'User not found');
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
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });

  if (!existing || existing.companyId !== companyId) {
    throw new NotFoundError('NOT_FOUND', 'User not found');
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
      // revokeAllUserTokens expects PrismaClient but tx is TransactionClient.
      // Safe: it only uses refreshToken.updateMany which exists on both types.
      revokeAllUserTokens(tx as unknown as PrismaClient, id),
    ]);
    return result;
  });

  // TODO: E3 — emit user.deactivated event
  const { companyRoles, ...rest } = updated;
  return { ...rest, role: companyRoles[0]?.role ?? null };
}
