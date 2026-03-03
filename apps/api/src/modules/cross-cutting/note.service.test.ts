import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateNoteInput, UpdateNoteInput, NoteListQuery } from './note.schema.js';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
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

vi.mock('../../core/entity-registry/index.js', () => ({
  validateEntityExists: vi.fn(),
}));

// Import after mocks are set up
import { validateEntityExists } from '../../core/entity-registry/index.js';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';

import {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  pinNote,
  createSystemNote,
} from './note.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000';
const NOTE_ID = '660e8400-e29b-41d4-a716-446655440000';
const SYSTEM_USER_ID = 'system-000';

const staffCtx: RequestContext = {
  userId: 'user-001',
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'STAFF',
  enabledModules: [],
};

const managerCtx: RequestContext = {
  ...staffCtx,
  userId: 'user-002',
  role: 'MANAGER',
};

const otherStaffCtx: RequestContext = {
  ...staffCtx,
  userId: 'user-003',
  role: 'STAFF',
};

function fakeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    entityType: 'Customer',
    entityId: ENTITY_ID,
    noteType: 'GENERAL',
    classification: null,
    title: null,
    content: 'Test note content',
    isPinned: false,
    deletedAt: null,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    createdBy: 'user-001',
    updatedBy: 'user-001',
    ...overrides,
  };
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    note: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    ...overrides,
    // Interactive transaction: execute callback with prisma mock as tx
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma),
  );
  return prisma as never;
}

// ---------------------------------------------------------------------------
// createNote
// ---------------------------------------------------------------------------

describe('createNote', () => {
  beforeEach(() => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // noteType: 'GENERAL' matches what Zod's .optional().default('GENERAL') produces
  const validInput: CreateNoteInput = {
    entityType: 'Customer',
    entityId: ENTITY_ID,
    noteType: 'GENERAL',
    content: 'Meeting notes from today',
  };

  it('creates note with correct fields and defaults noteType to GENERAL', async () => {
    const prisma = mockPrisma();
    const created = fakeNote();
    (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create.mockResolvedValue(
      created,
    );

    const result = await createNote(staffCtx, prisma, validInput);

    expect(result).toEqual(created);
    expect(
      (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create,
    ).toHaveBeenCalledWith({
      data: {
        entityType: 'Customer',
        entityId: ENTITY_ID,
        noteType: 'GENERAL',
        content: 'Meeting notes from today',
        title: null,
        classification: null,
        createdBy: 'user-001',
        updatedBy: 'user-001',
      },
    });
  });

  it('creates note with explicit noteType INTERNAL', async () => {
    const prisma = mockPrisma();
    const created = fakeNote({ noteType: 'INTERNAL' });
    (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create.mockResolvedValue(
      created,
    );

    const input: CreateNoteInput = { ...validInput, noteType: 'INTERNAL' };
    const result = await createNote(staffCtx, prisma, input);

    expect(result.noteType).toBe('INTERNAL');
    expect(
      (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ noteType: 'INTERNAL' }),
      }),
    );
  });

  it('creates note with title and classification when provided', async () => {
    const prisma = mockPrisma();
    const created = fakeNote({ title: 'Q1 Review', classification: 'Finance' });
    (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create.mockResolvedValue(
      created,
    );

    const input: CreateNoteInput = {
      ...validInput,
      title: 'Q1 Review',
      classification: 'Finance',
    };
    await createNote(staffCtx, prisma, input);

    expect(
      (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Q1 Review', classification: 'Finance' }),
      }),
    );
  });

  it('validates entity exists with correct company scope', async () => {
    const prisma = mockPrisma();
    (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create.mockResolvedValue(
      fakeNote(),
    );

    await createNote(staffCtx, prisma, validInput);

    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', ENTITY_ID, 'company-001');
  });

  it('rejects SYSTEM noteType from API (AC #4)', async () => {
    const prisma = mockPrisma();
    // Force bypass Zod by casting
    const input = { ...validInput, noteType: 'SYSTEM' } as unknown as CreateNoteInput;

    await expect(createNote(staffCtx, prisma, input)).rejects.toMatchObject({
      name: 'ValidationError',
      messageKey: 'errors.note.systemNoteCreateForbidden',
    });
  });

  it('propagates entity validation errors', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();

    await expect(createNote(staffCtx, prisma, validInput)).rejects.toThrow(AppError);
  });
});

// ---------------------------------------------------------------------------
// listNotes
// ---------------------------------------------------------------------------

describe('listNotes', () => {
  beforeEach(() => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validQuery: NoteListQuery = {
    entityType: 'Customer',
    entityId: ENTITY_ID,
  };

  it('returns pinned notes first, then by createdAt DESC', async () => {
    const pinnedNote = fakeNote({
      id: 'note-1',
      isPinned: true,
      createdAt: new Date('2026-03-01'),
    });
    const recentNote = fakeNote({ id: 'note-2', createdAt: new Date('2026-03-03') });
    const olderNote = fakeNote({ id: 'note-3', createdAt: new Date('2026-03-02') });

    const prisma = mockPrisma();
    (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany.mockResolvedValue([
      pinnedNote,
      recentNote,
      olderNote,
    ]);
    (prisma as { note: { count: ReturnType<typeof vi.fn> } }).note.count.mockResolvedValue(3);

    const result = await listNotes(staffCtx, prisma, validQuery);

    expect(result.items).toEqual([pinnedNote, recentNote, olderNote]);
    expect(result.total).toBe(3);
    expect(
      (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany,
    ).toHaveBeenCalledWith({
      where: { entityType: 'Customer', entityId: ENTITY_ID, deletedAt: null },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      skip: 0,
    });
  });

  it('filters by noteType when provided', async () => {
    const prisma = mockPrisma();
    (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany.mockResolvedValue(
      [],
    );
    (prisma as { note: { count: ReturnType<typeof vi.fn> } }).note.count.mockResolvedValue(0);

    await listNotes(staffCtx, prisma, { ...validQuery, noteType: 'INTERNAL' });

    expect(
      (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ noteType: 'INTERNAL' }),
      }),
    );
  });

  it('excludes soft-deleted notes (deletedAt: null filter)', async () => {
    const prisma = mockPrisma();
    (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany.mockResolvedValue(
      [],
    );
    (prisma as { note: { count: ReturnType<typeof vi.fn> } }).note.count.mockResolvedValue(0);

    await listNotes(staffCtx, prisma, validQuery);

    expect(
      (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('respects custom limit and offset', async () => {
    const prisma = mockPrisma();
    (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany.mockResolvedValue(
      [],
    );
    (prisma as { note: { count: ReturnType<typeof vi.fn> } }).note.count.mockResolvedValue(0);

    await listNotes(staffCtx, prisma, { ...validQuery, limit: 10, offset: 20 });

    expect(
      (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany,
    ).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 20 }));
  });

  it('validates entity exists before querying', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();

    await expect(listNotes(staffCtx, prisma, validQuery)).rejects.toThrow(AppError);
    expect(
      (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany,
    ).not.toHaveBeenCalled();
  });

  it('returns empty items with zero total when no notes exist', async () => {
    const prisma = mockPrisma();
    (prisma as { note: { findMany: ReturnType<typeof vi.fn> } }).note.findMany.mockResolvedValue(
      [],
    );
    (prisma as { note: { count: ReturnType<typeof vi.fn> } }).note.count.mockResolvedValue(0);

    const result = await listNotes(staffCtx, prisma, validQuery);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateNote
// ---------------------------------------------------------------------------

describe('updateNote', () => {
  beforeEach(() => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates content, title, and classification', async () => {
    const existing = fakeNote();
    const updated = fakeNote({
      content: 'Updated content',
      title: 'New title',
      classification: 'Legal',
    });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      updated,
    );

    const input: UpdateNoteInput = {
      content: 'Updated content',
      title: 'New title',
      classification: 'Legal',
    };
    const result = await updateNote(staffCtx, prisma, NOTE_ID, input);

    expect(result).toEqual(updated);
    expect(
      (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update,
    ).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: {
        content: 'Updated content',
        title: 'New title',
        classification: 'Legal',
        updatedBy: 'user-001',
      },
    });
  });

  it('rejects SYSTEM note edits (always read-only, AC #6)', async () => {
    const systemNote = fakeNote({ noteType: 'SYSTEM', createdBy: SYSTEM_USER_ID });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      systemNote,
    );

    await expect(
      updateNote(staffCtx, prisma, NOTE_ID, { content: 'hacked' }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      messageKey: 'errors.note.systemNoteReadOnly',
    });
  });

  it('allows creator to edit their own note (STAFF role)', async () => {
    const existing = fakeNote({ createdBy: 'user-001' });
    const updated = fakeNote({ content: 'Creator update' });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      updated,
    );

    const result = await updateNote(staffCtx, prisma, NOTE_ID, { content: 'Creator update' });
    expect(result).toEqual(updated);
  });

  it('rejects non-creator STAFF from editing (AC #6)', async () => {
    const existing = fakeNote({ createdBy: 'user-001' }); // created by user-001
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );

    // otherStaffCtx has userId: 'user-003', role: 'STAFF'
    await expect(
      updateNote(otherStaffCtx, prisma, NOTE_ID, { content: 'unauthorized' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      messageKey: 'errors.note.notOwner',
    });
  });

  it('allows MANAGER to edit any non-SYSTEM note (AC #6)', async () => {
    const existing = fakeNote({ createdBy: 'user-001' }); // created by different user
    const updated = fakeNote({ content: 'Manager update', updatedBy: 'user-002' });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      updated,
    );

    // managerCtx has userId: 'user-002', role: 'MANAGER'
    const result = await updateNote(managerCtx, prisma, NOTE_ID, { content: 'Manager update' });
    expect(result).toEqual(updated);
  });

  it('throws NotFoundError when note does not exist', async () => {
    const prisma = mockPrisma();
    // findFirst returns null by default

    await expect(updateNote(staffCtx, prisma, NOTE_ID, { content: 'nope' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws NotFoundError when note is soft-deleted (verifies deletedAt filter)', async () => {
    const prisma = mockPrisma();
    // findFirst returns null because the deletedAt: null filter excludes soft-deleted notes
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      null,
    );

    await expect(updateNote(staffCtx, prisma, NOTE_ID, { content: 'nope' })).rejects.toThrow(
      NotFoundError,
    );

    // Verify the query included the deletedAt: null filter that excludes soft-deleted notes
    expect(
      (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst,
    ).toHaveBeenCalledWith({
      where: { id: NOTE_ID, deletedAt: null },
    });
  });

  it('validates entity access (companyId scope)', async () => {
    const existing = fakeNote();
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      existing,
    );

    await updateNote(staffCtx, prisma, NOTE_ID, { content: 'update' });

    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', ENTITY_ID, 'company-001');
  });
});

// ---------------------------------------------------------------------------
// deleteNote
// ---------------------------------------------------------------------------

describe('deleteNote', () => {
  beforeEach(() => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects STAFF role at service level (defense-in-depth)', async () => {
    const prisma = mockPrisma();

    await expect(deleteNote(staffCtx, prisma, NOTE_ID)).rejects.toMatchObject({
      statusCode: 403,
      messageKey: 'errors.note.deleteRequiresManager',
    });
  });

  it('soft-deletes by setting deletedAt and updatedBy', async () => {
    const existing = fakeNote();
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue({
      ...existing,
      deletedAt: new Date(),
    });

    await deleteNote(managerCtx, prisma, NOTE_ID);

    expect(
      (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update,
    ).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: {
        deletedAt: expect.any(Date),
        updatedBy: 'user-002',
      },
    });
  });

  it('rejects deletion of SYSTEM notes', async () => {
    const systemNote = fakeNote({ noteType: 'SYSTEM', createdBy: SYSTEM_USER_ID });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      systemNote,
    );

    await expect(deleteNote(managerCtx, prisma, NOTE_ID)).rejects.toMatchObject({
      name: 'ValidationError',
      messageKey: 'errors.note.systemNoteReadOnly',
    });
  });

  it('throws NotFoundError when note does not exist', async () => {
    const prisma = mockPrisma();
    // findFirst returns null by default

    await expect(deleteNote(managerCtx, prisma, NOTE_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when note is already soft-deleted', async () => {
    const prisma = mockPrisma();
    // findFirst with deletedAt: null returns null for already-deleted notes

    await expect(deleteNote(managerCtx, prisma, NOTE_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates entity access (companyId scope)', async () => {
    const existing = fakeNote();
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue({
      ...existing,
      deletedAt: new Date(),
    });

    await deleteNote(managerCtx, prisma, NOTE_ID);

    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', ENTITY_ID, 'company-001');
  });
});

// ---------------------------------------------------------------------------
// pinNote
// ---------------------------------------------------------------------------

describe('pinNote', () => {
  beforeEach(() => {
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles isPinned from false to true', async () => {
    const existing = fakeNote({ isPinned: false });
    const updated = fakeNote({ isPinned: true });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      updated,
    );

    const result = await pinNote(staffCtx, prisma, NOTE_ID);

    expect(result.isPinned).toBe(true);
    expect(
      (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update,
    ).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { isPinned: true, updatedBy: 'user-001' },
    });
  });

  it('toggles isPinned from true to false', async () => {
    const existing = fakeNote({ isPinned: true });
    const updated = fakeNote({ isPinned: false });
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      updated,
    );

    const result = await pinNote(staffCtx, prisma, NOTE_ID);

    expect(result.isPinned).toBe(false);
    expect(
      (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update,
    ).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: { isPinned: false, updatedBy: 'user-001' },
    });
  });

  it('throws NotFoundError when note is soft-deleted', async () => {
    const prisma = mockPrisma();
    // findFirst returns null (soft-deleted notes filtered by deletedAt: null)

    await expect(pinNote(staffCtx, prisma, NOTE_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates entity access (companyId scope)', async () => {
    const existing = fakeNote();
    const prisma = mockPrisma();
    (prisma as { note: { findFirst: ReturnType<typeof vi.fn> } }).note.findFirst.mockResolvedValue(
      existing,
    );
    (prisma as { note: { update: ReturnType<typeof vi.fn> } }).note.update.mockResolvedValue(
      fakeNote({ isPinned: true }),
    );

    await pinNote(staffCtx, prisma, NOTE_ID);

    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', ENTITY_ID, 'company-001');
  });
});

// ---------------------------------------------------------------------------
// createSystemNote
// ---------------------------------------------------------------------------

describe('createSystemNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates note with SYSTEM type and correct createdBy', async () => {
    const systemNote = fakeNote({
      noteType: 'SYSTEM',
      content: 'Status changed to POSTED',
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });
    const prisma = mockPrisma();
    (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create.mockResolvedValue(
      systemNote,
    );

    const result = await createSystemNote(
      prisma,
      'SalesInvoice',
      ENTITY_ID,
      'Status changed to POSTED',
      SYSTEM_USER_ID,
    );

    expect(result.noteType).toBe('SYSTEM');
    expect(result.createdBy).toBe(SYSTEM_USER_ID);
    expect(
      (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create,
    ).toHaveBeenCalledWith({
      data: {
        entityType: 'SalesInvoice',
        entityId: ENTITY_ID,
        noteType: 'SYSTEM',
        content: 'Status changed to POSTED',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      },
    });
  });

  it('does not call validateEntityExists (trusted internal caller)', async () => {
    const prisma = mockPrisma();
    (prisma as { note: { create: ReturnType<typeof vi.fn> } }).note.create.mockResolvedValue(
      fakeNote({ noteType: 'SYSTEM' }),
    );

    await createSystemNote(prisma, 'SalesInvoice', ENTITY_ID, 'AI action', SYSTEM_USER_ID);

    expect(validateEntityExists).not.toHaveBeenCalled();
  });

  it('rejects empty entityType', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemNote(prisma, '', ENTITY_ID, 'content', SYSTEM_USER_ID),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      messageKey: 'errors.note.invalidEntityType',
    });
  });

  it('rejects empty entityId', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemNote(prisma, 'SalesInvoice', '', 'content', SYSTEM_USER_ID),
    ).rejects.toMatchObject({ name: 'ValidationError', messageKey: 'errors.note.invalidEntityId' });
  });

  it('rejects empty content', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemNote(prisma, 'SalesInvoice', ENTITY_ID, '', SYSTEM_USER_ID),
    ).rejects.toMatchObject({ name: 'ValidationError', messageKey: 'errors.note.emptyContent' });
  });

  it('rejects empty systemUserId', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemNote(prisma, 'SalesInvoice', ENTITY_ID, 'content', ''),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      messageKey: 'errors.note.invalidSystemUser',
    });
  });
});
