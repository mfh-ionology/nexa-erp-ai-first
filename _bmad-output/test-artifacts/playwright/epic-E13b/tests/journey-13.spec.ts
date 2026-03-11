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
  '../../../screenshots/epic-E13b/journey-13',
);

// ---------------------------------------------------------------------------
// Journey 13: Cross-Tenant AI Usage Dashboard
// ---------------------------------------------------------------------------

test.describe('J13: Cross-Tenant AI Usage Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as PLATFORM_ADMIN
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for MFA challenge
    const mfaInput = page.getByLabel('MFA Code');
    await expect(mfaInput).toBeVisible({ timeout: 10000 });

    // Generate and fill TOTP code
    const totpCode = generateTOTP(MFA_SECRET);
    await mfaInput.fill(totpCode);

    // Click verify and wait for navigation to dashboard
    await page.getByRole('button', { name: /verify & sign in/i }).click();
    await page.waitForURL('/', { timeout: 15000 });
  });

  test('view AI usage overview with KPIs, chart, and top consumers, then navigate to tenant detail', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /ai-usage via sidebar — verify tabbed layout and KPI cards
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await sidebar.getByText('AI Usage', { exact: true }).click();
    await expect(page).toHaveURL(/\/ai-usage/, { timeout: 10000 });

    // Verify page header
    await expect(
      page.getByRole('heading', { name: /ai usage/i }),
    ).toBeVisible({ timeout: 10000 });

    // Verify 3 tabs: Overview, Alerts, Providers
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    const alertsTab = page.getByRole('tab', { name: /alerts/i });
    const providersTab = page.getByRole('tab', { name: /providers/i });
    await expect(overviewTab).toBeVisible();
    await expect(alertsTab).toBeVisible();
    await expect(providersTab).toBeVisible();

    // Overview tab should be active by default
    await expect(overviewTab).toHaveAttribute('data-state', 'active');

    // Verify KPI cards are present (wait for loading to finish)
    const kpiSection = page.locator('section[aria-label="Usage KPIs"]');
    await expect(kpiSection).toBeVisible({ timeout: 10000 });

    // Check for KPI labels
    await expect(kpiSection.getByText('Tokens Today')).toBeVisible({ timeout: 15000 });
    await expect(kpiSection.getByText('Tokens This Month')).toBeVisible();
    await expect(kpiSection.getByText(/cost estimate/i)).toBeVisible();

    // Verify daily usage trend chart section
    const chartSection = page.locator('section[aria-label="Daily usage trend"]');
    await expect(chartSection).toBeVisible({ timeout: 10000 });
    await expect(chartSection.getByText(/daily token usage/i)).toBeVisible();

    // Visual checkpoint 1: AI Usage Overview page loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-ai-usage-overview-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Verify top consumers section
    // -----------------------------------------------------------------------
    // Scroll down to make the top consumers section visible
    const topConsumersSection = page.locator('section[aria-label="Top consumers"]');
    await topConsumersSection.scrollIntoViewIfNeeded();
    await expect(topConsumersSection).toBeVisible({ timeout: 10000 });
    await expect(
      topConsumersSection.getByText(/top consumers/i),
    ).toBeVisible();

    // Check if there's usage data (table) or empty state message
    const table = topConsumersSection.locator('table');
    const emptyMessage = topConsumersSection.getByText(/no usage data available/i);
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmptyMsg = await emptyMessage.isVisible().catch(() => false);

    // One of table or empty message must be visible
    expect(hasTable || hasEmptyMsg).toBeTruthy();

    if (hasTable) {
      // Verify table headers
      await expect(table.getByText('Tenant')).toBeVisible();
      await expect(table.getByText('Tokens')).toBeVisible();

      // Verify at least one tenant row with a link exists
      const tenantLinks = table.locator('a[href*="/tenants/"]');
      const linkCount = await tenantLinks.count();
      expect(linkCount).toBeGreaterThan(0);

      // Visual checkpoint 2: Top consumers table
      await topConsumersSection.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-top-consumers-table.png'),
      });

      // -------------------------------------------------------------------
      // Step 3: Click first top consumer tenant link to navigate to detail
      // -------------------------------------------------------------------
      const firstTenantLink = tenantLinks.first();
      const tenantName = await firstTenantLink.textContent();
      await firstTenantLink.click();

      // Verify navigation to tenant detail page
      await expect(page).toHaveURL(/\/tenants\//, { timeout: 10000 });

      // Verify tenant detail page loaded — look for tenant name or heading
      if (tenantName) {
        await expect(
          page.getByText(tenantName, { exact: false }),
        ).toBeVisible({ timeout: 10000 });
      }

      // Visual checkpoint 3: Tenant detail page
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-tenant-detail-after-click.png'),
        fullPage: true,
      });
    } else {
      // No usage data seeded — verify the empty state message
      await expect(emptyMessage).toBeVisible();

      // Visual checkpoint 2: Empty top consumers section
      await topConsumersSection.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-top-consumers-empty-state.png'),
      });

      // Step 3 cannot be tested without data — skip tenant link navigation
    }
  });
});
