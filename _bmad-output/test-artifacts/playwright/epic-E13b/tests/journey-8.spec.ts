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
  '../../../screenshots/epic-E13b/journey-8',
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
// Journey 8: Toggle Module Overrides and Feature Flags
// ---------------------------------------------------------------------------

test.describe('J8: Toggle Module Overrides and Feature Flags', () => {
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

  test('toggle module overrides and feature flags for a tenant', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /tenants and click into an ACTIVE tenant
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Tenants');
    await expect(page).toHaveURL(/\/tenants/);

    // Wait for table data to load
    const tenantRows = page.locator('tr[data-testid^="tenant-row-"]');
    await expect(tenantRows.first()).toBeVisible({ timeout: 10000 });

    // Click into the first ACTIVE tenant
    const activeRow = page
      .locator('tr[data-testid^="tenant-row-"]')
      .filter({ has: page.locator('text=ACTIVE') })
      .first();
    await expect(activeRow).toBeVisible({ timeout: 5000 });
    await activeRow.click();

    // Wait for tenant detail page to load
    await expect(page).toHaveURL(/\/tenants\/[a-zA-Z0-9-]+/, { timeout: 10000 });
    await expect(page.getByTestId('tenant-detail')).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 2: Click "Modules & Flags" tab
    // -----------------------------------------------------------------------
    await page.getByTestId('tab-modules').click();

    // Wait for Modules & Flags tab content to load
    const modulesFlagsTab = page.getByTestId('modules-flags-tab');
    await expect(modulesFlagsTab).toBeVisible({ timeout: 10000 });

    // Verify "Module Overrides" section heading is visible
    await expect(
      modulesFlagsTab.getByText('Module Overrides', { exact: true }),
    ).toBeVisible();

    // Verify module overrides list is visible with toggle switches
    const moduleOverridesList = page.getByTestId('module-overrides-list');
    await expect(moduleOverridesList).toBeVisible();

    // Verify at least some known modules are listed (e.g. manufacturing, sales)
    await expect(moduleOverridesList.getByText('Manufacturing', { exact: true })).toBeVisible();
    await expect(moduleOverridesList.getByText('Sales', { exact: true })).toBeVisible();

    // Verify Feature Flags section heading is visible
    await expect(
      modulesFlagsTab.getByText('Feature Flags', { exact: true }),
    ).toBeVisible();

    // CP1: Modules & Flags tab loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-modules-flags-tab-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Toggle a module override (manufacturing)
    // -----------------------------------------------------------------------
    const manufacturingToggle = page.getByTestId('module-toggle-manufacturing');
    await expect(manufacturingToggle).toBeVisible();

    // Get current state of the toggle
    const isCurrentlyChecked = await manufacturingToggle.isChecked();

    if (isCurrentlyChecked) {
      // Currently enabled — toggle OFF (disable). This will show a reason input.
      await manufacturingToggle.click();

      // Wait for reason input to appear (disabling prompts for reason)
      const reasonInput = page.getByTestId('module-reason-input');
      await expect(reasonInput).toBeVisible({ timeout: 5000 });

      // Fill optional reason
      await reasonInput.locator('input[type="text"]').fill('E2E test — toggling module off');

      // Listen for module update API call
      const moduleResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/modules') &&
          (resp.request().method() === 'PUT' || resp.request().method() === 'PATCH'),
        { timeout: 15000 },
      );

      // Click Confirm to submit the disable
      await reasonInput.getByRole('button', { name: /confirm/i }).click();

      // Wait for API response
      const moduleResponse = await moduleResponsePromise;
      const moduleStatus = moduleResponse.status();

      if (moduleStatus >= 400) {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '02-module-toggle-api-error.png'),
          fullPage: true,
        });
        throw new Error(
          `BUG: Module update API returned ${moduleStatus}. ` +
          `The backend module override endpoint returned an error.`,
        );
      }
    } else {
      // Currently disabled — toggle ON (enable). This fires directly.
      const moduleResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/modules') &&
          (resp.request().method() === 'PUT' || resp.request().method() === 'PATCH'),
        { timeout: 15000 },
      );

      await manufacturingToggle.click();

      // Wait for API response
      const moduleResponse = await moduleResponsePromise;
      const moduleStatus = moduleResponse.status();

      if (moduleStatus >= 400) {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '02-module-toggle-api-error.png'),
          fullPage: true,
        });
        throw new Error(
          `BUG: Module update API returned ${moduleStatus}. ` +
          `The backend module override endpoint returned an error.`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // Step 4: Verify success toast for module toggle
    // -----------------------------------------------------------------------
    const moduleToast = page.getByText(/Module "manufacturing"/i);
    await expect(moduleToast).toBeVisible({ timeout: 5000 });

    // Verify toggle state changed
    const newCheckedState = await manufacturingToggle.isChecked();
    expect(newCheckedState).toBe(!isCurrentlyChecked);

    // CP2: Module toggle toast confirmation
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-module-toggle-toast.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 5: Toggle a feature flag
    // -----------------------------------------------------------------------
    const featureFlagsList = page.getByTestId('feature-flags-list');
    const featureFlagsEmpty = page.getByTestId('feature-flags-empty');

    // Check whether feature flags exist or the empty state is shown
    const hasFeatureFlags = await featureFlagsList
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasFeatureFlags) {
      // Find the first feature flag toggle
      const firstFlagToggle = featureFlagsList.locator('[data-testid^="flag-toggle-"]').first();
      await expect(firstFlagToggle).toBeVisible({ timeout: 5000 });

      // Get the feature key name from the test id
      const flagTestId = await firstFlagToggle.getAttribute('data-testid');
      const featureKey = flagTestId?.replace('flag-toggle-', '') || 'unknown';

      // Get current state
      const flagCurrentlyChecked = await firstFlagToggle.isChecked();

      // Listen for feature flag update API call
      const flagResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/feature-flags') &&
          (resp.request().method() === 'PUT' || resp.request().method() === 'PATCH'),
        { timeout: 15000 },
      );

      // Toggle the feature flag
      await firstFlagToggle.click();

      // Wait for API response
      const flagResponse = await flagResponsePromise;
      const flagStatus = flagResponse.status();

      if (flagStatus >= 400) {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '03-feature-flag-api-error.png'),
          fullPage: true,
        });
        throw new Error(
          `BUG: Feature flag update API returned ${flagStatus}. ` +
          `The backend feature flag endpoint returned an error.`,
        );
      }

      // -----------------------------------------------------------------------
      // Step 6: Verify success toast for feature flag toggle
      // -----------------------------------------------------------------------
      const flagToast = page.getByText(new RegExp(`Feature flag "${featureKey}"`, 'i'));
      await expect(flagToast).toBeVisible({ timeout: 5000 });

      // Verify toggle state changed
      const newFlagState = await firstFlagToggle.isChecked();
      expect(newFlagState).toBe(!flagCurrentlyChecked);

      // CP3: Feature flag toggle toast confirmation
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-feature-flag-toggle-toast.png'),
        fullPage: true,
      });
    } else {
      // No feature flags configured — verify empty state is shown
      await expect(featureFlagsEmpty).toBeVisible({ timeout: 5000 });
      await expect(
        featureFlagsEmpty.getByText(/no feature flags configured/i),
      ).toBeVisible();

      // CP4: Feature flags empty state
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-feature-flags-empty-state.png'),
        fullPage: true,
      });
    }
  });
});
