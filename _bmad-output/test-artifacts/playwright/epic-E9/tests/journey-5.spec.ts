import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-5';

const STAFF_USER_ID = '00000000-0000-4000-a000-000000000010';
const DB_URL = 'postgresql://nexa:nexa_dev_pass@localhost:5432/nexa_erp_dev';

// Seed notification IDs for this journey
const SEED_NOTIF_IDS = [
  '00000000-e9e9-4005-b000-000000000001',
  '00000000-e9e9-4005-b000-000000000002',
  '00000000-e9e9-4005-b000-000000000003',
  '00000000-e9e9-4005-b000-000000000004',
  '00000000-e9e9-4005-b000-000000000005',
];

function runSQL(sql: string) {
  execSync(`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
  });
}

test.describe('Journey 5: Mark All Notifications as Read', () => {
  test.beforeEach(() => {
    // Clean up any previous seed data, then insert fresh DELIVERED notifications
    const deleteSQL = `DELETE FROM notifications WHERE id IN ('${SEED_NOTIF_IDS.join("','")}')`;
    runSQL(deleteSQL);

    const now = new Date().toISOString();
    const inserts = [
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[0]}', '${STAFF_USER_ID}', 'Approval required', 'A PurchaseOrder requires your approval.', 'IN_APP', 'URGENT', '/', 'PurchaseOrder', 'po-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[1]}', '${STAFF_USER_ID}', 'Invoice approved', 'Invoice INV-2024-001 has been approved.', 'IN_APP', 'HIGH', '/', 'Invoice', 'inv-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[2]}', '${STAFF_USER_ID}', 'Order confirmed', 'A new order has been confirmed.', 'IN_APP', 'NORMAL', '/', 'SalesOrder', 'ord-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[3]}', '${STAFF_USER_ID}', 'Stock low alert', 'Item SKU-100 is below reorder threshold.', 'IN_APP', 'HIGH', '/', 'StockItem', 'sku-100', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[4]}', '${STAFF_USER_ID}', 'Payment received', 'Payment of 500.00 GBP received.', 'IN_APP', 'NORMAL', '/', 'Payment', 'pay-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
    ];
    for (const sql of inserts) {
      runSQL(sql);
    }
  });

  test.afterEach(() => {
    const deleteSQL = `DELETE FROM notifications WHERE id IN ('${SEED_NOTIF_IDS.join("','")}')`;
    try {
      runSQL(deleteSQL);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('Mark All Read button marks all DELIVERED notifications as READ and resets badge', async ({
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

    // Step 2 — Verify bell badge shows unread count > 0
    const badge = page.locator('.bg-destructive').first();
    await expect(badge).toBeVisible({ timeout: 5000 });
    const badgeText = await badge.textContent();
    const initialBadgeCount = parseInt(badgeText?.replace('+', '') ?? '0', 10);
    expect(initialBadgeCount).toBeGreaterThan(0);

    // Checkpoint 1: Bell badge with unread count
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-bell-badge-unread-count.png`,
    });

    // Step 3 — Click notification bell to open dropdown
    await bell.click();

    const popover = page
      .locator('[data-radix-popper-content-wrapper]')
      .first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Verify 'Mark All Read' button is visible
    const markAllReadBtn = popover.getByRole('button', {
      name: /mark all read/i,
    });
    await expect(markAllReadBtn).toBeVisible();

    // Verify there are unread notification items (blue dots)
    const unreadDots = popover.locator('.bg-blue-500.rounded-full');
    const dotCount = await unreadDots.count();
    expect(dotCount).toBeGreaterThan(0);

    // Step 4 — Click 'Mark All Read' button
    await markAllReadBtn.click();

    // Wait for the API call to complete and UI to update
    await page.waitForLoadState('networkidle');

    // Allow a moment for optimistic UI updates to settle
    await page.waitForTimeout(1000);

    // Verify all blue unread dots are gone
    const remainingDots = popover.locator('.bg-blue-500.rounded-full');
    const remainingDotCount = await remainingDots.count();
    expect(
      remainingDotCount,
      'All unread dots should disappear after Mark All Read'
    ).toBe(0);

    // Verify no notification titles remain bold (semibold)
    const boldTitles = popover.locator(
      '[role="button"] .font-semibold'
    );
    const boldCount = await boldTitles.count();
    expect(
      boldCount,
      'No notification titles should be bold after marking all as read'
    ).toBe(0);

    // Verify 'Mark All Read' button is now hidden (no more unread items)
    const markAllReadHidden = await markAllReadBtn
      .isVisible()
      .catch(() => false);
    expect(
      markAllReadHidden,
      "'Mark All Read' button should disappear when unread count is 0"
    ).toBe(false);

    // Verify bell badge is gone or shows 0
    const badgeAfter = page.locator('.bg-destructive').first();
    const hasBadgeAfter = await badgeAfter.isVisible().catch(() => false);
    if (hasBadgeAfter) {
      const afterText = await badgeAfter.textContent();
      const afterCount = parseInt(afterText?.replace('+', '') ?? '0', 10);
      expect(afterCount, 'Badge count should be 0 after marking all as read').toBe(0);
    }
    // If badge disappeared entirely, that's the expected behaviour

    // Checkpoint 2: All notifications marked as read
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-all-marked-as-read.png`,
    });
  });
});
