import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import type { EffectivePermissions } from '../../core/rbac/permission.types.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { AppError, ValidationError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Mock @nexa/db (prevent real PrismaClient init)
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// ---------------------------------------------------------------------------
// Mock service layer — control return values per test
// ---------------------------------------------------------------------------

vi.mock('./attachment.service.js', () => ({
  presignUpload: vi.fn(),
  confirmUpload: vi.fn(),
  getDownloadUrl: vi.fn(),
  deleteAttachment: vi.fn(),
  listAttachments: vi.fn(),
}));

import {
  presignUpload,
  confirmUpload,
  getDownloadUrl,
  deleteAttachment,
  listAttachments,
} from './attachment.service.js';
import { attachmentRoutesPlugin } from './attachment.routes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000';
const ATTACHMENT_ID = '660e8400-e29b-41d4-a716-446655440000';

function buildTestApp(role: string = 'STAFF') {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);

  // Decorate request with auth context (simulating JWT + company-context middleware)
  // Fastify 5 requires getter/setter for reference types (arrays, objects)
  app.decorateRequest('userId', '');
  app.decorateRequest('tenantId', '');
  app.decorateRequest('companyId', '');
  app.decorateRequest('userRole', '');
  app.decorateRequest('enabledModules', {
    getter() {
      return (this as unknown as { _enabledModules: string[] })._enabledModules ?? [];
    },
    setter(val: string[]) {
      (this as unknown as { _enabledModules: string[] })._enabledModules = val;
    },
  });
  app.decorateRequest('permissions', {
    getter() {
      return ((this as unknown as { _permissions: unknown })._permissions ??
        null) as EffectivePermissions | null;
    },
    setter(val: unknown) {
      (this as unknown as { _permissions: unknown })._permissions = val;
    },
  });

  app.addHook('onRequest', async (request) => {
    request.userId = 'user-001';
    request.tenantId = 'tenant-001';
    request.companyId = 'company-001';
    request.userRole = role;
    request.enabledModules = [];
  });

  return app;
}

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    messageKey?: string;
    details?: Record<string, string[]>;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /attachments/presign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validBody = {
    entityType: 'Customer',
    entityId: ENTITY_ID,
    fileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
  };

  it('returns 200 with presigned URL for valid input', async () => {
    vi.mocked(presignUpload).mockResolvedValue({
      uploadUrl: 'https://s3.example.com/put',
      storageKey: 'tenant-001/Customer/entity-001/uuid-receipt.pdf',
      bucket: 'test-bucket',
      expiresIn: 900,
    });

    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/presign',
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('uploadUrl');
    expect(body.data).toHaveProperty('storageKey');
    expect(body.data).toHaveProperty('bucket');
    expect(body.data).toHaveProperty('expiresIn');

    await app.close();
  });

  it('returns 400 when service rejects executable MIME type', async () => {
    vi.mocked(presignUpload).mockRejectedValue(
      new ValidationError(
        'MIME type not allowed: application/x-msdownload',
        undefined,
        'errors.attachment.mimeTypeNotAllowed',
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/presign',
      payload: { ...validBody, mimeType: 'application/x-msdownload' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 400 when service rejects oversized file', async () => {
    vi.mocked(presignUpload).mockRejectedValue(
      new ValidationError('File size exceeds maximum', undefined, 'errors.attachment.fileTooLarge'),
    );

    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/presign',
      payload: { ...validBody, fileSize: 100_000_000 },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 400 when service rejects invalid entityType', async () => {
    vi.mocked(presignUpload).mockRejectedValue(
      new AppError('INVALID_ENTITY_TYPE', 'Invalid entity type: FakeType', 400),
    );

    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/presign',
      payload: { ...validBody, entityType: 'FakeType' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ENTITY_TYPE');

    await app.close();
  });

  it('returns 400 for missing required fields (Zod validation)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/presign',
      payload: { entityType: 'Customer' }, // missing required fields
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/presign',
      payload: validBody,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

describe('POST /attachments/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validBody = {
    storageKey: 'tenant-001/Customer/entity-001/uuid-receipt.pdf',
    entityType: 'Customer',
    entityId: ENTITY_ID,
    fileName: 'receipt.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
  };

  it('returns 201 with attachment record', async () => {
    const fakeAttachment = {
      id: ATTACHMENT_ID,
      entityType: 'Customer',
      entityId: ENTITY_ID,
      fileName: 'receipt.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      storageKey: validBody.storageKey,
      storageBucket: 'test-bucket',
      description: null,
      uploadedBy: 'user-001',
      uploadedAt: new Date('2026-03-03T00:00:00Z'),
      createdAt: new Date('2026-03-03T00:00:00Z'),
      updatedAt: new Date('2026-03-03T00:00:00Z'),
    };
    vi.mocked(confirmUpload).mockResolvedValue(fakeAttachment);

    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/attachments/confirm',
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', ATTACHMENT_ID);
    expect(body.data).toHaveProperty('fileName', 'receipt.pdf');

    await app.close();
  });
});

describe('GET /attachments/:id/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with download URL', async () => {
    vi.mocked(getDownloadUrl).mockResolvedValue({
      downloadUrl: 'https://s3.example.com/get',
      fileName: 'receipt.pdf',
      mimeType: 'application/pdf',
    });

    const app = buildTestApp('VIEWER');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('downloadUrl');
    expect(body.data).toHaveProperty('fileName', 'receipt.pdf');

    await app.close();
  });

  it('returns 404 when attachment not found', async () => {
    vi.mocked(getDownloadUrl).mockRejectedValue(
      new NotFoundError('NOT_FOUND', 'Attachment not found'),
    );

    const app = buildTestApp('VIEWER');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download`,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');

    await app.close();
  });
});

describe('DELETE /attachments/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 403 when user role is STAFF (below MANAGER)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/attachments/${ATTACHMENT_ID}`,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns 200 when user role is MANAGER', async () => {
    vi.mocked(deleteAttachment).mockResolvedValue(undefined);

    const app = buildTestApp('MANAGER');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/attachments/${ATTACHMENT_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', ATTACHMENT_ID);

    await app.close();
  });
});

describe('GET /attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with { items, total } shape', async () => {
    const fakeResult = {
      items: [
        {
          id: ATTACHMENT_ID,
          entityType: 'Customer',
          entityId: ENTITY_ID,
          fileName: 'receipt.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          storageKey: 'key',
          storageBucket: 'bucket',
          description: null,
          uploadedBy: 'user-001',
          uploadedAt: new Date('2026-03-03T00:00:00Z'),
          createdAt: new Date('2026-03-03T00:00:00Z'),
          updatedAt: new Date('2026-03-03T00:00:00Z'),
        },
      ],
      total: 1,
    };
    vi.mocked(listAttachments).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/attachments?entityType=Customer&entityId=${ENTITY_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total', 1);

    await app.close();
  });

  it('returns 400 for missing required query params', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(attachmentRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/attachments',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});
