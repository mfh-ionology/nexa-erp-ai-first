import type { PrismaClient } from '@nexa/db';
import { UserRole } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateNoteInput, UpdateNoteInput, NoteListQuery } from './note.schema.js';
import { validateEntityExists } from '../../core/entity-registry/index.js';
import { AppError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import { hasMinimumRole, ROLE_LEVEL } from '../../core/rbac/rbac.types.js';

// ---------------------------------------------------------------------------
// createNote (AC: #1, #4)
// ---------------------------------------------------------------------------

export async function createNote(
  ctx: RequestContext,
  prisma: PrismaClient,
  input: CreateNoteInput,
) {
  // 1. Validate entityType against registry (BR-SYS-014) and entity exists (BR-SYS-013)
  await validateEntityExists(prisma, input.entityType, input.entityId, ctx.companyId);

  // 2. Reject SYSTEM noteType — only createSystemNote() may create SYSTEM notes (AC #4)
  //    Defense-in-depth: Zod schema already excludes SYSTEM, but guard against bypass
  if ((input.noteType as string) === 'SYSTEM') {
    throw new ValidationError(
      'SYSTEM notes cannot be created via the API',
      undefined,
      'errors.note.systemNoteCreateForbidden',
    );
  }

  // 3. Create Note record
  const note = await prisma.note.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      noteType: input.noteType,
      content: input.content,
      title: input.title ?? null,
      classification: input.classification ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  return note;
}

// ---------------------------------------------------------------------------
// listNotes (AC: #5)
// ---------------------------------------------------------------------------

export async function listNotes(ctx: RequestContext, prisma: PrismaClient, query: NoteListQuery) {
  // 1. Validate entity exists with companyId (BR-SYS-013)
  await validateEntityExists(prisma, query.entityType, query.entityId, ctx.companyId);

  // 2. Build where clause
  const where = {
    entityType: query.entityType,
    entityId: query.entityId,
    deletedAt: null,
    ...(query.noteType ? { noteType: query.noteType } : {}),
  };

  // 3. Query notes + total in parallel (pinned first, then newest)
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [items, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.note.count({ where }),
  ]);

  return { items, total };
}

// ---------------------------------------------------------------------------
// updateNote (AC: #6)
// ---------------------------------------------------------------------------

export async function updateNote(
  ctx: RequestContext,
  prisma: PrismaClient,
  noteId: string,
  input: UpdateNoteInput,
) {
  // Defense-in-depth: Zod .refine() may not serialize through Fastify's JSON schema compiler
  if (
    input.content === undefined &&
    input.title === undefined &&
    input.classification === undefined
  ) {
    throw new ValidationError(
      'At least one field (content, title, or classification) is required',
      undefined,
      'errors.note.emptyUpdate',
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Find note by id (404 if not found or soft-deleted)
    const note = await tx.note.findFirst({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new NotFoundError('NOTE_NOT_FOUND', 'Note not found', 'errors.note.notFound');
    }

    // 2. Reject if SYSTEM note — always read-only (AC #6)
    if (note.noteType === 'SYSTEM') {
      throw new ValidationError(
        'SYSTEM notes are read-only',
        undefined,
        'errors.note.systemNoteReadOnly',
      );
    }

    // 3. Enforce ownership: only creator can edit, unless caller has MANAGER+ role (AC #6)
    if (note.createdBy !== ctx.userId) {
      if (!(ctx.role in ROLE_LEVEL)) {
        throw new AppError(
          'FORBIDDEN',
          'Invalid user role',
          403,
          undefined,
          'errors.auth.invalidRole',
        );
      }
      if (!hasMinimumRole(ctx.role as UserRole, UserRole.MANAGER)) {
        throw new AppError(
          'FORBIDDEN',
          'Only the note creator or a manager can edit this note',
          403,
          undefined,
          'errors.note.notOwner',
        );
      }
    }

    // 4. Validate entity access (entity must belong to caller's companyId)
    await validateEntityExists(tx, note.entityType, note.entityId, ctx.companyId);

    // 5. Update note fields
    return tx.note.update({
      where: { id: noteId },
      data: {
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.classification !== undefined ? { classification: input.classification } : {}),
        updatedBy: ctx.userId,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// deleteNote (AC: #7)
// ---------------------------------------------------------------------------

export async function deleteNote(ctx: RequestContext, prisma: PrismaClient, noteId: string) {
  // Defense-in-depth: route guard also enforces MANAGER, but check here too
  // in case this function is called from another service
  if (!(ctx.role in ROLE_LEVEL) || !hasMinimumRole(ctx.role as UserRole, UserRole.MANAGER)) {
    throw new AppError(
      'FORBIDDEN',
      'Only managers can delete notes',
      403,
      undefined,
      'errors.note.deleteRequiresManager',
    );
  }

  await prisma.$transaction(async (tx) => {
    // 1. Find note by id (404 if not found or already soft-deleted)
    const note = await tx.note.findFirst({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new NotFoundError('NOTE_NOT_FOUND', 'Note not found', 'errors.note.notFound');
    }

    // 2. Reject if SYSTEM note — SYSTEM notes cannot be deleted
    if (note.noteType === 'SYSTEM') {
      throw new ValidationError(
        'SYSTEM notes cannot be deleted',
        undefined,
        'errors.note.systemNoteReadOnly',
      );
    }

    // 3. Validate entity access (companyId scope)
    await validateEntityExists(tx, note.entityType, note.entityId, ctx.companyId);

    // 4. Soft-delete: set deletedAt + updatedBy (AC #7)
    await tx.note.update({
      where: { id: noteId },
      data: {
        deletedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// pinNote (AC: #8)
// ---------------------------------------------------------------------------

export async function pinNote(ctx: RequestContext, prisma: PrismaClient, noteId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Find note by id (404 if not found or soft-deleted)
    const note = await tx.note.findFirst({
      where: { id: noteId, deletedAt: null },
    });

    if (!note) {
      throw new NotFoundError('NOTE_NOT_FOUND', 'Note not found', 'errors.note.notFound');
    }

    // 2. Validate entity access (companyId scope)
    await validateEntityExists(tx, note.entityType, note.entityId, ctx.companyId);

    // 3. Toggle isPinned (AC #8)
    return tx.note.update({
      where: { id: noteId },
      data: {
        isPinned: !note.isPinned,
        updatedBy: ctx.userId,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// createSystemNote (internal only — no RequestContext)
// ---------------------------------------------------------------------------

export async function createSystemNote(
  prisma: PrismaClient,
  entityType: string,
  entityId: string,
  content: string,
  systemUserId: string,
) {
  // Basic input guards — callers are internal but mistakes happen
  if (!entityType || typeof entityType !== 'string') {
    throw new ValidationError('entityType is required', undefined, 'errors.note.invalidEntityType');
  }
  if (!entityId || typeof entityId !== 'string') {
    throw new ValidationError('entityId is required', undefined, 'errors.note.invalidEntityId');
  }
  if (!content || typeof content !== 'string') {
    throw new ValidationError('content is required', undefined, 'errors.note.emptyContent');
  }
  if (!systemUserId || typeof systemUserId !== 'string') {
    throw new ValidationError(
      'systemUserId is required',
      undefined,
      'errors.note.invalidSystemUser',
    );
  }

  const note = await prisma.note.create({
    data: {
      entityType,
      entityId,
      noteType: 'SYSTEM',
      content,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    },
  });

  return note;
}
