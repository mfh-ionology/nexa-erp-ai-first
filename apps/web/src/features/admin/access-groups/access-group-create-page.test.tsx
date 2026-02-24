import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock @nexa/api-client errors (hoisted for vi.mock factory) ---
const { MockApiError } = vi.hoisted(() => {
  class _MockApiError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { MockApiError: _MockApiError };
});

vi.mock('@nexa/api-client', () => ({
  ApiError: MockApiError,
}));

// --- Mock TanStack Router ---
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// --- Mock sonner toast ---
const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: vi.fn(),
  },
}));

// --- Mock useCreateAccessGroup mutation ---
const mockMutateAsync = vi.fn();
vi.mock('./api/use-access-group-mutations', () => ({
  useCreateAccessGroup: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Dynamic import after mocks
async function renderPage() {
  const { AccessGroupCreatePage } = await import('./access-group-create-page');
  return render(<AccessGroupCreatePage />);
}

describe('AccessGroupCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Form rendering tests ---

  describe('form rendering', () => {
    it('renders Code, Name, Description fields', async () => {
      await renderPage();

      expect(screen.getByText('accessGroups.field.code')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.field.name')).toBeInTheDocument();
      expect(screen.getByText('accessGroups.field.description')).toBeInTheDocument();
    });

    it('code input transforms to uppercase', async () => {
      const user = userEvent.setup();
      await renderPage();

      const codeInput = screen.getByPlaceholderText('accessGroups.field.codePlaceholder');
      await user.type(codeInput, 'sales_mgr');

      expect(codeInput).toHaveValue('SALES_MGR');
    });

    it('renders breadcrumbs: System > Access Groups > New', async () => {
      await renderPage();

      const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(breadcrumbNav).toBeInTheDocument();
      expect(within(breadcrumbNav).getByText('navigation:system')).toBeInTheDocument();
      // Title appears in both breadcrumb and h1; scope to breadcrumb nav
      expect(within(breadcrumbNav).getByText('accessGroups.create.title')).toBeInTheDocument();
    });
  });

  // --- Validation tests ---

  describe('validation', () => {
    it('submit with empty Code shows required error', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Fill name but not code
      const nameInput = screen.getByPlaceholderText('accessGroups.field.namePlaceholder');
      await user.type(nameInput, 'Test Group');

      const submitButton = screen.getByRole('button', { name: 'common:create' });
      await user.click(submitButton);

      // Error appears in FormMessage and sr-only aria-live region
      await waitFor(() => {
        const errors = screen.getAllByText('accessGroups.validation.codeRequired');
        expect(errors.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('submit with empty Name shows required error', async () => {
      const user = userEvent.setup();
      await renderPage();

      // Fill code but not name
      const codeInput = screen.getByPlaceholderText('accessGroups.field.codePlaceholder');
      await user.type(codeInput, 'TEST_CODE');

      const submitButton = screen.getByRole('button', { name: 'common:create' });
      await user.click(submitButton);

      // Error appears in FormMessage and sr-only aria-live region
      await waitFor(() => {
        const errors = screen.getAllByText('accessGroups.validation.nameRequired');
        expect(errors.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('invalid code format (lowercase, special chars) shows format error', async () => {
      const user = userEvent.setup();
      await renderPage();

      const codeInput = screen.getByPlaceholderText('accessGroups.field.codePlaceholder');
      // Type digits first — the component uppercases, but "123" starts with a digit
      await user.type(codeInput, '123abc');

      const nameInput = screen.getByPlaceholderText('accessGroups.field.namePlaceholder');
      await user.type(nameInput, 'Test Group');

      const submitButton = screen.getByRole('button', { name: 'common:create' });
      await user.click(submitButton);

      // Error appears in FormMessage and sr-only aria-live region
      await waitFor(() => {
        const errors = screen.getAllByText('accessGroups.validation.codeFormat');
        expect(errors.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // --- Submission tests ---

  describe('submission', () => {
    it('valid submit calls POST and navigates to detail page', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({ id: 'ag-new', code: 'SALES_MGR', name: 'Sales Manager' });

      await renderPage();

      const codeInput = screen.getByPlaceholderText('accessGroups.field.codePlaceholder');
      await user.type(codeInput, 'SALES_MGR');

      const nameInput = screen.getByPlaceholderText('accessGroups.field.namePlaceholder');
      await user.type(nameInput, 'Sales Manager');

      const submitButton = screen.getByRole('button', { name: 'common:create' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          code: 'SALES_MGR',
          name: 'Sales Manager',
          description: undefined,
        });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('accessGroups.toast.created');
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/system/access-groups/ag-new' }),
      );
    });

    it('409 error shows duplicate code message on Code field', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new MockApiError('CONFLICT', 'Duplicate', 409));

      await renderPage();

      const codeInput = screen.getByPlaceholderText('accessGroups.field.codePlaceholder');
      await user.type(codeInput, 'DUPE');

      const nameInput = screen.getByPlaceholderText('accessGroups.field.namePlaceholder');
      await user.type(nameInput, 'Duplicate');

      const submitButton = screen.getByRole('button', { name: 'common:create' });
      await user.click(submitButton);

      // Error appears in FormMessage and sr-only aria-live region
      await waitFor(() => {
        const errors = screen.getAllByText('accessGroups.error.duplicateCode');
        expect(errors.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // --- Cancel tests ---

  describe('cancel', () => {
    it('cancel button navigates back to list', async () => {
      const user = userEvent.setup();
      await renderPage();

      const cancelButton = screen.getByRole('button', { name: 'common:cancel' });
      await user.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/system/access-groups' }),
      );
    });
  });
});
