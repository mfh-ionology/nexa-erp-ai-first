import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Memory } from '../../types';

import { MemoryCard } from '../memory-card';

// --- Fixtures ---

const baseMemory: Memory = {
  id: 'mem-1',
  userId: 'user-1',
  companyId: 'company-1',
  category: 'PREFERENCE',
  content: 'User prefers dark mode and compact layouts',
  source: 'EXPLICIT',
  importance: 0.8,
  lastAccessedAt: '2026-02-28T10:00:00Z',
  metadata: null,
  createdAt: '2026-02-25T08:00:00Z',
  updatedAt: '2026-02-28T10:00:00Z',
};

const longContentMemory: Memory = {
  ...baseMemory,
  id: 'mem-2',
  content:
    'This is a very long memory content that should be truncated to approximately three lines when displayed in the memory card component. It contains extensive detail about user preferences and workflows that the AI has learned over many interactions with the user across multiple sessions and modules within the ERP system.',
};

const learnedMemory: Memory = {
  ...baseMemory,
  id: 'mem-3',
  source: 'IMPLICIT',
  lastAccessedAt: null,
};

const defaultProps = {
  memory: baseMemory,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  index: 0,
};

describe('MemoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering tests ---

  it('renders content, category badge, source badge, and dates', () => {
    render(<MemoryCard {...defaultProps} />);

    // Content text
    expect(screen.getByText(/User prefers dark mode/)).toBeInTheDocument();

    // Category badge — i18n key returned as text
    expect(screen.getByText('memory.settings.preference')).toBeInTheDocument();

    // Source badge — explicit
    expect(screen.getByText('memory.source.explicit')).toBeInTheDocument();

    // Creation date — uses i18n key with date param
    expect(screen.getByText(/memory\.created/)).toBeInTheDocument();

    // Last used date — uses i18n key with date param
    expect(screen.getByText(/memory\.lastUsed/)).toBeInTheDocument();
  });

  it('renders as a semantic article element', () => {
    render(<MemoryCard {...defaultProps} />);

    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('renders "Learned" source badge for implicit memories', () => {
    render(<MemoryCard {...defaultProps} memory={learnedMemory} />);

    expect(screen.getByText('memory.source.implicit')).toBeInTheDocument();
    expect(screen.queryByText('memory.source.explicit')).not.toBeInTheDocument();
  });

  it('does not render last used date when lastAccessedAt is null', () => {
    render(<MemoryCard {...defaultProps} memory={learnedMemory} />);

    expect(screen.queryByText(/memory\.lastUsed/)).not.toBeInTheDocument();
  });

  // --- Edit and delete buttons ---

  it('edit and delete buttons are present and have aria-labels', () => {
    render(<MemoryCard {...defaultProps} />);

    const editBtn = screen.getByRole('button', { name: 'memory.edit' });
    const deleteBtn = screen.getByRole('button', { name: 'memory.deleteTitle' });

    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();
  });

  it('edit button calls onEdit with memory id', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<MemoryCard {...defaultProps} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'memory.edit' }));
    expect(onEdit).toHaveBeenCalledWith('mem-1');
  });

  it('delete button calls onDelete with memory id', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<MemoryCard {...defaultProps} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'memory.deleteTitle' }));
    expect(onDelete).toHaveBeenCalledWith('mem-1');
  });

  // --- Content expansion ---

  it('truncated content expands on click', async () => {
    const user = userEvent.setup();
    render(<MemoryCard {...defaultProps} memory={longContentMemory} />);

    // Initially has line-clamp-3 class (truncated)
    const contentParagraph = screen.getByText(/This is a very long memory content/);
    expect(contentParagraph.className).toContain('line-clamp-3');

    // Click the content area button to expand
    const expandButton = screen.getByRole('button', { name: /memory\.expandContent/ });
    await user.click(expandButton);

    // After click, line-clamp-3 should be removed (expanded)
    expect(contentParagraph.className).not.toContain('line-clamp-3');
  });

  it('expanded content collapses on second click', async () => {
    const user = userEvent.setup();
    render(<MemoryCard {...defaultProps} memory={longContentMemory} />);

    const expandButton = screen.getByRole('button', { name: /memory\.expandContent/ });

    // First click — expand
    await user.click(expandButton);
    const contentParagraph = screen.getByText(/This is a very long memory content/);
    expect(contentParagraph.className).not.toContain('line-clamp-3');

    // Second click — collapse
    await user.click(expandButton);
    expect(contentParagraph.className).toContain('line-clamp-3');
  });

  // --- Animation delay based on index ---

  it('applies staggered animation delay based on index prop', () => {
    const { container } = render(<MemoryCard {...defaultProps} index={3} />);

    const article = container.querySelector('article');
    expect(article?.style.animationDelay).toBe('180ms');
  });

  // --- Category badge variants ---

  it('renders different category badges correctly', () => {
    const categories = [
      { category: 'WORKFLOW' as const, expected: 'memory.settings.workflow' },
      { category: 'DECISION' as const, expected: 'memory.settings.decision' },
      { category: 'INSTRUCTION' as const, expected: 'memory.settings.instruction' },
      { category: 'ENTITY_CONTEXT' as const, expected: 'memory.settings.entityContext' },
    ];

    for (const { category, expected } of categories) {
      const { unmount } = render(
        <MemoryCard {...defaultProps} memory={{ ...baseMemory, category }} />,
      );
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    }
  });
});
