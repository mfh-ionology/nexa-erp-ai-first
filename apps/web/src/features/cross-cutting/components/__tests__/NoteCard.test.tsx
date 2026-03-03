import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Note } from '../../types';
import { NoteCard } from '../NoteCard';

// --- Mock Radix UI pointer capture for DropdownMenu ---
beforeEach(() => {
  // Radix UI uses Element.prototype.hasPointerCapture which jsdom doesn't support
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  // Radix dialogs use scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

// --- Test data ---
const baseNote: Note = {
  id: 'note-1',
  entityType: 'CustomerInvoice',
  entityId: 'inv-123',
  noteType: 'GENERAL',
  classification: null,
  title: null,
  content: 'This is a test note with some content',
  isPinned: false,
  deletedAt: null,
  createdAt: '2025-06-01T10:00:00Z',
  updatedAt: '2025-06-01T10:00:00Z',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const pinnedNote: Note = { ...baseNote, id: 'note-pinned', isPinned: true };
const systemNote: Note = {
  ...baseNote,
  id: 'note-system',
  noteType: 'SYSTEM',
  content: 'System generated note',
  createdBy: 'system',
};
const internalNote: Note = {
  ...baseNote,
  id: 'note-internal',
  noteType: 'INTERNAL',
  content: 'Internal note',
};
const customerVisibleNote: Note = {
  ...baseNote,
  id: 'note-cv',
  noteType: 'CUSTOMER_VISIBLE',
  content: 'Customer visible note',
};

describe('NoteCard', () => {
  const defaultProps = {
    note: baseNote,
    currentUserId: 'user-1',
    canDelete: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onPin: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders note content', () => {
      render(<NoteCard {...defaultProps} />);

      expect(screen.getByText('This is a test note with some content')).toBeInTheDocument();
    });

    it('renders author name', () => {
      render(<NoteCard {...defaultProps} />);

      expect(screen.getByText(/user-1/)).toBeInTheDocument();
    });

    it('renders relative timestamp', () => {
      render(<NoteCard {...defaultProps} />);

      // formatDistanceToNow will produce something like "X months ago"
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it('renders GENERAL type badge with grey styling', () => {
      render(<NoteCard {...defaultProps} />);

      const badge = screen.getByText('crossCutting.notes.typeGeneral');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-gray-100');
      expect(badge.className).toContain('text-gray-700');
    });

    it('renders INTERNAL type badge with blue styling', () => {
      render(<NoteCard {...defaultProps} note={internalNote} />);

      const badge = screen.getByText('crossCutting.notes.typeInternal');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-blue-100');
      expect(badge.className).toContain('text-blue-700');
    });

    it('renders CUSTOMER_VISIBLE type badge with green styling', () => {
      render(<NoteCard {...defaultProps} note={customerVisibleNote} />);

      const badge = screen.getByText('crossCutting.notes.typeCustomerVisible');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-green-100');
      expect(badge.className).toContain('text-green-700');
    });

    it('renders SYSTEM type badge with purple styling', () => {
      render(<NoteCard {...defaultProps} note={systemNote} />);

      const badge = screen.getByText('crossCutting.notes.typeSystem');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-purple-100');
      expect(badge.className).toContain('text-purple-700');
    });
  });

  // --- Pin indicator ---

  describe('pin indicator', () => {
    it('shows pin icon when note is pinned', () => {
      render(<NoteCard {...defaultProps} note={pinnedNote} />);

      expect(screen.getByLabelText('crossCutting.notes.pinned')).toBeInTheDocument();
    });

    it('does not show pin icon when note is not pinned', () => {
      render(<NoteCard {...defaultProps} />);

      expect(screen.queryByLabelText('crossCutting.notes.pinned')).not.toBeInTheDocument();
    });
  });

  // --- System notes ---

  describe('system notes', () => {
    it('renders system notes with italic styling', () => {
      render(<NoteCard {...defaultProps} note={systemNote} />);

      const content = screen.getByText('System generated note');
      expect(content.className).toContain('italic');
    });

    it('does not show action menu for system notes', () => {
      render(<NoteCard {...defaultProps} note={systemNote} />);

      expect(screen.queryByLabelText('crossCutting.notes.actions')).not.toBeInTheDocument();
    });
  });

  // --- Edit mode ---

  describe('edit mode', () => {
    it('shows edit option in menu for own notes', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);

      expect(screen.getByText('common:edit')).toBeInTheDocument();
    });

    it('does not show edit option for notes by other users', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} currentUserId="other-user" />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);

      expect(screen.queryByText('common:edit')).not.toBeInTheDocument();
    });

    it('enters edit mode and shows textarea', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:edit'));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue(baseNote.content);
    });

    it('calls onEdit with new content on save', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} onEdit={onEdit} />);

      // Enter edit mode
      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:edit'));

      // Clear and type new content
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      // Save
      await user.click(screen.getByText('common:save'));

      expect(onEdit).toHaveBeenCalledWith('note-1', 'Updated content');
    });

    it('cancels edit mode and restores original content', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} />);

      // Enter edit mode
      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:edit'));

      // Modify content
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Temp edit');

      // Cancel
      await user.click(screen.getByText('common:cancel'));

      // Should show original content, not textarea
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText(baseNote.content)).toBeInTheDocument();
    });

    it('disables save when content is unchanged', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:edit'));

      const saveButton = screen.getByText('common:save');
      expect(saveButton.closest('button')).toBeDisabled();
    });

    it('disables save when content is empty', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:edit'));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);

      const saveButton = screen.getByText('common:save');
      expect(saveButton.closest('button')).toBeDisabled();
    });
  });

  // --- Pin toggle ---

  describe('pin toggle', () => {
    it('shows Pin option for unpinned notes', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);

      expect(screen.getByText('crossCutting.notes.pin')).toBeInTheDocument();
    });

    it('shows Unpin option for pinned notes', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} note={pinnedNote} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);

      expect(screen.getByText('crossCutting.notes.unpin')).toBeInTheDocument();
    });

    it('calls onPin when pin is clicked', async () => {
      const onPin = vi.fn();
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} onPin={onPin} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('crossCutting.notes.pin'));

      expect(onPin).toHaveBeenCalledWith('note-1', false);
    });
  });

  // --- Delete ---

  describe('delete', () => {
    it('shows delete option when canDelete is true', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} canDelete />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);

      expect(screen.getByText('common:delete')).toBeInTheDocument();
    });

    it('hides delete option when canDelete is false', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} canDelete={false} />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);

      // Pin is always there but delete is not
      expect(screen.getByText('crossCutting.notes.pin')).toBeInTheDocument();
      expect(screen.queryByText('common:delete')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog before deleting', async () => {
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} canDelete />);

      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:delete'));

      expect(screen.getByText('crossCutting.notes.deleteConfirmTitle')).toBeInTheDocument();
      expect(screen.getByText('crossCutting.notes.deleteConfirmDescription')).toBeInTheDocument();
    });

    it('calls onDelete when delete is confirmed', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(<NoteCard {...defaultProps} onDelete={onDelete} canDelete />);

      // Open menu → click Delete → confirm
      const menuTrigger = screen.getByLabelText('crossCutting.notes.actions');
      await user.click(menuTrigger);
      await user.click(screen.getByText('common:delete'));

      // In the confirmation dialog, there are two 'common:delete' texts — the menu item and the confirm button
      // The dialog actions use AlertDialogAction
      const confirmButtons = screen.getAllByText('common:delete');
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      await user.click(confirmButton!);

      expect(onDelete).toHaveBeenCalledWith('note-1');
    });
  });
});
