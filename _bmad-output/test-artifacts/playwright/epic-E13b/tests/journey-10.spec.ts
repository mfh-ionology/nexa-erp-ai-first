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
  '../../../screenshots/epic-E13b/journey-10',
);

// Unique suffix per run to avoid 409 conflicts from previous runs
const RUN_ID = Date.now().toString(36).slice(-5);
const PLAN_CODE = `test-e-plus-${RUN_ID}`;
const PLAN_NAME = `Enterprise Plus ${RUN_ID}`;

// ---------------------------------------------------------------------------
// Journey 10: Create and Edit Subscription Plans
// ---------------------------------------------------------------------------

test.describe('J10: Create and Edit Subscription Plans', () => {
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

  test('create a new plan, verify it appears, then edit it', async ({ page }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /plans via sidebar (preserves SPA auth state)
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await sidebar.getByText('Plans', { exact: true }).click();
    await expect(page).toHaveURL(/\/plans/);

    // Wait for plans grid to load
    const plansGrid = page.locator('[data-testid="plans-grid"]');
    await expect(plansGrid).toBeVisible({ timeout: 15000 });

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Plans', level: 1 })).toBeVisible();

    // Verify breadcrumb
    await expect(page.getByText('Platform Admin > Plans')).toBeVisible();

    // Verify "+ New Plan" button
    const newPlanBtn = page.locator('[data-testid="create-plan-button"]');
    await expect(newPlanBtn).toBeVisible();

    // Visual checkpoint 1: Plans page loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-plans-page-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Click "+ New Plan" button to open create dialog
    // -----------------------------------------------------------------------
    await newPlanBtn.click();

    // Wait for dialog to appear
    const dialogTitle = page.getByRole('heading', { name: 'Create Plan' });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify form fields are present
    await expect(page.locator('[data-testid="plan-code-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-display-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-max-users-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-max-companies-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-token-allowance-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-ai-hard-limit-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-modules-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-api-rate-limit-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-form-submit"]')).toBeVisible();

    // Visual checkpoint 2: Create plan dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-create-plan-dialog-open.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Fill form with plan details
    // -----------------------------------------------------------------------
    await page.locator('[data-testid="plan-code-input"]').fill(PLAN_CODE);
    await page.locator('[data-testid="plan-display-name-input"]').fill(PLAN_NAME);
    await page.locator('[data-testid="plan-max-users-input"]').fill('200');
    await page.locator('[data-testid="plan-max-companies-input"]').fill('20');
    await page.locator('[data-testid="plan-token-allowance-input"]').fill('5000000');
    await page.locator('[data-testid="plan-api-rate-limit-input"]').fill('5000');

    // -----------------------------------------------------------------------
    // Step 4: Select modules (System and Finance)
    // -----------------------------------------------------------------------
    await page.locator('[data-testid="module-toggle-system"]').click();
    await page.locator('[data-testid="module-toggle-finance"]').click();

    // Verify modules are selected (purple background = selected state)
    await expect(page.locator('[data-testid="module-toggle-system"]')).toHaveClass(/bg-purple-600/);
    await expect(page.locator('[data-testid="module-toggle-finance"]')).toHaveClass(/bg-purple-600/);

    // -----------------------------------------------------------------------
    // Step 5: Submit the form — create the plan
    // -----------------------------------------------------------------------
    await page.locator('[data-testid="plan-form-submit"]').click();

    // Wait for success toast
    await expect(page.getByText(new RegExp(`Plan.*${PLAN_NAME}.*created`, 'i'))).toBeVisible({ timeout: 10000 });

    // Dialog should close
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });

    // Wait for grid to refresh and show the new plan card
    const newPlanCard = page.locator(`[data-testid="plan-card-${PLAN_CODE}"]`);
    await expect(newPlanCard).toBeVisible({ timeout: 10000 });

    // Verify plan card details
    await expect(newPlanCard.getByText(PLAN_NAME)).toBeVisible();
    await expect(newPlanCard.locator('code').getByText(PLAN_CODE)).toBeVisible();
    await expect(newPlanCard.getByText('200', { exact: true })).toBeVisible();
    await expect(newPlanCard.getByText('20', { exact: true })).toBeVisible();
    await expect(newPlanCard.getByText('System')).toBeVisible();
    await expect(newPlanCard.getByText('Finance')).toBeVisible();

    // Visual checkpoint 3: Plan created successfully
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-plan-created-success.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 6: Click edit icon on the newly created plan card
    // -----------------------------------------------------------------------
    const editBtn = page.locator(`[data-testid="edit-plan-${PLAN_CODE}"]`);
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Wait for edit dialog
    const editDialogTitle = page.getByRole('heading', { name: 'Edit Plan' });
    await expect(editDialogTitle).toBeVisible({ timeout: 5000 });

    // Verify fields are pre-populated
    await expect(page.locator('[data-testid="plan-display-name-input"]')).toHaveValue(PLAN_NAME);
    await expect(page.locator('[data-testid="plan-max-users-input"]')).toHaveValue('200');
    await expect(page.locator('[data-testid="plan-max-companies-input"]')).toHaveValue('20');
    await expect(page.locator('[data-testid="plan-token-allowance-input"]')).toHaveValue('5000000');
    await expect(page.locator('[data-testid="plan-api-rate-limit-input"]')).toHaveValue('5000');

    // Verify Code field is NOT present in edit mode (immutable)
    await expect(page.locator('[data-testid="plan-code-input"]')).not.toBeVisible();

    // Verify isActive toggle is present in edit mode
    await expect(page.locator('[data-testid="plan-is-active-input"]')).toBeVisible();

    // Visual checkpoint 4: Edit plan dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-edit-plan-dialog-open.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 7: Update maxUsers to 250
    // -----------------------------------------------------------------------
    const maxUsersInput = page.locator('[data-testid="plan-max-users-input"]');
    await maxUsersInput.clear();
    await maxUsersInput.fill('250');

    // -----------------------------------------------------------------------
    // Step 8: Save changes
    // -----------------------------------------------------------------------
    await page.locator('[data-testid="plan-form-submit"]').click();

    // Wait for success toast
    await expect(page.getByText(new RegExp(`Plan.*${PLAN_NAME}.*updated`, 'i'))).toBeVisible({ timeout: 10000 });

    // Dialog should close
    await expect(editDialogTitle).not.toBeVisible({ timeout: 5000 });

    // Verify plan card reflects updated maxUsers of 250
    await expect(newPlanCard.getByText('250')).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 5: Plan updated successfully
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-plan-updated-success.png'),
      fullPage: true,
    });
  });
});
