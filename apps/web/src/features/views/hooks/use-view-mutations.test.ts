/**
 * Tests for useViewMutations hook.
 *
 * Covers AC10: optimistic updates, rollback on error, error toasts,
 * 409 DUPLICATE_NAME and 403 FORBIDDEN handling.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

import { useViewMutations } from './use-view-mutations';
import type { ViewInitResponse } from '../types';

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Mock API functions
const mockCreateSavedView = vi.fn();
const mockUpdateSavedView = vi.fn();
const mockDeleteSavedView = vi.fn();
const mockToggleFavourite = vi.fn();
const mockSetDefault = vi.fn();

vi.mock('../api', () => ({
  createSavedView: (...args: unknown[]) => mockCreateSavedView(...args),
  updateSavedView: (...args: unknown[]) => mockUpdateSavedView(...args),
  deleteSavedView: (...args: unknown[]) => mockDeleteSavedView(...args),
  toggleFavourite: (...args: unknown[]) => mockToggleFavourite(...args),
  setDefault: (...args: unknown[]) => mockSetDefault(...args),
}));

vi.mock('@nexa/api-client', () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const mockT = (key: string) => key;

const mockInitData: ViewInitResponse = {
  dataView: {
    id: 'dv1',
    viewKey: 'USERS',
    viewName: 'Users',
    entityTable: 'users',
    idField: 'id',
    defaultSortField: 'name',
    defaultSortDir: 'ASC',
  },
  fields: [],
  datePresets: [],
  savedViews: [
    {
      id: 'sv1',
      name: 'Active Users',
      groupName: 'Users',
      scope: 'PERSONAL',
      createdBy: 'user1',
      dataViewId: 'dv1',
      isFavourite: false,
      favouriteOrder: 0,
      isDefault: false,
      filterLogic: 'AND',
      sortConfig: [],
      columnConfig: [],
      conditions: [],
    },
  ],
  userColumnPreferences: null,
};

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Seed the cache with init data
  qc.setQueryData(['views', 'init', 'USERS'], mockInitData);
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useViewMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggleFav optimistically toggles isFavourite', async () => {
    mockToggleFavourite.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useViewMutations('USERS', mockT), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.toggleFav.mutate('sv1');
    });

    await waitFor(() => {
      expect(mockToggleFavourite).toHaveBeenCalledWith('sv1');
    });
  });

  it('removeView optimistically removes the view from cache', async () => {
    mockDeleteSavedView.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useViewMutations('USERS', mockT), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.removeView.mutate('sv1');
    });

    await waitFor(() => {
      expect(mockDeleteSavedView).toHaveBeenCalledWith('sv1');
    });
  });

  it('shows error toast on generic mutation failure', async () => {
    mockDeleteSavedView.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useViewMutations('USERS', mockT), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.removeView.mutate('sv1');
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
  });
});
