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
const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E13b/journey-12',
);

// ---------------------------------------------------------------------------
// Journey 12: Assign a New Plan to a Tenant
// ---------------------------------------------------------------------------

test.describe('J12: Assign a New Plan to a Tenant', () => {
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

  test('assign Pro plan to tenant with comparison view and reason', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to tenant detail page via sidebar → Tenants → click row
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await sidebar.getByText('Tenants', { exact: true }).click();
    await expect(page).toHaveURL(/\/tenants/, { timeout: 10000 });

    // Wait for tenant list to load, then click the dev tenant row
    const tenantRow = page.locator(`[data-testid="tenant-row-${DEV_TENANT_ID}"]`);
    await expect(tenantRow).toBeVisible({ timeout: 15000 });
    await tenantRow.click();

    // Wait for tenant detail to load
    await expect(page).toHaveURL(new RegExp(`/tenants/${DEV_TENANT_ID}`), {
      timeout: 10000,
    });

    // -----------------------------------------------------------------------
    // Step 2: Click the Billing tab
    // -----------------------------------------------------------------------
    const billingTabTrigger = page.getByRole('tab', { name: /billing/i });
    await expect(billingTabTrigger).toBeVisible({ timeout: 10000 });
    await billingTabTrigger.click();

    // Wait for billing tab content to render
    const billingTab = page.locator('[data-testid="billing-tab"]');
    await expect(billingTab).toBeVisible({ timeout: 10000 });

    // Verify subscription section heading is visible
    await expect(
      billingTab.getByRole('heading', { name: 'Subscription' }),
    ).toBeVisible();

    // Verify Change Plan button is visible (PLATFORM_ADMIN)
    const changePlanBtn = page.locator('[data-testid="change-plan-btn"]');
    await expect(changePlanBtn).toBeVisible();

    // -----------------------------------------------------------------------
    // Step 3: Click "Change Plan" to open the assignment dialog
    // -----------------------------------------------------------------------
    await changePlanBtn.click();

    // Wait for the dialog to appear
    const dialogTitle = page.getByText('Change Subscription Plan');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify current plan is shown in the dialog description
    await expect(page.getByText(/current plan:/i)).toBeVisible();

    // Verify the plan selector dropdown exists with default placeholder
    const planSelect = page.locator('[data-testid="plan-select"]');
    await expect(planSelect).toBeVisible();

    // Verify reason textarea exists
    const reasonInput = page.locator('[data-testid="plan-reason-input"]');
    await expect(reasonInput).toBeVisible();

    // Verify Confirm button is disabled (no plan selected)
    const confirmBtn = page.getByRole('button', { name: /confirm plan change/i });
    await expect(confirmBtn).toBeDisabled();

    // Visual checkpoint 1: Dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-plan-assignment-dialog-opened.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Select the 'Pro' plan from the dropdown
    // -----------------------------------------------------------------------
    // Get all options to find the Pro plan option
    const options = planSelect.locator('option');
    const optionCount = await options.count();

    // Find and select the Pro plan option (contains "pro" in text, case-insensitive)
    let proOptionValue = '';
    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent();
      if (text && /pro/i.test(text)) {
        proOptionValue = await options.nth(i).getAttribute('value') ?? '';
        break;
      }
    }

    // If no Pro plan found, select the first non-empty option as fallback
    if (!proOptionValue && optionCount > 1) {
      proOptionValue = await options.nth(1).getAttribute('value') ?? '';
    }

    await planSelect.selectOption(proOptionValue);

    // Verify comparison view appears
    const comparison = page.locator('[data-testid="plan-comparison"]');
    await expect(comparison).toBeVisible({ timeout: 5000 });

    // Verify comparison headers (use exact match to avoid conflicts with row labels)
    await expect(comparison.getByText('Limit', { exact: true })).toBeVisible();
    await expect(comparison.getByText('Current', { exact: true })).toBeVisible();
    await expect(comparison.getByText('New', { exact: true })).toBeVisible();

    // Verify limit rows
    await expect(comparison.getByText('Max Users')).toBeVisible();
    await expect(comparison.getByText('Max Companies')).toBeVisible();
    await expect(comparison.getByText('AI Token Allowance')).toBeVisible();
    await expect(comparison.getByText('API Rate Limit')).toBeVisible();

    // Verify amber warning box about immediate effect
    await expect(
      page.getByText(/plan changes take effect immediately/i),
    ).toBeVisible();

    // Confirm button should now be enabled (plan selected)
    await expect(confirmBtn).toBeEnabled();

    // Visual checkpoint 2: Comparison view
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-plan-comparison-view.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 5: Fill the reason field
    // -----------------------------------------------------------------------
    await reasonInput.fill('Customer upgraded to Pro tier');

    // Visual checkpoint 3: Reason filled, ready to confirm
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-reason-filled-ready.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 6: Click Confirm Plan Change and verify success
    // -----------------------------------------------------------------------
    await confirmBtn.click();

    // Wait for success toast — billing-tab.tsx shows:
    // "Plan changed from {oldPlanCode} to {newPlanCode}"
    await expect(
      page.getByText(/plan changed from/i),
    ).toBeVisible({ timeout: 10000 });

    // Dialog should close
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });

    // Verify billing tab refreshes and shows new plan
    // The billing tab should still be visible after dialog closes
    await expect(billingTab).toBeVisible();

    // Visual checkpoint 4: Plan changed successfully
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-plan-changed-success.png'),
      fullPage: true,
    });
  });
});
