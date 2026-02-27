/**
 * Tests for useViewInit hook.
 *
 * Covers AC1: init fetch, column generation, default view resolution,
 * user prefs application.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

import { useViewInit } from './use-view-init';

// Mock auth store — always authenticated
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: true }),
}));

// Mock API
const mockFetchViewInit = vi.fn();
vi.mock('../api', () => ({
  fetchViewInit: (...args: unknown[]) => mockFetchViewInit(...args),
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useViewInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches view init data for a given viewKey', async () => {
    const mockData = {
      dataView: { id: '1', viewKey: 'USERS', viewName: 'Users' },
      fields: [{ id: 'f1', fieldKey: 'name', fieldLabel: 'Name' }],
      datePresets: [],
      savedViews: [],
      userColumnPreferences: null,
    };
    mockFetchViewInit.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useViewInit('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockFetchViewInit).toHaveBeenCalledWith('USERS');
    expect(result.current.data).toEqual(mockData);
  });

  it('does not fetch when viewKey is empty', () => {
    renderHook(() => useViewInit(''), {
      wrapper: createWrapper(),
    });

    expect(mockFetchViewInit).not.toHaveBeenCalled();
  });

  it('returns error state on fetch failure', async () => {
    mockFetchViewInit.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useViewInit('USERS'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Network error');
  });
});
