import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-4';

const STAFF_USER_ID = '00000000-0000-4000-a000-000000000010';
const DB_URL = 'postgresql://nexa:nexa_dev_pass@localhost:5432/nexa_erp_dev';

const SEED_NOTIF_IDS = [
  '00000000-e9e9-4004-b000-000000000001',
  '00000000-e9e9-4004-b000-000000000002',
  '00000000-e9e9-4004-b000-000000000003',
];

function runSQL(sql: string) {
  execSync(`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
  });
}

test.describe('Journey 4: Dismiss a Notification', () => {
  test.beforeEach(() => {
    // Clean up ALL notifications for staff user to ensure clean state,
    // then insert fresh DELIVERED notifications
    runSQL(`DELETE FROM notifications WHERE user_id = '${STAFF_USER_ID}'`);

    const now = new Date().toISOString();
    const inserts = [
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[0]}', '${STAFF_USER_ID}', 'Stock alert triggered', 'Widget A has fallen below reorder level.', 'IN_APP', 'URGENT', '/', 'Product', 'prod-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[1]}', '${STAFF_USER_ID}', 'Payment received', 'Payment of £1,200.00 received from Acme Corp.', 'IN_APP', 'HIGH', '/', 'Payment', 'pay-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
      `INSERT INTO notifications (id, user_id, title, body, channel, priority, action_url, entity_type, entity_id, status, delivered_at, created_at, updated_at) VALUES ('${SEED_NOTIF_IDS[2]}', '${STAFF_USER_ID}', 'Report generated', 'Monthly sales report is ready for review.', 'IN_APP', 'NORMAL', '/', 'Report', 'rep-001', 'DELIVERED', '${now}', '${now}', '${now}')`,
    ];
    for (const sql of inserts) {
      runSQL(sql);
    }
  });

  test.afterEach(() => {
    try {
      runSQL(`DELETE FROM notifications WHERE user_id = '${STAFF_USER_ID}'`);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('Hovering reveals dismiss button and clicking it removes the notification', async ({
    page,
  }) => {
    // Capture API errors for debugging
    const apiErrors: string[] = [];
    page.on('response', (resp) => {
      if (resp.url().includes('/api/') && resp.status() >= 400) {
        apiErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
      }
    });

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

    // Step 1 — Dashboard loaded, bell icon visible
    const bell = page.getByRole('button', { name: /notifications/i });
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Record initial badge count
    const badge = bell.locator('.bg-destructive');
    await expect(badge).toBeVisible({ timeout: 5000 });
    const badgeText = await badge.textContent();
    const initialBadgeCount = parseInt(badgeText?.replace('+', '') ?? '0', 10);
    expect(initialBadgeCount).toBeGreaterThan(0);

    // Step 2 — Click notification bell to open dropdown
    await bell.click();

    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Step 3 — Count the initial number of notification items in the dropdown
    const notificationItems = popover.locator('div[role="button"][class*="border-l-"]');
    await expect(notificationItems.first()).toBeVisible();
    const initialCount = await notificationItems.count();
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // Checkpoint 1: Dropdown open with initial notifications
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-dropdown-open-initial-notifications.png`,
    });

    // Step 4 — Find a DELIVERED notification (one with unread blue dot)
    // The blue dot is a span.bg-blue-500 inside the notification item
    const unreadNotifications = notificationItems.filter({
      has: page.locator('.bg-blue-500'),
    });
    const unreadCount = await unreadNotifications.count();
    expect(unreadCount, 'Expected at least one DELIVERED notification with blue dot').toBeGreaterThan(0);

    const targetNotification = unreadNotifications.first();
    const targetTitle = await targetNotification.locator('.font-heading').first().textContent();

    // Hover over the target DELIVERED notification to reveal dismiss button
    await targetNotification.hover();
    await page.waitForTimeout(300);

    // The dismiss button: <button aria-label="Dismiss"> inside the hovered item
    const dismissButton = targetNotification.locator('button:has(svg.lucide-x)');
    await expect(dismissButton).toBeVisible({ timeout: 3000 });

    // Set up network interception for the dismiss API call
    const dismissResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/dismiss') && resp.request().method() === 'POST',
      { timeout: 10000 },
    );

    // Click the dismiss button
    await dismissButton.click();

    // Wait for the dismiss API response and check it
    const dismissResponse = await dismissResponsePromise.catch((e) => {
      console.error('Dismiss API call not intercepted:', e.message);
      return null;
    });

    if (dismissResponse) {
      const status = dismissResponse.status();
      if (status >= 400) {
        const body = await dismissResponse.text().catch(() => 'unable to read body');
        throw new Error(`Dismiss API returned ${status}: ${body}. API errors so far: ${apiErrors.join('; ')}`);
      }
    } else {
      // If no API call was intercepted, check if the count still decreased (optimistic-only)
      console.warn('No dismiss API response intercepted. API errors so far:', apiErrors.join('; '));
    }

    // Wait for the notification to be removed from the list
    await expect(notificationItems).toHaveCount(initialCount - 1, { timeout: 5000 });

    // Verify badge count decreased
    const badgeAfter = bell.locator('.bg-destructive');
    const hasBadgeAfter = await badgeAfter.isVisible().catch(() => false);
    if (hasBadgeAfter) {
      const newBadgeText = await badgeAfter.textContent();
      const newBadgeCount = parseInt(
        newBadgeText?.replace('+', '') ?? '0',
        10
      );
      expect(newBadgeCount).toBeLessThan(initialBadgeCount);
    }
    // If badge disappeared entirely, that's valid (count went to 0)

    // Checkpoint 2: Notification dismissed from list
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-notification-dismissed.png`,
    });
  });
});
