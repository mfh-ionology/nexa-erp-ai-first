import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// --- Mock API client ---
const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

// --- Mock auth store ---
let mockIsAuthenticated = true;
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
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
      roleDefaults: (role: string) => ['notifications', 'role-defaults', role],
    },
  },
}));

// --- Test data ---
const testRoleDefaults = {
  role: 'STAFF',
  items: [
    {
      templateId: 'tmpl-1',
      templateCode: 'INVOICE_APPROVED',
      templateName: 'Invoice Approved',
      eventName: 'invoice.approved',
      defaultChannels: ['IN_APP', 'EMAIL'],
      enableInApp: true,
      enableEmail: false,
      enablePush: true,
      hasRoleDefault: true,
    },
    {
      templateId: 'tmpl-2',
      templateCode: 'TASK_ASSIGNED',
      templateName: 'Task Assigned',
      eventName: 'task.assigned',
      defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
      enableInApp: true,
      enableEmail: true,
      enablePush: true,
      hasRoleDefault: false,
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

// ---------------------------------------------------------------------------
// useRoleDefaults
// ---------------------------------------------------------------------------

describe('useRoleDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it('fetches role defaults for specified role', async () => {
    mockApiGet.mockResolvedValue({ data: testRoleDefaults });

    const { useRoleDefaults } = await import('./use-role-defaults');
    const { result } = renderHook(() => useRoleDefaults('STAFF'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(testRoleDefaults);
    expect(result.current.data!.items).toHaveLength(2);
    expect(mockApiGet).toHaveBeenCalledWith('/notifications/preferences/role-defaults?role=STAFF');
  });

  it('does not fetch when not authenticated', async () => {
    mockIsAuthenticated = false;

    const { useRoleDefaults } = await import('./use-role-defaults');
    renderHook(() => useRoleDefaults('STAFF'), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does not fetch when role is empty', async () => {
    const { useRoleDefaults } = await import('./use-role-defaults');
    renderHook(() => useRoleDefaults(''), {
      wrapper: createWrapper(),
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { useRoleDefaults } = await import('./use-role-defaults');
    const { result } = renderHook(() => useRoleDefaults('STAFF'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns items with hasRoleDefault flag', async () => {
    mockApiGet.mockResolvedValue({ data: testRoleDefaults });

    const { useRoleDefaults } = await import('./use-role-defaults');
    const { result } = renderHook(() => useRoleDefaults('STAFF'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const withDefault = result.current.data!.items.find((i) => i.templateId === 'tmpl-1');
    const withoutDefault = result.current.data!.items.find((i) => i.templateId === 'tmpl-2');

    expect(withDefault!.hasRoleDefault).toBe(true);
    expect(withoutDefault!.hasRoleDefault).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useUpdateRoleDefaults
// ---------------------------------------------------------------------------

describe('useUpdateRoleDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PUT with role and preferences, shows success toast', async () => {
    mockApiPut.mockResolvedValue({ data: { updated: 2 } });

    const { useUpdateRoleDefaults } = await import('./use-role-defaults');
    const { result } = renderHook(() => useUpdateRoleDefaults(), {
      wrapper: createWrapper(),
    });

    const input = {
      role: 'STAFF',
      preferences: [
        {
          notificationTemplateId: 'tmpl-1',
          enableInApp: true,
          enableEmail: false,
          enablePush: true,
        },
        {
          notificationTemplateId: 'tmpl-2',
          enableInApp: false,
          enableEmail: true,
          enablePush: false,
        },
      ],
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiPut).toHaveBeenCalledWith('/notifications/preferences/role-defaults', input);
    expect(mockToastSuccess).toHaveBeenCalledWith('preferences.roleDefaults.saveSuccess');
  });

  it('shows error toast on failure', async () => {
    mockApiPut.mockRejectedValue(new Error('Server error'));

    const { useUpdateRoleDefaults } = await import('./use-role-defaults');
    const { result } = renderHook(() => useUpdateRoleDefaults(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: 'tmpl-1',
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToastError).toHaveBeenCalledWith('preferences.roleDefaults.saveError');
  });

  it('returns updated count on success', async () => {
    mockApiPut.mockResolvedValue({ data: { updated: 3 } });

    const { useUpdateRoleDefaults } = await import('./use-role-defaults');
    const { result } = renderHook(() => useUpdateRoleDefaults(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        role: 'MANAGER',
        preferences: [
          {
            notificationTemplateId: 'tmpl-1',
            enableInApp: true,
            enableEmail: true,
            enablePush: false,
          },
          {
            notificationTemplateId: 'tmpl-2',
            enableInApp: false,
            enableEmail: false,
            enablePush: true,
          },
          {
            notificationTemplateId: 'tmpl-3',
            enableInApp: true,
            enableEmail: false,
            enablePush: false,
          },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ updated: 3 });
  });
});
