import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getPlatformPrisma } from '../../client.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { hashPassword } from '../../core/auth/platform-auth.service.js';
import { AppError, NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';

import {
  createUserRequestSchema,
  updateUserRequestSchema,
  userIdParamsSchema,
  listUsersQuerySchema,
  listUsersResponseSchema,
  singleUserResponseSchema,
  type CreateUserRequest,
  type UpdateUserRequest,
} from './users.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------
// Design decision: No DELETE endpoint is provided. Platform users are
// soft-deleted via PATCH { isActive: false }. This preserves audit trail
// integrity (BR-PLT-016) and referential integrity for platform_audit_log
// records. Hard-delete would orphan audit entries and violate NFR49.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function userRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();
  const adminOnly = requirePlatformRole('PLATFORM_ADMIN');

  // -------------------------------------------------------------------------
  // GET /admin/users — list platform admin accounts
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/users',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: listUsersQuerySchema,
        response: { 200: successEnvelope(listUsersResponseSchema) },
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query as { limit: number; offset: number };

      const [users, total] = await Promise.all([
        prisma.platformUser.findMany({
          orderBy: { createdAt: 'asc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            mfaEnabled: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        }),
        prisma.platformUser.count(),
      ]);

      return sendSuccess(reply, users.map(formatUser), {
        total,
        hasMore: offset + users.length < total,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/users — create platform admin account
  // -------------------------------------------------------------------------
  fastify.post(
    '/admin/users',
    {
      preHandler: [adminOnly],
      schema: {
        body: createUserRequestSchema,
        response: { 201: successEnvelope(singleUserResponseSchema) },
      },
      // No config.audit here — we log explicitly below to capture the new user's ID
    },
    async (request, reply) => {
      const { email, password, displayName, role } = request.body as CreateUserRequest;

      // Check email uniqueness
      const existing = await prisma.platformUser.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        throw new AppError('CONFLICT', 'A user with this email already exists', 409);
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.platformUser.create({
        data: {
          email,
          passwordHash,
          displayName,
          role,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          mfaEnabled: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      // Explicit audit log with the newly created user's ID (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'platform_user.create',
          targetType: 'platform_user',
          targetId: user.id,
          details: { email: user.email, role: user.role },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        // Audit failures must not break operations (BR-PLT-017)
      }

      return sendSuccess(reply, formatUser(user), undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/users/:id — update platform admin account
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/admin/users/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: userIdParamsSchema,
        body: updateUserRequestSchema,
        response: { 200: successEnvelope(singleUserResponseSchema) },
      },
      config: {
        audit: { action: 'platform_user.update', targetType: 'platform_user' },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as UpdateUserRequest;

      // Cannot deactivate own account
      if (body.isActive === false && id === request.platformUserId) {
        throw new AppError(
          'SELF_DEACTIVATION',
          'Cannot deactivate your own account',
          400,
        );
      }

      // Verify the target user exists
      const existingUser = await prisma.platformUser.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingUser) {
        throw new NotFoundError('USER_NOT_FOUND', 'Platform user not found');
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (body.role !== undefined) updateData.role = body.role;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.displayName !== undefined) updateData.displayName = body.displayName;
      if (body.mfaReset === true) {
        updateData.mfaEnabled = false;
        updateData.mfaSecret = null;
      }

      const user = await prisma.platformUser.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          mfaEnabled: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      return sendSuccess(reply, formatUser(user));
    },
  );
}

export const userRoutesPlugin = fp(userRoutes, {
  name: 'platform-user-routes',
  dependencies: ['platform-jwt-verify'],
});
