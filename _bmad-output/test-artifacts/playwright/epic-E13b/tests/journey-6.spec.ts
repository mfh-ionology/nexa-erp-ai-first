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
  '../../../screenshots/epic-E13b/journey-6',
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
// Journey 6: Suspend an Active Tenant
// ---------------------------------------------------------------------------

test.describe('J6: Suspend an Active Tenant', () => {
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

  test('suspend an active tenant with mandatory reason confirmation dialog', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to Tenants list and click into an ACTIVE tenant
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Tenants');
    await expect(page).toHaveURL(/\/tenants/);

    // Wait for table data to load
    const tenantRows = page.locator('tr[data-testid^="tenant-row-"]');
    await expect(tenantRows.first()).toBeVisible({ timeout: 10000 });

    // Find an ACTIVE tenant and click into it
    const activeRow = page
      .locator('tr[data-testid^="tenant-row-"]')
      .filter({ has: page.locator('text=ACTIVE') })
      .first();
    await expect(activeRow).toBeVisible({ timeout: 5000 });
    await activeRow.click();

    // Wait for tenant detail page to load
    await expect(page).toHaveURL(/\/tenants\/[a-zA-Z0-9-]+/, { timeout: 10000 });
    await expect(page.getByTestId('tenant-detail')).toBeVisible({ timeout: 10000 });

    // Verify ACTIVE status badge
    const headerRow = page.locator('.flex.items-center.justify-between').first();
    await expect(headerRow.getByText('Active')).toBeVisible();

    // Verify Suspend button is visible in action bar
    await expect(page.getByTestId('suspend-btn')).toBeVisible();
    await expect(page.getByTestId('suspend-btn')).toContainText('Suspend');

    // CP1: Tenant detail page loaded with ACTIVE status
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-tenant-detail-active.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Click Suspend button — confirmation dialog opens
    // -----------------------------------------------------------------------
    await page.getByTestId('suspend-btn').click();

    // Verify dialog is visible with correct title
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('heading', { name: 'Suspend Tenant' })).toBeVisible();

    // Verify description mentions 30-second propagation
    await expect(dialog.getByText(/30 seconds/)).toBeVisible();

    // Verify reason textarea is visible with required marker
    await expect(dialog.getByLabel(/reason/i)).toBeVisible();

    // Verify destructive confirm button exists with correct label
    const confirmButton = dialog.getByRole('button', { name: /suspend tenant/i });
    await expect(confirmButton).toBeVisible();

    // CP2: Suspend dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-suspend-dialog-opened.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify confirm button is disabled when reason is empty
    // -----------------------------------------------------------------------
    await expect(confirmButton).toBeDisabled();

    // CP3: Confirm button disabled without reason
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-confirm-button-disabled.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Fill in the reason text
    // -----------------------------------------------------------------------
    const reasonTextarea = dialog.getByLabel(/reason/i);
    await reasonTextarea.fill(
      'Security investigation — suspicious activity detected on tenant account',
    );

    // Verify confirm button becomes enabled after entering reason
    await expect(confirmButton).toBeEnabled();

    // -----------------------------------------------------------------------
    // Step 5: Click confirm to suspend tenant
    // -----------------------------------------------------------------------
    // Listen for the suspend API call
    const suspendResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/suspend') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await confirmButton.click();

    // Wait for the API response and check status
    const suspendResponse = await suspendResponsePromise;
    const responseStatus = suspendResponse.status();

    // BUG: Suspend API returns 500 Internal Server Error (backend bug)
    // The frontend correctly calls POST /admin/tenants/:id/suspend with { reason }
    // but the Platform API's TenantLifecycleService.suspendTenant() fails server-side.
    // Documenting the failure and verifying frontend handles the error gracefully.
    if (responseStatus >= 400) {
      // Capture a screenshot showing the error state
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-suspend-api-error.png'),
        fullPage: true,
      });

      // Verify the frontend shows an error toast (graceful error handling)
      const errorToast = page.getByText(/failed to suspend|error|unexpected/i);
      await expect(errorToast).toBeVisible({ timeout: 5000 });

      // Test still fails because the core journey cannot complete due to backend bug
      throw new Error(
        `BUG: Suspend API returned ${responseStatus}. ` +
        `The backend POST /admin/tenants/:id/suspend endpoint returns an internal server error. ` +
        `Frontend correctly sends the request and handles the error gracefully with a toast.`,
      );
    }

    // --- Happy path (when backend bug is fixed) ---

    // Wait for the dialog to close (mutation completes)
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Verify success toast appears
    const successToast = page.getByText('Tenant suspended');
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Verify status badge changed to SUSPENDED
    await expect(page.getByText('Suspended')).toBeVisible({ timeout: 5000 });

    // Verify Suspend button is gone and Reactivate button appears
    await expect(page.getByTestId('suspend-btn')).toBeHidden();
    await expect(page.getByTestId('reactivate-btn')).toBeVisible();

    // CP4: Tenant suspended successfully
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-tenant-suspended-success.png'),
      fullPage: true,
    });
  });
});
