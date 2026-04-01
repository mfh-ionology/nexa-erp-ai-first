import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createSimulationSchema,
  updateSimulationSchema,
  listSimulationsQuerySchema,
  simulationParamsSchema,
  simulationDetailSchema,
} from './simulations.schema.js';
import type { ListSimulationsQuery } from './simulations.schema.js';
import {
  createSimulation,
  updateSimulation,
  deleteSimulation,
  getSimulationById,
  listSimulations,
  convertSimulation,
  invalidateSimulation,
} from './simulations.service.js';
import { journalDetailSchema } from './journals.schema.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const simulationDetailEnvelope = successEnvelope(simulationDetailSchema);

// ---------------------------------------------------------------------------
// Simulation routes plugin
// ---------------------------------------------------------------------------

async function simulationsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /simulations — list
  fastify.get<{ Querystring: ListSimulationsQuery }>(
    '/simulations',
    {
      schema: { querystring: listSimulationsQuerySchema },
      preHandler: createPermissionGuard('finance.simulations', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listSimulations(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /simulations/:id — detail
  fastify.get<{ Params: { id: string } }>(
    '/simulations/:id',
    {
      schema: {
        params: simulationParamsSchema,
        response: { 200: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getSimulationById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /simulations — create
  fastify.post(
    '/simulations',
    {
      schema: {
        body: createSimulationSchema,
        response: { 201: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createSimulation(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.body as z.infer<typeof createSimulationSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /simulations/:id — update
  fastify.patch<{ Params: { id: string } }>(
    '/simulations/:id',
    {
      schema: {
        params: simulationParamsSchema,
        body: updateSimulationSchema,
        response: { 200: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await updateSimulation(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          request.body as z.infer<typeof updateSimulationSchema>,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_NOT_ACTIVE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // DELETE /simulations/:id — hard delete
  fastify.delete<{ Params: { id: string } }>(
    '/simulations/:id',
    {
      schema: { params: simulationParamsSchema },
      preHandler: createPermissionGuard('finance.simulations', 'delete'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        await deleteSimulation(prisma, ctx.companyId, request.params.id);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_TRANSFERRED') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /simulations/:id/convert — convert to journal entry
  const journalDetailEnvelope = successEnvelope(journalDetailSchema);

  fastify.post<{ Params: { id: string } }>(
    '/simulations/:id/convert',
    {
      schema: {
        params: simulationParamsSchema,
        response: { 200: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await convertSimulation(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_NOT_ACTIVE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /simulations/:id/invalidate — mark as invalid
  fastify.post<{ Params: { id: string } }>(
    '/simulations/:id/invalidate',
    {
      schema: {
        params: simulationParamsSchema,
        response: { 200: simulationDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.simulations', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await invalidateSimulation(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'SIMULATION_NOT_ACTIVE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const simulationsRoutesPlugin = simulationsRoutes;
