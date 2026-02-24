import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BoardPage } from './board-page';
import type { BoardColumn } from './types';

// Mock useBreakpoint to default to desktop
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

interface MockCard {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  assignee?: string;
}

const mockColumns: BoardColumn<MockCard>[] = [
  {
    key: 'lead',
    labelKey: 'pipeline.lead',
    color: '#6b7280',
    cards: [
      { id: 'c1', title: 'Acme Corp Deal', subtitle: '£10,000', status: 'NEW', assignee: 'John' },
    ],
  },
  {
    key: 'negotiation',
    labelKey: 'pipeline.negotiation',
    color: '#3b82f6',
    cards: [
      { id: 'c2', title: 'Beta Inc Deal', subtitle: '£25,000', status: 'IN_PROGRESS', assignee: 'Sarah' },
      { id: 'c3', title: 'Gamma Ltd Deal', subtitle: '£8,000' },
    ],
  },
  {
    key: 'won',
    labelKey: 'pipeline.won',
    color: '#22c55e',
    cards: [],
  },
];

const defaultProps = {
  title: 'CRM Pipeline',
  breadcrumbs: [
    { label: 'Home', path: '/' },
    { label: 'CRM Pipeline' },
  ],
  columns: mockColumns,
};

describe('BoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders columns with cards', () => {
    render(<BoardPage {...defaultProps} />);

    // Column labels
    expect(screen.getByText('pipeline.lead')).toBeInTheDocument();
    expect(screen.getByText('pipeline.negotiation')).toBeInTheDocument();
    expect(screen.getByText('pipeline.won')).toBeInTheDocument();

    // Card titles
    expect(screen.getByText('Acme Corp Deal')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc Deal')).toBeInTheDocument();
    expect(screen.getByText('Gamma Ltd Deal')).toBeInTheDocument();

    // Card counts in badges
    expect(screen.getByText('1')).toBeInTheDocument(); // lead column count
    expect(screen.getByText('2')).toBeInTheDocument(); // negotiation column count
    expect(screen.getByText('0')).toBeInTheDocument(); // won column count
  });

  it('[+ New Card] button visible when canCreate === true', () => {
    render(
      <BoardPage {...defaultProps} canCreate onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText('board.newCard')).toBeInTheDocument();
  });

  it('[+ New Card] button calls onCreateNew when clicked', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(
      <BoardPage {...defaultProps} canCreate onCreateNew={onCreateNew} />,
    );

    await user.click(screen.getByText('board.newCard'));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('card click calls onCardClick', async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();

    render(
      <BoardPage {...defaultProps} onCardClick={onCardClick} />,
    );

    await user.click(screen.getByText('Acme Corp Deal'));
    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', title: 'Acme Corp Deal' }),
    );
  });

  it('renders empty column message for columns with no cards', () => {
    render(<BoardPage {...defaultProps} />);

    expect(screen.getByText('board.emptyColumn')).toBeInTheDocument();
  });

  it('has semantic main landmark with aria-label', () => {
    render(<BoardPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'CRM Pipeline');
  });

  it('renders card subtitles and assignee initials', () => {
    render(<BoardPage {...defaultProps} />);

    expect(screen.getByText('£10,000')).toBeInTheDocument();
    expect(screen.getByText('£25,000')).toBeInTheDocument();
    // Assignee initial
    expect(screen.getByText('J')).toBeInTheDocument(); // John
    expect(screen.getByText('S')).toBeInTheDocument(); // Sarah
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<BoardPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });
});
