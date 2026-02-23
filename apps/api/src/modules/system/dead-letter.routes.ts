import type { FastifyInstance } from 'fastify';

import type { BusinessEvents } from '../../core/events/event-bus.types.js';
import {
  deadLetterParamsSchema,
  deadLetterQuerySchema,
  reprocessResponseSchema,
  deadLetterListResponseSchema,
} from './dead-letter.schema.js';
import type { DeadLetterQuery } from './dead-letter.schema.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { AppError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Dead-letter queue query & reprocess routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function deadLetterRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /dead-letter-queue — filtered, paginated dead-letter queue entries
  fastify.get<{ Querystring: DeadLetterQuery }>(
    '/dead-letter-queue',
    {
      schema: {
        querystring: deadLetterQuerySchema,
        response: { 200: deadLetterListResponseSchema },
      },
      preHandler: createPermissionGuard('system.dead-letter-queue.list', 'view'),
    },
    async (request, reply) => {
      if (!request.server.deadLetterService) {
        throw new AppError('SERVICE_UNAVAILABLE', 'Dead-letter queue is unavailable (Redis not connected)', 503);
      }

      const { eventName, reprocessed, cursor, limit } = request.query;

      const result = await request.server.deadLetterService.list({
        eventName,
        reprocessed,
        cursor,
        limit,
      });

      return sendSuccess(reply, result.items, {
        cursor: result.cursor,
        hasMore: result.hasMore,
      });
    },
  );

  // POST /dead-letter-queue/:id/reprocess — re-emit event from DLQ
  fastify.post<{ Params: { id: string } }>(
    '/dead-letter-queue/:id/reprocess',
    {
      schema: {
        params: deadLetterParamsSchema,
        response: { 200: reprocessResponseSchema },
      },
      // Story spec says 'manage' (Task 9.3) but 'manage' is not a valid action
      // in ACTION_FLAG_MAP (valid: new, view, edit, delete). Using 'edit' since
      // reprocessing modifies the DLQ entry state. company-defaults.json grants
      // canEdit: true for FULL_ACCESS, consistent with this choice.
      preHandler: createPermissionGuard('system.dead-letter-queue.list', 'edit'),
    },
    async (request, reply) => {
      if (!request.server.deadLetterService) {
        throw new AppError('SERVICE_UNAVAILABLE', 'Dead-letter queue is unavailable (Redis not connected)', 503);
      }

      const { id } = request.params;

      const entry = await request.server.deadLetterService.getById(id);

      if (!entry) {
        throw new AppError('NOT_FOUND', 'Dead-letter entry not found', 404);
      }

      if (entry.reprocessed) {
        throw new AppError('CONFLICT', 'Dead-letter entry has already been reprocessed', 409);
      }

      // Re-emit through the event bus. The cast from string → keyof BusinessEvents
      // is acceptable since DLQ only stores events that were previously type-checked
      // at original emission time. If the event type was removed from BusinessEvents
      // in a code update, this emit fires with zero handlers (no error, no effect).
      request.server.log.info(
        `[DLQ] Reprocessing event "${entry.eventName}" (DLQ entry ${id})`,
      );
      request.server.eventBus.emit(
        entry.eventName as keyof BusinessEvents,
        entry.payload as BusinessEvents[keyof BusinessEvents],
      );

      // Mark as reprocessed immediately after re-emitting. We do NOT call
      // drain() here because: (1) drain() blocks on ALL pending events across
      // the entire event bus, not just this one — causing multi-second request
      // latency under load; (2) "reprocessed" means "re-submitted to event bus",
      // not "handlers succeeded"; (3) if the re-emitted event fails again, the
      // retry mechanism creates a NEW DLQ entry separately.
      await request.server.deadLetterService.markReprocessed(id);

      return sendSuccess(reply, { id, reprocessed: true as const });
    },
  );
}

export const deadLetterRoutesPlugin = deadLetterRoutes;
