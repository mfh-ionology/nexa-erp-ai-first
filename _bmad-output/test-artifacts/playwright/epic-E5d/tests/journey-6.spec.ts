import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-6';

/** Track bugs found during test execution */
const bugs: string[] = [];

/**
 * Helper: navigate within the SPA using pushState + popstate.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
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

test.describe('Journey 6: Edit Knowledge Article', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Edit article via overflow menu — update content and save', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge#articles ─────────────
    await spaNavigate(page, '/ai/admin/knowledge');

    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Verify Knowledge Articles tab is active
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Wait for article cards to load
    const firstOverflowBtn = page.getByLabel('Article actions').first();
    await firstOverflowBtn.waitFor({ state: 'visible', timeout: 15000 });

    // Checkpoint 1: Knowledge Articles Tab Loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-knowledge-articles-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click overflow menu on the first article card ─────────
    await firstOverflowBtn.click();
    await page.waitForTimeout(500);

    // Checkpoint 2: Overflow Menu Open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-overflow-menu-open.png`,
      fullPage: true,
    });

    // Verify Edit option is visible in the dropdown
    const editOption = page.getByRole('menuitem', { name: /edit/i });
    await expect(editOption).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click Edit option ───────────────────────────────────
    await editOption.click();
    await page.waitForTimeout(500);

    // Verify edit dialog opens with correct title
    const dialogTitle = page.getByRole('heading', { name: /edit.*article/i });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify pre-filled title (should not be empty)
    const titleInput = page.locator('input[placeholder="Article title"]');
    const originalTitle = await titleInput.inputValue();
    expect(originalTitle.length).toBeGreaterThan(0);
    console.log(`Original article title: "${originalTitle}"`);

    // Verify pre-filled content (should not be empty)
    const contentTextarea = page.locator('textarea');
    const originalContent = await contentTextarea.inputValue();
    expect(originalContent.length).toBeGreaterThan(0);
    console.log(`Original content length: ${originalContent.length} chars`);

    // Checkpoint 3: Edit Dialog Open with Pre-filled Data
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-edit-dialog-open.png`,
      fullPage: true,
    });

    // ── Step 4: Update content field ────────────────────────────────
    const updatedContent =
      'Updated content: When purchasing from EU suppliers after Brexit transition, use reverse charge mechanism. VAT code 3 applies to all EU purchases of goods and services.';
    await contentTextarea.click();
    await contentTextarea.fill(updatedContent);
    await page.waitForTimeout(500);

    // Verify content field has the new text
    const newContentValue = await contentTextarea.inputValue();
    expect(newContentValue).toContain('reverse charge mechanism');

    // Checkpoint 4: Content Updated in Form
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-content-updated.png`,
      fullPage: true,
    });

    // ── Step 5: Click Save button ───────────────────────────────────
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();

    // Listen for API response
    const updateResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/ai/knowledge-articles/') &&
        (resp.request().method() === 'PATCH' || resp.request().method() === 'PUT'),
      { timeout: 15000 },
    ).catch(() => null);

    await saveButton.click();

    // Wait for dialog to close (indicates success)
    await expect(dialogTitle).toBeHidden({ timeout: 15000 });

    // Wait for API response
    const updateResponse = await updateResponsePromise;
    if (updateResponse) {
      const status = updateResponse.status();
      console.log(`Update API response status: ${status}`);
      if (status >= 400) {
        bugs.push(`Edit article API returned status ${status}`);
      }
    }

    await page.waitForTimeout(1000);

    // Check for success toast
    const successToast = page.getByText(/updated|saved/i).first();
    const hasSuccessToast = await successToast.isVisible().catch(() => false);

    if (hasSuccessToast) {
      console.log('Success toast visible after article update');
    }

    // Check for error toast
    const errorToast = page.getByText(/failed|error/i).first();
    const hasErrorToast = await errorToast.isVisible().catch(() => false);

    if (hasErrorToast) {
      const errorText = await errorToast.textContent();
      bugs.push(`Edit article showed error toast: "${errorText}"`);
    }

    // Checkpoint 5: Article Updated Successfully
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-article-updated.png`,
      fullPage: true,
    });

    // ── Summary ────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` + bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found during Edit Article flow:\n` + bugs.join('\n'),
      );
    }

    console.log('SUCCESS: Edit Knowledge Article journey completed');
  });
});
