import { randomUUID } from 'node:crypto';

import pino from 'pino';
import type { PrismaClient } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type { PresignRequest, ConfirmRequest } from './attachment.schema.js';
import { validateEntityExists } from '../../core/entity-registry/index.js';
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  headObject,
  deleteObject,
  getDefaultBucket,
} from '../../core/storage/index.js';
import { isAllowedMimeType, isBlockedExtension } from './mime-allowlist.js';
import { AppError, NotFoundError, ValidationError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const log = pino({ name: 'attachment-service' });

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (BR-SYS-006)
const DEFAULT_DOWNLOAD_EXPIRY = 60 * 60; // 60 minutes per Architecture §2.20
const DEFAULT_LIST_LIMIT = 100;
const MAX_FILE_SIZE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FILE_SIZE_CACHE_MAX_ENTRIES = 500; // cap to prevent unbounded growth

// ---------------------------------------------------------------------------
// File-name sanitisation (FIX #3 — strip path separators and control chars)
// ---------------------------------------------------------------------------

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\]/g, '_') // path separators → underscores
    .replace(/[\x00-\x1f\x7f]/g, ''); // strip control characters
}

// ---------------------------------------------------------------------------
// Max file size cache (FIX #9 — avoid DB query on every presign)
// ---------------------------------------------------------------------------

const maxFileSizeCache = new Map<string, { value: number; expiresAt: number }>();

/** Exported for testing only — clears the in-memory max file size cache. */
export function _clearMaxFileSizeCache(): void {
  maxFileSizeCache.clear();
}

async function getMaxFileSize(prisma: PrismaClient, companyId: string): Promise<number> {
  const cached = maxFileSizeCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const setting = await prisma.systemSetting.findFirst({
    where: { companyId, key: 'attachment.maxFileSize' },
    select: { value: true },
  });

  let result = DEFAULT_MAX_FILE_SIZE;
  if (setting?.value) {
    const parsed = parseInt(setting.value, 10);
    if (!isNaN(parsed) && parsed > 0) result = parsed;
  }

  // Evict expired entries and enforce size cap before inserting
  if (maxFileSizeCache.size >= MAX_FILE_SIZE_CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of maxFileSizeCache) {
      if (entry.expiresAt <= now) maxFileSizeCache.delete(key);
    }
    // If still over cap after purging expired, drop oldest entries (Map iterates in insertion order)
    if (maxFileSizeCache.size >= MAX_FILE_SIZE_CACHE_MAX_ENTRIES) {
      const toDelete = maxFileSizeCache.size - MAX_FILE_SIZE_CACHE_MAX_ENTRIES + 1;
      let deleted = 0;
      for (const key of maxFileSizeCache.keys()) {
        if (deleted >= toDelete) break;
        maxFileSizeCache.delete(key);
        deleted++;
      }
    }
  }

  maxFileSizeCache.set(companyId, {
    value: result,
    expiresAt: Date.now() + MAX_FILE_SIZE_CACHE_TTL_MS,
  });

  return result;
}

// ---------------------------------------------------------------------------
// presignUpload (AC: #1, #2, #5)
// ---------------------------------------------------------------------------

export async function presignUpload(
  prisma: PrismaClient,
  ctx: RequestContext,
  input: PresignRequest,
) {
  // 1. Validate MIME type against allowlist (BR-SYS-007)
  if (!isAllowedMimeType(input.mimeType)) {
    throw new ValidationError(
      `MIME type not allowed: ${input.mimeType}`,
      undefined,
      'errors.attachment.mimeTypeNotAllowed',
      { mimeType: input.mimeType },
    );
  }

  // 2. Validate file extension is not blocked (AC #5 — executables)
  if (isBlockedExtension(input.fileName)) {
    throw new ValidationError(
      `File type not allowed: ${input.fileName}`,
      undefined,
      'errors.attachment.fileTypeBlocked',
      { fileName: input.fileName },
    );
  }

  // 3. Validate file size against max (BR-SYS-006)
  const maxFileSize = await getMaxFileSize(prisma, ctx.companyId);
  if (input.fileSize > maxFileSize) {
    throw new ValidationError(
      `File size ${input.fileSize} exceeds maximum ${maxFileSize}`,
      undefined,
      'errors.attachment.fileTooLarge',
      { fileSize: String(input.fileSize), maxFileSize: String(maxFileSize) },
    );
  }

  // 4. Validate entity type against registry (BR-SYS-014) and entity exists (BR-SYS-009)
  await validateEntityExists(prisma, input.entityType, input.entityId, ctx.companyId);

  // 5. Generate storage key: "{tenantId}/{entityType}/{entityId}/{uuid}-{sanitizedFileName}"
  //    FIX #3 — sanitize fileName to prevent path separator injection
  const bucket = getDefaultBucket();
  const safeFileName = sanitizeFileName(input.fileName);
  const storageKey = `${ctx.tenantId}/${input.entityType}/${input.entityId}/${randomUUID()}-${safeFileName}`;

  // 6. Generate presigned PUT URL (BR-SYS-008)
  const { url, expiresIn } = await generatePresignedPutUrl(
    bucket,
    storageKey,
    input.mimeType,
    input.fileSize,
  );

  return { uploadUrl: url, storageKey, bucket, expiresIn };
}

// ---------------------------------------------------------------------------
// confirmUpload (AC: #3)
// ---------------------------------------------------------------------------

export async function confirmUpload(
  prisma: PrismaClient,
  ctx: RequestContext,
  input: ConfirmRequest,
) {
  // 1. Validate entity exists with companyId
  await validateEntityExists(prisma, input.entityType, input.entityId, ctx.companyId);

  // 2. Re-validate MIME type and extension (defense-in-depth — presign may have been bypassed)
  if (!isAllowedMimeType(input.mimeType)) {
    throw new ValidationError(
      `MIME type not allowed: ${input.mimeType}`,
      undefined,
      'errors.attachment.mimeTypeNotAllowed',
      { mimeType: input.mimeType },
    );
  }
  if (isBlockedExtension(input.fileName)) {
    throw new ValidationError(
      `File type not allowed: ${input.fileName}`,
      undefined,
      'errors.attachment.fileTypeBlocked',
      { fileName: input.fileName },
    );
  }

  // 3. Validate storageKey matches tenant, entityType, and entityId
  const bucket = getDefaultBucket();
  const expectedPrefix = `${ctx.tenantId}/${input.entityType}/${input.entityId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    throw new ValidationError(
      'Storage key does not match the current tenant and entity',
      undefined,
      'errors.attachment.invalidStorageKey',
    );
  }

  // 4. Verify object exists in S3 and metadata matches client claims
  //    NOTE: TOCTOU race window — the S3 object could be deleted between this HEAD
  //    check and the DB create below. The duplicate storageKey check (step 5) and
  //    the orphan sweep job mitigate the impact. A true fix would require S3 event
  //    notifications or a two-phase commit, which is P1 scope.
  const objectMeta = await headObject(bucket, input.storageKey);
  if (!objectMeta) {
    throw new AppError(
      'OBJECT_NOT_FOUND',
      'Upload not found in storage — file may not have been uploaded yet',
      400,
      undefined,
      'errors.attachment.objectNotFound',
    );
  }

  // Verify uploaded file size matches client-provided value
  if (objectMeta.contentLength !== input.fileSize) {
    throw new ValidationError(
      `File size mismatch: expected ${input.fileSize}, got ${objectMeta.contentLength}`,
      undefined,
      'errors.attachment.fileSizeMismatch',
      { expected: String(input.fileSize), actual: String(objectMeta.contentLength) },
    );
  }

  // Verify MIME type matches (compare base type, strip parameters)
  const actualMime = objectMeta.contentType.split(';')[0]!.trim().toLowerCase();
  const expectedMime = input.mimeType.split(';')[0]!.trim().toLowerCase();
  if (actualMime !== expectedMime) {
    throw new ValidationError(
      `MIME type mismatch: expected ${input.mimeType}, got ${objectMeta.contentType}`,
      undefined,
      'errors.attachment.mimeTypeMismatch',
      { expected: input.mimeType, actual: objectMeta.contentType },
    );
  }

  // 5. Reject duplicate storageKey (prevent double-confirm creating orphan records)
  const existing = await prisma.attachment.findFirst({
    where: { storageKey: input.storageKey },
    select: { id: true },
  });
  if (existing) {
    throw new ValidationError(
      'This file has already been confirmed',
      undefined,
      'errors.attachment.alreadyConfirmed',
    );
  }

  // 6. Create Attachment row in DB
  const attachment = await prisma.attachment.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      storageBucket: bucket,
      description: input.description ?? null,
      uploadedBy: ctx.userId,
    },
  });

  return attachment;
}

// ---------------------------------------------------------------------------
// getDownloadUrl (AC: #4)
// ---------------------------------------------------------------------------

export async function getDownloadUrl(
  prisma: PrismaClient,
  ctx: RequestContext,
  attachmentId: string,
) {
  // 1. Find Attachment by id
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    throw new NotFoundError('NOT_FOUND', 'Attachment not found', 'errors.attachment.notFound');
  }

  // 2. Verify caller has access to parent entity (companyId check)
  await validateEntityExists(prisma, attachment.entityType, attachment.entityId, ctx.companyId);

  // 3. Generate presigned GET URL (configurable expiry, default 60 min)
  //    FIX #7 — include Content-Disposition to force browser download
  const { url } = await generatePresignedGetUrl(
    attachment.storageBucket,
    attachment.storageKey,
    DEFAULT_DOWNLOAD_EXPIRY,
    attachment.fileName,
  );

  return {
    downloadUrl: url,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
  };
}

// ---------------------------------------------------------------------------
// deleteAttachment (AC: #6)
// ---------------------------------------------------------------------------

export async function deleteAttachment(
  prisma: PrismaClient,
  ctx: RequestContext,
  attachmentId: string,
) {
  // 1. Find Attachment by id
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    throw new NotFoundError('NOT_FOUND', 'Attachment not found', 'errors.attachment.notFound');
  }

  // 2. Verify caller has access to parent entity
  await validateEntityExists(prisma, attachment.entityType, attachment.entityId, ctx.companyId);

  // 3. Delete DB record
  await prisma.attachment.delete({ where: { id: attachmentId } });

  // 4. Delete S3 object — async, non-blocking (swallow errors, log warning)
  deleteObject(attachment.storageBucket, attachment.storageKey).catch((err: unknown) => {
    log.warn(
      { err, storageKey: attachment.storageKey, storageBucket: attachment.storageBucket },
      'Failed to delete S3 object — will be cleaned up by orphan sweep',
    );
  });
}

// ---------------------------------------------------------------------------
// listAttachments (AC: #7)
// ---------------------------------------------------------------------------

export async function listAttachments(
  prisma: PrismaClient,
  ctx: RequestContext,
  entityType: string,
  entityId: string,
  limit: number = DEFAULT_LIST_LIMIT,
  offset: number = 0,
) {
  // 1. Validate entity exists with companyId
  await validateEntityExists(prisma, entityType, entityId, ctx.companyId);

  const where = { entityType, entityId };

  // 2. Query attachments and total count in parallel
  const [attachments, total] = await Promise.all([
    prisma.attachment.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.attachment.count({ where }),
  ]);

  return { items: attachments, total };
}
