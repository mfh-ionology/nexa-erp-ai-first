import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EntityListPage } from './entity-list-page';

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

interface MockRow {
  id: string;
  name: string;
  status: string;
  amount: string;
}

const mockColumns: ColumnDef<MockRow, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'amount', header: 'Amount' },
];

const mockData: MockRow[] = [
  { id: '1', name: 'Invoice 001', status: 'DRAFT', amount: '£100.00' },
  { id: '2', name: 'Invoice 002', status: 'POSTED', amount: '£250.00' },
  { id: '3', name: 'Invoice 003', status: 'APPROVED', amount: '£500.00' },
];

const defaultProps = {
  title: 'Invoices',
  breadcrumbs: [
    { label: 'Home', path: '/' },
    { label: 'Invoices' },
  ],
  columns: mockColumns,
  data: mockData,
  entityType: 'invoice',
  getRowId: (row: MockRow) => row.id,
};

describe('EntityListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, breadcrumbs, and data table with provided columns and data', () => {
    render(<EntityListPage {...defaultProps} />);

    // Title renders (h1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Invoices');

    // Breadcrumbs render
    expect(screen.getByText('Home')).toBeInTheDocument();

    // Table data renders
    expect(screen.getByText('Invoice 001')).toBeInTheDocument();
    expect(screen.getByText('Invoice 002')).toBeInTheDocument();
    expect(screen.getByText('Invoice 003')).toBeInTheDocument();

    // Column headers render
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('[+ New] button visible when canCreate === true, hidden when false', () => {
    const { rerender } = render(
      <EntityListPage {...defaultProps} canCreate={false} />,
    );

    // [+ New] button not visible
    expect(screen.queryByText('new')).not.toBeInTheDocument();

    // Re-render with canCreate true
    rerender(
      <EntityListPage {...defaultProps} canCreate onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('[+ New] button calls onCreateNew when clicked', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(
      <EntityListPage {...defaultProps} canCreate onCreateNew={onCreateNew} />,
    );

    await user.click(screen.getByText('new'));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('row selection shows batch action bar with correct selected count', async () => {
    const user = userEvent.setup();
    const onBatchAction = vi.fn();

    render(
      <EntityListPage
        {...defaultProps}
        batchActions={[
          {
            key: 'delete',
            labelKey: 'batchDelete',
            variant: 'destructive',
            onAction: onBatchAction,
          },
        ]}
      />,
    );

    // Select the first row's checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all", subsequent are row checkboxes
    await user.click(checkboxes[1]!);

    // Batch action bar should appear
    expect(screen.getByText('selected')).toBeInTheDocument();
    expect(screen.getByText('batchDelete')).toBeInTheDocument();
  });

  it('"Load More" button visible when hasMore === true, hidden when false', () => {
    const { rerender } = render(
      <EntityListPage {...defaultProps} hasMore={false} />,
    );

    expect(screen.queryByText('loadMore')).not.toBeInTheDocument();

    rerender(
      <EntityListPage
        {...defaultProps}
        hasMore
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('loadMore')).toBeInTheDocument();
  });

  it('"Load More" button calls onLoadMore when clicked', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();

    render(
      <EntityListPage {...defaultProps} hasMore onLoadMore={onLoadMore} />,
    );

    await user.click(screen.getByText('loadMore'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('search input calls onSearchChange on input', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(
      <EntityListPage
        {...defaultProps}
        searchValue=""
        onSearchChange={onSearchChange}
      />,
    );

    const searchInput = screen.getByRole('textbox', { name: 'search' });
    await user.type(searchInput, 'test');

    expect(onSearchChange).toHaveBeenCalled();
  });

  it('empty state shows "No results found" message', () => {
    render(
      <EntityListPage {...defaultProps} data={[]} />,
    );

    expect(screen.getByText('noResults')).toBeInTheDocument();
  });

  it('row click calls onRowClick', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    render(
      <EntityListPage {...defaultProps} onRowClick={onRowClick} />,
    );

    // Click on a table row (find by the row data text)
    const row = screen.getByText('Invoice 001').closest('tr');
    expect(row).toBeTruthy();
    await user.click(row!);

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('has semantic main landmark with aria-label', () => {
    render(<EntityListPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Invoices');
  });

  it('renders overflow menu when overflowActions provided', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <EntityListPage
        {...defaultProps}
        overflowActions={[
          { key: 'export', labelKey: 'common.exportCsv', onAction: onExport },
        ]}
      />,
    );

    // Click the overflow menu button
    const overflowButton = screen.getByRole('button', { name: 'actions' });
    await user.click(overflowButton);

    expect(screen.getByText('common.exportCsv')).toBeInTheDocument();
  });
});
