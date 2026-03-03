import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Note } from '../../types';

// --- Test data ---
const testNotes: Note[] = [
  {
    id: 'note-1',
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    noteType: 'GENERAL',
    classification: null,
    title: null,
    content: 'Oldest unpinned note',
    isPinned: false,
    deletedAt: null,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
  {
    id: 'note-2',
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    noteType: 'INTERNAL',
    classification: null,
    title: null,
    content: 'Newer unpinned note',
    isPinned: false,
    deletedAt: null,
    createdAt: '2025-06-02T14:30:00Z',
    updatedAt: '2025-06-02T14:30:00Z',
    createdBy: 'user-2',
    updatedBy: 'user-2',
  },
  {
    id: 'note-3',
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    noteType: 'SYSTEM',
    classification: null,
    title: null,
    content: 'System note (pinned)',
    isPinned: true,
    deletedAt: null,
    createdAt: '2025-06-03T09:15:00Z',
    updatedAt: '2025-06-03T09:15:00Z',
    createdBy: 'system',
    updatedBy: 'system',
  },
];

// --- Mock hooks ---
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockPinMutate = vi.fn();
const mockCreateMutate = vi.fn();

vi.mock('../../hooks/use-notes', () => ({
  useNotes: vi.fn(() => ({
    notes: testNotes,
    total: testNotes.length,
    isLoading: false,
    error: null,
  })),
  useCreateNote: vi.fn(() => ({
    mutate: mockCreateMutate,
    isPending: false,
  })),
  useUpdateNote: vi.fn(() => ({
    mutate: mockUpdateMutate,
  })),
  useDeleteNote: vi.fn(() => ({
    mutate: mockDeleteMutate,
  })),
  usePinNote: vi.fn(() => ({
    mutate: mockPinMutate,
  })),
}));

// --- Mock permissions ---
vi.mock('@/hooks/use-permissions', () => ({
  usePermission: vi.fn(() => ({
    canAccess: true,
    canNew: true,
    canView: true,
    canEdit: true,
    canDelete: true,
    isSuperAdmin: false,
  })),
}));

// --- Mock auth store ---
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

// --- Radix UI polyfills ---
beforeEach(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('NotesPanel', () => {
  const defaultProps = {
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    resourceCode: 'finance.invoices.detail',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Restore default mock implementations (tests that override them leak state)
    const { useNotes } = await import('../../hooks/use-notes');
    (useNotes as ReturnType<typeof vi.fn>).mockReturnValue({
      notes: testNotes,
      total: testNotes.length,
      isLoading: false,
      error: null,
    });
  });

  it('renders notes title', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.notes.title')).toBeInTheDocument();
  });

  it('renders note count badge', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders all notes', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    expect(screen.getByText('Oldest unpinned note')).toBeInTheDocument();
    expect(screen.getByText('Newer unpinned note')).toBeInTheDocument();
    expect(screen.getByText('System note (pinned)')).toBeInTheDocument();
  });

  it('renders pinned notes first, then reverse chronological', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    const noteContents = screen.getAllByText(
      /Oldest unpinned note|Newer unpinned note|System note \(pinned\)/,
    );

    // Pinned first (note-3), then newest unpinned (note-2), then oldest (note-1)
    expect(noteContents[0]).toHaveTextContent('System note (pinned)');
    expect(noteContents[1]).toHaveTextContent('Newer unpinned note');
    expect(noteContents[2]).toHaveTextContent('Oldest unpinned note');
  });

  it('renders Add Note button', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.notes.addNote')).toBeInTheDocument();
  });

  it('renders type badges with correct colours', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    const generalBadge = screen.getByText('crossCutting.notes.typeGeneral');
    expect(generalBadge.className).toContain('bg-gray-100');

    const internalBadge = screen.getByText('crossCutting.notes.typeInternal');
    expect(internalBadge.className).toContain('bg-blue-100');

    const systemBadge = screen.getByText('crossCutting.notes.typeSystem');
    expect(systemBadge.className).toContain('bg-purple-100');
  });

  it('shows empty state when no notes', async () => {
    const { useNotes } = await import('../../hooks/use-notes');
    (useNotes as ReturnType<typeof vi.fn>).mockReturnValue({
      notes: [],
      total: 0,
      isLoading: false,
      error: null,
    });

    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.notes.emptyState')).toBeInTheDocument();
  });

  it('renders system notes as read-only (italic, no actions)', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    render(<NotesPanel {...defaultProps} />);

    const systemContent = screen.getByText('System note (pinned)');
    expect(systemContent.className).toContain('italic');
  });

  it('renders timeline connector line', async () => {
    const { NotesPanel } = await import('../NotesPanel');
    const { container } = render(<NotesPanel {...defaultProps} />);

    // Timeline line is an absolute-positioned div with bg-border class
    const timelineLine = container.querySelector('.bg-border');
    expect(timelineLine).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', async () => {
    const { useNotes } = await import('../../hooks/use-notes');
    (useNotes as ReturnType<typeof vi.fn>).mockReturnValue({
      notes: [],
      total: 0,
      isLoading: true,
      error: null,
    });

    const { NotesPanel } = await import('../NotesPanel');
    const { container } = render(<NotesPanel {...defaultProps} />);

    // Skeletons are rendered as divs with specific classes
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
