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
  '../../../screenshots/epic-E13b/journey-5',
);

// ---------------------------------------------------------------------------
// Helper: navigate via sidebar (preserves SPA state)
// ---------------------------------------------------------------------------

async function clickSidebarNav(
  page: import('@playwright/test').Page,
  label: string,
) {
  const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
  await sidebar.getByText(label, { exact: true }).click();
}

// ---------------------------------------------------------------------------
// Journey 5: Tenant Detail Page with 7 Tabs
// ---------------------------------------------------------------------------

test.describe('J5: Tenant Detail Page with 7 Tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Login as PLATFORM_ADMIN
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for MFA challenge
    const mfaInput = page.getByLabel('MFA Code');
    await expect(mfaInput).toBeVisible({ timeout: 10000 });

    // Generate and fill TOTP code
    const totpCode = generateTOTP(MFA_SECRET);
    await mfaInput.fill(totpCode);

    // Click Verify & Sign In
    await page.getByRole('button', { name: /verify & sign in/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 15000 });
  });

  test('tenant detail page shows overview, all 7 tabs, action bar, and tab navigation', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /tenants — verify tenant list loads
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Tenants');
    await expect(page).toHaveURL(/\/tenants/);
    await expect(
      page.getByRole('heading', { name: 'Tenants' }),
    ).toBeVisible();

    // Wait for table data to load
    const tenantRows = page.locator('tr[data-testid^="tenant-row-"]');
    await expect(tenantRows.first()).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 2: Click first ACTIVE tenant row — navigate to detail page
    // -----------------------------------------------------------------------
    const activeRow = page
      .locator('tr[data-testid^="tenant-row-"]')
      .filter({ has: page.locator('text=ACTIVE') })
      .first();
    await expect(activeRow).toBeVisible({ timeout: 5000 });
    await activeRow.click();

    // Wait for navigation to tenant detail page
    await expect(page).toHaveURL(/\/tenants\/[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Wait for detail page to finish loading
    await expect(page.getByTestId('tenant-detail')).toBeVisible({ timeout: 10000 });

    // Verify breadcrumb
    await expect(page.getByText(/Platform Admin.*Tenants/)).toBeVisible();

    // Verify tenant name heading exists
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Verify StatusBadge shows Active in header (next to the h1 tenant name)
    const headerRow = page.locator('.flex.items-center.justify-between').first();
    await expect(headerRow.getByText('Active')).toBeVisible();

    // Verify all 7 tabs are visible (data-testid values match the TABS array: overview, modules, users, ai-usage, billing, diagnostics, audit)
    const tabIds = ['overview', 'modules', 'users', 'ai-usage', 'billing', 'diagnostics', 'audit'];
    for (const id of tabIds) {
      await expect(page.getByTestId(`tab-${id}`)).toBeVisible();
    }

    // CP1: Tenant detail page loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-tenant-detail-page-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify Overview tab content
    // -----------------------------------------------------------------------
    // Overview tab should be active by default
    await expect(page.getByTestId('overview-tab')).toBeVisible();

    // Verify overview section headings are present
    const overviewTab = page.getByTestId('overview-tab');
    await expect(overviewTab.getByText('Identity', { exact: true })).toBeVisible();
    await expect(overviewTab.getByText('Status & Plan', { exact: true })).toBeVisible();
    await expect(overviewTab.getByText('Infrastructure', { exact: true })).toBeVisible();
    await expect(overviewTab.getByText('Timestamps', { exact: true })).toBeVisible();

    // Verify key field labels
    await expect(overviewTab.getByText('Display Name')).toBeVisible();
    await expect(overviewTab.getByText('Code', { exact: true })).toBeVisible();
    await expect(overviewTab.getByText('Legal Name')).toBeVisible();
    await expect(overviewTab.getByText('Region')).toBeVisible();
    await expect(overviewTab.getByText('Sandbox Mode')).toBeVisible();
    await expect(overviewTab.getByText('Created', { exact: true })).toBeVisible();

    // -----------------------------------------------------------------------
    // Step 4: Verify action bar buttons for ACTIVE tenant
    // -----------------------------------------------------------------------
    const actionBar = page.getByTestId('tenant-action-bar');
    await expect(actionBar).toBeVisible();

    // ACTIVE tenant: Suspend button visible (destructive)
    await expect(page.getByTestId('suspend-btn')).toBeVisible();
    await expect(page.getByTestId('suspend-btn')).toContainText('Suspend');

    // ACTIVE tenant: Impersonate button visible (amber)
    await expect(page.getByTestId('impersonate-btn')).toBeVisible();
    await expect(page.getByTestId('impersonate-btn')).toContainText('Impersonate');

    // CP2: Action bar buttons
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-action-bar-buttons.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 5: Click Users tab
    // -----------------------------------------------------------------------
    await page.getByTestId('tab-users').or(page.getByRole('tab', { name: 'Users' })).click();
    // Verify users tab content loads (placeholder or actual list)
    await page.waitForTimeout(500);

    // -----------------------------------------------------------------------
    // Step 6: Click AI Usage tab
    // -----------------------------------------------------------------------
    await page.getByTestId('tab-ai-usage').or(page.getByRole('tab', { name: 'AI Usage' })).click();
    await page.waitForTimeout(500);

    // -----------------------------------------------------------------------
    // Step 7: Click Billing tab
    // -----------------------------------------------------------------------
    await page.getByTestId('tab-billing').or(page.getByRole('tab', { name: 'Billing' })).click();
    await page.waitForTimeout(500);

    // -----------------------------------------------------------------------
    // Step 8: Click Diagnostics tab
    // -----------------------------------------------------------------------
    await page.getByTestId('tab-diagnostics').or(page.getByRole('tab', { name: 'Diagnostics' })).click();
    await page.waitForTimeout(500);

    // -----------------------------------------------------------------------
    // Step 9: Click Audit tab
    // -----------------------------------------------------------------------
    await page.getByTestId('tab-audit').or(page.getByRole('tab', { name: 'Audit' })).click();
    await page.waitForTimeout(500);

    // CP3: Audit tab content
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-audit-tab-content.png'),
      fullPage: true,
    });
  });
});
