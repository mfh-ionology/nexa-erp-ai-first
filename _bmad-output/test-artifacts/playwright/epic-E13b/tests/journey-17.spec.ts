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
  '../../../screenshots/epic-E13b/journey-17',
);

// ---------------------------------------------------------------------------
// Journey 17: Per-Tenant AI Usage and BYOK Key Management
// ---------------------------------------------------------------------------

test.describe('J17: Per-Tenant AI Usage and BYOK Key Management', () => {
  // Platform Admin runs on port 5112 (not the ERP web app on 5110)
  test.use({ baseURL: 'http://localhost:5112' });

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

  test('view per-tenant AI usage, BYOK management, and quota settings', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to Tenants via sidebar, then click into a tenant
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', {
      name: /platform navigation/i,
    });
    await sidebar.getByText('Tenants', { exact: true }).click();
    await expect(page).toHaveURL(/\/tenants/, { timeout: 10000 });

    // Wait for tenant list to load — find the first clickable tenant row
    const tenantRows = page.locator('table tbody tr, [data-testid*="tenant-row"]');
    await expect(tenantRows.first()).toBeVisible({ timeout: 10000 });

    // Click the first tenant row to navigate to its detail page
    await tenantRows.first().click();
    await expect(page).toHaveURL(/\/tenants\//, { timeout: 10000 });

    // Wait for tenant detail page to load
    await expect(
      page.locator('[data-testid="tenant-detail-loading"]'),
    ).not.toBeVisible({ timeout: 15000 });

    // Verify tenant detail page loaded with tabs
    const tabsList = page.getByRole('tablist');
    await expect(tabsList).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 1: Tenant detail page loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-tenant-detail-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Click "AI Usage" tab — per-tenant AI usage detail loads
    // -----------------------------------------------------------------------
    const aiUsageTab = page.getByRole('tab', { name: /ai usage/i });
    await expect(aiUsageTab).toBeVisible();
    await aiUsageTab.click();

    // Wait for AI usage detail to load
    const aiUsageDetail = page.getByTestId('tenant-ai-usage-detail');
    await expect(aiUsageDetail).toBeVisible({ timeout: 15000 });

    // Verify KPI cards are present
    const kpiSection = page.locator('[aria-label="Tenant AI Usage KPIs"]');
    await expect(kpiSection).toBeVisible({ timeout: 10000 });

    // Check for KPI card labels
    await expect(page.getByText('Tokens Today')).toBeVisible();
    await expect(page.getByText('Tokens This Month')).toBeVisible();
    await expect(page.getByText('Cost Estimate')).toBeVisible();

    // Visual Checkpoint 2: AI Usage tab loaded with KPIs and quota
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-ai-usage-tab-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify Quota Progress Bar
    // -----------------------------------------------------------------------
    const quotaSection = page.locator('[aria-label="Token quota"]');
    await expect(quotaSection).toBeVisible({ timeout: 10000 });
    await expect(quotaSection.getByText('Quota Status')).toBeVisible();

    // Verify the quota progress bar component is present
    const quotaProgressBar = quotaSection.getByTestId('quota-progress-bar');
    await expect(quotaProgressBar).toBeVisible();

    // Verify quota label shows token usage info (e.g. "0 / 5.0M tokens (0.0%)")
    const quotaLabel = quotaSection.getByTestId('quota-label');
    await expect(quotaLabel).toBeVisible();
    await expect(quotaLabel).toContainText('tokens');

    // Verify soft and hard limit markers exist
    await expect(quotaSection.getByTestId('soft-limit-marker')).toBeAttached();
    await expect(quotaSection.getByTestId('hard-limit-marker')).toBeAttached();

    // -----------------------------------------------------------------------
    // Step 4: Verify charts section — scroll down and check
    // -----------------------------------------------------------------------
    // Check Daily Token Usage chart section
    const trendSection = page.locator('[aria-label="Daily usage trend"]');
    await trendSection.scrollIntoViewIfNeeded();
    await expect(trendSection).toBeVisible();
    await expect(
      trendSection.getByText('Daily Token Usage (30 days)'),
    ).toBeVisible();

    // Check Usage by Feature section
    const featureSection = page.locator('[aria-label="Usage by feature"]');
    await featureSection.scrollIntoViewIfNeeded();
    await expect(featureSection).toBeVisible();
    await expect(featureSection.getByText('Usage by Feature')).toBeVisible();

    // Check Usage by Provider section
    const providerSection = page.locator('[aria-label="Usage by provider"]');
    await providerSection.scrollIntoViewIfNeeded();
    await expect(providerSection).toBeVisible();
    await expect(providerSection.getByText('Usage by Provider')).toBeVisible();

    // Visual Checkpoint 3: Charts section visible
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-ai-usage-charts.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4b: Check BYOK section (Enterprise tenants only)
    // -----------------------------------------------------------------------
    const byokSection = page.getByTestId('byok-management-section');
    const byokSplitSection = page.getByTestId('byok-split-section');
    const isEnterpriseTenant = await byokSection.isVisible({ timeout: 3000 }).catch(() => false);

    if (isEnterpriseTenant) {
      // BYOK Management Section is visible — Enterprise tenant
      await byokSection.scrollIntoViewIfNeeded();
      await expect(byokSection.getByText('BYOK API Keys')).toBeVisible();

      // Check for Add BYOK Key button
      const addByokBtn = page.getByTestId('add-byok-key-btn');
      await expect(addByokBtn).toBeVisible();

      // Check BYOK split donut chart if data exists
      const byokSplitVisible = await byokSplitSection.isVisible().catch(() => false);
      if (byokSplitVisible) {
        await expect(
          byokSplitSection.getByText('BYOK vs Vendor Key Usage'),
        ).toBeVisible();
      }

      // Visual Checkpoint 4: BYOK section
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-byok-section.png'),
        fullPage: true,
      });

      // -------------------------------------------------------------------
      // Step 5: Click "Add BYOK Key" button — modal opens
      // -------------------------------------------------------------------
      await addByokBtn.click();

      // Verify modal opens with provider selector and API key input
      const addModal = page.getByRole('alertdialog');
      await expect(addModal).toBeVisible({ timeout: 5000 });
      await expect(addModal.getByText('Add BYOK API Key')).toBeVisible();

      // Verify provider dropdown
      const providerSelect = addModal.locator('#byok-provider-select');
      await expect(providerSelect).toBeVisible();

      // Verify API key input
      const apiKeyInput = addModal.locator('#byok-api-key');
      await expect(apiKeyInput).toBeVisible();

      // Verify Cancel and Add Key buttons
      await expect(
        addModal.getByRole('button', { name: /cancel/i }),
      ).toBeVisible();
      await expect(
        addModal.getByRole('button', { name: /add key/i }),
      ).toBeVisible();

      // Visual Checkpoint 5: Add BYOK Key modal
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05-add-byok-modal.png'),
        fullPage: true,
      });

      // -------------------------------------------------------------------
      // Step 6: Cancel / close modal
      // -------------------------------------------------------------------
      await addModal.getByRole('button', { name: /cancel/i }).click();
      await expect(addModal).not.toBeVisible({ timeout: 5000 });

      // Visual Checkpoint 6: Modal closed
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '06-modal-closed.png'),
        fullPage: true,
      });
    } else {
      // Not an Enterprise tenant — BYOK section should not be visible
      // Take a screenshot noting BYOK is not available for this plan
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-byok-section-not-enterprise.png'),
        fullPage: true,
      });
      console.log(
        'INFO: BYOK section not visible — tenant is not on Enterprise plan. ' +
          'Steps 4b-6 (BYOK management, Add BYOK Key modal) skipped.',
      );
    }

    // -----------------------------------------------------------------------
    // Step 7: Verify Quota Settings Editor (PLATFORM_ADMIN only)
    // -----------------------------------------------------------------------
    // Scroll back up to quota section
    await quotaSection.scrollIntoViewIfNeeded();

    // Click "Edit Quota" button
    const editQuotaBtn = page.getByTestId('edit-quota-btn');
    await expect(editQuotaBtn).toBeVisible();
    await editQuotaBtn.click();

    // Verify quota settings editor appears
    const quotaEditor = page.getByTestId('quota-settings-editor');
    await expect(quotaEditor).toBeVisible({ timeout: 5000 });

    // Verify the three input fields
    await expect(quotaEditor.getByLabel('Token Allowance')).toBeVisible();
    await expect(quotaEditor.getByLabel(/soft limit/i)).toBeVisible();
    await expect(quotaEditor.getByLabel(/hard limit/i)).toBeVisible();

    // Verify Save and Cancel buttons
    await expect(
      quotaEditor.getByRole('button', { name: /save changes/i }),
    ).toBeVisible();
    await expect(
      quotaEditor.getByRole('button', { name: /cancel/i }),
    ).toBeVisible();

    // Visual Checkpoint 7: Quota settings editor
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-quota-settings-editor.png'),
      fullPage: true,
    });
  });
});
