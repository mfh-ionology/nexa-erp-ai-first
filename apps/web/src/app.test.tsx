import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { App } from '@/app';
import { useAuthStore } from '@/stores/auth-store';

describe('App', () => {
  beforeEach(() => {
    // Reset auth store to unauthenticated state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeCompanyId: null,
      permissions: null,
      isAuthenticated: false,
      isLoading: false,
      rememberMe: false,
    });

    // Reset jsdom URL to root
    window.history.replaceState({}, '', '/');
  });

  it('renders without crashing', () => {
    render(<App />);
    // App renders something — no uncaught errors
    expect(document.getElementById('root') ?? document.body).toBeTruthy();
  });

  it('redirects unauthenticated user to login', async () => {
    render(<App />);

    // The _authenticated layout redirects to /login when isAuthenticated is false.
    // The login page renders the Nexa heading and the sign-in button.
    // Since i18n is mocked to return keys, the button text is the translation key.
    await waitFor(() => {
      expect(screen.getByText('common:appName')).toBeInTheDocument();
    });

    // Verify the login form is displayed (sign-in button present)
    expect(screen.getByText('common:signIn')).toBeInTheDocument();
  });
});
