import { test, expect, type WebSocketRoute } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-7';

/**
 * Journey 7: Toast Appears for URGENT/HIGH Priority Notifications
 *
 * Tests that when a high-priority notification arrives via WebSocket,
 * a Sonner toast appears with the notification title and body.
 * NORMAL/LOW priorities should NOT trigger toasts.
 *
 * Strategy: Mock the Socket.io WebSocket connection using Playwright's
 * routeWebSocket API. Simulate the Engine.io/Socket.io handshake,
 * then inject a notification:new event to trigger the frontend toast.
 */
test.describe('Journey 7: Toast for URGENT/HIGH Priority Notifications', () => {
  test('URGENT notification triggers a Sonner toast and increments badge count', async ({
    page,
  }) => {
    // ── WebSocket mock setup ────────────────────────────────────────────────
    // Intercept Socket.io WebSocket connection and simulate handshake.
    // This allows us to inject notification:new events without a real server.

    let wsRoute: WebSocketRoute | null = null;
    let socketReady = false;

    await page.routeWebSocket(/\/api\/v1\/notifications\/ws/, (ws) => {
      wsRoute = ws;

      // Step 1 of Engine.io handshake: send "open" packet
      ws.send(
        '0{"sid":"test-sid-j7","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}'
      );

      ws.onMessage((msg) => {
        if (typeof msg !== 'string') return;

        // Socket.io namespace connect request: 40/notifications,...
        if (msg.startsWith('40/notifications')) {
          // Acknowledge namespace connection
          ws.send('40/notifications,{"sid":"notif-j7-001"}');
          socketReady = true;
        }

        // Engine.io pong (client responds to our ping) — no action needed
        // msg === '3'
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

    // ── Step 2 — Verify bell icon and NotificationProvider is active ────────
    const bell = page.locator('button:has(svg.lucide-bell)').first();
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Dashboard with bell icon visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-bell-icon-ws-connected.png`,
    });

    // Record initial badge count (may be 0 if no seeded notifications)
    const badge = page.locator('.bg-destructive').first();
    let initialCount = 0;
    const hasBadge = await badge.isVisible().catch(() => false);
    if (hasBadge) {
      const badgeText = await badge.textContent();
      initialCount = parseInt(badgeText?.replace('+', '') ?? '0', 10);
    }

    // ── Step 3 — Inject URGENT notification via mocked WebSocket ────────────
    // Wait a moment for the Socket.io client to establish its connection
    // through the mock. The handshake should complete within a few hundred ms.
    await page.waitForTimeout(1500);

    // Verify WebSocket was intercepted and Socket.io handshake completed
    expect(wsRoute, 'WebSocket route should have been intercepted').not.toBeNull();

    const urgentNotification = {
      id: 'test-notif-urgent-j7-001',
      title: 'Urgent: System Alert',
      body: 'Critical system threshold exceeded. Please review immediately.',
      priority: 'URGENT',
      actionUrl: '/system/settings',
      entityType: 'system',
      entityId: 'test-entity-j7-001',
      status: 'DELIVERED',
      createdAt: new Date().toISOString(),
    };

    // Send Socket.io EVENT packet: 42/namespace,["event",payload]
    // Engine.io type 4 (message) + Socket.io type 2 (EVENT)
    const eventPayload = JSON.stringify([
      'notification:new',
      urgentNotification,
    ]);
    wsRoute!.send(`42/notifications,${eventPayload}`);

    // ── Step 4 — Verify Sonner toast appears ────────────────────────────────
    // Sonner renders toasts in an <ol data-sonner-toaster> > <li data-sonner-toast>
    const toastContainer = page.locator('[data-sonner-toaster]');
    const toast = toastContainer.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify toast shows the notification title and body
    await expect(toast).toContainText('Urgent: System Alert');
    await expect(toast).toContainText('Critical system threshold exceeded');

    // Checkpoint 2: Toast notification visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-toast-urgent-notification.png`,
    });

    // ── Step 5 — Verify badge count incremented ─────────────────────────────
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

    // Checkpoint 3: Badge count incremented
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-5-badge-count-incremented.png`,
    });
  });
});
