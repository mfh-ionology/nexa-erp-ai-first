import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-17';

test.describe('Journey #17: System Access Group Cannot Be Deleted', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin cannot delete/deactivate a system access group (isSystem: true)', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: /access groups/i })
    ).toBeVisible();

    // ── Step 2: Click READ_ONLY row in table ──
    const readOnlyRow = page.locator('table tbody tr', {
      hasText: 'READ_ONLY',
    });
    await expect(readOnlyRow).toBeVisible();
    await readOnlyRow.click();

    // Wait for navigation to the detail page
    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, { timeout: 10000 });

    // Verify detail page loaded — title/heading should reference Read Only
    await expect(
      page.getByRole('heading', { name: /read.?only/i })
    ).toBeVisible();

    // Verify system group banner is visible
    const systemBanner = page.getByText(/system.*(access group|group)/i)
      .or(page.locator('[data-testid="system-group-banner"]'))
      .or(page.getByText(/cannot be (changed|deleted)/i));
    await expect(systemBanner).toBeVisible();

    // Visual Checkpoint 1: READ_ONLY detail page with system group banner
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-read-only-detail-page.png`,
      fullPage: true,
    });

    // ── Step 3: Click Overflow menu (More Actions) ──
    const overflowButton = page.getByRole('button', { name: /more actions/i })
      .or(page.getByRole('button', { name: /overflow/i }))
      .or(page.locator('[data-testid="overflow-menu"]'))
      .or(page.locator('[data-testid="more-actions"]'))
      .or(page.locator('button[aria-label*="more"]'))
      .or(page.locator('button[aria-haspopup="menu"]'));
    await expect(overflowButton).toBeVisible();
    await overflowButton.click();

    // ── Step 4: Verify Deactivate option is disabled ──
    // Wait for the menu to appear
    const menu = page.getByRole('menu')
      .or(page.locator('[role="menu"]'))
      .or(page.locator('[data-testid="overflow-menu-content"]'));
    await expect(menu).toBeVisible({ timeout: 5000 });

    // Find the Deactivate menu item — it should be disabled for system groups
    const deactivateOption = page.getByRole('menuitem', { name: /deactivate/i })
      .or(page.getByText(/deactivate/i));
    await expect(deactivateOption).toBeVisible();

    // Verify the option is disabled — check for aria-disabled or disabled attribute
    // System groups should have this option greyed out / disabled
    const isDisabled = await deactivateOption.evaluate((el) => {
      return (
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('disabled') ||
        (el as HTMLButtonElement).disabled === true ||
        el.classList.contains('disabled') ||
        el.getAttribute('data-disabled') === 'true' ||
        window.getComputedStyle(el).pointerEvents === 'none' ||
        window.getComputedStyle(el).opacity < '0.6'
      );
    });
    expect(isDisabled).toBe(true);

    // Visual Checkpoint 2: Overflow menu with disabled Deactivate option
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-overflow-menu-deactivate-disabled.png`,
      fullPage: true,
    });
  });
});
