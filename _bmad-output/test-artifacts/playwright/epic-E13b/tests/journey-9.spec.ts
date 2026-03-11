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
  '../../../screenshots/epic-E13b/journey-9',
);

// ---------------------------------------------------------------------------
// Journey 9: Billing Overview Dashboard with KPI Cards
// ---------------------------------------------------------------------------

test.describe('J9: Billing Overview Dashboard with KPI Cards', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as PLATFORM_ADMIN
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for MFA challenge (202 response triggers MFA field)
    const mfaInput = page.getByLabel('MFA Code');
    await expect(mfaInput).toBeVisible({ timeout: 10000 });

    // Generate and fill TOTP code
    const totpCode = generateTOTP(MFA_SECRET);
    await mfaInput.fill(totpCode);

    // Click verify and wait for navigation to dashboard
    await page.getByRole('button', { name: /verify & sign in/i }).click();
    await page.waitForURL('/', { timeout: 15000 });
  });

  test('billing dashboard loads with KPI cards, enforcement distribution, and issues table', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /billing via sidebar — preserves SPA auth state
    // (page.goto causes full reload which loses Zustand in-memory state)
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await sidebar.getByText('Billing', { exact: true }).click();
    await expect(page).toHaveURL(/\/billing/);

    // Wait for the billing dashboard to finish loading
    const dashboard = page.locator('[data-testid="billing-dashboard"]');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Billing', level: 1 })).toBeVisible();

    // Verify breadcrumb
    await expect(page.getByText('Platform Admin > Billing')).toBeVisible();

    // Verify KPI cards are present
    await expect(page.locator('[data-testid="kpi-totalActive"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-current"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-grace"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-overdue"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-blocked"]')).toBeVisible();

    // Verify KPI card labels
    await expect(page.locator('[data-testid="kpi-totalActive"]').getByText('Active Tenants')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-current"]').getByText('Current')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-grace"]').getByText('Grace Period')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-overdue"]').getByText('Overdue')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-blocked"]').getByText('Blocked')).toBeVisible();

    // Visual checkpoint 1: Billing dashboard loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-billing-dashboard-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Verify enforcement action distribution section
    // -----------------------------------------------------------------------
    await expect(page.getByText('Enforcement Action Distribution')).toBeVisible();

    // Verify each enforcement action row
    await expect(page.locator('[data-testid="enforcement-none"]')).toBeVisible();
    await expect(page.locator('[data-testid="enforcement-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="enforcement-readOnly"]')).toBeVisible();
    await expect(page.locator('[data-testid="enforcement-suspended"]')).toBeVisible();

    // Verify enforcement labels
    await expect(page.locator('[data-testid="enforcement-none"]').getByText('None')).toBeVisible();
    await expect(page.locator('[data-testid="enforcement-warning"]').getByText('Warning')).toBeVisible();
    await expect(page.locator('[data-testid="enforcement-readOnly"]').getByText('Read Only')).toBeVisible();
    await expect(page.locator('[data-testid="enforcement-suspended"]').getByText('Suspended')).toBeVisible();

    // Visual checkpoint 2: Enforcement distribution visible
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-enforcement-distribution-visible.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify billing issues table
    // -----------------------------------------------------------------------

    // The table might show issues OR an empty state message
    const issuesTable = page.getByText('Billing Issues');
    const emptyState = page.getByText('All tenants are in good standing');

    const hasIssuesTable = await issuesTable.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // One of these must be visible
    expect(hasIssuesTable || hasEmptyState).toBe(true);

    if (hasIssuesTable && !hasEmptyState) {
      // Verify table columns
      const table = page.locator('table');
      await expect(table.getByText('Tenant')).toBeVisible();
      await expect(table.getByText('Plan')).toBeVisible();
      await expect(table.getByText('Billing Status')).toBeVisible();
      await expect(table.getByText('Dunning Level')).toBeVisible();
      await expect(table.getByText('Enforcement')).toBeVisible();
      await expect(table.getByText('Last Payment')).toBeVisible();
    }

    // Visual checkpoint 3: Billing issues table
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-billing-issues-table.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Click a tenant name link in the billing issues table
    // -----------------------------------------------------------------------

    if (hasIssuesTable && !hasEmptyState) {
      // Find the first tenant name link in the table
      const firstTenantLink = page.locator('table button.font-medium.text-primary').first();
      const tenantName = await firstTenantLink.textContent();
      expect(tenantName).toBeTruthy();

      await firstTenantLink.click();

      // Wait for navigation to tenant detail page
      await page.waitForURL(/\/tenants\//, { timeout: 10000 });

      // Verify we landed on a tenant detail page
      expect(page.url()).toMatch(/\/tenants\/[a-zA-Z0-9-]+/);

      // Visual checkpoint 4: Tenant detail after click
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-tenant-detail-navigation.png'),
        fullPage: true,
      });
    }
  });
});
