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
  '../../../screenshots/epic-E13b/journey-11',
);

// ---------------------------------------------------------------------------
// Journey 11: Change Billing Enforcement Action
// ---------------------------------------------------------------------------

test.describe('J11: Change Billing Enforcement Action', () => {
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

  test('change enforcement from NONE to WARNING with reason and verify timeline update', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to tenant detail page via sidebar → Tenants → click row
    // (SPA navigation preserves in-memory auth state)
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
    const billingTabTrigger = page.getByRole('tab', { name: /billing/i });
    await expect(billingTabTrigger).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 2: Click the Billing tab
    // -----------------------------------------------------------------------
    await billingTabTrigger.click();

    // Wait for billing tab content to render
    const billingTab = page.locator('[data-testid="billing-tab"]');
    await expect(billingTab).toBeVisible({ timeout: 10000 });

    // Verify subscription section heading is visible
    await expect(
      billingTab.getByRole('heading', { name: 'Subscription' }),
    ).toBeVisible();

    // Verify enforcement & dunning section heading is visible
    await expect(
      billingTab.getByRole('heading', { name: /enforcement.*dunning/i }),
    ).toBeVisible();

    // Verify Change Enforcement button is visible (PLATFORM_ADMIN)
    const changeEnforcementBtn = page.locator(
      '[data-testid="change-enforcement-btn"]',
    );
    await expect(changeEnforcementBtn).toBeVisible();

    // Verify Change Plan button is visible (PLATFORM_ADMIN)
    const changePlanBtn = page.locator('[data-testid="change-plan-btn"]');
    await expect(changePlanBtn).toBeVisible();

    // Visual checkpoint 1: Billing tab loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-billing-tab-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify enforcement escalation timeline
    // -----------------------------------------------------------------------
    const timeline = page.locator('[data-testid="enforcement-timeline"]');
    await expect(timeline).toBeVisible();

    // Verify all 4 steps exist
    await expect(
      page.locator('[data-testid="timeline-step-NONE"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="timeline-step-WARNING"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="timeline-step-READ_ONLY"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="timeline-step-SUSPENDED"]'),
    ).toBeVisible();

    // Verify labels
    await expect(timeline.getByText('None')).toBeVisible();
    await expect(timeline.getByText('Warning')).toBeVisible();
    await expect(timeline.getByText('Read Only')).toBeVisible();
    await expect(timeline.getByText('Suspended')).toBeVisible();

    // Verify current state description shows NONE state
    const enforcementDescription = page.locator(
      '[data-testid="enforcement-description"]',
    );
    await expect(enforcementDescription).toBeVisible();
    await expect(enforcementDescription).toContainText(
      'Normal operation — no restrictions',
    );

    // Visual checkpoint 2: Enforcement timeline detail
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-enforcement-timeline-detail.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 4: Click "Change Enforcement" to open the dialog
    // -----------------------------------------------------------------------
    await changeEnforcementBtn.click();

    // Wait for the dialog to appear
    const dialogTitle = page.getByText('Change Enforcement Action');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify current enforcement is shown as "None"
    await expect(page.getByText(/current enforcement:.*none/i)).toBeVisible();

    // Verify the target select dropdown exists
    const targetSelect = page.locator(
      '[data-testid="enforcement-target-select"]',
    );
    await expect(targetSelect).toBeVisible();

    // Verify reason textarea exists
    const reasonInput = page.locator(
      '[data-testid="enforcement-reason-input"]',
    );
    await expect(reasonInput).toBeVisible();

    // Verify grace period input exists
    const graceInput = page.locator(
      '[data-testid="enforcement-grace-input"]',
    );
    await expect(graceInput).toBeVisible();

    // Visual checkpoint 3: Enforcement dialog opened
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-enforcement-dialog-opened.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 5: Verify WARNING is selected (auto-selected as only valid transition
    // from NONE) and check consequence description
    // -----------------------------------------------------------------------
    // From NONE, the only valid target is WARNING — it should be pre-selected
    await expect(targetSelect).toHaveValue('WARNING');

    // -----------------------------------------------------------------------
    // Step 6: Verify consequence description for WARNING
    // -----------------------------------------------------------------------
    const consequenceBox = page.locator(
      '[data-testid="enforcement-consequence"]',
    );
    await expect(consequenceBox).toBeVisible();
    await expect(consequenceBox).toContainText(
      "A warning banner will appear in the tenant's ERP within 30 seconds.",
    );

    // Verify the Confirm button is disabled (reason not filled yet)
    const confirmBtn = page.getByRole('button', { name: /confirm change/i });
    await expect(confirmBtn).toBeDisabled();

    // Visual checkpoint 4: WARNING selected with consequence description
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-warning-selected-consequence.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 7: Fill reason text
    // -----------------------------------------------------------------------
    await reasonInput.fill(
      'Payment overdue by 14 days, escalating to warning',
    );

    // Confirm button should now be enabled
    await expect(confirmBtn).toBeEnabled();

    // -----------------------------------------------------------------------
    // Step 8: Click Confirm Change and verify success
    // -----------------------------------------------------------------------
    await confirmBtn.click();

    // Wait for success toast — billing-tab.tsx shows:
    // "Enforcement changed from NONE to WARNING"
    await expect(
      page.getByText(/enforcement changed from.*none.*to.*warning/i),
    ).toBeVisible({ timeout: 10000 });

    // Dialog should close
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });

    // Verify enforcement timeline updated — description should now show WARNING state
    await expect(enforcementDescription).toContainText(
      'Payment overdue',
      { timeout: 5000 },
    );

    // Visual checkpoint 5: Enforcement changed successfully
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-enforcement-changed-success.png'),
      fullPage: true,
    });
  });
});
