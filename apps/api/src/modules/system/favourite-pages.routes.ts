// ---------------------------------------------------------------------------
// Favourite Pages Routes — Nav Redesign Task 3
// GET    /favourite-pages           — list all favourite pages for current user
// POST   /favourite-pages           — add a favourite page pin
// DELETE /favourite-pages/:id       — remove a favourite page pin by ID
// POST   /favourite-pages/unpin-by-path — remove a favourite page pin by path
// PUT    /favourite-pages/reorder   — reorder favourite page pins
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import {
  listFavouritePages,
  createFavouritePage,
  deleteFavouritePage,
  deleteFavouritePageByPath,
  reorderFavouritePages,
} from './favourite-pages.service.js';
import {
  favouritePageResponseSchema,
  createFavouritePageBodySchema,
  deleteFavouritePageParamsSchema,
  unpinByPathBodySchema,
  reorderFavouritePagesBodySchema,
} from './favourite-pages.schema.js';
import type {
  CreateFavouritePageBody,
  DeleteFavouritePageParams,
  UnpinByPathBody,
  ReorderFavouritePagesBody,
} from './favourite-pages.schema.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function favouritePagesRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /favourite-pages — list all favourite pages for current user
  // -------------------------------------------------------------------------
  fastify.get(
    '/',
    {
      schema: {
        response: { 200: successEnvelope(z.array(favouritePageResponseSchema)) },
      },
    },
    async (request, reply) => {
      const pages = await listFavouritePages(
        prisma,
        request.userId,
        request.companyId,
        request.enabledModules,
      );
      return sendSuccess(reply, pages);
    },
  );

  // -------------------------------------------------------------------------
  // POST /favourite-pages — add a favourite page pin
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateFavouritePageBody }>(
    '/',
    {
      schema: {
        body: createFavouritePageBodySchema,
        response: { 201: successEnvelope(favouritePageResponseSchema) },
      },
    },
    async (request, reply) => {
      const page = await createFavouritePage(prisma, request.userId, request.companyId, {
        path: request.body.path,
        label: request.body.label,
        iconKey: request.body.iconKey,
      });
      return sendSuccess(reply, page, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /favourite-pages/:id — remove a favourite page pin by ID
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: DeleteFavouritePageParams }>(
    '/:id',
    {
      schema: {
        params: deleteFavouritePageParamsSchema,
      },
    },
    async (request, reply) => {
      await deleteFavouritePage(prisma, request.userId, request.companyId, request.params.id);
      return sendSuccess(reply, null, undefined, 204);
    },
  );

  // -------------------------------------------------------------------------
  // POST /favourite-pages/unpin-by-path — remove a favourite page by path
  // -------------------------------------------------------------------------
  fastify.post<{ Body: UnpinByPathBody }>(
    '/unpin-by-path',
    {
      schema: {
        body: unpinByPathBodySchema,
      },
    },
    async (request, reply) => {
      await deleteFavouritePageByPath(prisma, request.userId, request.companyId, request.body.path);
      return sendSuccess(reply, null, undefined, 204);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /favourite-pages/reorder — reorder favourite page pins
  // -------------------------------------------------------------------------
  fastify.put<{ Body: ReorderFavouritePagesBody }>(
    '/reorder',
    {
      schema: {
        body: reorderFavouritePagesBodySchema,
        response: { 200: successEnvelope(z.object({ success: z.literal(true) })) },
      },
    },
    async (request, reply) => {
      await reorderFavouritePages(prisma, request.userId, request.companyId, {
        orderedIds: request.body.orderedIds,
      });
      return sendSuccess(reply, { success: true as const });
    },
  );
}

export const favouritePagesRoutesPlugin = favouritePagesRoutes;
