import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import type { DataViewFieldDto, LovStaticValue } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBatchFetchLov = vi.fn();
const mockFetchLov = vi.fn();

vi.mock('../../api', () => ({
  batchFetchLov: (...args: unknown[]) => mockBatchFetchLov(...args),
  fetchLov: (...args: unknown[]) => mockFetchLov(...args),
}));

vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    views: {
      lovBatch: (viewKey: string) => ['views', 'lov', 'batch', viewKey],
      lov: (fieldId: string) => ['views', 'lov', fieldId],
    },
  },
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<DataViewFieldDto> = {}): DataViewFieldDto {
  return {
    id: 'field-1',
    fieldKey: 'status',
    fieldLabel: 'Status',
    fieldType: 'ENUM',
    defaultVisible: true,
    defaultOrder: 0,
    defaultWidth: 150,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: false,
    lovType: 'NONE',
    lovScope: null,
    lovStaticValues: null,
    lovDependsOn: null,
    lovSearchMin: 0,
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

async function importHooks() {
  return import('../use-lov');
}

// ---------------------------------------------------------------------------
// useBatchLov
// ---------------------------------------------------------------------------

describe('useBatchLov', () => {
  let useBatchLov: Awaited<ReturnType<typeof importHooks>>['useBatchLov'];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await importHooks();
    useBatchLov = mod.useBatchLov;
  });

  it('only requests VIEW_SPECIFIC fields', async () => {
    const batchResult: Record<string, LovStaticValue[]> = {
      f2: [{ value: 'active', label: 'Active' }],
    };
    mockBatchFetchLov.mockResolvedValue(batchResult);

    const fields: DataViewFieldDto[] = [
      makeField({ id: 'f1', lovType: 'STATIC', lovStaticValues: [{ value: 'a', label: 'A' }] }),
      makeField({ id: 'f2', lovType: 'VIEW_SPECIFIC', lovScope: 'statuses' }),
      makeField({ id: 'f3', lovType: 'NONE' }),
    ];

    renderHook(() => useBatchLov('USERS', fields, true), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockBatchFetchLov).toHaveBeenCalledTimes(1);
    });

    // Only VIEW_SPECIFIC fields included in batch request
    expect(mockBatchFetchLov).toHaveBeenCalledWith([{ fieldId: 'f2', lovScope: 'statuses' }]);
  });

  it('returns static values from field metadata for STATIC type', async () => {
    mockBatchFetchLov.mockResolvedValue({});

    const staticValues: LovStaticValue[] = [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
    const fields: DataViewFieldDto[] = [
      makeField({ id: 'f1', lovType: 'STATIC', lovStaticValues: staticValues }),
    ];

    const { result } = renderHook(() => useBatchLov('USERS', fields, true), {
      wrapper: createWrapper(),
    });

    // STATIC values come from field metadata, not batch fetch
    await waitFor(() => {
      expect(result.current.lovData['f1']).toEqual(staticValues);
    });

    // No batch fetch should have been made (no VIEW_SPECIFIC fields)
    expect(mockBatchFetchLov).not.toHaveBeenCalled();
  });

  it('does not fetch when enabled is false', async () => {
    const fields: DataViewFieldDto[] = [
      makeField({ id: 'f1', lovType: 'VIEW_SPECIFIC', lovScope: 'test' }),
    ];

    renderHook(() => useBatchLov('USERS', fields, false), { wrapper: createWrapper() });

    // Give it time to potentially fire
    await new Promise((r) => setTimeout(r, 50));
    expect(mockBatchFetchLov).not.toHaveBeenCalled();
  });

  it('merges batch results with static values', async () => {
    const batchResult: Record<string, LovStaticValue[]> = {
      f2: [
        { value: 'open', label: 'Open' },
        { value: 'closed', label: 'Closed' },
      ],
    };
    mockBatchFetchLov.mockResolvedValue(batchResult);

    const staticValues: LovStaticValue[] = [{ value: 'a', label: 'Option A' }];
    const fields: DataViewFieldDto[] = [
      makeField({ id: 'f1', lovType: 'STATIC', lovStaticValues: staticValues }),
      makeField({ id: 'f2', lovType: 'VIEW_SPECIFIC', lovScope: 'statuses' }),
    ];

    const { result } = renderHook(() => useBatchLov('USERS', fields, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.lovData['f1']).toEqual(staticValues);
      expect(result.current.lovData['f2']).toEqual(batchResult['f2']);
    });
  });
});

// ---------------------------------------------------------------------------
// useLovSearch
// ---------------------------------------------------------------------------

describe('useLovSearch', () => {
  let useLovSearch: Awaited<ReturnType<typeof importHooks>>['useLovSearch'];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mod = await importHooks();
    useLovSearch = mod.useLovSearch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search input (300ms)', async () => {
    mockFetchLov.mockResolvedValue([{ value: 'result', label: 'Result' }]);

    const { result } = renderHook(() => useLovSearch('field-1', 'customers', 2), {
      wrapper: createWrapper(),
    });

    // Type a search term
    act(() => {
      result.current.setSearchTerm('abc');
    });

    // Immediately after setting, the debounced term hasn't updated yet
    expect(mockFetchLov).not.toHaveBeenCalled();

    // Advance timer past debounce (300ms)
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Now the API should have been called
    await waitFor(() => {
      expect(mockFetchLov).toHaveBeenCalledWith('customers', 'abc');
    });
  });

  it('only triggers API call when search length >= lovSearchMin', async () => {
    mockFetchLov.mockResolvedValue([]);

    const { result } = renderHook(() => useLovSearch('field-1', 'customers', 3), {
      wrapper: createWrapper(),
    });

    // Type only 2 characters (below lovSearchMin of 3)
    act(() => {
      result.current.setSearchTerm('ab');
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Should NOT have fetched since search length < lovSearchMin
    expect(mockFetchLov).not.toHaveBeenCalled();

    // Now type 3 characters
    act(() => {
      result.current.setSearchTerm('abc');
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockFetchLov).toHaveBeenCalledWith('customers', 'abc');
    });
  });

  it('returns empty results initially', () => {
    const { result } = renderHook(() => useLovSearch('field-1', 'customers', 2), {
      wrapper: createWrapper(),
    });

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
  });
});

// Need to import afterEach at top level
import { afterEach } from 'vitest';
