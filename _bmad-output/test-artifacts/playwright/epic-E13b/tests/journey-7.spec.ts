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
  '../../../screenshots/epic-E13b/journey-7',
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
// Journey 7: Reactivate a Suspended Tenant
// ---------------------------------------------------------------------------

test.describe('J7: Reactivate a Suspended Tenant', () => {
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

  test('reactivate a suspended tenant via detail page confirmation dialog', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Pre-step: Navigate to Tenants and find or create a SUSPENDED tenant
    // -----------------------------------------------------------------------
    await clickSidebarNav(page, 'Tenants');
    await expect(page).toHaveURL(/\/tenants/);

    // Wait for table data to load
    const tenantRows = page.locator('tr[data-testid^="tenant-row-"]');
    await expect(tenantRows.first()).toBeVisible({ timeout: 10000 });

    // Check if a SUSPENDED tenant already exists
    const suspendedRow = page
      .locator('tr[data-testid^="tenant-row-"]')
      .filter({ has: page.getByText('Suspended', { exact: true }) })
      .first();
    const hasSuspendedTenant = await suspendedRow
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasSuspendedTenant) {
      // No SUSPENDED tenant — we must first suspend an ACTIVE tenant via the UI
      // This mirrors Journey 6's flow as a setup step
      const activeRow = page
        .locator('tr[data-testid^="tenant-row-"]')
        .filter({ has: page.getByText('Active', { exact: true }) })
        .first();
      await expect(activeRow).toBeVisible({ timeout: 5000 });
      await activeRow.click();

      // Wait for tenant detail page
      await expect(page).toHaveURL(/\/tenants\/[a-zA-Z0-9-]+/, { timeout: 10000 });
      await expect(page.getByTestId('tenant-detail')).toBeVisible({ timeout: 10000 });

      // Click Suspend button
      const suspendBtn = page.getByTestId('suspend-btn');
      await expect(suspendBtn).toBeVisible({ timeout: 5000 });
      await suspendBtn.click();

      // Fill in the suspend dialog
      const suspendDialog = page.getByRole('alertdialog');
      await expect(suspendDialog).toBeVisible({ timeout: 5000 });

      // Fill reason textarea (required for suspend)
      const reasonField = suspendDialog.getByLabel(/reason/i);
      await expect(reasonField).toBeVisible({ timeout: 3000 });
      await reasonField.fill('Test setup for Journey 7 — suspending tenant to test reactivation');

      // Listen for suspend API response
      const suspendResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/suspend') && resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      // Click confirm
      const suspendConfirm = suspendDialog.getByRole('button', { name: /suspend tenant/i });
      await expect(suspendConfirm).toBeEnabled({ timeout: 3000 });
      await suspendConfirm.click();

      // Wait for suspend API response
      const suspendResponse = await suspendResponsePromise;
      const suspendStatus = suspendResponse.status();

      if (suspendStatus >= 400) {
        // Backend Suspend API fails — this is a known bug from J6
        // Cannot create the precondition for J7
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '00-suspend-setup-api-error.png'),
          fullPage: true,
        });

        throw new Error(
          `PRECONDITION FAILURE: Cannot create SUSPENDED tenant. ` +
          `Suspend API returned ${suspendStatus}. ` +
          `Journey 7 (Reactivate) depends on a working Suspend API to create the test precondition. ` +
          `This is the same backend bug documented in Journey 6.`,
        );
      }

      // Suspend succeeded — verify status changed
      await expect(suspendDialog).toBeHidden({ timeout: 10000 });
      await expect(page.getByText('Suspended')).toBeVisible({ timeout: 5000 });
    } else {
      // SUSPENDED tenant exists — click into it
      await suspendedRow.click();
      await expect(page).toHaveURL(/\/tenants\/[a-zA-Z0-9-]+/, { timeout: 10000 });
      await expect(page.getByTestId('tenant-detail')).toBeVisible({ timeout: 10000 });
    }

    // -----------------------------------------------------------------------
    // Step 1: Verify tenant detail shows SUSPENDED status
    // -----------------------------------------------------------------------
    await expect(page.getByText('Suspended')).toBeVisible({ timeout: 5000 });

    // Verify Reactivate button is visible in action bar
    await expect(page.getByTestId('reactivate-btn')).toBeVisible();
    await expect(page.getByTestId('reactivate-btn')).toContainText(/reactivate/i);

    // CP1: Tenant detail page loaded with SUSPENDED status
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-tenant-detail-suspended.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Click Reactivate button — confirmation dialog opens
    // -----------------------------------------------------------------------
    await page.getByTestId('reactivate-btn').click();

    // Verify dialog is visible with correct title
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(
      dialog.getByRole('heading', { name: /reactivate tenant/i }),
    ).toBeVisible();

    // Verify description mentions restoring ERP access and entitlement cache
    await expect(dialog.getByText(/restore full ERP access/i)).toBeVisible();
    await expect(dialog.getByText(/entitlement cache/i)).toBeVisible();

    // Verify Reactivate confirm button (default variant, NOT destructive)
    const confirmButton = dialog.getByRole('button', { name: /reactivate/i });
    await expect(confirmButton).toBeVisible();

    // Verify confirm button is enabled immediately (no reason required)
    await expect(confirmButton).toBeEnabled();

    // Verify Cancel button exists
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible();

    // CP2: Reactivate confirmation dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-reactivate-dialog-opened.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Click confirm to reactivate tenant
    // -----------------------------------------------------------------------
    // Listen for the reactivate API call
    const reactivateResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/reactivate') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await confirmButton.click();

    // Wait for the API response
    const reactivateResponse = await reactivateResponsePromise;
    const responseStatus = reactivateResponse.status();

    // Handle API error
    if (responseStatus >= 400) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-reactivate-api-error.png'),
        fullPage: true,
      });

      // Verify the frontend handles the error gracefully with a toast
      const errorToast = page.getByText(/failed to reactivate|error|unexpected/i);
      await expect(errorToast).toBeVisible({ timeout: 5000 });

      throw new Error(
        `BUG: Reactivate API returned ${responseStatus}. ` +
        `The backend POST /admin/tenants/:id/reactivate endpoint returned an error. ` +
        `Frontend correctly sends the request and handles the error gracefully with a toast.`,
      );
    }

    // --- Happy path (API succeeded) ---

    // Wait for the dialog to close
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Verify success toast appears
    const successToast = page.getByText(/tenant reactivated/i);
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Verify status badge changed from SUSPENDED to ACTIVE
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5000 });

    // Verify Reactivate button is gone and Suspend button appears
    await expect(page.getByTestId('reactivate-btn')).toBeHidden({ timeout: 5000 });
    await expect(page.getByTestId('suspend-btn')).toBeVisible({ timeout: 5000 });

    // CP3: Tenant reactivated — status changed to ACTIVE
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-tenant-reactivated-active.png'),
      fullPage: true,
    });
  });
});
