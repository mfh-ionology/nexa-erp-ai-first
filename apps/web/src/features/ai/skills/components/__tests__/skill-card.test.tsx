import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Skill } from '../../types';

import { SkillCard } from '../skill-card';

// --- Fixtures ---

const baseSkill: Skill = {
  id: 'skill-1',
  name: 'create-invoice',
  displayName: 'Create Invoice',
  description: 'Creates a new sales invoice with line items',
  category: 'domain',
  moduleKey: 'finance',
  packKey: 'core-finance',
  triggerPhrases: ['create invoice', 'new invoice', 'make an invoice'],
  negativeTriggers: ['delete invoice', 'void invoice'],
  orchestrationPattern: 'SEQUENTIAL',
  skillContent: 'skill instructions here',
  requiredTools: ['createInvoice', 'lookupCustomer'],
  parameters: null,
  examples: null,
  priority: 10,
  version: '1.0.0',
  isActive: true,
  hasOverride: false,
};

const inactiveSkill: Skill = {
  ...baseSkill,
  id: 'skill-2',
  name: 'deprecated-skill',
  displayName: 'Deprecated Skill',
  isActive: false,
};

const overrideSkill: Skill = {
  ...baseSkill,
  id: 'skill-3',
  hasOverride: true,
};

const noTriggersSkill: Skill = {
  ...baseSkill,
  id: 'skill-4',
  triggerPhrases: [],
  negativeTriggers: [],
};

const defaultProps = {
  skill: baseSkill,
  isAdmin: false,
  onClick: vi.fn(),
  index: 0,
};

describe('SkillCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering tests ---

  it('renders name, description, triggers, and pattern', () => {
    render(<SkillCard {...defaultProps} />);

    // Display name
    expect(screen.getByText('Create Invoice')).toBeInTheDocument();

    // Description
    expect(screen.getByText('Creates a new sales invoice with line items')).toBeInTheDocument();

    // Pattern badge — i18n key
    expect(screen.getByText('skills.patterns.SEQUENTIAL')).toBeInTheDocument();
  });

  it('renders trigger phrases as green-styled tags', () => {
    render(<SkillCard {...defaultProps} />);

    // Trigger phrases rendered
    expect(screen.getByText('create invoice')).toBeInTheDocument();
    expect(screen.getByText('new invoice')).toBeInTheDocument();
    expect(screen.getByText('make an invoice')).toBeInTheDocument();

    // Verify green styling (bg-[#d1fae5] text-[#065f46])
    const triggerEl = screen.getByText('create invoice');
    expect(triggerEl.className).toContain('bg-[#d1fae5]');
    expect(triggerEl.className).toContain('text-[#065f46]');
  });

  it('renders negative triggers as red-styled tags', () => {
    render(<SkillCard {...defaultProps} />);

    expect(screen.getByText('delete invoice')).toBeInTheDocument();
    expect(screen.getByText('void invoice')).toBeInTheDocument();

    // Verify red styling (bg-[#fee2e2] text-[#991b1b])
    const negTriggerEl = screen.getByText('delete invoice');
    expect(negTriggerEl.className).toContain('bg-[#fee2e2]');
    expect(negTriggerEl.className).toContain('text-[#991b1b]');
  });

  it('does not render trigger sections when arrays are empty', () => {
    render(<SkillCard {...defaultProps} skill={noTriggersSkill} />);

    expect(screen.queryByText('skills.triggers')).not.toBeInTheDocument();
    expect(screen.queryByText('skills.blocks')).not.toBeInTheDocument();
  });

  // --- Active/inactive indicator ---

  it('shows active indicator for active skills', () => {
    render(<SkillCard {...defaultProps} />);

    expect(screen.getByText('skills.active')).toBeInTheDocument();
    expect(screen.queryByText('skills.inactive')).not.toBeInTheDocument();
  });

  it('shows inactive indicator for inactive skills', () => {
    render(<SkillCard {...defaultProps} skill={inactiveSkill} />);

    expect(screen.getByText('skills.inactive')).toBeInTheDocument();
  });

  it('active indicator has green dot', () => {
    const { container } = render(<SkillCard {...defaultProps} />);

    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-[#10b981]');
  });

  it('inactive indicator has grey dot', () => {
    const { container } = render(<SkillCard {...defaultProps} skill={inactiveSkill} />);

    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-[#9ca3af]');
  });

  // --- Override badge ---

  it('shows override badge when hasOverride is true', () => {
    render(<SkillCard {...defaultProps} skill={overrideSkill} />);

    expect(screen.getByText('skills.overrideApplied')).toBeInTheDocument();
  });

  it('does not show override badge when hasOverride is false', () => {
    render(<SkillCard {...defaultProps} />);

    expect(screen.queryByText('skills.overrideApplied')).not.toBeInTheDocument();
  });

  // --- Click event ---

  it('click event fires with skill data', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SkillCard {...defaultProps} onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(baseSkill);
  });

  it('keyboard Enter fires click handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SkillCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledWith(baseSkill);
  });

  it('keyboard Space fires click handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SkillCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledWith(baseSkill);
  });

  // --- Accessibility ---

  it('has accessible label combining name and description', () => {
    render(<SkillCard {...defaultProps} />);

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute(
      'aria-label',
      'Create Invoice: Creates a new sales invoice with line items',
    );
  });

  it('is focusable via tabIndex', () => {
    render(<SkillCard {...defaultProps} />);

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  // --- Animation delay ---

  it('applies staggered animation delay based on index', () => {
    const { container } = render(<SkillCard {...defaultProps} index={2} />);

    const article = container.querySelector('article');
    expect(article?.style.animationDelay).toBe('120ms');
  });

  // --- Falls back to name when displayName is empty ---

  it('falls back to name when displayName is empty', () => {
    render(<SkillCard {...defaultProps} skill={{ ...baseSkill, displayName: '' }} />);

    expect(screen.getByText('create-invoice')).toBeInTheDocument();
  });
});
