import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import path from 'node:path';

// ---------------------------------------------------------------------------
// TOTP helper — generates a 6-digit TOTP code from a Base32 secret
// ---------------------------------------------------------------------------

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of encoded.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string, timeStep = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Constants — match seeded data from apps/platform-api/prisma/seed.ts
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'admin@nexa-platform.local';
const ADMIN_PASSWORD = 'platform-admin-dev';
const MFA_SECRET = 'JBSWY3DPEHPK3PXP';

// Viewer user created via API in beforeAll
const VIEWER_EMAIL = 'viewer-e2e@nexa-platform.local';
const VIEWER_PASSWORD = 'ViewerTest-123!';
const VIEWER_DISPLAY_NAME = 'E2E Viewer';

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E13b/journey-3',
);

// Platform API base URL — Node.js fetch calls bypass Vite proxy, so we call
// the Platform API directly on its native port.
const PLATFORM_API_BASE = process.env.PLATFORM_API_URL || 'http://localhost:5101';

// ---------------------------------------------------------------------------
// Test fixture setup: create a PLATFORM_VIEWER user via API
// ---------------------------------------------------------------------------

async function getAdminToken(): Promise<string> {
  // Step 1: Login without MFA code → get 202 challenge
  const loginRes1 = await fetch(`${PLATFORM_API_BASE}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (loginRes1.status === 202) {
    // Step 2: Login with MFA code
    const totpCode = generateTOTP(MFA_SECRET);
    const loginRes2 = await fetch(`${PLATFORM_API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        mfaCode: totpCode,
      }),
    });
    const json = await loginRes2.json();
    return json.data.accessToken;
  }

  // If MFA not required (shouldn't happen for admin, but handle gracefully)
  const json = await loginRes1.json();
  return json.data.accessToken;
}

async function ensureViewerUser(adminToken: string): Promise<void> {
  // Try to create the viewer user — if it already exists, that's fine (409)
  const res = await fetch(`${PLATFORM_API_BASE}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      email: VIEWER_EMAIL,
      password: VIEWER_PASSWORD,
      displayName: VIEWER_DISPLAY_NAME,
      role: 'PLATFORM_VIEWER',
    }),
  });

  if (res.status === 201 || res.status === 409) {
    return; // Created or already exists
  }

  const body = await res.text();
  throw new Error(`Failed to create viewer user: ${res.status} ${body}`);
}

// ---------------------------------------------------------------------------
// Helper: navigate via sidebar (preserves SPA state, avoids full page reload)
// ---------------------------------------------------------------------------

async function clickSidebarNav(page: import('@playwright/test').Page, label: string) {
  const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
  await sidebar.getByText(label, { exact: true }).click();
}

// ---------------------------------------------------------------------------
// Journey 3: PLATFORM_VIEWER Sees Read-Only UI
// ---------------------------------------------------------------------------

test.describe('J3: PLATFORM_VIEWER Sees Read-Only UI', () => {
  // Create the viewer user before all tests
  test.beforeAll(async () => {
    const adminToken = await getAdminToken();
    await ensureViewerUser(adminToken);
  });

  // Login as PLATFORM_VIEWER before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(VIEWER_EMAIL);
    await page.getByLabel('Password').fill(VIEWER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // PLATFORM_VIEWER has no MFA — should redirect to dashboard directly
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('viewer sees read-only restrictions across all pages', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Dashboard shows "Read-only mode" indicator
    // -----------------------------------------------------------------------
    await expect(page.getByTestId('read-only-indicator')).toBeVisible();
    await expect(page.getByTestId('read-only-indicator')).toContainText(
      'Read-only mode',
    );

    // CP1: Dashboard with read-only indicator
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-dashboard-read-only-indicator.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Navigate to Tenants via sidebar — no "+ New Tenant" button
    // Use sidebar navigation to preserve SPA auth state (page.goto causes
    // full reload which loses Zustand in-memory state).
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Tenants');
    await expect(page).toHaveURL(/\/tenants/);
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();

    // The "New Tenant" button should NOT be visible for PLATFORM_VIEWER
    await expect(page.getByTestId('new-tenant-btn')).not.toBeVisible();

    // CP2: Tenants list without New Tenant button
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-tenants-list-no-create-button.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Click first tenant row to open detail page
    // -----------------------------------------------------------------------
    // Wait for data to load (table body appears after loading)
    const tenantRow = page.locator('tr[data-testid^="tenant-row-"]').first();
    // Give time for data to load before checking if rows exist
    await page.waitForTimeout(2000);
    const hasRows = await tenantRow.isVisible().catch(() => false);

    if (hasRows) {
      await tenantRow.click();
      await expect(page.getByTestId('tenant-detail')).toBeVisible();

      // -------------------------------------------------------------------
      // Step 4: Verify no lifecycle action buttons (Suspend, Reactivate,
      //         Archive, Impersonate) in the tenant detail action bar
      // -------------------------------------------------------------------
      // TenantActionBar returns null for non-admin users
      await expect(page.getByTestId('tenant-action-bar')).not.toBeVisible();
      await expect(page.getByTestId('suspend-btn')).not.toBeVisible();
      await expect(page.getByTestId('reactivate-btn')).not.toBeVisible();
      await expect(page.getByTestId('archive-btn')).not.toBeVisible();
      await expect(page.getByTestId('impersonate-btn')).not.toBeVisible();

      // CP3: Tenant detail without action buttons
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-tenant-detail-no-action-bar.png'),
        fullPage: true,
      });

      // -------------------------------------------------------------------
      // Step 5: Click "Modules & Flags" tab — toggles should be disabled
      // -------------------------------------------------------------------
      await page.getByTestId('tab-modules').click();
      await expect(page.getByTestId('modules-flags-tab')).toBeVisible();

      // Module override toggles should be disabled
      const moduleToggles = page.locator('[data-testid^="module-toggle-"]');
      const toggleCount = await moduleToggles.count();
      for (let i = 0; i < toggleCount; i++) {
        await expect(moduleToggles.nth(i)).toBeDisabled();
      }

      // Feature flag toggles should also be disabled (if any exist)
      const flagToggles = page.locator('[data-testid^="flag-toggle-"]');
      const flagCount = await flagToggles.count();
      for (let i = 0; i < flagCount; i++) {
        await expect(flagToggles.nth(i)).toBeDisabled();
      }

      // CP4: Modules & Flags disabled toggles
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-modules-flags-disabled-toggles.png'),
        fullPage: true,
      });
    }

    // -----------------------------------------------------------------------
    // Step 6: Navigate to Plans via sidebar — no "+ New Plan" button
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Plans');
    await expect(page).toHaveURL(/\/plans/);
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

    // The "New Plan" button should NOT be visible for PLATFORM_VIEWER
    await expect(page.getByTestId('create-plan-button')).not.toBeVisible();

    // CP5: Plans page without New Plan button
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-plans-no-create-button.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 7: Navigate to Billing via sidebar — verify page loads
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Billing');
    await expect(page).toHaveURL(/\/billing/);
    await expect(
      page.getByRole('heading', { name: 'Billing' }),
    ).toBeVisible();

    // CP6: Billing dashboard
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-billing-dashboard.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 8: Navigate to AI Usage via sidebar — no "Export CSV" button
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'AI Usage');
    await expect(page).toHaveURL(/\/ai-usage/);
    await expect(
      page.getByRole('heading', { name: 'AI Usage' }),
    ).toBeVisible();

    // Export CSV button is hidden by RequirePlatformRole for non-admin users
    await expect(page.getByRole('button', { name: /export csv/i })).not.toBeVisible();

    // CP7: AI Usage page without Export CSV
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-ai-usage-no-export.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 9: Navigate to Support Console via sidebar — no Impersonate buttons
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Support Console');
    await expect(page).toHaveURL(/\/support/);
    await expect(
      page.getByRole('heading', { name: 'Support Console' }),
    ).toBeVisible();

    // Search bar should be visible
    await expect(page.getByTestId('support-search-input')).toBeVisible();

    // Impersonate buttons should NOT be visible
    // (canImpersonate returns false for PLATFORM_VIEWER)
    await expect(
      page.locator('[data-testid^="impersonate-tenant-"]'),
    ).not.toBeVisible();

    // CP8: Support console without Impersonate buttons
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-support-no-impersonate.png'),
      fullPage: true,
    });
  });
});
