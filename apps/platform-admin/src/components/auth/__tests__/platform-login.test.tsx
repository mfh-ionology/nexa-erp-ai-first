import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  usePlatformAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      login: mockLogin,
    }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => mockNavigate),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: '/api/v1',
}));

import { PlatformLogin } from '../platform-login';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(response: { status?: number; ok?: boolean; json: unknown }) {
  return vi.fn().mockResolvedValue({
    status: response.status ?? 200,
    ok: response.ok ?? true,
    json: () => Promise.resolve(response.json),
  });
}

const successResponse = {
  success: true,
  data: {
    accessToken: 'test-token-123',
    expiresIn: 3600,
    platformUser: {
      id: 'user-1',
      email: 'admin@nexa.io',
      displayName: 'Admin User',
      role: 'PLATFORM_ADMIN',
    },
  },
};

const mfaChallengeResponse = {
  success: true,
  data: {
    requiresMfa: true,
  },
};

const errorResponse = {
  success: false,
  data: null,
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlatformLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch({ json: successResponse });
  });

  describe('Rendering', () => {
    it('renders email and password fields', () => {
      render(<PlatformLogin />);

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('renders "Platform Admin" branding', () => {
      render(<PlatformLogin />);

      expect(screen.getByText('Platform Admin')).toBeInTheDocument();
      expect(screen.getByText('Sign in to the Nexa platform dashboard')).toBeInTheDocument();
    });

    it('does not show MFA code field initially', () => {
      render(<PlatformLogin />);

      expect(screen.queryByLabelText('MFA Code')).not.toBeInTheDocument();
    });
  });

  describe('MFA flow', () => {
    it('MFA code field appears after 202 response', async () => {
      globalThis.fetch = mockFetch({
        status: 202,
        ok: true,
        json: mfaChallengeResponse,
      });

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByLabelText('MFA Code')).toBeInTheDocument();
      });

      // Button text changes to "Verify & Sign In"
      expect(screen.getByRole('button', { name: 'Verify & Sign In' })).toBeInTheDocument();
    });

    it('sends MFA code on second submission', async () => {
      // First call returns MFA challenge, second call returns success
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          status: 202,
          ok: true,
          json: () => Promise.resolve(mfaChallengeResponse),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(successResponse),
        });
      globalThis.fetch = fetchMock;

      const user = userEvent.setup();
      render(<PlatformLogin />);

      // First submission — triggers MFA
      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByLabelText('MFA Code')).toBeInTheDocument();
      });

      // Second submission — with MFA code
      await user.type(screen.getByLabelText('MFA Code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Verify & Sign In' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      // Second call should include mfaCode
      const secondCallBody = JSON.parse(fetchMock.mock.calls[1]![1].body);
      expect(secondCallBody.mfaCode).toBe('123456');
    });
  });

  describe('Successful login', () => {
    it('updates auth store and navigates to dashboard', async () => {
      globalThis.fetch = mockFetch({ json: successResponse });

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          {
            id: 'user-1',
            email: 'admin@nexa.io',
            displayName: 'Admin User',
            role: 'PLATFORM_ADMIN',
          },
          'test-token-123',
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });

    it('sends credentials to correct endpoint with correct headers', async () => {
      const fetchMock = mockFetch({ json: successResponse });
      globalThis.fetch = fetchMock;

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'secret');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const [url, options] = fetchMock.mock.calls[0]!;
      expect(url).toContain('/admin/auth/login');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.credentials).toBe('include');

      const body = JSON.parse(options.body);
      expect(body.email).toBe('admin@nexa.io');
      expect(body.password).toBe('secret');
    });
  });

  describe('Failed login', () => {
    it('shows error message on invalid credentials', async () => {
      globalThis.fetch = mockFetch({
        status: 401,
        ok: false,
        json: errorResponse,
      });

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'wrong');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
      });

      // Should NOT navigate or call login
      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows generic error on network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Network error. Please check your connection.',
        );
      });

      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows generic "Login failed" when no error message in response', async () => {
      globalThis.fetch = mockFetch({
        status: 500,
        ok: false,
        json: { success: false, data: null },
      });

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Login failed');
      });
    });
  });

  describe('Logout', () => {
    it('logout store action clears state', async () => {
      // This tests the store directly — import the real store for verification
      const { usePlatformAuthStore: realStore } =
        await vi.importActual<typeof import('@/stores/auth-store')>('@/stores/auth-store');

      // Set up authenticated state
      realStore.getState().login(
        {
          id: 'user-1',
          email: 'admin@nexa.io',
          displayName: 'Admin User',
          role: 'PLATFORM_ADMIN',
        },
        'token-123',
      );

      expect(realStore.getState().isAuthenticated).toBe(true);
      expect(realStore.getState().user).not.toBeNull();
      expect(realStore.getState().accessToken).toBe('token-123');

      // Logout
      realStore.getState().logout();

      expect(realStore.getState().isAuthenticated).toBe(false);
      expect(realStore.getState().user).toBeNull();
      expect(realStore.getState().accessToken).toBeNull();
    });
  });

  describe('Form interaction', () => {
    it('disables inputs and button while submitting', async () => {
      // Use a promise that we control to keep the fetch pending
      let resolveFetch: (value: unknown) => void;
      globalThis.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ) as unknown as typeof globalThis.fetch;

      const user = userEvent.setup();
      render(<PlatformLogin />);

      await user.type(screen.getByLabelText('Email'), 'admin@nexa.io');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      // While submitting, button shows "Signing in..."
      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
      expect(screen.getByLabelText('Email')).toBeDisabled();
      expect(screen.getByLabelText('Password')).toBeDisabled();

      // Resolve the fetch to clean up
      resolveFetch!({
        status: 200,
        ok: true,
        json: () => Promise.resolve(successResponse),
      });
    });
  });
});
