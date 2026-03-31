/**
 * Auth helper for Epic E14 Playwright E2E tests.
 *
 * Uses the REAL login page — no API mocking.
 *
 * Seed credentials (from packages/db/prisma/seed.ts):
 *   email:    admin@nexa-erp.dev
 *   password: NexaDev2026!
 */

import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Seed credentials
// ---------------------------------------------------------------------------

export const TEST_EMAIL = 'admin@nexa-erp.dev';
export const TEST_PASSWORD = 'NexaDev2026!';

// ---------------------------------------------------------------------------
// Login via the real login page
// ---------------------------------------------------------------------------

/**
 * Perform a real login through the UI login page.
 *
 * 1. Navigate to /login
 * 2. Fill email + password using the seed placeholders
 * 3. Click Sign In
 * 4. Wait for redirect away from /login (dashboard loads)
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/login', { timeout: 30_000 });
  await page.waitForURL('**/login', { timeout: 30_000 });

  // Wait for login form to be interactive
  await page.getByPlaceholder('you@company.co.uk').waitFor({ state: 'visible', timeout: 30_000 });

  // Fill credentials using the known placeholder text from i18n
  await page.getByPlaceholder('you@company.co.uk').fill(TEST_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);

  // Submit
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for navigation away from login (the app redirects to / after success)
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45_000,
  });

  // Wait for network to settle (initial data fetches)
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Login and navigate to a specific finance page
// ---------------------------------------------------------------------------

/**
 * Login via real auth, then navigate to the given path within the SPA.
 *
 * After login, the user lands on /. We use evaluate() to do client-side
 * navigation so we don't lose the in-memory Zustand auth state that would
 * be lost on a full page.goto() reload.
 */
export async function loginAndNavigateTo(page: Page, targetPath: string): Promise<void> {
  await login(page);

  if (targetPath === '/') return;

  // Navigate within the SPA using History API + popstate.
  // JWT is stored in Zustand memory — page.goto() would lose it.
  // TanStack Router listens to popstate events for client-side routing.
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, targetPath);

  // Wait for TanStack Router to process the navigation
  await page.waitForURL(`**${targetPath}`, { timeout: 15_000 }).catch(() => {
    // URL may already match — that's fine
  });

  // Let the page content and API calls settle
  await page.waitForTimeout(3000);
}
