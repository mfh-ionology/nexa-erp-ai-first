import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-2';

test.describe('Journey 2: Open Notification Dropdown', () => {
  test('Clicking the bell opens a popover with prioritised notification items', async ({
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

    // Step 1 — Verify dashboard loaded and bell is visible
    const bell = page.locator('button:has(svg.lucide-bell)').first();
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Dashboard with bell icon
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-1-dashboard-with-bell.png`,
    });

    // Step 2 — Click notification bell to open dropdown
    await bell.click();

    // Wait for the popover content to appear
    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Checkpoint 2: Dropdown open
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-notification-dropdown-open.png`,
    });

    // Step 3 — Verify 'Notifications' heading in dropdown header
    const heading = popover.getByText('Notifications').first();
    await expect(heading).toBeVisible();

    // Check if we are in empty state (no seeded notifications) or populated state
    const emptyState = popover.getByText(/no notifications/i);
    const isEmptyState = await emptyState.isVisible().catch(() => false);

    if (!isEmptyState) {
      // Step 4 — Verify 'Mark All Read' button is visible
      const markAllRead = popover.getByText(/mark all read/i).first();
      await expect(markAllRead).toBeVisible();

      // Step 5 — Verify at least one notification with coloured priority border
      const priorityItem = popover
        .locator(
          '[class*="border-l-red-500"], [class*="border-l-amber-500"], [class*="border-l-blue-500"], [class*="border-l-gray-400"]'
        )
        .first();
      await expect(priorityItem).toBeVisible();

      // Step 6 — Verify unread dot indicator (blue dot)
      const unreadDot = popover.locator('.bg-blue-500.rounded-full').first();
      await expect(unreadDot).toBeVisible();

      // Step 7 — Verify relative timestamp on notification items
      const timestamp = popover
        .locator('span')
        .filter({ hasText: /ago|just now/i })
        .first();
      await expect(timestamp).toBeVisible();
    } else {
      // Empty state — precondition not met: no notifications seeded for staff user
      // Verify empty state UI renders correctly, then fail with explanation
      await expect(emptyState).toBeVisible();
      const emptyDescription = popover.getByText(/all caught up/i);
      await expect(emptyDescription).toBeVisible();
    }

    // Checkpoint 3: Priority indicators and timestamps (or empty state)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-7-priority-and-timestamps.png`,
    });

    // Step 8 — Verify 'View All' link at bottom of dropdown
    const viewAll = popover.getByText(/view all/i).first();
    await expect(viewAll).toBeVisible();

    // If empty state, fail the test — precondition requires seeded notifications
    if (isEmptyState) {
      expect(isEmptyState,
        'PRECONDITION NOT MET: No notifications seeded for staff user. ' +
        'Journey requires at least 3 unread notifications of varying priorities (URGENT, HIGH, NORMAL).'
      ).toBe(false);
    }
  });
});
