import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiPut = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

// --- Mock toast ---
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// --- Mock i18n ---
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    notifications: {
      all: ['notifications'],
      preferences: () => ['notifications', 'preferences'],
    },
  },
}));

// --- Helper ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useUpdateNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PUT with preferences and shows success toast', async () => {
    mockApiPut.mockResolvedValue({ data: { updated: 2 } });

    const { useUpdateNotificationPreferences } =
      await import('./use-update-notification-preferences');
    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    const input = {
      preferences: [
        {
          notificationTemplateId: 'tmpl-1',
          enableEmail: false,
        },
        {
          notificationTemplateId: 'tmpl-2',
          enablePush: true,
        },
      ],
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPut).toHaveBeenCalledWith('/notifications/preferences', input);
    expect(mockToastSuccess).toHaveBeenCalledWith('preferences.saveSuccess');
  });

  it('shows error toast on failure', async () => {
    mockApiPut.mockRejectedValue(new Error('Server error'));

    const { useUpdateNotificationPreferences } =
      await import('./use-update-notification-preferences');
    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        preferences: [{ notificationTemplateId: 'tmpl-1', enableEmail: false }],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToastError).toHaveBeenCalledWith('preferences.saveError');
  });

  it('returns updated count on success', async () => {
    mockApiPut.mockResolvedValue({ data: { updated: 3 } });

    const { useUpdateNotificationPreferences } =
      await import('./use-update-notification-preferences');
    const { result } = renderHook(() => useUpdateNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        preferences: [
          { notificationTemplateId: 'tmpl-1', enableInApp: true },
          { notificationTemplateId: 'tmpl-2', enableEmail: false },
          { notificationTemplateId: 'tmpl-3', enablePush: true },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ updated: 3 });
  });
});
