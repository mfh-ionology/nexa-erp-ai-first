import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-3';

const STAFF_USER_ID = '00000000-0000-4000-a000-000000000010';
const DB_URL = 'postgresql://nexa:nexa_dev_pass@localhost:5432/nexa_erp_dev';

// Seed notification IDs for cleanup
const SEED_NOTIF_IDS = [
  '00000000-e9e9-4003-b000-000000000001',
  '00000000-e9e9-4003-b000-000000000002',
  '00000000-e9e9-4003-b000-000000000003',
];

function runSQL(sql: string) {
  execSync(`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
  });
}

test.describe('Journey 3: Click Notification to Mark as Read', () => {
  test.beforeEach(() => {
    // Clean up any previous seed data, then insert fresh DELIVERED notifications
    const deleteSQL = `DELETE FROM notifications WHERE id IN ('${SEED_NOTIF_IDS.join("','")}')`;
    runSQL(deleteSQL);

    const now = new Date().toISOString();
    // Use actionUrls that STAFF users can access (dashboard and AI routes visible in their sidebar)
    const inserts = [
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[0]}', '${STAFF_USER_ID}', 'Approval required', 'A PurchaseOrder requires your approval.', 'IN_APP', 'URGENT', '/', 'PurchaseOrder', 'po-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[1]}', '${STAFF_USER_ID}', 'Invoice approved', 'Invoice INV-2024-001 has been approved.', 'IN_APP', 'HIGH', '/', 'Invoice', 'inv-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[2]}', '${STAFF_USER_ID}', 'Order confirmed', 'A new order has been confirmed and is ready for fulfilment.', 'IN_APP', 'NORMAL', '/', 'SalesOrder', 'ord-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
    ];
    for (const sql of inserts) {
      runSQL(sql);
    }
  });

  test.afterEach(() => {
    // Clean up seeded notifications
    const deleteSQL = `DELETE FROM notifications WHERE id IN ('${SEED_NOTIF_IDS.join("','")}')`;
    try {
      runSQL(deleteSQL);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('Clicking an unread notification navigates to actionUrl and marks it as READ', async ({
    page,
  }) => {
    // Login as staff user
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.click();
    await emailInput.fill('staff@nexa-erp.dev');
    await passwordInput.click();
    await passwordInput.fill('NexaDev2026!');

    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');

    // Step 1 — Verify dashboard loaded
    const bell = page.locator('button:has(svg.lucide-bell)').first();
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Record initial badge count before any interaction
    const badge = page.locator('.bg-destructive').first();
    await expect(badge).toBeVisible({ timeout: 5000 });
    const badgeText = await badge.textContent();
    const initialBadgeCount = parseInt(badgeText?.replace('+', '') ?? '0', 10);
    expect(initialBadgeCount).toBeGreaterThan(0);

    // Step 2 — Click notification bell to open dropdown
    await bell.click();

    const popover = page
      .locator('[data-radix-popper-content-wrapper]')
      .first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Step 3 — Verify first unread notification item
    const unreadDot = popover.locator('.bg-blue-500.rounded-full').first();
    await expect(unreadDot).toBeVisible();

    // Get the first notification item (role="button" with border-l-* class)
    const firstNotification = popover
      .locator('[role="button"][class*="border-l-"]')
      .first();
    await expect(firstNotification).toBeVisible();

    // Verify bold title on unread item
    const boldTitle = firstNotification.locator('.font-semibold').first();
    await expect(boldTitle).toBeVisible();

    // Record the notification title for later verification
    const notifTitle = await boldTitle.textContent();

    // Checkpoint 1: Unread notification visible in dropdown
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-3-unread-notification-in-dropdown.png`,
    });

    // Step 4 — Click the first unread notification item
    // This should close the dropdown, navigate to actionUrl, and mark as READ
    await firstNotification.click();

    // Wait for dropdown to close
    await expect(popover).not.toBeVisible({ timeout: 5000 });

    // Wait for navigation and mark-as-read API call to complete
    await page.waitForLoadState('networkidle');

    // Checkpoint 2: Navigated after clicking notification
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-navigated-after-click.png`,
    });

    // Step 5 — Reopen the dropdown and verify the notification is now READ
    const bellAfterNav = page.locator('button:has(svg.lucide-bell)').first();
    await expect(bellAfterNav).toBeVisible({ timeout: 10000 });

    // Check badge count has decreased
    const badgeAfter = page.locator('.bg-destructive').first();
    const hasBadgeAfter = await badgeAfter.isVisible().catch(() => false);
    if (hasBadgeAfter) {
      const newBadgeText = await badgeAfter.textContent();
      const newBadgeCount = parseInt(
        newBadgeText?.replace('+', '') ?? '0',
        10
      );
      expect(newBadgeCount).toBeLessThan(initialBadgeCount);
    }
    // If badge disappeared entirely, that's also valid (count went to 0)

    // Click bell to reopen dropdown
    await bellAfterNav.click();

    const popoverAfter = page
      .locator('[data-radix-popper-content-wrapper]')
      .first();
    await expect(popoverAfter).toBeVisible({ timeout: 5000 });

    // Find the notification we clicked — it should now be READ (no blue dot, normal weight)
    if (notifTitle) {
      const readNotification = popoverAfter
        .locator('[role="button"]')
        .filter({ hasText: notifTitle })
        .first();

      const isVisible = await readNotification.isVisible().catch(() => false);
      if (isVisible) {
        // Verify it no longer has the bold semibold style
        const stillBold = readNotification.locator('.font-semibold').first();
        const isBold = await stillBold.isVisible().catch(() => false);
        expect(
          isBold,
          `Notification "${notifTitle}" should no longer be bold after being marked as READ`
        ).toBe(false);

        // Verify no blue dot on this specific notification
        const dot = readNotification.locator('.bg-blue-500.rounded-full');
        const hasDot = await dot.isVisible().catch(() => false);
        expect(
          hasDot,
          `Notification "${notifTitle}" should not have unread dot after being marked as READ`
        ).toBe(false);
      }
    }

    // Checkpoint 3: Notification now shows as READ in dropdown
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-5-notification-marked-as-read.png`,
    });
  });
});
