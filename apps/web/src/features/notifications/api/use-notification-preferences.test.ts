import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// --- Mock auth store ---
let mockIsAuthenticated = true;
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
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

// --- Test data ---
const testPreferences = {
  items: [
    {
      templateId: 'tmpl-1',
      templateCode: 'INVOICE_APPROVED',
      templateName: 'Invoice Approved',
      eventName: 'invoice.approved',
      defaultChannels: ['IN_APP', 'EMAIL'],
      defaultPriority: 'NORMAL',
      enableInApp: true,
      enableEmail: true,
      enablePush: false,
      priorityOverride: null,
      isMuted: false,
      muteUntil: null,
      hasUserPreference: false,
    },
    {
      templateId: 'tmpl-2',
      templateCode: 'TASK_ASSIGNED',
      templateName: 'Task Assigned',
      eventName: 'task.assigned',
      defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
      defaultPriority: 'HIGH',
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      priorityOverride: 'URGENT',
      isMuted: false,
      muteUntil: null,
      hasUserPreference: true,
    },
  ],
};

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

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it('fetches and returns preference items', async () => {
    mockApiGet.mockResolvedValue({ data: testPreferences });

    const { useNotificationPreferences } = await import('./use-notification-preferences');
    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(testPreferences);
    expect(result.current.data!.items).toHaveLength(2);
    expect(mockApiGet).toHaveBeenCalledWith('/notifications/preferences');
  });

  it('does not fetch when not authenticated', async () => {
    mockIsAuthenticated = false;

    const { useNotificationPreferences } = await import('./use-notification-preferences');
    renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { useNotificationPreferences } = await import('./use-notification-preferences');
    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns items with hasUserPreference flag', async () => {
    mockApiGet.mockResolvedValue({ data: testPreferences });

    const { useNotificationPreferences } = await import('./use-notification-preferences');
    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const defaultItem = result.current.data!.items.find((i) => i.templateId === 'tmpl-1');
    const userItem = result.current.data!.items.find((i) => i.templateId === 'tmpl-2');

    expect(defaultItem!.hasUserPreference).toBe(false);
    expect(userItem!.hasUserPreference).toBe(true);
  });
});
