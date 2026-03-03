import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../core/types/request-context.js';
import type { PresignRequest, ConfirmRequest } from './attachment.schema.js';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
// ---------------------------------------------------------------------------

vi.mock('../../core/entity-registry/index.js', () => ({
  validateEntityExists: vi.fn(),
}));

vi.mock('../../core/storage/index.js', () => ({
  generatePresignedPutUrl: vi.fn(),
  generatePresignedGetUrl: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
  getDefaultBucket: vi.fn().mockReturnValue('test-bucket'),
}));

// Import after mocks are set up
import { validateEntityExists } from '../../core/entity-registry/index.js';
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  headObject,
  deleteObject,
} from '../../core/storage/index.js';
import { AppError } from '../../core/errors/app-error.js';
import { ValidationError } from '../../core/errors/validation-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';

import {
  presignUpload,
  confirmUpload,
  getDownloadUrl,
  deleteAttachment,
  listAttachments,
  _clearMaxFileSizeCache,
} from './attachment.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockCtx: RequestContext = {
  userId: 'user-001',
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'STAFF',
  enabledModules: [],
};

const FIFTY_MB = 50 * 1024 * 1024;

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    systemSetting: { findFirst: vi.fn().mockResolvedValue(null) },
    attachment: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn(),
    },
    ...overrides,
  } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presignUpload', () => {
  beforeEach(() => {
    _clearMaxFileSizeCache();
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(generatePresignedPutUrl).mockResolvedValue({
      url: 'https://s3.example.com/presigned-put',
      expiresIn: 900,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validInput: PresignRequest = {
    entityType: 'Customer',
    entityId: '550e8400-e29b-41d4-a716-446655440000',
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
  };

  it('returns presigned URL, storage key, bucket, and expiry for valid input', async () => {
    const prisma = mockPrisma();
    const result = await presignUpload(prisma, mockCtx, validInput);

    expect(result.uploadUrl).toBe('https://s3.example.com/presigned-put');
    expect(result.bucket).toBe('test-bucket');
    expect(result.expiresIn).toBe(900);
    expect(result.storageKey).toContain('tenant-001/Customer/');
    expect(result.storageKey).toContain('receipt.pdf');
  });

  it('validates entity exists with correct company scope', async () => {
    const prisma = mockPrisma();
    await presignUpload(prisma, mockCtx, validInput);

    expect(validateEntityExists).toHaveBeenCalledWith(
      prisma,
      'Customer',
      validInput.entityId,
      'company-001',
    );
  });

  it('throws ValidationError for disallowed MIME type', async () => {
    const prisma = mockPrisma();
    const input = { ...validInput, mimeType: 'application/x-msdownload' };

    await expect(presignUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);

    try {
      await presignUpload(prisma, mockCtx, input);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.mimeTypeNotAllowed');
    }
  });

  it('throws ValidationError for blocked file extension', async () => {
    const prisma = mockPrisma();
    const input = { ...validInput, fileName: 'virus.exe', mimeType: 'application/pdf' };

    await expect(presignUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);

    try {
      await presignUpload(prisma, mockCtx, input);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.fileTypeBlocked');
    }
  });

  it('throws ValidationError when file exceeds default 50 MB limit', async () => {
    const prisma = mockPrisma();
    const input = { ...validInput, fileSize: FIFTY_MB + 1 };

    await expect(presignUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);

    try {
      await presignUpload(prisma, mockCtx, input);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.fileTooLarge');
    }
  });

  it('uses custom max file size from SystemSetting when available', async () => {
    const customMax = 10 * 1024 * 1024; // 10 MB
    const prisma = mockPrisma({
      systemSetting: {
        findFirst: vi.fn().mockResolvedValue({ value: String(customMax) }),
      },
    });
    const input = { ...validInput, fileSize: customMax + 1 };

    await expect(presignUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);
  });

  it('allows file exactly at the size limit', async () => {
    const prisma = mockPrisma();
    const input = { ...validInput, fileSize: FIFTY_MB };

    const result = await presignUpload(prisma, mockCtx, input);
    expect(result.uploadUrl).toBeDefined();
  });

  it('propagates entity validation errors', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();

    await expect(presignUpload(prisma, mockCtx, validInput)).rejects.toThrow(AppError);
  });

  it('generates storage key in expected format', async () => {
    const prisma = mockPrisma();
    const result = await presignUpload(prisma, mockCtx, validInput);

    // Format: {tenantId}/{entityType}/{entityId}/{uuid}-{fileName}
    const parts = result.storageKey.split('/');
    expect(parts[0]).toBe('tenant-001');
    expect(parts[1]).toBe('Customer');
    expect(parts[2]).toBe(validInput.entityId);
    expect(parts[3]).toMatch(/-receipt\.pdf$/);
  });

  it('sanitizes path separators in fileName (FIX #3)', async () => {
    const prisma = mockPrisma();
    const input = { ...validInput, fileName: '../../evil/path.pdf' };
    const result = await presignUpload(prisma, mockCtx, input);

    // Path separators replaced with underscores: '../../evil/path.pdf' → '.._.._evil_path.pdf'
    expect(result.storageKey).not.toContain('../../');
    expect(result.storageKey).toContain('.._.._evil_path.pdf');
  });
});

describe('confirmUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validInput: ConfirmRequest = {
    storageKey: 'tenant-001/Customer/550e8400-e29b-41d4-a716-446655440000/uuid-receipt.pdf',
    entityType: 'Customer',
    entityId: '550e8400-e29b-41d4-a716-446655440000',
    fileName: 'receipt.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
  };

  const fakeAttachment = {
    id: 'att-001',
    entityType: 'Customer',
    entityId: validInput.entityId,
    fileName: 'receipt.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    storageKey: 'tenant-001/Customer/550e8400-e29b-41d4-a716-446655440000/uuid-receipt.pdf',
    storageBucket: 'test-bucket',
    description: null,
    uploadedBy: 'user-001',
    uploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('creates Attachment record when S3 object exists and metadata matches', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf',
    });
    const prisma = mockPrisma();
    (
      prisma as { attachment: { create: ReturnType<typeof vi.fn> } }
    ).attachment.create.mockResolvedValue(fakeAttachment);

    const result = await confirmUpload(prisma, mockCtx, validInput);

    expect(result).toEqual(fakeAttachment);
    expect(headObject).toHaveBeenCalledWith('test-bucket', validInput.storageKey);
  });

  it('throws AppError (400) when S3 object does not exist', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue(null);
    const prisma = mockPrisma();

    await expect(confirmUpload(prisma, mockCtx, validInput)).rejects.toThrow(AppError);

    try {
      await confirmUpload(prisma, mockCtx, validInput);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe('OBJECT_NOT_FOUND');
      expect(appErr.statusCode).toBe(400);
    }
  });

  it('validates entity exists before creating attachment', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();

    await expect(confirmUpload(prisma, mockCtx, validInput)).rejects.toThrow(AppError);
    expect(headObject).not.toHaveBeenCalled();
  });

  it('throws ValidationError when storageKey does not match tenant', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const prisma = mockPrisma();
    const input = { ...validInput, storageKey: 'other-tenant/Customer/entity-001/uuid-file.pdf' };

    await expect(confirmUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);

    try {
      await confirmUpload(prisma, mockCtx, input);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.invalidStorageKey');
    }
  });

  it('throws ValidationError when storageKey entityType/entityId mismatch claimed values', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const prisma = mockPrisma();
    // Key was presigned for a different entity than what's being confirmed
    const input = {
      ...validInput,
      storageKey: 'tenant-001/SalesOrder/different-id/uuid-file.pdf',
    };

    await expect(confirmUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for blocked MIME type on confirm (defense-in-depth)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const prisma = mockPrisma();
    const input = { ...validInput, mimeType: 'application/x-msdownload' };

    await expect(confirmUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);

    try {
      await confirmUpload(prisma, mockCtx, input);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.mimeTypeNotAllowed');
    }
  });

  it('throws ValidationError for blocked extension on confirm (defense-in-depth)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const prisma = mockPrisma();
    const input = { ...validInput, fileName: 'malware.exe' };

    await expect(confirmUpload(prisma, mockCtx, input)).rejects.toThrow(ValidationError);

    try {
      await confirmUpload(prisma, mockCtx, input);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.fileTypeBlocked');
    }
  });

  it('throws ValidationError when storageKey already confirmed (duplicate check)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf',
    });
    const prisma = mockPrisma();
    // Simulate existing attachment with same storageKey
    (
      prisma as { attachment: { findFirst: ReturnType<typeof vi.fn> } }
    ).attachment.findFirst.mockResolvedValue({ id: 'existing-att' });

    await expect(confirmUpload(prisma, mockCtx, validInput)).rejects.toThrow(ValidationError);

    try {
      await confirmUpload(prisma, mockCtx, validInput);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.alreadyConfirmed');
    }
  });

  it('throws ValidationError when S3 file size mismatches client claim (FIX #1)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue({
      contentLength: 9999,
      contentType: 'application/pdf',
    });
    const prisma = mockPrisma();

    await expect(confirmUpload(prisma, mockCtx, validInput)).rejects.toThrow(ValidationError);

    try {
      await confirmUpload(prisma, mockCtx, validInput);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.fileSizeMismatch');
    }
  });

  it('throws ValidationError when S3 MIME type mismatches client claim (FIX #1)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue({ contentLength: 1024, contentType: 'image/png' });
    const prisma = mockPrisma();

    await expect(confirmUpload(prisma, mockCtx, validInput)).rejects.toThrow(ValidationError);

    try {
      await confirmUpload(prisma, mockCtx, validInput);
    } catch (err) {
      expect((err as AppError).messageKey).toBe('errors.attachment.mimeTypeMismatch');
    }
  });

  it('accepts MIME types with parameters when base type matches (FIX #1)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf; charset=utf-8',
    });
    const prisma = mockPrisma();
    (
      prisma as { attachment: { create: ReturnType<typeof vi.fn> } }
    ).attachment.create.mockResolvedValue(fakeAttachment);

    const result = await confirmUpload(prisma, mockCtx, validInput);
    expect(result).toEqual(fakeAttachment);
  });

  it('stores description when provided (FIX #10)', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(headObject).mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf',
    });
    const prisma = mockPrisma();
    (
      prisma as { attachment: { create: ReturnType<typeof vi.fn> } }
    ).attachment.create.mockResolvedValue(fakeAttachment);

    await confirmUpload(prisma, mockCtx, { ...validInput, description: 'Contract scan' });

    expect(
      (prisma as { attachment: { create: ReturnType<typeof vi.fn> } }).attachment.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: 'Contract scan' }),
      }),
    );
  });
});

describe('getDownloadUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fakeAttachment = {
    id: 'att-001',
    entityType: 'Customer',
    entityId: 'entity-001',
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    storageKey: 'tenant-001/Customer/entity-001/uuid-receipt.pdf',
    storageBucket: 'test-bucket',
    uploadedBy: 'user-001',
    description: null,
    fileSize: 1024,
    uploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns presigned GET URL, fileName, and mimeType', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(generatePresignedGetUrl).mockResolvedValue({
      url: 'https://s3.example.com/presigned-get',
      expiresIn: 3600,
    });
    const prisma = mockPrisma();
    (
      prisma as { attachment: { findUnique: ReturnType<typeof vi.fn> } }
    ).attachment.findUnique.mockResolvedValue(fakeAttachment);

    const result = await getDownloadUrl(prisma, mockCtx, 'att-001');

    expect(result).toEqual({
      downloadUrl: 'https://s3.example.com/presigned-get',
      fileName: 'receipt.pdf',
      mimeType: 'application/pdf',
    });
    // FIX #7 — now passes fileName for Content-Disposition
    expect(generatePresignedGetUrl).toHaveBeenCalledWith(
      'test-bucket',
      fakeAttachment.storageKey,
      3600,
      'receipt.pdf',
    );
  });

  it('throws NotFoundError when attachment does not exist', async () => {
    const prisma = mockPrisma();
    (
      prisma as { attachment: { findUnique: ReturnType<typeof vi.fn> } }
    ).attachment.findUnique.mockResolvedValue(null);

    await expect(getDownloadUrl(prisma, mockCtx, 'nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('validates parent entity access after finding attachment', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();
    (
      prisma as { attachment: { findUnique: ReturnType<typeof vi.fn> } }
    ).attachment.findUnique.mockResolvedValue(fakeAttachment);

    await expect(getDownloadUrl(prisma, mockCtx, 'att-001')).rejects.toThrow(AppError);
    expect(validateEntityExists).toHaveBeenCalledWith(
      prisma,
      'Customer',
      'entity-001',
      'company-001',
    );
  });
});

describe('deleteAttachment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fakeAttachment = {
    id: 'att-001',
    entityType: 'Customer',
    entityId: 'entity-001',
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    storageKey: 'tenant-001/Customer/entity-001/uuid-receipt.pdf',
    storageBucket: 'test-bucket',
    uploadedBy: 'user-001',
    description: null,
    fileSize: 1024,
    uploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('deletes DB record and S3 object', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(deleteObject).mockResolvedValue(undefined);
    const prisma = mockPrisma();
    (
      prisma as {
        attachment: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
      }
    ).attachment.findUnique.mockResolvedValue(fakeAttachment);
    (
      prisma as { attachment: { delete: ReturnType<typeof vi.fn> } }
    ).attachment.delete.mockResolvedValue(fakeAttachment);

    await deleteAttachment(prisma, mockCtx, 'att-001');

    expect(
      (prisma as { attachment: { delete: ReturnType<typeof vi.fn> } }).attachment.delete,
    ).toHaveBeenCalledWith({
      where: { id: 'att-001' },
    });
    expect(deleteObject).toHaveBeenCalledWith('test-bucket', fakeAttachment.storageKey);
  });

  it('throws NotFoundError when attachment does not exist', async () => {
    const prisma = mockPrisma();
    (
      prisma as { attachment: { findUnique: ReturnType<typeof vi.fn> } }
    ).attachment.findUnique.mockResolvedValue(null);

    await expect(deleteAttachment(prisma, mockCtx, 'nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('swallows S3 delete errors without throwing', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    vi.mocked(deleteObject).mockRejectedValue(new Error('S3 network error'));
    const prisma = mockPrisma();
    (
      prisma as {
        attachment: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
      }
    ).attachment.findUnique.mockResolvedValue(fakeAttachment);
    (
      prisma as { attachment: { delete: ReturnType<typeof vi.fn> } }
    ).attachment.delete.mockResolvedValue(fakeAttachment);

    // Should not throw even though deleteObject rejects
    await deleteAttachment(prisma, mockCtx, 'att-001');

    // DB record should still be deleted
    expect(
      (prisma as { attachment: { delete: ReturnType<typeof vi.fn> } }).attachment.delete,
    ).toHaveBeenCalled();

    // Wait for the async .catch() to fire (pino logs internally — we just verify no throw)
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('listAttachments', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { items, total } ordered by uploadedAt DESC with default pagination', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const fakeList = [
      { id: 'att-2', uploadedAt: new Date('2026-03-02') },
      { id: 'att-1', uploadedAt: new Date('2026-03-01') },
    ];
    const prisma = mockPrisma();
    (
      prisma as {
        attachment: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
      }
    ).attachment.findMany.mockResolvedValue(fakeList);
    (
      prisma as { attachment: { count: ReturnType<typeof vi.fn> } }
    ).attachment.count.mockResolvedValue(5);

    const result = await listAttachments(prisma, mockCtx, 'Customer', 'entity-001');

    expect(result.items).toEqual(fakeList);
    expect(result.total).toBe(5);
    expect(
      (prisma as { attachment: { findMany: ReturnType<typeof vi.fn> } }).attachment.findMany,
    ).toHaveBeenCalledWith({
      where: { entityType: 'Customer', entityId: 'entity-001' },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
      skip: 0,
    });
  });

  it('respects custom limit and offset', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const prisma = mockPrisma();
    (
      prisma as { attachment: { findMany: ReturnType<typeof vi.fn> } }
    ).attachment.findMany.mockResolvedValue([]);

    await listAttachments(prisma, mockCtx, 'Customer', 'entity-001', 10, 20);

    expect(
      (prisma as { attachment: { findMany: ReturnType<typeof vi.fn> } }).attachment.findMany,
    ).toHaveBeenCalledWith({
      where: { entityType: 'Customer', entityId: 'entity-001' },
      orderBy: { uploadedAt: 'desc' },
      take: 10,
      skip: 20,
    });
  });

  it('validates entity exists before querying', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();

    await expect(listAttachments(prisma, mockCtx, 'Customer', 'entity-001')).rejects.toThrow(
      AppError,
    );

    expect(
      (prisma as { attachment: { findMany: ReturnType<typeof vi.fn> } }).attachment.findMany,
    ).not.toHaveBeenCalled();
  });

  it('returns empty items with zero total when no attachments exist', async () => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
    const prisma = mockPrisma();
    (
      prisma as { attachment: { findMany: ReturnType<typeof vi.fn> } }
    ).attachment.findMany.mockResolvedValue([]);
    (
      prisma as { attachment: { count: ReturnType<typeof vi.fn> } }
    ).attachment.count.mockResolvedValue(0);

    const result = await listAttachments(prisma, mockCtx, 'Customer', 'entity-001');
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
