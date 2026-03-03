import type { PrismaClient } from '@nexa/db';
import { UserRole, RecordLinkType } from '@nexa/db';
import type { Prisma } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateRecordLinkInput, RecordLinkListQuery } from './record-link.schema.js';
import { isValidEntityType, validateEntityExists } from '../../core/entity-registry/index.js';
import { AppError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import { hasMinimumRole, ROLE_LEVEL } from '../../core/rbac/rbac.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPrismaKnownError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

// ---------------------------------------------------------------------------
// createRecordLink (AC: #1, #7, #8)
// ---------------------------------------------------------------------------

export async function createRecordLink(
  ctx: RequestContext,
  prisma: PrismaClient,
  input: CreateRecordLinkInput,
) {
  // 1. Reject self-linking — an entity cannot link to itself
  if (
    input.sourceEntityType === input.targetEntityType &&
    input.sourceEntityId === input.targetEntityId
  ) {
    throw new AppError(
      'SELF_LINK_NOT_ALLOWED',
      'Cannot create a link from an entity to itself',
      400,
      undefined,
      'errors.recordLink.selfLinkNotAllowed',
    );
  }

  // 2. Validate source entity exists with companyId (BR-SYS-013 + BR-SYS-014)
  //    validateEntityExists already checks isValidEntityType internally
  await validateEntityExists(prisma, input.sourceEntityType, input.sourceEntityId, ctx.companyId);

  // 3. Validate target entity exists with companyId (BR-SYS-013 + BR-SYS-014)
  await validateEntityExists(prisma, input.targetEntityType, input.targetEntityId, ctx.companyId);

  // 4. Duplicate check — exact direction match (AC #7)
  //    Pre-check with findUnique + P2002 catch for clean 409.
  const existing = await prisma.recordLink.findUnique({
    where: {
      sourceEntityType_sourceEntityId_targetEntityType_targetEntityId_linkType: {
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        linkType: input.linkType as RecordLinkType,
      },
    },
  });

  if (existing) {
    throw new AppError(
      'DUPLICATE_RECORD_LINK',
      'A link with the same source, target, and type already exists',
      409,
      undefined,
      'errors.recordLink.duplicateLink',
    );
  }

  // 4b. Reverse-direction duplicate check for symmetric link types.
  //     RELATES_TO is bidirectional — A→B and B→A are the same logical relationship.
  if (input.linkType === RecordLinkType.RELATES_TO) {
    const existingReverse = await prisma.recordLink.findUnique({
      where: {
        sourceEntityType_sourceEntityId_targetEntityType_targetEntityId_linkType: {
          sourceEntityType: input.targetEntityType,
          sourceEntityId: input.targetEntityId,
          targetEntityType: input.sourceEntityType,
          targetEntityId: input.sourceEntityId,
          linkType: input.linkType,
        },
      },
    });

    if (existingReverse) {
      throw new AppError(
        'DUPLICATE_RECORD_LINK',
        'A link with the same source, target, and type already exists (reverse direction)',
        409,
        undefined,
        'errors.recordLink.duplicateLink',
      );
    }
  }

  try {
    const link = await prisma.recordLink.create({
      data: {
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        linkType: input.linkType as RecordLinkType,
        description: input.description ?? null,
        isSystemGenerated: false,
        createdBy: ctx.userId,
      },
    });

    return link;
  } catch (error) {
    // Race condition safety: if a concurrent request inserted the same link
    // between our findUnique and create, the unique constraint fires P2002.
    if (isPrismaKnownError(error, 'P2002')) {
      throw new AppError(
        'DUPLICATE_RECORD_LINK',
        'A link with the same source, target, and type already exists',
        409,
        undefined,
        'errors.recordLink.duplicateLink',
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// listRecordLinks (AC: #3, #4)
// ---------------------------------------------------------------------------

export async function listRecordLinks(
  ctx: RequestContext,
  prisma: PrismaClient,
  query: RecordLinkListQuery,
) {
  // 1. Validate entity exists with companyId (BR-SYS-013 + BR-SYS-014)
  //    validateEntityExists already checks isValidEntityType internally
  await validateEntityExists(prisma, query.entityType, query.entityId, ctx.companyId);

  // 2. Build bidirectional query (AC #3)
  const direction = query.direction ?? 'all';
  const sourceMatch: Prisma.RecordLinkWhereInput = {
    sourceEntityType: query.entityType,
    sourceEntityId: query.entityId,
  };
  const targetMatch: Prisma.RecordLinkWhereInput = {
    targetEntityType: query.entityType,
    targetEntityId: query.entityId,
  };

  let where: Prisma.RecordLinkWhereInput;
  if (direction === 'outgoing') {
    where = { ...sourceMatch };
  } else if (direction === 'incoming') {
    where = { ...targetMatch };
  } else {
    // direction = 'all' — bidirectional
    where = { OR: [sourceMatch, targetMatch] };
  }

  // 3. Optional linkType filter (AC #4)
  if (query.linkType) {
    where.linkType = query.linkType as RecordLinkType;
  }

  // 4. Query links + total in parallel
  const [rawItems, total] = await Promise.all([
    prisma.recordLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.recordLink.count({ where }),
  ]);

  // 5. Map each result to include direction indicator (AC #3)
  const items = rawItems.map((link) => {
    const isSource =
      link.sourceEntityType === query.entityType && link.sourceEntityId === query.entityId;
    return {
      ...link,
      direction: isSource ? ('outgoing' as const) : ('incoming' as const),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// deleteRecordLink (AC: #5, #6)
// ---------------------------------------------------------------------------

export async function deleteRecordLink(ctx: RequestContext, prisma: PrismaClient, linkId: string) {
  // 1. Find link by id (404 if not found)
  const link = await prisma.recordLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new NotFoundError(
      'RECORD_LINK_NOT_FOUND',
      'Record link not found',
      'errors.recordLink.notFound',
    );
  }

  // 2. Validate entity access — BOTH sides must belong to caller's companyId.
  //    If a side's model is not yet available (ENTITY_TYPE_NOT_AVAILABLE), skip that
  //    side's check. But every checkable side must pass, and at least one must be checked.
  const access = { sourceOk: false, sourceSkipped: false, targetOk: false, targetSkipped: false };

  try {
    await validateEntityExists(prisma, link.sourceEntityType, link.sourceEntityId, ctx.companyId);
    access.sourceOk = true;
  } catch (error) {
    if (error instanceof AppError && error.code === 'ENTITY_TYPE_NOT_AVAILABLE') {
      access.sourceSkipped = true;
    } else if (
      error instanceof AppError &&
      (error.code === 'ENTITY_NOT_FOUND' || error.code === 'INVALID_ENTITY_TYPE')
    ) {
      // Source entity not accessible to caller
    } else {
      throw error;
    }
  }

  try {
    await validateEntityExists(prisma, link.targetEntityType, link.targetEntityId, ctx.companyId);
    access.targetOk = true;
  } catch (error) {
    if (error instanceof AppError && error.code === 'ENTITY_TYPE_NOT_AVAILABLE') {
      access.targetSkipped = true;
    } else if (
      error instanceof AppError &&
      (error.code === 'ENTITY_NOT_FOUND' || error.code === 'INVALID_ENTITY_TYPE')
    ) {
      // Target entity not accessible to caller
    } else {
      throw error;
    }
  }

  // Every checkable side must pass; at least one side must be checkable
  const sourceDenied = !access.sourceOk && !access.sourceSkipped;
  const targetDenied = !access.targetOk && !access.targetSkipped;
  const bothSkipped = access.sourceSkipped && access.targetSkipped;

  if (sourceDenied || targetDenied || bothSkipped) {
    throw new AppError(
      'FORBIDDEN',
      'Access denied: linked entities are not accessible',
      403,
      undefined,
      'errors.recordLink.accessDenied',
    );
  }

  // 3. RBAC: system-generated links require MANAGER+ (AC #6)
  if (link.isSystemGenerated) {
    if (!(ctx.role in ROLE_LEVEL) || !hasMinimumRole(ctx.role as UserRole, UserRole.MANAGER)) {
      throw new AppError(
        'FORBIDDEN',
        'Only managers can delete system-generated links',
        403,
        undefined,
        'errors.recordLink.systemLinkDeleteForbidden',
      );
    }
  }
  // Manual links (isSystemGenerated: false) — STAFF sufficient (AC #5, enforced at route level)

  // 4. Hard-delete the RecordLink record
  //    Catch P2025 (concurrent delete between findUnique and delete) → clean 404
  try {
    await prisma.recordLink.delete({
      where: { id: linkId },
    });
  } catch (error) {
    if (isPrismaKnownError(error, 'P2025')) {
      throw new NotFoundError(
        'RECORD_LINK_NOT_FOUND',
        'Record link not found',
        'errors.recordLink.notFound',
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// createSystemLink (internal only — no RequestContext) (AC: #2)
// ---------------------------------------------------------------------------

export async function createSystemLink(
  prisma: PrismaClient,
  input: {
    sourceEntityType: string;
    sourceEntityId: string;
    targetEntityType: string;
    targetEntityId: string;
    linkType: RecordLinkType;
    description?: string;
  },
  actorId: string,
) {
  // 1. Basic input guards — callers are internal but mistakes happen
  if (!input.sourceEntityType || typeof input.sourceEntityType !== 'string') {
    throw new ValidationError(
      'sourceEntityType is required',
      undefined,
      'errors.recordLink.invalidSourceEntityType',
    );
  }
  if (!input.sourceEntityId || typeof input.sourceEntityId !== 'string') {
    throw new ValidationError(
      'sourceEntityId is required',
      undefined,
      'errors.recordLink.invalidSourceEntityId',
    );
  }
  if (!input.targetEntityType || typeof input.targetEntityType !== 'string') {
    throw new ValidationError(
      'targetEntityType is required',
      undefined,
      'errors.recordLink.invalidTargetEntityType',
    );
  }
  if (!input.targetEntityId || typeof input.targetEntityId !== 'string') {
    throw new ValidationError(
      'targetEntityId is required',
      undefined,
      'errors.recordLink.invalidTargetEntityId',
    );
  }
  if (!input.linkType || typeof input.linkType !== 'string') {
    throw new ValidationError(
      'linkType is required',
      undefined,
      'errors.recordLink.invalidLinkType',
    );
  }
  if (!actorId || typeof actorId !== 'string') {
    throw new ValidationError('actorId is required', undefined, 'errors.recordLink.invalidActorId');
  }

  // 1b. Validate entity types against registry (BR-SYS-014)
  if (!isValidEntityType(input.sourceEntityType)) {
    throw new ValidationError(
      `Invalid source entity type: ${input.sourceEntityType}`,
      undefined,
      'errors.recordLink.invalidSourceEntityType',
    );
  }
  if (!isValidEntityType(input.targetEntityType)) {
    throw new ValidationError(
      `Invalid target entity type: ${input.targetEntityType}`,
      undefined,
      'errors.recordLink.invalidTargetEntityType',
    );
  }

  // 2. Atomic upsert — return existing link if duplicate (idempotent for event handlers)
  const link = await prisma.recordLink.upsert({
    where: {
      sourceEntityType_sourceEntityId_targetEntityType_targetEntityId_linkType: {
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        linkType: input.linkType,
      },
    },
    update: {}, // No-op update — just return existing
    create: {
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      linkType: input.linkType,
      description: input.description ?? null,
      isSystemGenerated: true,
      createdBy: actorId,
    },
  });

  return link;
}
