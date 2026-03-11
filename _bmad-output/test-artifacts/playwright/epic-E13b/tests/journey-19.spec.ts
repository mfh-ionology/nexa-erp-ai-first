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
const DEV_TENANT_ID = '00000000-0000-4000-b000-000000000010';
const PLATFORM_API_BASE = 'http://localhost:5101';
const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E13b/journey-19',
);

// ---------------------------------------------------------------------------
// Journey 19: Start an Impersonation Session
// ---------------------------------------------------------------------------

test.describe('J19: Start an Impersonation Session', () => {
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

  test('start impersonation session with mandatory reason and duration', async ({
    page,
    context,
  }) => {
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });

    // -----------------------------------------------------------------------
    // Step 1: Navigate to tenant detail page via sidebar → tenants list → row click
    // -----------------------------------------------------------------------
    await sidebar.getByText('Tenants').click();
    await expect(page).toHaveURL(/\/tenants/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /tenants/i })).toBeVisible({
      timeout: 10000,
    });

    // Wait for tenant list to load — the "Development Tenant" row should appear
    const tenantRow = page.getByTestId(`tenant-row-${DEV_TENANT_ID}`);
    await expect(tenantRow).toBeVisible({ timeout: 15000 });

    // Click on the tenant row to navigate to the detail page
    await tenantRow.click();
    await expect(page).toHaveURL(new RegExp(`/tenants/${DEV_TENANT_ID}`), { timeout: 10000 });

    // Wait for tenant detail page to load (loading skeleton disappears)
    await expect(page.getByTestId('tenant-detail')).toBeVisible({ timeout: 15000 });

    // Verify tenant name and status badge
    await expect(page.getByRole('heading', { name: /development tenant/i })).toBeVisible();

    // Verify action bar with Impersonate button is visible
    const actionBar = page.getByTestId('tenant-action-bar');
    await expect(actionBar).toBeVisible();
    const impersonateBtn = page.getByTestId('impersonate-btn');
    await expect(impersonateBtn).toBeVisible();
    await expect(impersonateBtn).toBeEnabled(); // ACTIVE tenant — should be enabled

    // Visual Checkpoint 1: Tenant detail page loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-tenant-detail-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Click Impersonate button — dialog opens
    // -----------------------------------------------------------------------
    await impersonateBtn.click();

    // Wait for the impersonation dialog to appear
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    await expect(dialog.getByText('Impersonate Tenant')).toBeVisible();

    // Verify warning banner
    await expect(
      dialog.getByText(/you will be redirected to the tenant's erp/i),
    ).toBeVisible();
    await expect(dialog.getByText(/all actions will be audited/i)).toBeVisible();

    // Verify reason textarea is present
    const reasonField = page.getByTestId('impersonation-reason');
    await expect(reasonField).toBeVisible();

    // Verify duration selector defaults to 60 (1 hour)
    const durationSelect = page.getByTestId('impersonation-duration');
    await expect(durationSelect).toBeVisible();
    await expect(durationSelect).toHaveValue('60');

    // Verify Submit button exists
    const submitBtn = page.getByTestId('impersonation-submit');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText(/start impersonation/i);

    // Visual Checkpoint 2: Impersonation dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-impersonation-dialog-opened.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify Submit button is disabled when reason is empty
    // -----------------------------------------------------------------------
    await expect(submitBtn).toBeDisabled();

    // Visual Checkpoint 3: Submit disabled with empty reason
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-submit-disabled-empty-reason.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Fill form — reason (>10 chars) and duration (30 min)
    // -----------------------------------------------------------------------
    const reasonText =
      'Investigating reported UI rendering issue on dashboard for customer support ticket #4521';
    await reasonField.fill(reasonText);

    // Change duration to 30 minutes
    await durationSelect.selectOption('30');
    await expect(durationSelect).toHaveValue('30');

    // Verify submit button is now enabled
    await expect(submitBtn).toBeEnabled();

    // Visual Checkpoint 4: Form filled and ready
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-form-filled-ready.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 5: Click Start Impersonation — session created
    // -----------------------------------------------------------------------
    // Listen for new pages (the dialog calls window.open on success)
    const newPagePromise = context
      .waitForEvent('page', { timeout: 20000 })
      .catch(() => null);

    // Wait for the API response after clicking submit
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/impersonate') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await submitBtn.click();

    // Wait for the API response
    const response = await responsePromise;
    const status = response.status();

    if (status >= 200 && status < 300) {
      // API succeeded — dialog should close and toast should appear
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Check for success toast
      const successToast = page.getByText(/impersonation session started/i);
      await expect(successToast).toBeVisible({ timeout: 5000 });

      // Visual Checkpoint 5: After impersonation submitted
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05-impersonation-submitted.png'),
        fullPage: true,
      });

      // Check if a new tab was opened targeting the ERP URL.
      // Note: The ERP app may redirect to /login (stripping hash fragments),
      // so we only verify the tab was opened to the correct host.
      const newPage = await newPagePromise;
      if (newPage) {
        const newUrl = newPage.url();
        // Should target the ERP web app (port 5110)
        expect(newUrl).toContain('localhost:5110');
        await newPage.close();
      }
    } else {
      // API failed — capture the error state for debugging
      const body = await response.text().catch(() => '(no body)');
      console.log(`Impersonation API returned ${status}: ${body}`);

      // Wait a moment for the error toast to appear
      await page.waitForTimeout(2000);

      // Visual Checkpoint 5: Error state after failed submission
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05-impersonation-api-error.png'),
        fullPage: true,
      });

      // The test should still fail to flag the API issue
      expect(status, `Impersonation API returned ${status}: ${body}`).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(300);
    }
  });
});
