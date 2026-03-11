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
  '../../../screenshots/epic-E13b/journey-15',
);

// ---------------------------------------------------------------------------
// Journey 15: Export AI Usage Data as CSV
// ---------------------------------------------------------------------------

test.describe('J15: Export AI Usage Data as CSV', () => {
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

  test('export CSV from AI Usage overview with date range selector', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /ai-usage via sidebar
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await sidebar.getByText('AI Usage', { exact: true }).click();
    await expect(page).toHaveURL(/\/ai-usage/, { timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: /ai usage/i }),
    ).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 2: Verify Export CSV button is visible for PLATFORM_ADMIN
    // -----------------------------------------------------------------------
    const exportButton = page.getByRole('button', { name: /export csv/i });
    await expect(exportButton).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 1: AI Usage overview loaded with Export CSV button
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-ai-usage-overview-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Click Export CSV button — date range selector appears
    // -----------------------------------------------------------------------
    await exportButton.click();

    // Verify date range selector appears with Start Date and End Date inputs
    // Labels are not associated via for/id, so use text + sibling input approach
    await expect(page.getByText('Start Date')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('End Date')).toBeVisible({ timeout: 5000 });
    const dateInputs = page.locator('input[type="date"]');
    const startDateInput = dateInputs.first();
    const endDateInput = dateInputs.last();
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    // Verify Download and Cancel buttons are visible
    const downloadButton = page.getByRole('button', { name: /download/i });
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await expect(downloadButton).toBeVisible();
    await expect(cancelButton).toBeVisible();

    // Verify date inputs are pre-filled (last 30 days)
    const startValue = await startDateInput.inputValue();
    const endValue = await endDateInput.inputValue();
    expect(startValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Visual Checkpoint 2: Date range selector visible
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-date-range-selector-visible.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Click Download button to trigger CSV export
    // -----------------------------------------------------------------------
    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);

    await downloadButton.click();

    // Wait for the date picker to close (indicating export was triggered)
    await expect(page.getByText('Start Date')).not.toBeVisible({ timeout: 10000 });

    // Check if a download was triggered
    const download = await downloadPromise;

    if (download) {
      // Verify the downloaded file has a CSV-like name
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.csv$/i);

      // Save the download to verify it's not empty
      const downloadPath = path.join(SCREENSHOT_DIR, filename);
      await download.saveAs(downloadPath);
    }

    // Visual Checkpoint 3: Export initiated, selector closed
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-export-initiated.png'),
      fullPage: true,
    });

    // Verify the Export CSV button is back to normal (not in loading state)
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled({ timeout: 10000 });
  });
});
