import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  notificationListQuerySchema,
  notificationParamsSchema,
  notificationResponseSchema,
  notificationListResponseSchema,
  unreadCountResponseSchema,
  markAllReadResponseSchema,
} from './notification.schema.js';
import type { NotificationListQuery, NotificationParams } from './notification.schema.js';
import {
  updatePreferencesSchema,
  preferencesResponseSchema,
  updatePreferencesResponseSchema,
  resetPreferencesResponseSchema,
  getRoleDefaultsQuerySchema,
  updateRoleDefaultsSchema,
  roleDefaultsResponseSchema,
  updateRoleDefaultsResponseSchema,
} from './notification-preference.schema.js';
import type {
  UpdatePreferencesInput,
  GetRoleDefaultsQuery,
  UpdateRoleDefaultsInput,
} from './notification-preference.schema.js';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  getUnreadCount,
} from './notification.service.js';
import {
  getPreferences,
  updatePreferences,
  resetPreferences,
  getRoleDefaults,
  updateRoleDefaults,
} from './notification-preference.service.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { successEnvelope } from '../../../core/schemas/envelope.js';
import { extractRequestContext } from '../../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Notification routes plugin
//
// Route layout:
//   GET    /notifications                             — list notifications (STAFF)
//   GET    /notifications/unread-count                — get unread count (STAFF)
//   PATCH  /notifications/mark-all-read               — mark all unread as read (STAFF)
//   PATCH  /notifications/:id/read                    — mark as read (STAFF)
//   POST   /notifications/:id/dismiss                 — dismiss notification (STAFF)
//   GET    /notifications/preferences                 — get user preferences (STAFF)
//   PUT    /notifications/preferences                 — bulk upsert user preferences (STAFF)
//   DELETE /notifications/preferences/reset           — reset user preferences to defaults (STAFF)
//   GET    /notifications/preferences/role-defaults   — get role defaults (ADMIN)
//   PUT    /notifications/preferences/role-defaults   — update role defaults (ADMIN)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /notifications — list notifications (AC: #1)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: NotificationListQuery }>(
    '/notifications',
    {
      schema: {
        querystring: notificationListQuerySchema,
        response: { 200: successEnvelope(notificationListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listNotifications(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /notifications/unread-count — get unread count (AC: #1)
  // -------------------------------------------------------------------------
  fastify.get(
    '/notifications/unread-count',
    {
      schema: {
        response: { 200: successEnvelope(unreadCountResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getUnreadCount(ctx, prisma);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /notifications/mark-all-read — mark all unread as read (AC: #3)
  // -------------------------------------------------------------------------
  fastify.patch(
    '/notifications/mark-all-read',
    {
      schema: {
        response: { 200: successEnvelope(markAllReadResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await markAllAsRead(ctx, prisma);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /notifications/:id/read — mark as read (AC: #1)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: NotificationParams }>(
    '/notifications/:id/read',
    {
      schema: {
        params: notificationParamsSchema,
        response: { 200: successEnvelope(notificationResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await markAsRead(ctx, prisma, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /notifications/:id/dismiss — dismiss notification (AC: #1)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: NotificationParams }>(
    '/notifications/:id/dismiss',
    {
      schema: {
        params: notificationParamsSchema,
        response: { 200: successEnvelope(notificationResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await dismissNotification(ctx, prisma, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /notifications/preferences — get user preferences (AC: #3, #4)
  // -------------------------------------------------------------------------
  fastify.get(
    '/notifications/preferences',
    {
      schema: {
        response: { 200: successEnvelope(preferencesResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getPreferences(ctx, prisma);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /notifications/preferences — bulk upsert user preferences (AC: #3, #4)
  // -------------------------------------------------------------------------
  fastify.put<{ Body: UpdatePreferencesInput }>(
    '/notifications/preferences',
    {
      schema: {
        body: updatePreferencesSchema,
        response: { 200: successEnvelope(updatePreferencesResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updatePreferences(ctx, prisma, request.body);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /notifications/preferences/reset — reset user preferences (STAFF)
  // -------------------------------------------------------------------------
  fastify.delete(
    '/notifications/preferences/reset',
    {
      schema: {
        response: { 200: successEnvelope(resetPreferencesResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await resetPreferences(ctx, prisma);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /notifications/preferences/role-defaults — get role defaults (ADMIN)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: GetRoleDefaultsQuery }>(
    '/notifications/preferences/role-defaults',
    {
      schema: {
        querystring: getRoleDefaultsQuerySchema,
        response: { 200: successEnvelope(roleDefaultsResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getRoleDefaults(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /notifications/preferences/role-defaults — update role defaults (ADMIN)
  // -------------------------------------------------------------------------
  fastify.put<{ Body: UpdateRoleDefaultsInput }>(
    '/notifications/preferences/role-defaults',
    {
      schema: {
        body: updateRoleDefaultsSchema,
        response: { 200: successEnvelope(updateRoleDefaultsResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.ADMIN }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateRoleDefaults(ctx, prisma, request.body);
      return sendSuccess(reply, result);
    },
  );
}

export const notificationRoutesPlugin = notificationRoutes;
