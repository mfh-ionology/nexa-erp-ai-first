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
const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E13b/journey-2',
);

// ---------------------------------------------------------------------------
// Journey 2: Verify App Shell and All Navigation Items
// ---------------------------------------------------------------------------

test.describe('J2: Verify App Shell and All Navigation Items', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as PLATFORM_ADMIN before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Handle MFA
    const mfaInput = page.getByLabel('MFA Code');
    await expect(mfaInput).toBeVisible();
    const totpCode = generateTOTP(MFA_SECRET);
    await mfaInput.fill(totpCode);
    await page.getByRole('button', { name: /verify & sign in/i }).click();

    // Wait for dashboard
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('app shell has dark sidebar with PLATFORM ADMIN branding and all nav items', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Verify dashboard loads with sidebar visible
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('PLATFORM ADMIN', { exact: true })).toBeVisible();

    // Visual checkpoint CP1: Dashboard with full sidebar
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-dashboard-with-sidebar.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Verify all navigation items are visible
    // The actual sidebar has 10 items (includes AI Intelligence)
    // Test plan lists 9 items — we verify all 10 that exist in the codebase
    // -----------------------------------------------------------------------
    const expectedNavItems = [
      'Dashboard',
      'AI Intelligence',
      'Tenants',
      'Plans',
      'AI Usage',
      'Billing',
      'Support Console',
      'Monitoring',
      'Audit Log',
      'Settings',
    ];

    for (const navItem of expectedNavItems) {
      await expect(
        sidebar.getByText(navItem, { exact: true }),
      ).toBeVisible();
    }

    // -----------------------------------------------------------------------
    // Step 3: Click Tenants nav item — verify navigation
    // -----------------------------------------------------------------------
    await sidebar.getByText('Tenants', { exact: true }).click();
    await expect(page).toHaveURL(/\/tenants/);

    // Visual checkpoint CP2: Tenants nav active
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-tenants-nav-active.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Click Plans nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('Plans', { exact: true }).click();
    await expect(page).toHaveURL(/\/plans/);

    // -----------------------------------------------------------------------
    // Step 5: Click AI Usage nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('AI Usage', { exact: true }).click();
    await expect(page).toHaveURL(/\/ai-usage/);

    // -----------------------------------------------------------------------
    // Step 6: Click Billing nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('Billing', { exact: true }).click();
    await expect(page).toHaveURL(/\/billing/);

    // -----------------------------------------------------------------------
    // Step 7: Click Support Console nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('Support Console', { exact: true }).click();
    await expect(page).toHaveURL(/\/support/);

    // -----------------------------------------------------------------------
    // Step 8: Click Monitoring nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('Monitoring', { exact: true }).click();
    await expect(page).toHaveURL(/\/monitoring/);

    // -----------------------------------------------------------------------
    // Step 9: Click Audit Log nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('Audit Log', { exact: true }).click();
    await expect(page).toHaveURL(/\/audit-log/);

    // -----------------------------------------------------------------------
    // Step 10: Click Settings nav item
    // -----------------------------------------------------------------------
    await sidebar.getByText('Settings', { exact: true }).click();
    await expect(page).toHaveURL(/\/settings/);

    // Visual checkpoint CP3: Settings nav active
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-settings-nav-active.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 11: Click sidebar collapse toggle
    // -----------------------------------------------------------------------
    const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
    await collapseButton.click();

    // After collapse: text labels should be hidden
    await expect(sidebar.getByText('PLATFORM ADMIN', { exact: true })).not.toBeVisible();

    // Nav item text labels should not be visible (icons remain)
    for (const navItem of expectedNavItems) {
      await expect(
        sidebar.locator('.nav-item-text', { hasText: navItem }),
      ).not.toBeVisible();
    }

    // Expand button should now show
    await expect(
      page.getByRole('button', { name: /expand sidebar/i }),
    ).toBeVisible();

    // Visual checkpoint CP4: Sidebar collapsed
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-sidebar-collapsed.png'),
      fullPage: true,
    });
  });
});
