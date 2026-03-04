import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-6';

const STAFF_USER_ID = '00000000-0000-4000-a000-000000000010';
const DB_URL = 'postgresql://nexa:nexa_dev_pass@localhost:5432/nexa_erp_dev';

function runSQL(sql: string) {
  execSync(`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
  });
}

test.describe('Journey 6: Empty State When No Notifications', () => {
  test.beforeEach(() => {
    // Delete ALL notifications for the staff user to ensure empty state
    runSQL(
      `DELETE FROM notifications WHERE user_id = '${STAFF_USER_ID}'`
    );
  });

  test.afterEach(() => {
    // No cleanup needed — we only deleted, didn't insert
  });

  test('Notification dropdown shows empty state with icon and message when user has no notifications', async ({
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

    // Step 2 — Verify bell icon has NO badge (no unread count)
    const badge = page.locator('.bg-destructive').first();
    const hasBadge = await badge.isVisible().catch(() => false);
    if (hasBadge) {
      // If badge is visible, its count should be 0
      const badgeText = await badge.textContent();
      const count = parseInt(badgeText?.replace('+', '') ?? '0', 10);
      expect(count, 'Badge should show 0 or not be visible').toBe(0);
    }
    // If no badge at all, that's the expected empty-state behaviour

    // Checkpoint 1: Bell icon without badge
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-bell-icon-no-badge.png`,
    });

    // Step 3 — Click notification bell to open dropdown
    await bell.click();

    const popover = page
      .locator('[data-radix-popper-content-wrapper]')
      .first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Verify "Notifications" header is present
    await expect(popover.getByRole('heading', { name: 'Notifications' })).toBeVisible();

    // Verify empty state — muted Bell icon and "No notifications" text
    await expect(
      popover.getByText(/no notifications/i)
    ).toBeVisible({ timeout: 5000 });

    // Verify secondary description text
    await expect(
      popover.getByText(/you're all caught up/i)
    ).toBeVisible();

    // Verify "Mark All Read" button is NOT visible (no unread items)
    const markAllReadBtn = popover.getByRole('button', {
      name: /mark all read/i,
    });
    const isMarkAllReadVisible = await markAllReadBtn
      .isVisible()
      .catch(() => false);
    expect(
      isMarkAllReadVisible,
      "'Mark All Read' button should NOT be visible when there are no notifications"
    ).toBe(false);

    // Verify "View All" link is still present in footer
    await expect(
      popover.getByText(/view all/i)
    ).toBeVisible();

    // Verify no notification items are present (no items with priority border)
    const notificationItems = popover.locator('[role="button"][class*="border-l-"]');
    const itemCount = await notificationItems.count();
    expect(itemCount, 'No notification items should be present').toBe(0);

    // Checkpoint 2: Empty state dropdown
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-3-empty-state-dropdown.png`,
    });
  });
});
