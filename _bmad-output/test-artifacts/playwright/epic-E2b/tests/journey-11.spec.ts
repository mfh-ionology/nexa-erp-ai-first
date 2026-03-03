import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-11';

test.describe('Journey #11: Assign Zero Access Groups Rejected (422)', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Attempting to save zero access groups for a user returns a 422 error', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /system/users ──
    await page.goto('/system/users');
    await expect(
      page.getByRole('heading', { name: /users/i })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 2: Click sales@nexa-test.co.uk user row ──
    const salesUserRow = page.locator('table tbody tr', {
      hasText: 'sales@nexa-test.co.uk',
    });
    await expect(salesUserRow).toBeVisible({ timeout: 10000 });
    await salesUserRow.click();

    // Wait for navigation to user detail page
    await expect(page).toHaveURL(/\/system\/users\/.+/, {
      timeout: 10000,
    });

    // Verify user detail page loaded for the sales user
    await expect(
      page.getByText('sales@nexa-test.co.uk')
    ).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 1: User detail page with current access groups
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-user-detail-page-with-access-groups.png`,
      fullPage: true,
    });

    // ── Step 3: Remove all access group tags/chips ──
    // Strategy: Try multiple approaches to clear all access groups
    // Approach 1: Look for remove buttons (X) on each access group tag/chip
    const removeButtons = page.locator(
      '[data-testid="access-groups-panel"] [aria-label*="remove" i], ' +
      '[data-testid="access-groups-panel"] [aria-label*="delete" i], ' +
      '[data-testid="access-groups-panel"] button:has(svg), ' +
      'section:has-text("Access Group") [aria-label*="remove" i], ' +
      'section:has-text("Access Group") [aria-label*="delete" i]'
    );

    // Try to find and click remove/clear buttons on group tags
    let removeCount = await removeButtons.count();
    if (removeCount > 0) {
      // Click remove buttons from last to first to avoid index shifting
      for (let i = removeCount - 1; i >= 0; i--) {
        await removeButtons.nth(i).click();
        await page.waitForTimeout(300);
      }
    } else {
      // Approach 2: If it's a native multi-select, deselect all options
      const accessGroupSelector = page.getByRole('combobox', { name: /access group/i })
        .or(page.getByLabel(/access group/i))
        .or(page.locator('[data-testid="access-group-selector"]'))
        .or(page.locator('select[name*="accessGroup"]'));

      try {
        // For native select: set empty selection
        await accessGroupSelector.first().selectOption([]);
      } catch {
        // Approach 3: Look for a "clear all" button
        const clearAllButton = page.getByRole('button', { name: /clear all/i })
          .or(page.getByRole('button', { name: /remove all/i }))
          .or(page.locator('[aria-label="Clear"]'))
          .or(page.locator('[aria-label="clear all"]'));

        if (await clearAllButton.first().isVisible()) {
          await clearAllButton.first().click();
        } else {
          // Approach 4: Click individual tag close buttons (X icons within chips)
          const chipCloseButtons = page.locator(
            '.chip button, .tag button, [class*="badge"] button, ' +
            '[class*="chip"] [class*="close"], [class*="tag"] [class*="close"]'
          );
          const chipCount = await chipCloseButtons.count();
          for (let i = chipCount - 1; i >= 0; i--) {
            await chipCloseButtons.nth(i).click();
            await page.waitForTimeout(300);
          }
        }
      }
    }

    // Visual Checkpoint 2: Empty access groups selection
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-empty-access-groups-selection.png`,
      fullPage: true,
    });

    // ── Step 4: Click Save access group assignments button ──
    const saveButton = page.getByRole('button', { name: /save.*access.*group/i })
      .or(page.getByRole('button', { name: /save.*assignment/i }))
      .or(page.getByRole('button', { name: /save/i }));
    await saveButton.first().click();

    // Wait for error feedback — 422 Business Rule Violation
    const errorIndicator = page.getByText(/at least one access group/i)
      .or(page.getByText(/required/i))
      .or(page.getByText(/cannot be empty/i))
      .or(page.getByText(/422/i))
      .or(page.getByText(/validation/i))
      .or(page.getByRole('alert'));

    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });

    // Verify we're still on the same user detail page (not navigated away)
    await expect(page).toHaveURL(/\/system\/users\/.+/);

    // Visual Checkpoint 3: 422 error displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-422-error-empty-groups-rejected.png`,
      fullPage: true,
    });
  });
});
