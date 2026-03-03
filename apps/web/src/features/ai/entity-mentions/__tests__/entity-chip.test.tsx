import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntityMention } from '../types';
import { EntityChip } from '../entity-chip';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const contactMention: EntityMention = {
  id: 'uuid-contact-1',
  type: 'Contact',
  name: 'John Smith',
  subtitle: 'john@example.com',
};

const invoiceMention: EntityMention = {
  id: 'uuid-invoice-1',
  type: 'Invoice',
  name: 'INV-1042',
  subtitle: 'Acme Ltd',
};

const unknownMention: EntityMention = {
  id: 'uuid-unknown-1',
  type: 'SomeNewType',
  name: 'Unknown Entity',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityChip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders entity name', () => {
    render(<EntityChip entity={contactMention} />);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('renders an icon (svg element present)', () => {
    const { container } = render(<EntityChip entity={contactMention} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders fallback icon for unknown entity types', () => {
    const { container } = render(<EntityChip entity={unknownMention} />);
    // Should still render an svg (the Tag fallback icon)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(screen.getByText('Unknown Entity')).toBeInTheDocument();
  });

  // ─── input variant ──────────────────────────────────────────────────────

  describe('input variant', () => {
    it('shows remove button when onRemove is provided', () => {
      const onRemove = vi.fn();
      render(<EntityChip entity={contactMention} variant="input" onRemove={onRemove} />);
      expect(
        screen.getByRole('button', { name: `Remove ${contactMention.name}` }),
      ).toBeInTheDocument();
    });

    it('does not show remove button when onRemove is not provided', () => {
      render(<EntityChip entity={contactMention} variant="input" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();
      render(<EntityChip entity={contactMention} variant="input" onRemove={onRemove} />);

      await user.click(screen.getByRole('button', { name: `Remove ${contactMention.name}` }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('applies input variant styling', () => {
      const { container } = render(
        <EntityChip entity={contactMention} variant="input" onRemove={vi.fn()} />,
      );
      const chip = container.firstElementChild;
      expect(chip?.className).toContain('bg-[#ede9fe]');
      expect(chip?.className).toContain('text-[#6d28d9]');
    });
  });

  // ─── user-message variant ──────────────────────────────────────────────

  describe('user-message variant', () => {
    it('hides remove button even when onRemove is provided', () => {
      render(<EntityChip entity={contactMention} variant="user-message" onRemove={vi.fn()} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('applies user-message variant styling', () => {
      const { container } = render(<EntityChip entity={contactMention} variant="user-message" />);
      const chip = container.firstElementChild;
      expect(chip?.className).toContain('bg-white/20');
      expect(chip?.className).toContain('text-white');
    });
  });

  // ─── assistant-message variant ─────────────────────────────────────────

  describe('assistant-message variant', () => {
    it('hides remove button even when onRemove is provided', () => {
      render(<EntityChip entity={contactMention} variant="assistant-message" onRemove={vi.fn()} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('applies assistant-message variant styling', () => {
      const { container } = render(
        <EntityChip entity={contactMention} variant="assistant-message" />,
      );
      const chip = container.firstElementChild;
      expect(chip?.className).toContain('bg-[#ede9fe]');
      expect(chip?.className).toContain('text-[#6d28d9]');
    });
  });

  // ─── accessibility ─────────────────────────────────────────────────────

  it('does not use role="status" (chip is not an ARIA live region)', () => {
    render(<EntityChip entity={contactMention} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('has aria-label on the remove button', () => {
    render(<EntityChip entity={invoiceMention} variant="input" onRemove={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', `Remove ${invoiceMention.name}`);
  });

  // ─── className merging ─────────────────────────────────────────────────

  it('merges custom className', () => {
    const { container } = render(
      <EntityChip entity={contactMention} className="my-custom-class" />,
    );
    const chip = container.firstElementChild;
    expect(chip?.className).toContain('my-custom-class');
  });
});
