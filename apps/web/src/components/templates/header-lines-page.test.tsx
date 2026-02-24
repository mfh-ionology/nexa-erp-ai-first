import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { HeaderLinesPage } from './header-lines-page';

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

interface MockLine {
  id: string;
  item: string;
  description: string;
  qty: number;
  price: string;
  total: string;
}

const mockLineColumns: ColumnDef<MockLine, unknown>[] = [
  { accessorKey: 'item', header: 'Item' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'qty', header: 'Qty' },
  { accessorKey: 'price', header: 'Price' },
  { accessorKey: 'total', header: 'Total' },
];

const mockLines: MockLine[] = [
  { id: 'l1', item: 'Widget A', description: 'Standard widget', qty: 2, price: '£50.00', total: '£100.00' },
  { id: 'l2', item: 'Widget B', description: 'Premium widget', qty: 1, price: '£150.00', total: '£150.00' },
];

const defaultProps = {
  title: 'Invoice INV-001',
  breadcrumbs: [
    { label: 'Home', path: '/' },
    { label: 'Invoices', path: '/invoices' },
    { label: 'INV-001' },
  ],
  entityType: 'invoice',
  status: 'DRAFT',
  headerTabs: [
    { key: 'main', labelKey: 'tabs.main', content: <div>Main fields</div> },
    { key: 'terms', labelKey: 'tabs.terms', content: <div>Terms content</div> },
  ],
  lineColumns: mockLineColumns,
  lines: mockLines,
  getLineId: (line: MockLine) => line.id,
};

describe('HeaderLinesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header tabs and switches on click', async () => {
    const user = userEvent.setup();
    const onHeaderTabChange = vi.fn();

    render(
      <HeaderLinesPage
        {...defaultProps}
        onHeaderTabChange={onHeaderTabChange}
      />,
    );

    // First tab content visible
    expect(screen.getByText('Main fields')).toBeInTheDocument();

    // Click second tab
    await user.click(screen.getByRole('tab', { name: 'tabs.terms' }));
    expect(onHeaderTabChange).toHaveBeenCalledWith('terms');
  });

  it('renders line items table with provided data', () => {
    render(<HeaderLinesPage {...defaultProps} />);

    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Widget B')).toBeInTheDocument();
    expect(screen.getByText('Standard widget')).toBeInTheDocument();
    expect(screen.getByText('Premium widget')).toBeInTheDocument();
  });

  it('[+ Add Line] button calls onAddLine', async () => {
    const user = userEvent.setup();
    const onAddLine = vi.fn();

    render(
      <HeaderLinesPage {...defaultProps} onAddLine={onAddLine} isEditable />,
    );

    const addButton = screen.getByText('addLine');
    await user.click(addButton);
    expect(onAddLine).toHaveBeenCalledTimes(1);
  });

  it('remove button calls onRemoveLine with correct index', async () => {
    const user = userEvent.setup();
    const onRemoveLine = vi.fn();

    render(
      <HeaderLinesPage
        {...defaultProps}
        onRemoveLine={onRemoveLine}
        isEditable
      />,
    );

    // Find all remove buttons (trash icons)
    const removeButtons = screen.getAllByRole('button', { name: 'removeLine' });
    expect(removeButtons.length).toBe(2);

    // Click the second remove button
    await user.click(removeButtons[1]!);
    expect(onRemoveLine).toHaveBeenCalledWith(1);
  });

  it('totals section displays subtotal, VAT, and total', () => {
    render(
      <HeaderLinesPage
        {...defaultProps}
        lines={[]} // Empty lines to avoid duplicate price values
        totals={{
          subtotal: '£250.00',
          vatAmount: '£50.00',
          vatRate: '20%',
          total: '£300.00',
        }}
      />,
    );

    expect(screen.getByText('subtotal')).toBeInTheDocument();
    expect(screen.getByText('£250.00')).toBeInTheDocument();
    expect(screen.getByText('vatAmount')).toBeInTheDocument();
    expect(screen.getByText('£50.00')).toBeInTheDocument();
    // 'total' appears twice in TotalsSection (label key) - use getAllByText
    expect(screen.getAllByText('total').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('£300.00')).toBeInTheDocument();
  });

  it('read-only mode hides add/remove controls when isEditable === false', () => {
    render(
      <HeaderLinesPage {...defaultProps} isEditable={false} />,
    );

    // No "Add Line" button
    expect(screen.queryByText('addLine')).not.toBeInTheDocument();

    // No remove buttons
    expect(screen.queryByRole('button', { name: 'removeLine' })).not.toBeInTheDocument();
  });

  it('renders status badge in header', () => {
    render(<HeaderLinesPage {...defaultProps} />);

    expect(screen.getByLabelText('status.ariaLabel')).toBeInTheDocument();
  });

  it('has semantic main landmark with aria-label', () => {
    render(<HeaderLinesPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Invoice INV-001');
  });

  it('renders action bar slot when provided', () => {
    render(
      <HeaderLinesPage
        {...defaultProps}
        actionBarSlot={<button type="button">Approve</button>}
      />,
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<HeaderLinesPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });
});
