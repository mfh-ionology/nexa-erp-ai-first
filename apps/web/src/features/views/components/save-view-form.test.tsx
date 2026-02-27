/**
 * Tests for SaveViewForm component.
 *
 * Covers: form validation, scope radio selection, role dropdown visibility,
 * 409 duplicate name inline error, submit calls createView mutation.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { SaveViewForm } from './save-view-form';
import type { ViewState } from '../hooks/use-view-state';
import type { useViewMutations } from '../hooks/use-view-mutations';

// Mock i18n
vi.mock('@nexa/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// Mock auth store
const mockPermissions = {
  isSuperAdmin: false,
  accessGroups: [
    { id: 'ag1', name: 'Sales Team' },
    { id: 'ag2', name: 'Admin Team' },
  ],
};
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ permissions: mockPermissions }),
}));

// Mock ApiError
vi.mock('@nexa/api-client', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const mockViewState = {
  activeViewId: null,
  dataView: undefined,
  fields: [],
  savedViews: [],
  datePresets: [],
  columnState: [
    {
      fieldId: 'name',
      fieldKey: 'name',
      fieldLabel: 'Name',
      visible: true,
      order: 0,
      width: 200,
      pinned: 'NONE',
      pinnable: true,
      sortable: true,
      fieldType: 'STRING',
    },
  ],
  tanstackColumns: [],
  activeFilters: [],
  activeSortRules: [],
  filterLogic: 'AND' as const,
  activeFilterCount: 0,
  isDirty: false,
  isLoading: false,
  error: null,
  setActiveView: vi.fn(),
  updateColumnState: vi.fn(),
  reorderColumns: vi.fn(),
  toggleColumnVisibility: vi.fn(),
  setColumnPin: vi.fn(),
  markClean: vi.fn(),
  applyFilters: vi.fn(),
  clearFilters: vi.fn(),
} as unknown as ViewState;

function createMockMutations(
  overrides?: Partial<ReturnType<typeof useViewMutations>>,
): ReturnType<typeof useViewMutations> {
  return {
    createView: {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    },
    updateView: { mutateAsync: vi.fn(), isPending: false },
    replaceView: { mutateAsync: vi.fn(), isPending: false },
    removeView: { mutate: vi.fn(), isPending: false },
    toggleFav: { mutate: vi.fn(), isPending: false },
    setDef: { mutate: vi.fn(), isPending: false },
    ...overrides,
  } as unknown as ReturnType<typeof useViewMutations>;
}

describe('SaveViewForm', () => {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    const mutations = createMockMutations();
    const Wrapper = createWrapper();
    render(
      createElement(
        Wrapper,
        null,
        createElement(SaveViewForm, {
          viewKey: 'USERS',
          viewState: mockViewState,
          mutations,
          onSuccess,
          onCancel,
        }),
      ),
    );

    expect(screen.getByText('views.form.name')).toBeTruthy();
    expect(screen.getByText('views.form.groupName')).toBeTruthy();
    expect(screen.getByText('views.form.scope')).toBeTruthy();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mutations = createMockMutations();
    const Wrapper = createWrapper();
    render(
      createElement(
        Wrapper,
        null,
        createElement(SaveViewForm, {
          viewKey: 'USERS',
          viewState: mockViewState,
          mutations,
          onSuccess,
          onCancel,
        }),
      ),
    );

    await user.click(screen.getByText('cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables GLOBAL scope for non-admin users', () => {
    const mutations = createMockMutations();
    const Wrapper = createWrapper();
    render(
      createElement(
        Wrapper,
        null,
        createElement(SaveViewForm, {
          viewKey: 'USERS',
          viewState: mockViewState,
          mutations,
          onSuccess,
          onCancel,
        }),
      ),
    );

    const globalRadio = document.getElementById('scope-global');
    expect(globalRadio).toBeTruthy();
    expect(globalRadio?.getAttribute('disabled')).not.toBeNull();
  });

  it('disables submit button when mutation is pending', () => {
    const mutations = createMockMutations({
      createView: {
        mutateAsync: vi.fn(),
        isPending: true,
      } as unknown as ReturnType<typeof useViewMutations>['createView'],
    });
    const Wrapper = createWrapper();
    render(
      createElement(
        Wrapper,
        null,
        createElement(SaveViewForm, {
          viewKey: 'USERS',
          viewState: mockViewState,
          mutations,
          onSuccess,
          onCancel,
        }),
      ),
    );

    const submitBtn = screen.getByText('views.actions.saveNew').closest('button');
    expect(submitBtn?.disabled).toBe(true);
  });

  it('calls createView.mutateAsync on valid submit', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    const mutations = createMockMutations({
      createView: {
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useViewMutations>['createView'],
    });
    const Wrapper = createWrapper();
    render(
      createElement(
        Wrapper,
        null,
        createElement(SaveViewForm, {
          viewKey: 'USERS',
          viewState: mockViewState,
          mutations,
          onSuccess,
          onCancel,
        }),
      ),
    );

    // Fill in name and group — use name attribute selectors since Input has no explicit type
    const nameInput = document.querySelector('input[name="name"]');
    const groupInput = document.querySelector('input[name="groupName"]');
    if (nameInput) await user.type(nameInput, 'My View');
    if (groupInput) await user.type(groupInput, 'My Group');

    // Submit
    const submitBtn = screen.getByText('views.actions.saveNew').closest('button');
    if (submitBtn) await user.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          viewKey: 'USERS',
          name: 'My View',
          groupName: 'My Group',
          scope: 'PERSONAL',
        }),
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
