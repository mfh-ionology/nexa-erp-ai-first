import { test, expect, type WebSocketRoute } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-16';

/**
 * Journey 16: WebSocket Real-Time Notification Delivery
 *
 * Verifies that a new notification delivered via WebSocket appears in the
 * dropdown without a page refresh, the badge count updates live, and
 * NORMAL priority does NOT trigger a toast (silent badge-only update).
 *
 * Strategy: Mock the Socket.io WebSocket connection using Playwright's
 * routeWebSocket API. After login and baseline capture, inject a
 * notification:new event with NORMAL priority and verify badge increment,
 * no toast, and dropdown shows the new notification at the top.
 */
test.describe('Journey 16: WebSocket Real-Time Notification Delivery', () => {
  test('NORMAL notification arrives via WebSocket, updates badge silently, and appears in dropdown', async ({
    page,
  }) => {
    // ── WebSocket mock setup ────────────────────────────────────────────────
    let wsRoute: WebSocketRoute | null = null;
    let socketReady = false;

    await page.routeWebSocket(/\/api\/v1\/notifications\/ws/, (ws) => {
      wsRoute = ws;

      // Engine.io handshake: send "open" packet
      ws.send(
        '0{"sid":"test-sid-j16","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}'
      );

      ws.onMessage((msg) => {
        if (typeof msg !== 'string') return;

        // Socket.io namespace connect request: 40/notifications,...
        if (msg.startsWith('40/notifications')) {
          ws.send('40/notifications,{"sid":"notif-j16-001"}');
          socketReady = true;
        }
      });
    });

    // ── Step 1 — Login ──────────────────────────────────────────────────────
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

    // ── Step 2 — Record initial badge count ─────────────────────────────────
    const bell = page.locator('button:has(svg.lucide-bell)').first();
    await expect(bell).toBeVisible({ timeout: 10000 });

    const badge = page.locator('.bg-destructive').first();
    let initialCount = 0;
    const hasBadge = await badge.isVisible().catch(() => false);
    if (hasBadge) {
      const badgeText = await badge.textContent();
      initialCount = parseInt(badgeText?.replace('+', '') ?? '0', 10);
    }

    // Checkpoint 1: Initial bell state (baseline)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-initial-bell-state.png`,
    });

    // ── Step 3 — Inject NORMAL priority notification via mocked WebSocket ──
    // Allow time for Socket.io handshake to complete through the mock
    await page.waitForTimeout(1500);

    expect(
      wsRoute,
      'WebSocket route should have been intercepted'
    ).not.toBeNull();

    const normalNotification = {
      id: 'test-notif-normal-j16-001',
      title: 'New Comment on Invoice INV-0042',
      body: 'Sarah left a comment: "Please review the VAT calculation on line 3."',
      priority: 'NORMAL',
      actionUrl: '/finance/invoices/inv-0042',
      entityType: 'invoice',
      entityId: 'test-entity-j16-001',
      status: 'DELIVERED',
      createdAt: new Date().toISOString(),
    };

    // Send Socket.io EVENT packet: 42/namespace,["event",payload]
    const eventPayload = JSON.stringify([
      'notification:new',
      normalNotification,
    ]);
    wsRoute!.send(`42/notifications,${eventPayload}`);

    // Also send an unread-count update (as the backend would)
    const countPayload = JSON.stringify([
      'notification:unread-count',
      { count: initialCount + 1 },
    ]);
    wsRoute!.send(`42/notifications,${countPayload}`);

    // ── Step 4 — Verify badge incremented and NO toast appeared ─────────────
    // Wait for the badge to update
    const updatedBadge = page.locator('.bg-destructive').first();
    await expect(updatedBadge).toBeVisible({ timeout: 5000 });

    const updatedBadgeText = await updatedBadge.textContent();
    const updatedCount = parseInt(
      updatedBadgeText?.replace('+', '') ?? '0',
      10
    );
    expect(
      updatedCount,
      `Badge count should increment from ${initialCount} to ${initialCount + 1}`
    ).toBe(initialCount + 1);

    // Verify NO toast appeared (NORMAL priority = silent update)
    // Give a brief moment for any toast that might erroneously appear
    await page.waitForTimeout(1000);
    const toastContainer = page.locator('[data-sonner-toaster]');
    const toasts = toastContainer.locator('[data-sonner-toast]');
    const toastCount = await toasts.count();
    expect(
      toastCount,
      'NORMAL priority should NOT trigger a toast notification'
    ).toBe(0);

    // Checkpoint 2: Badge incremented, no toast visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-badge-incremented-no-toast.png`,
    });

    // ── Step 5 — Open dropdown and verify new notification at top ────────────
    await bell.click();

    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // The new notification should be at the top of the list
    // Look for the notification title we injected
    const newNotifTitle = popover
      .getByText('New Comment on Invoice INV-0042')
      .first();
    await expect(newNotifTitle).toBeVisible({ timeout: 5000 });

    // Verify it shows as unread (blue dot indicator)
    const firstNotifItem = popover
      .locator('[class*="border-l-"]')
      .first();
    await expect(firstNotifItem).toBeVisible();

    // Verify 'just now' timestamp (injected moments ago)
    const justNow = popover
      .locator('span')
      .filter({ hasText: /just now/i })
      .first();
    await expect(justNow).toBeVisible();

    // Checkpoint 3: Dropdown with new notification at top
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-5-dropdown-new-notification-top.png`,
    });

    // ── Step 6 — Verify the new notification is the first item ──────────────
    // The notification list should have our injected notification at the top
    const allNotifItems = popover.locator('[class*="border-l-"]');
    const firstItemText = await allNotifItems.first().textContent();
    expect(
      firstItemText,
      'Newest notification should be prepended at the top of the list'
    ).toContain('New Comment on Invoice INV-0042');
  });
});
