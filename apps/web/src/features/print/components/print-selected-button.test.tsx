/* eslint-disable i18next/no-literal-string */

/**
 * Tests for <PrintSelectedButton>.
 *
 * Covers Task 4.3:
 * - Disabled state when no selection
 * - Progress display during batch operation
 * - Click triggers batch print
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { BatchPrintStatus } from '../hooks/use-batch-print';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockExecuteBatchPrint = vi.fn();
const mockCancel = vi.fn();
let mockBatchStatus: BatchPrintStatus = {
  state: 'idle',
  total: 0,
  completed: 0,
  failed: 0,
  errors: [],
};

vi.mock('../hooks/use-batch-print', () => ({
  useBatchPrint: () => ({
    executeBatchPrint: mockExecuteBatchPrint,
    batchStatus: mockBatchStatus,
    cancel: mockCancel,
  }),
}));

vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{{${k}}}`, v);
        }
        return result;
      }
      return key;
    },
  }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PrintSelectedButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchStatus = {
      state: 'idle',
      total: 0,
      completed: 0,
      failed: 0,
      errors: [],
    };
  });

  async function importAndRender(selectedIds: string[] = []) {
    const { PrintSelectedButton } = await import('./print-selected-button');
    return render(<PrintSelectedButton documentType="SALES_INVOICE" selectedIds={selectedIds} />);
  }

  it('renders disabled when no rows are selected', async () => {
    await importAndRender([]);

    const button = screen.getByTestId('print-selected-button');
    expect(button).toBeDisabled();
  });

  it('renders enabled when rows are selected', async () => {
    await importAndRender(['inv-1', 'inv-2']);

    const button = screen.getByTestId('print-selected-button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('actions.printSelectedCount');
  });

  it('triggers batch print on click', async () => {
    const user = userEvent.setup();
    await importAndRender(['inv-1', 'inv-2']);

    const button = screen.getByTestId('print-selected-button');
    await user.click(button);

    expect(mockExecuteBatchPrint).toHaveBeenCalledWith('SALES_INVOICE', ['inv-1', 'inv-2']);
  });

  it('shows progress during batch generation', async () => {
    mockBatchStatus = {
      state: 'generating',
      total: 5,
      completed: 2,
      failed: 0,
      errors: [],
    };

    await importAndRender(['inv-1']);

    const button = screen.getByTestId('print-selected-button');
    expect(button).toHaveTextContent('actions.batchGenerating');
    expect(button).not.toBeDisabled();
  });

  it('shows spinner icon during active batch operation', async () => {
    mockBatchStatus = {
      state: 'downloading',
      total: 3,
      completed: 1,
      failed: 0,
      errors: [],
    };

    await importAndRender(['inv-1']);

    // Loader2 icon has animate-spin class when active
    const button = screen.getByTestId('print-selected-button');
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('calls cancel when clicked during active batch', async () => {
    mockBatchStatus = {
      state: 'generating',
      total: 3,
      completed: 1,
      failed: 0,
      errors: [],
    };

    const user = userEvent.setup();
    await importAndRender(['inv-1']);

    const button = screen.getByTestId('print-selected-button');
    await user.click(button);

    expect(mockCancel).toHaveBeenCalled();
    expect(mockExecuteBatchPrint).not.toHaveBeenCalled();
  });

  it('is enabled during active batch even with empty selectedIds', async () => {
    mockBatchStatus = {
      state: 'printing',
      total: 2,
      completed: 0,
      failed: 0,
      errors: [],
    };

    await importAndRender([]);

    const button = screen.getByTestId('print-selected-button');
    expect(button).not.toBeDisabled();
  });
});
