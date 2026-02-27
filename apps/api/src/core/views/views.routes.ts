import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@nexa/db';
import type Redis from 'ioredis';
import type { Logger } from 'pino';

import {
  viewInitQuerySchema,
  savedViewsQuerySchema,
  savedViewParamsSchema,
  columnWidthParamsSchema,
  columnPrefsParamsSchema,
  lovScopeParamsSchema,
  createSavedViewSchema,
  updateSavedViewSchema,
  batchLovSchema,
  updateColumnWidthSchema,
  bulkColumnPrefsSchema,
} from './views.schemas.js';
import type {
  ViewInitQuery,
  CreateSavedViewBody,
  UpdateSavedViewBody,
  BatchLovBody,
  UpdateColumnWidthBody,
  BulkColumnPrefsBody,
} from './views.schemas.js';
import {
  ViewsService,
  toDataViewDto,
  toDataViewFieldDto,
  toDateRangePresetDto,
} from './views.service.js';
import { ViewsRepository } from './views.repository.js';
import { LovService } from './lov.service.js';
import { ViewNotFoundError } from './views.errors.js';
import { createPermissionGuard } from '../rbac/index.js';
import { sendSuccess } from '../utils/response.js';
import { extractRequestContext } from '../types/request-context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the user's access group IDs from the resolved permissions.
 * These are used as "roleIds" for saved view visibility filtering.
 */
function getRoleIds(
  request: { permissions: { accessGroups: Array<{ id: string }> } | null } | { permissions: null },
): string[] {
  return request.permissions?.accessGroups.map((ag) => ag.id) ?? [];
}

// ---------------------------------------------------------------------------
// Single LOV query schema (used only by GET /views/lov/:lovScope)
// ---------------------------------------------------------------------------

const singleLovQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ---------------------------------------------------------------------------
// Views routes plugin
// ---------------------------------------------------------------------------

function viewRoutes(fastify: FastifyInstance): void {
  const repo = new ViewsRepository(prisma);
  const redis = (fastify as unknown as { redis?: Redis }).redis;
  if (!redis) {
    throw new Error('views plugin requires redis decorator — register redis plugin before views');
  }
  const logger = fastify.log as unknown as Logger;
  const viewsService = new ViewsService(repo, redis, logger);
  const lovService = new LovService(prisma, logger);

  // =========================================================================
  // GET /views/init — Bundled init (AC: #3)
  // =========================================================================

  fastify.get<{ Querystring: ViewInitQuery }>(
    '/init',
    {
      schema: {
        querystring: viewInitQuerySchema,
      },
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const roleIds = getRoleIds(request);
      const result = await viewsService.getViewInit(
        ctx.companyId,
        ctx.userId,
        roleIds,
        request.query.viewKey,
      );
      return sendSuccess(reply, result);
    },
  );

  // =========================================================================
  // GET /views/data-views — List all data views
  // =========================================================================

  fastify.get(
    '/data-views',
    {
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const dataViews = await prisma.dataView.findMany({
        where: { companyId: ctx.companyId, isActive: true },
        orderBy: { viewName: 'asc' },
      });
      return sendSuccess(reply, dataViews.map(toDataViewDto));
    },
  );

  // =========================================================================
  // GET /views/data-views/:viewKey/fields — Get field metadata
  // =========================================================================

  fastify.get<{ Params: { viewKey: string } }>(
    '/data-views/:viewKey/fields',
    {
      schema: {
        params: z.object({ viewKey: z.string().min(1).max(50) }),
      },
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const dataView = await repo.getDataViewWithFields(ctx.companyId, request.params.viewKey);
      if (!dataView) {
        throw new ViewNotFoundError(
          `View '${request.params.viewKey}' not found`,
          'views.error.notFound',
          { viewKey: request.params.viewKey },
        );
      }
      return sendSuccess(reply, dataView.fields.map(toDataViewFieldDto));
    },
  );

  // =========================================================================
  // GET /views/date-presets — List date presets
  // =========================================================================

  fastify.get(
    '/date-presets',
    {
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const presets = await repo.getDatePresets(ctx.companyId);
      return sendSuccess(reply, presets.map(toDateRangePresetDto));
    },
  );

  // =========================================================================
  // GET /views/saved — List saved views (query: viewKey)
  // =========================================================================

  fastify.get<{ Querystring: { viewKey: string } }>(
    '/saved',
    {
      schema: {
        querystring: savedViewsQuerySchema,
      },
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const roleIds = getRoleIds(request);
      const savedViews = await viewsService.getSavedViews(
        ctx.companyId,
        ctx.userId,
        roleIds,
        request.query.viewKey,
      );
      return sendSuccess(reply, savedViews);
    },
  );

  // =========================================================================
  // POST /views/saved — Create saved view (AC: #4)
  // =========================================================================

  fastify.post<{ Body: CreateSavedViewBody }>(
    '/saved',
    {
      schema: {
        body: createSavedViewSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await viewsService.createSavedView(
        ctx.companyId,
        ctx.userId,
        ctx.role,
        request.body,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // =========================================================================
  // PATCH /views/saved/:id — Update saved view
  // =========================================================================

  fastify.patch<{ Params: { id: string }; Body: UpdateSavedViewBody }>(
    '/saved/:id',
    {
      schema: {
        params: savedViewParamsSchema,
        body: updateSavedViewSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await viewsService.updateSavedView(
        ctx.companyId,
        request.params.id,
        ctx.userId,
        ctx.role,
        request.body,
      );
      return sendSuccess(reply, result);
    },
  );

  // =========================================================================
  // DELETE /views/saved/:id — Delete saved view
  // =========================================================================

  fastify.delete<{ Params: { id: string } }>(
    '/saved/:id',
    {
      schema: {
        params: savedViewParamsSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await viewsService.deleteSavedView(ctx.companyId, request.params.id, ctx.userId, ctx.role);
      return reply.status(204).send();
    },
  );

  // =========================================================================
  // GET /views/favourites — List favourites
  // =========================================================================

  fastify.get(
    '/favourites',
    {
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const roleIds = getRoleIds(request);
      const favourites = await viewsService.getFavourites(ctx.companyId, ctx.userId, roleIds);
      return sendSuccess(reply, favourites);
    },
  );

  // =========================================================================
  // POST /views/saved/:id/set-default — Set as default
  // =========================================================================

  fastify.post<{ Params: { id: string } }>(
    '/saved/:id/set-default',
    {
      schema: {
        params: savedViewParamsSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await viewsService.setDefault(ctx.companyId, request.params.id, ctx.userId, ctx.role);
      return sendSuccess(reply, { success: true });
    },
  );

  // =========================================================================
  // POST /views/saved/:id/toggle-favourite — Toggle favourite
  // =========================================================================

  fastify.post<{ Params: { id: string } }>(
    '/saved/:id/toggle-favourite',
    {
      schema: {
        params: savedViewParamsSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const roleIds = getRoleIds(request);
      await viewsService.toggleFavourite(ctx.companyId, request.params.id, ctx.userId, roleIds);
      return sendSuccess(reply, { success: true });
    },
  );

  // =========================================================================
  // GET /views/columns/:viewKey — Get column preferences
  // =========================================================================

  fastify.get<{ Params: { viewKey: string } }>(
    '/columns/:viewKey',
    {
      schema: {
        params: columnPrefsParamsSchema,
      },
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const dataView = await repo.getDataViewWithFields(ctx.companyId, request.params.viewKey);
      if (!dataView) {
        throw new ViewNotFoundError(
          `View '${request.params.viewKey}' not found`,
          'views.error.notFound',
          { viewKey: request.params.viewKey },
        );
      }
      const fieldIds = dataView.fields.map((f) => f.id);
      const prefs = await repo.getUserColumnPreferences(ctx.userId, fieldIds);
      return sendSuccess(reply, prefs);
    },
  );

  // =========================================================================
  // PUT /views/columns/:viewKey — Bulk upsert column prefs
  // =========================================================================

  fastify.put<{ Params: { viewKey: string }; Body: BulkColumnPrefsBody }>(
    '/columns/:viewKey',
    {
      schema: {
        params: columnPrefsParamsSchema,
        body: bulkColumnPrefsSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await viewsService.saveColumnPreferences(
        ctx.userId,
        request.params.viewKey,
        ctx.companyId,
        request.body,
      );
      return sendSuccess(reply, { success: true });
    },
  );

  // =========================================================================
  // PATCH /views/columns/:viewKey/:fieldId/width — Update single width (AC: #7)
  // =========================================================================

  fastify.patch<{ Params: { viewKey: string; fieldId: string }; Body: UpdateColumnWidthBody }>(
    '/columns/:viewKey/:fieldId/width',
    {
      schema: {
        params: columnWidthParamsSchema,
        body: updateColumnWidthSchema,
      },
      preHandler: createPermissionGuard('views.list', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await viewsService.updateColumnWidth(
        ctx.companyId,
        ctx.userId,
        request.params.viewKey,
        request.params.fieldId,
        request.body.width,
      );
      return sendSuccess(reply, { success: true });
    },
  );

  // =========================================================================
  // POST /views/lov/batch — Batch LOV fetch (AC: #6)
  // =========================================================================

  fastify.post<{ Body: BatchLovBody }>(
    '/lov/batch',
    {
      schema: {
        body: batchLovSchema,
      },
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const results = await lovService.batchFetchLov(ctx.companyId, request.body.items);
      return sendSuccess(reply, { results });
    },
  );

  // =========================================================================
  // GET /views/lov/:lovScope — Single LOV fetch
  // =========================================================================

  fastify.get<{ Params: { lovScope: string }; Querystring: z.infer<typeof singleLovQuerySchema> }>(
    '/lov/:lovScope',
    {
      schema: {
        params: lovScopeParamsSchema,
        querystring: singleLovQuerySchema,
      },
      preHandler: createPermissionGuard('views.list', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const values = await lovService.fetchLovByScope(
        ctx.companyId,
        request.params.lovScope,
        request.query.search,
        request.query.limit,
      );
      return sendSuccess(reply, values);
    },
  );
}

export const viewRoutesPlugin = viewRoutes;
