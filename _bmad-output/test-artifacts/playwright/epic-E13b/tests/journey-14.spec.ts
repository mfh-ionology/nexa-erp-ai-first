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
  '../../../screenshots/epic-E13b/journey-14',
);

// ---------------------------------------------------------------------------
// Journey 14: AI Quota Alerts and Spike Detection
// ---------------------------------------------------------------------------

test.describe('J14: AI Quota Alerts and Spike Detection', () => {
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

  test('view alerts, filter by type, acknowledge alert, and view acknowledged', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /ai-usage via sidebar (client-side navigation
    // preserves in-memory auth state — page.goto would lose it)
    // -----------------------------------------------------------------------
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await sidebar.getByText('AI Usage', { exact: true }).click();
    await expect(page).toHaveURL(/\/ai-usage/, { timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: /ai usage/i }),
    ).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 2: Click Alerts tab — verify alert list loads with active alerts
    // -----------------------------------------------------------------------
    const alertsTab = page.getByRole('tab', { name: /alerts/i });
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();
    await expect(alertsTab).toHaveAttribute('data-state', 'active');

    // Wait for alerts list to load (either alert items or empty state)
    const alertList = page.locator('[role="list"][aria-label="AI usage alerts"]');
    const emptyState = page.getByText(/no active alerts/i);

    // Wait for either alert list or empty state to appear
    await expect(
      alertList.or(emptyState),
    ).toBeVisible({ timeout: 15000 });

    const hasAlerts = await alertList.isVisible().catch(() => false);

    // Verify filter dropdowns are visible
    const typeFilter = page.locator('#alert-type-filter');
    const acknowledgedFilter = page.locator('#alert-acknowledged-filter');
    await expect(typeFilter).toBeVisible();
    await expect(acknowledgedFilter).toBeVisible();

    // Visual Checkpoint 1: Alerts tab loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-alerts-tab-loaded.png'),
      fullPage: true,
    });

    if (hasAlerts) {
      // Verify alert items have expected structure
      const alertItems = alertList.locator('[role="listitem"]');
      const alertCount = await alertItems.count();
      expect(alertCount).toBeGreaterThan(0);

      // Check that alerts have type badges (amber/red/purple)
      // At least one badge should exist
      const badges = alertList.locator(
        'span:has-text("Quota Warning"), span:has-text("Quota Exceeded"), span:has-text("Usage Spike")',
      );
      await expect(badges.first()).toBeVisible();

      // Verify tenant names and usage percentages are shown
      const usageTexts = alertList.locator('text=/Usage: \\d/');
      await expect(usageTexts.first()).toBeVisible();

      // -------------------------------------------------------------------
      // Step 3: Open alert type filter dropdown — verify options
      // -------------------------------------------------------------------
      const typeOptions = await typeFilter.locator('option').allTextContents();
      expect(typeOptions).toContain('All Types');
      expect(typeOptions).toContain('Quota Warning');
      expect(typeOptions).toContain('Quota Exceeded');
      expect(typeOptions).toContain('Usage Spike');

      // -------------------------------------------------------------------
      // Step 4: Select 'Usage Spike' filter — verify only spike alerts shown
      // -------------------------------------------------------------------
      await typeFilter.selectOption('USAGE_SPIKE');

      // Wait for filtered results to load
      await page.waitForTimeout(1000);

      // After filtering, check what's visible
      const filteredAlertList = page.locator('[role="list"][aria-label="AI usage alerts"]');
      const filteredEmpty = page.getByText(/no active alerts/i);
      const hasFilteredAlerts = await filteredAlertList.isVisible().catch(() => false);

      if (hasFilteredAlerts) {
        // All visible badges should be 'Usage Spike' (no amber/red)
        const filteredBadges = filteredAlertList.locator(
          'span:has-text("Quota Warning"), span:has-text("Quota Exceeded")',
        );
        const nonSpikeBadgeCount = await filteredBadges.count();
        expect(nonSpikeBadgeCount).toBe(0);

        // Spike badges should be visible
        const spikeBadges = filteredAlertList.locator('span:has-text("Usage Spike")');
        const spikeCount = await spikeBadges.count();
        expect(spikeCount).toBeGreaterThan(0);
      }

      // Visual Checkpoint 2: Filtered to usage spike
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-filtered-usage-spike.png'),
        fullPage: true,
      });

      // -------------------------------------------------------------------
      // Step 5: Acknowledge first alert — reset filter to All first
      // -------------------------------------------------------------------
      await typeFilter.selectOption('');
      await page.waitForTimeout(1000);

      // Re-check alert list after resetting filter
      const resetAlertList = page.locator('[role="list"][aria-label="AI usage alerts"]');
      const resetHasAlerts = await resetAlertList.isVisible().catch(() => false);

      if (resetHasAlerts) {
        // Find the first acknowledge button
        const ackButton = page.getByRole('button', { name: /acknowledge alert/i }).first();
        const ackButtonVisible = await ackButton.isVisible().catch(() => false);

        if (ackButtonVisible) {
          // Count alerts before acknowledging
          const alertsBefore = await resetAlertList.locator('[role="listitem"]').count();

          await ackButton.click();

          // Wait for the mutation to complete and list to update
          await page.waitForTimeout(2000);

          // Visual Checkpoint 3: Alert acknowledged
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '03-alert-acknowledged.png'),
            fullPage: true,
          });

          // Verify alert was removed or marked acknowledged
          const alertsAfter = await resetAlertList.locator('[role="listitem"]').count().catch(() => 0);
          // The alert should either be removed (count decreased) or still there but marked
          // Since we filter by acknowledged=false by default, it should disappear
          expect(alertsAfter).toBeLessThan(alertsBefore);

          // -----------------------------------------------------------------
          // Step 6: Switch to Acknowledged view
          // -----------------------------------------------------------------
          await acknowledgedFilter.selectOption('true');
          await page.waitForTimeout(1000);

          // Wait for acknowledged alerts list or empty state
          const ackAlertList = page.locator('[role="list"][aria-label="AI usage alerts"]');
          const ackEmpty = page.getByText(/no active alerts/i);
          await expect(
            ackAlertList.or(ackEmpty),
          ).toBeVisible({ timeout: 10000 });

          const hasAckAlerts = await ackAlertList.isVisible().catch(() => false);

          if (hasAckAlerts) {
            // The acknowledged alert should show "Acknowledged" text
            await expect(
              ackAlertList.getByText('Acknowledged'),
            ).toBeVisible({ timeout: 5000 });
          }

          // Visual Checkpoint 4: Acknowledged alerts view
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '04-acknowledged-alerts-view.png'),
            fullPage: true,
          });
        } else {
          // No acknowledge button visible (PLATFORM_VIEWER or no unacknowledged alerts)
          test.skip();
        }
      } else {
        // No alerts after reset — skip remaining steps
        test.skip();
      }
    } else {
      // No alerts seeded — cannot test filtering/acknowledging
      // Still verify the empty state is properly displayed
      await expect(emptyState).toBeVisible();
      await expect(page.getByText(/all tenants are within their usage limits/i)).toBeVisible();
      test.skip();
    }
  });
});
