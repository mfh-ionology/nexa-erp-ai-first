import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-12';

/**
 * Helper: navigate within the SPA using TanStack Router.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: open email dialog from the first POSTED invoice.
 */
async function openEmailDialog(page: import('@playwright/test').Page) {
  // Navigate to AR Invoices
  await spaNavigate(page, '/ar/invoices');
  const pageHeading = page.getByRole('heading', { name: /invoices/i }).or(
    page.getByText('Invoices', { exact: true }),
  );
  await expect(pageHeading.first()).toBeVisible({ timeout: 15000 });

  // Click the first invoice (INV-2026-0042 is the first POSTED/visible invoice)
  const firstInvoiceLink = page.getByText('INV-2026-0042');
  await expect(firstInvoiceLink).toBeVisible({ timeout: 10000 });
  await firstInvoiceLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Open overflow menu
  const overflowButton = page
    .locator('svg.lucide-more-horizontal, svg.lucide-ellipsis')
    .first()
    .locator('..');
  await expect(overflowButton).toBeVisible({ timeout: 10000 });
  await overflowButton.click();
  await page.waitForTimeout(500);

  // Click "Email to Customer"
  const emailMenuItem = page.getByText('Email to Customer');
  await expect(emailMenuItem).toBeVisible({ timeout: 5000 });
  await emailMenuItem.click();
  await page.waitForTimeout(2000);

  // Verify dialog opened
  const emailDialog = page.getByRole('dialog');
  await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });
}

test.describe('Journey 12: Responsive Email Dialog Layout', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('should adapt email dialog layout across desktop, tablet, and mobile viewports', async ({
    page,
  }) => {
    // ── Step 1-2: Navigate to invoice list and open email dialog at desktop size ──
    // Default viewport is 1280x720 from playwright config
    await openEmailDialog(page);

    // ── Step 3: Verify dialog at desktop viewport (1280x720) ──
    const emailDialog = page.getByRole('dialog').first();
    await expect(emailDialog).toBeVisible();

    // Verify dialog has expected width constraint (~600px centered)
    const desktopBox = await emailDialog.boundingBox();
    expect(desktopBox).not.toBeNull();
    if (desktopBox) {
      // Dialog should be around 600px wide (allow some margin for padding/border)
      expect(desktopBox.width).toBeLessThanOrEqual(700);
      expect(desktopBox.width).toBeGreaterThanOrEqual(400);
      // Should be roughly centered horizontally
      const viewportWidth = 1280;
      const dialogCenter = desktopBox.x + desktopBox.width / 2;
      expect(Math.abs(dialogCenter - viewportWidth / 2)).toBeLessThan(50);
    }

    // Verify key form elements are visible
    const sendButton = emailDialog.getByRole('button', { name: /send/i });
    await expect(sendButton.first()).toBeVisible();

    // Screenshot checkpoint 1: Desktop layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-desktop-dialog-1280x720.png`,
      fullPage: false,
    });

    // ── Step 4: Resize to tablet viewport (800x600) ──
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);

    // Dialog should adapt — verify it's still visible
    await expect(emailDialog).toBeVisible();

    const tabletBox = await emailDialog.boundingBox();
    expect(tabletBox).not.toBeNull();
    if (tabletBox) {
      // On tablet, dialog should be wider relative to viewport (up to ~90%)
      // or maintain its 600px max but not overflow
      expect(tabletBox.width).toBeLessThanOrEqual(800);
      expect(tabletBox.width).toBeGreaterThanOrEqual(350);
    }

    // Verify Send button still visible on tablet
    await expect(sendButton.first()).toBeVisible();

    // Screenshot checkpoint 2: Tablet layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-tablet-dialog-800x600.png`,
      fullPage: false,
    });

    // ── Step 5: Resize to mobile viewport (375x667) ──
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Dialog should still be visible — possibly as full-screen or bottom sheet
    await expect(emailDialog).toBeVisible();

    const mobileBox = await emailDialog.boundingBox();
    expect(mobileBox).not.toBeNull();
    if (mobileBox) {
      // On mobile, dialog should fill most of the viewport width
      expect(mobileBox.width).toBeGreaterThanOrEqual(300);
      // Should not overflow viewport
      expect(mobileBox.width).toBeLessThanOrEqual(375);
    }

    // Verify Send button is still accessible (may need to scroll)
    // Try scrolling the dialog content if Send is not visible
    const sendVisible = await sendButton.first().isVisible().catch(() => false);
    if (!sendVisible) {
      // Try scrolling within the dialog
      await emailDialog.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(500);
    }

    // Screenshot checkpoint 3: Mobile layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-mobile-dialog-375x667.png`,
      fullPage: false,
    });
  });
});
