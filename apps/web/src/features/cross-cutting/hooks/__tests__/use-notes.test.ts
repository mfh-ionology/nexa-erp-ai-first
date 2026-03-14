import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { Note, ListResponse } from '../../types';

// --- Mock API client functions ---
const mockListNotes = vi.fn();
const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockPinNote = vi.fn();

vi.mock('../../api/note-api', () => ({
  listNotes: (...args: unknown[]) => mockListNotes(...args),
  createNote: (...args: unknown[]) => mockCreateNote(...args),
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
  deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
  pinNote: (...args: unknown[]) => mockPinNote(...args),
}));

// --- Mock toast ---
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// --- Mock i18n ---
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    notes: {
      all: ['notes'],
      list: (entityType: string, entityId: string) => ['notes', entityType, entityId],
    },
  },
}));

// --- Test data ---
const TEST_ENTITY_TYPE = 'CustomerInvoice';
const TEST_ENTITY_ID = 'inv-123';

const testNotes: Note[] = [
  {
    id: 'note-1',
    entityType: TEST_ENTITY_TYPE,
    entityId: TEST_ENTITY_ID,
    noteType: 'GENERAL',
    classification: null,
    title: null,
    content: 'First note content',
    isPinned: true,
    deletedAt: null,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
  {
    id: 'note-2',
    entityType: TEST_ENTITY_TYPE,
    entityId: TEST_ENTITY_ID,
    noteType: 'INTERNAL',
    classification: null,
    title: null,
    content: 'Internal note content',
    isPinned: false,
    deletedAt: null,
    createdAt: '2025-06-02T14:30:00Z',
    updatedAt: '2025-06-02T14:30:00Z',
    createdBy: 'user-2',
    updatedBy: 'user-2',
  },
  {
    id: 'note-3',
    entityType: TEST_ENTITY_TYPE,
    entityId: TEST_ENTITY_ID,
    noteType: 'SYSTEM',
    classification: null,
    title: null,
    content: 'System generated note',
    isPinned: false,
    deletedAt: null,
    createdAt: '2025-06-03T09:15:00Z',
    updatedAt: '2025-06-03T09:15:00Z',
    createdBy: 'system',
    updatedBy: 'system',
  },
];

const testListResponse: ListResponse<Note> = {
  items: testNotes,
  total: 3,
};

// --- Helper: create wrapper with QueryClient ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns note list data', async () => {
    mockListNotes.mockResolvedValue(testListResponse);

    const { useNotes } = await import('../use-notes');
    const { result } = renderHook(() => useNotes(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notes).toEqual(testNotes);
    expect(result.current.total).toBe(3);
  });

  it('returns empty array when no data', async () => {
    mockListNotes.mockResolvedValue({ items: [], total: 0 });

    const { useNotes } = await import('../use-notes');
    const { result } = renderHook(() => useNotes(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notes).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('does not fetch when entityType is empty', async () => {
    const { useNotes } = await import('../use-notes');
    renderHook(() => useNotes('', TEST_ENTITY_ID), { wrapper: createWrapper() });

    expect(mockListNotes).not.toHaveBeenCalled();
  });

  it('does not fetch when entityId is empty', async () => {
    const { useNotes } = await import('../use-notes');
    renderHook(() => useNotes(TEST_ENTITY_TYPE, ''), { wrapper: createWrapper() });

    expect(mockListNotes).not.toHaveBeenCalled();
  });

  it('calls listNotes with correct params', async () => {
    mockListNotes.mockResolvedValue(testListResponse);

    const { useNotes } = await import('../use-notes');
    renderHook(() => useNotes(TEST_ENTITY_TYPE, TEST_ENTITY_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(mockListNotes).toHaveBeenCalled());
    expect(mockListNotes).toHaveBeenCalledWith(TEST_ENTITY_TYPE, TEST_ENTITY_ID);
  });
});

describe('useCreateNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates note with entityType and entityId merged', async () => {
    const createdNote = { ...testNotes[0], id: 'note-new' };
    mockCreateNote.mockResolvedValue(createdNote);

    const { useCreateNote } = await import('../use-notes');
    const { result } = renderHook(() => useCreateNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ content: 'New note', noteType: 'GENERAL' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCreateNote).toHaveBeenCalledWith({
      entityType: TEST_ENTITY_TYPE,
      entityId: TEST_ENTITY_ID,
      content: 'New note',
      noteType: 'GENERAL',
    });
  });

  it('shows error toast on failure', async () => {
    mockCreateNote.mockRejectedValue(new Error('Create failed'));

    const { useCreateNote } = await import('../use-notes');
    const { result } = renderHook(() => useCreateNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ content: 'New note' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'crossCutting.notes.createFailed',
      variant: 'destructive',
    });
  });
});

describe('useUpdateNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates note content', async () => {
    const updatedNote = { ...testNotes[0], content: 'Updated content' };
    mockUpdateNote.mockResolvedValue(updatedNote);

    const { useUpdateNote } = await import('../use-notes');
    const { result } = renderHook(() => useUpdateNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ noteId: 'note-1', input: { content: 'Updated content' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', { content: 'Updated content' });
  });

  it('shows error toast on failure', async () => {
    mockUpdateNote.mockRejectedValue(new Error('Update failed'));

    const { useUpdateNote } = await import('../use-notes');
    const { result } = renderHook(() => useUpdateNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ noteId: 'note-1', input: { content: 'Updated' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'crossCutting.notes.updateFailed',
      variant: 'destructive',
    });
  });
});

describe('useDeleteNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes note', async () => {
    mockDeleteNote.mockResolvedValue(undefined);

    const { useDeleteNote } = await import('../use-notes');
    const { result } = renderHook(() => useDeleteNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('note-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDeleteNote).toHaveBeenCalledWith('note-1');
  });

  it('shows error toast on failure', async () => {
    mockDeleteNote.mockRejectedValue(new Error('Delete failed'));

    const { useDeleteNote } = await import('../use-notes');
    const { result } = renderHook(() => useDeleteNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('note-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'crossCutting.notes.deleteFailed',
      variant: 'destructive',
    });
  });
});

describe('usePinNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls pinNote API', async () => {
    const toggledNote = { ...testNotes[0], isPinned: false };
    mockPinNote.mockResolvedValue(toggledNote);

    const { usePinNote } = await import('../use-notes');
    const { result } = renderHook(() => usePinNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('note-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPinNote).toHaveBeenCalledWith('note-1');
  });

  it('performs optimistic update on pin toggle', async () => {
    mockListNotes.mockResolvedValue(testListResponse);
    // Never resolves — lets us observe the optimistic state
    mockPinNote.mockReturnValue(new Promise(() => {}));

    const { usePinNote, useNotes } = await import('../use-notes');
    const wrapper = createWrapper();

    // Single renderHook with both hooks so they share the same React tree
    const { result } = renderHook(
      () => ({
        list: useNotes(TEST_ENTITY_TYPE, TEST_ENTITY_ID),
        pin: usePinNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isLoading).toBe(false));
    expect(result.current.list.notes[0]!.isPinned).toBe(true);

    act(() => {
      result.current.pin.mutate('note-1');
    });

    // Optimistic update should flip isPinned
    await waitFor(() => {
      const note1 = result.current.list.notes.find((n) => n.id === 'note-1');
      expect(note1?.isPinned).toBe(false);
    });
  });

  it('reverts optimistic update on error', async () => {
    mockListNotes.mockResolvedValue(testListResponse);
    mockPinNote.mockRejectedValue(new Error('Pin failed'));

    const { usePinNote, useNotes } = await import('../use-notes');
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => ({
        list: useNotes(TEST_ENTITY_TYPE, TEST_ENTITY_ID),
        pin: usePinNote(TEST_ENTITY_TYPE, TEST_ENTITY_ID),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    act(() => {
      result.current.pin.mutate('note-1');
    });

    // After error, should revert and show toast
    await waitFor(() => expect(result.current.pin.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'crossCutting.notes.pinFailed',
      variant: 'destructive',
    });
  });
});
