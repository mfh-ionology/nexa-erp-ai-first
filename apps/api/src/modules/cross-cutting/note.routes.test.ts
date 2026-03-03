import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import type { EffectivePermissions } from '../../core/rbac/permission.types.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { AppError, ValidationError, NotFoundError } from '../../core/errors/index.js';
import type { NoteType } from '@nexa/db';

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

vi.mock('./note.service.js', () => ({
  createNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  pinNote: vi.fn(),
}));

import { createNote, listNotes, updateNote, deleteNote, pinNote } from './note.service.js';
import { noteRoutesPlugin } from './note.routes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000';
const NOTE_ID = '660e8400-e29b-41d4-a716-446655440000';

function fakeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    entityType: 'Customer',
    entityId: ENTITY_ID,
    noteType: 'GENERAL' as NoteType,
    classification: null as string | null,
    title: null as string | null,
    content: 'Test note content',
    isPinned: false,
    deletedAt: null as Date | null,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    createdBy: 'user-001',
    updatedBy: 'user-001',
    ...overrides,
  };
}

function buildTestApp(role: string = 'STAFF') {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);

  // Decorate request with auth context (simulating JWT + company-context middleware)
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
// POST /notes
// ---------------------------------------------------------------------------

describe('POST /notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validBody = {
    entityType: 'Customer',
    entityId: ENTITY_ID,
    content: 'Meeting notes from today',
  };

  it('returns 201 with note having GENERAL type (default)', async () => {
    const created = fakeNote();
    vi.mocked(createNote).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', NOTE_ID);
    expect(body.data).toHaveProperty('noteType', 'GENERAL');
    expect(body.data).toHaveProperty('content', 'Test note content');

    await app.close();
  });

  it('returns 201 with noteType INTERNAL when specified', async () => {
    const created = fakeNote({ noteType: 'INTERNAL' });
    vi.mocked(createNote).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, noteType: 'INTERNAL' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('noteType', 'INTERNAL');

    await app.close();
  });

  it('returns 400 when noteType is SYSTEM (rejected by Zod — SYSTEM excluded)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, noteType: 'SYSTEM' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 when service rejects invalid entityType', async () => {
    vi.mocked(createNote).mockRejectedValue(
      new AppError('INVALID_ENTITY_TYPE', 'Invalid entity type: FakeType', 400),
    );

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, entityType: 'FakeType' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ENTITY_TYPE');

    await app.close();
  });

  it('returns 404 when entity does not exist', async () => {
    vi.mocked(createNote).mockRejectedValue(
      new NotFoundError('ENTITY_NOT_FOUND', 'Entity not found'),
    );

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: validBody,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITY_NOT_FOUND');

    await app.close();
  });

  it('returns 400 when content is empty', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, content: '' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 for missing required fields (Zod validation)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { entityType: 'Customer' }, // missing entityId and content
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 when content contains <script> tag (XSS prevention)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, content: 'Hello <script>alert(1)</script>' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 when content contains event handler attribute (XSS prevention)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, content: '<img src=x onerror=alert(1)>' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 when content contains <iframe> tag (XSS prevention)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: { ...validBody, content: '<iframe src="https://evil.com"></iframe>' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: validBody,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// GET /notes
// ---------------------------------------------------------------------------

describe('GET /notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with list ordered correctly (pinned first, then by date DESC)', async () => {
    const pinnedNote = fakeNote({ id: 'note-1', isPinned: true });
    const recentNote = fakeNote({ id: 'note-2' });
    const fakeResult = { items: [pinnedNote, recentNote], total: 2 };
    vi.mocked(listNotes).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/notes?entityType=Customer&entityId=${ENTITY_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total', 2);

    await app.close();
  });

  it('returns 200 with filtered list when noteType specified', async () => {
    const fakeResult = { items: [fakeNote({ noteType: 'INTERNAL' })], total: 1 };
    vi.mocked(listNotes).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/notes?entityType=Customer&entityId=${ENTITY_ID}&noteType=INTERNAL`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);

    // Verify service was called with noteType filter
    expect(listNotes).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ noteType: 'INTERNAL' }),
    );

    await app.close();
  });

  it('returns 400 for missing required query params', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notes',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PATCH /notes/:id
// ---------------------------------------------------------------------------

describe('PATCH /notes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with updated note when called by creator', async () => {
    const updated = fakeNote({ content: 'Updated content' });
    vi.mocked(updateNote).mockResolvedValue(updated);

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}`,
      payload: { content: 'Updated content' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('content', 'Updated content');

    await app.close();
  });

  it('returns 403 when non-creator STAFF tries to edit', async () => {
    vi.mocked(updateNote).mockRejectedValue(
      new AppError(
        'FORBIDDEN',
        'Only the note creator or a manager can edit this note',
        403,
        undefined,
        'errors.note.notOwner',
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}`,
      payload: { content: 'unauthorized' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns 200 when non-creator MANAGER edits (allowed)', async () => {
    const updated = fakeNote({ content: 'Manager update', updatedBy: 'user-002' });
    vi.mocked(updateNote).mockResolvedValue(updated);

    const app = buildTestApp('MANAGER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}`,
      payload: { content: 'Manager update' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);

    await app.close();
  });

  it('returns 400 when attempting to edit SYSTEM note (read-only)', async () => {
    vi.mocked(updateNote).mockRejectedValue(
      new ValidationError(
        'SYSTEM notes are read-only',
        undefined,
        'errors.note.systemNoteReadOnly',
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}`,
      payload: { content: 'try to edit system note' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 404 when note does not exist', async () => {
    vi.mocked(updateNote).mockRejectedValue(new NotFoundError('NOTE_NOT_FOUND', 'Note not found'));

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}`,
      payload: { content: 'nope' },
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}`,
      payload: { content: 'nope' },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// DELETE /notes/:id
// ---------------------------------------------------------------------------

describe('DELETE /notes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 403 when user role is STAFF (below MANAGER)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notes/${NOTE_ID}`,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns 200 when user role is MANAGER', async () => {
    vi.mocked(deleteNote).mockResolvedValue(undefined);

    const app = buildTestApp('MANAGER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notes/${NOTE_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', NOTE_ID);

    await app.close();
  });

  it('returns 400 when attempting to delete SYSTEM note', async () => {
    vi.mocked(deleteNote).mockRejectedValue(
      new ValidationError(
        'SYSTEM notes cannot be deleted',
        undefined,
        'errors.note.systemNoteReadOnly',
      ),
    );

    const app = buildTestApp('MANAGER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notes/${NOTE_ID}`,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 404 when note does not exist', async () => {
    vi.mocked(deleteNote).mockRejectedValue(new NotFoundError('NOTE_NOT_FOUND', 'Note not found'));

    const app = buildTestApp('MANAGER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notes/${NOTE_ID}`,
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PATCH /notes/:id/pin
// ---------------------------------------------------------------------------

describe('PATCH /notes/:id/pin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with toggled isPinned', async () => {
    const pinned = fakeNote({ isPinned: true });
    vi.mocked(pinNote).mockResolvedValue(pinned);

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}/pin`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('isPinned', true);

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}/pin`,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 404 when note does not exist', async () => {
    vi.mocked(pinNote).mockRejectedValue(new NotFoundError('NOTE_NOT_FOUND', 'Note not found'));

    const app = buildTestApp('STAFF');
    await app.register(noteRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${NOTE_ID}/pin`,
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
