import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ReportPage } from './report-page';

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

interface MockResult {
  id: string;
  account: string;
  debit: string;
  credit: string;
}

const mockResultColumns: ColumnDef<MockResult, unknown>[] = [
  { accessorKey: 'account', header: 'Account' },
  { accessorKey: 'debit', header: 'Debit' },
  { accessorKey: 'credit', header: 'Credit' },
];

const mockResultData: MockResult[] = [
  { id: '1', account: 'Sales Revenue', debit: '', credit: '£10,000' },
  { id: '2', account: 'Cost of Goods', debit: '£6,000', credit: '' },
];

const defaultProps = {
  title: 'Trial Balance',
  breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Reports', path: '/reports' }, { label: 'Trial Balance' }],
  parameterSlot: <div>Date range picker and filters</div>,
};

describe('ReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders parameter section', () => {
    render(<ReportPage {...defaultProps} />);

    expect(screen.getByText('parameters')).toBeInTheDocument();
    expect(screen.getByText('Date range picker and filters')).toBeInTheDocument();
  });

  it('Run Report button triggers onRunReport callback', async () => {
    const user = userEvent.setup();
    const onRunReport = vi.fn();

    render(<ReportPage {...defaultProps} onRunReport={onRunReport} />);

    await user.click(screen.getByText('runReport'));
    expect(onRunReport).toHaveBeenCalledTimes(1);
  });

  it('results shown after run', () => {
    render(
      <ReportPage
        {...defaultProps}
        hasResults
        resultColumns={mockResultColumns}
        resultData={mockResultData}
      />,
    );

    expect(screen.getByText('results')).toBeInTheDocument();
    expect(screen.getByText('Sales Revenue')).toBeInTheDocument();
    expect(screen.getByText('Cost of Goods')).toBeInTheDocument();
  });

  it('results not shown when hasResults is false', () => {
    render(
      <ReportPage
        {...defaultProps}
        hasResults={false}
        resultColumns={mockResultColumns}
        resultData={mockResultData}
      />,
    );

    expect(screen.queryByText('Sales Revenue')).not.toBeInTheDocument();
  });

  it('AI summary shown when hasResults is true and slot is provided', () => {
    render(
      <ReportPage
        {...defaultProps}
        hasResults
        resultColumns={mockResultColumns}
        resultData={mockResultData}
        aiSummarySlot={<p>Total revenue is £10,000 with expenses of £6,000</p>}
      />,
    );

    expect(screen.getByText('aiSummary')).toBeInTheDocument();
    expect(screen.getByText('Total revenue is £10,000 with expenses of £6,000')).toBeInTheDocument();
  });

  it('AI summary not shown when hasResults is false', () => {
    render(
      <ReportPage
        {...defaultProps}
        hasResults={false}
        aiSummarySlot={<p>Summary text</p>}
      />,
    );

    expect(screen.queryByText('Summary text')).not.toBeInTheDocument();
  });

  it('totals row renders when provided', () => {
    render(
      <ReportPage
        {...defaultProps}
        hasResults
        resultColumns={mockResultColumns}
        resultData={mockResultData}
        totals={{ debit: '£6,000', credit: '£10,000' }}
      />,
    );

    // Totals should include the total label and values
    expect(screen.getByText('total')).toBeInTheDocument();
  });

  it('Run Report button disabled when isRunning is true', () => {
    render(
      <ReportPage {...defaultProps} isRunning onRunReport={vi.fn()} />,
    );

    const runButton = screen.getByText('runReport').closest('button');
    expect(runButton).toBeDisabled();
  });

  it('has semantic main landmark with aria-label', () => {
    render(<ReportPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Trial Balance');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<ReportPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });

  it('overflow menu has export and print options', async () => {
    const user = userEvent.setup();

    render(<ReportPage {...defaultProps} />);

    // Click the overflow menu button
    const overflowButton = screen.getByRole('button', { name: 'actions' });
    await user.click(overflowButton);

    expect(screen.getByText('exportCsv')).toBeInTheDocument();
    expect(screen.getByText('exportExcel')).toBeInTheDocument();
    expect(screen.getByText('print')).toBeInTheDocument();
  });
});
