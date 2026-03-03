import type { FastifyInstance } from 'fastify';
import { prisma, UserRole } from '@nexa/db';

import {
  createNoteSchema,
  updateNoteSchema,
  noteListQuerySchema,
  noteParamsSchema,
  noteResponseSchema,
  noteListResponseSchema,
} from './note.schema.js';
import type { CreateNoteInput, UpdateNoteInput, NoteListQuery, NoteParams } from './note.schema.js';
import { createNote, listNotes, updateNote, deleteNote, pinNote } from './note.service.js';
import { createRbacGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Note CRUD routes plugin
//
// Route layout:
//   POST   /notes            — create note (STAFF)
//   GET    /notes            — list notes for entity (VIEWER)
//   PATCH  /notes/:id        — update note (STAFF)
//   DELETE /notes/:id        — soft-delete note (MANAGER)
//   PATCH  /notes/:id/pin    — toggle pin (STAFF)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function noteRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /notes — create note (AC: #1, #4)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateNoteInput }>(
    '/notes',
    {
      schema: {
        body: createNoteSchema,
        response: { 201: successEnvelope(noteResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createNote(ctx, prisma, request.body);
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // GET /notes — list notes for entity (AC: #5)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: NoteListQuery }>(
    '/notes',
    {
      schema: {
        querystring: noteListQuerySchema,
        response: { 200: successEnvelope(noteListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await listNotes(ctx, prisma, request.query);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /notes/:id — update note (AC: #6)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: NoteParams; Body: UpdateNoteInput }>(
    '/notes/:id',
    {
      schema: {
        params: noteParamsSchema,
        body: updateNoteSchema,
        response: { 200: successEnvelope(noteResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await updateNote(ctx, prisma, request.params.id, request.body);
      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /notes/:id — soft-delete note (AC: #7)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: NoteParams }>(
    '/notes/:id',
    {
      schema: {
        params: noteParamsSchema,
        response: { 200: successEnvelope(noteParamsSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.MANAGER }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      await deleteNote(ctx, prisma, request.params.id);
      return sendSuccess(reply, { id: request.params.id });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /notes/:id/pin — toggle pin (AC: #8)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: NoteParams }>(
    '/notes/:id/pin',
    {
      schema: {
        params: noteParamsSchema,
        response: { 200: successEnvelope(noteResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.STAFF }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await pinNote(ctx, prisma, request.params.id);
      return sendSuccess(reply, result);
    },
  );
}

export const noteRoutesPlugin = noteRoutes;
