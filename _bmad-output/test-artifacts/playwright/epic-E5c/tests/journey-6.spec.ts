import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-6';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 6: Prompt Versioning — Edit, Diff, and Restore', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.pressSequentially('admin@nexa-erp.dev', { delay: 10 });

    const passwordInput = page.getByLabel('Password');
    await passwordInput.click();
    await passwordInput.fill('');
    await passwordInput.pressSequentially('NexaDev2026!', { delay: 10 });

    const loginResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    await loginResponsePromise;

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Edit prompt, view version diff, and restore previous version', async ({ page }) => {
    // Log API responses for debugging
    page.on('response', async (response) => {
      if (response.url().includes('/ai/admin/prompts')) {
        const body = await response.text().catch(() => 'no body');
        console.log(`[API] ${response.status()} ${response.url()} → ${body.substring(0, 500)}`);
      }
    });

    // ── Step 1: Navigate to /ai/admin/prompts ────────────────────────────────
    await spaNavigate(page, '/ai/admin/prompts');
    await expect(
      page.getByLabel('breadcrumb').getByText('Prompt Templates'),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Step 2: Click on 'test-invoice-reminder' prompt row ──────────────────
    const promptRow = page.getByRole('row').filter({ hasText: 'test-invoice-reminder' });
    await expect(promptRow).toBeVisible({ timeout: 10000 });
    await promptRow.click();

    // Wait for navigation to the prompt editor page
    await page.waitForURL((url) => {
      const path = url.pathname;
      return path.includes('/ai/admin/prompts/') && !path.endsWith('/prompts') && !path.endsWith('/new');
    }, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify editor loaded with existing data
    await expect(page.getByText('test-invoice-reminder')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Version History')).toBeVisible();
    await expect(page.getByText('v1')).toBeVisible();

    // ── Checkpoint 1: Prompt Editor Loaded ────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-prompt-editor-loaded.png`,
      fullPage: true,
    });

    // ── Step 3: Edit the system prompt text ───────────────────────────────────
    const systemPromptTextarea = page.locator('textarea[aria-label="System prompt editor"]');
    await expect(systemPromptTextarea).toBeVisible();

    // Clear and fill with updated text
    await systemPromptTextarea.fill(
      'You are a senior accounts receivable specialist for {{company.name}}. Today is {{today}}. Your role is to generate professional but firm reminder emails for overdue invoices. Always include the exact amount owed.',
    );

    // Wait for form to register as dirty
    await page.waitForTimeout(500);

    // Verify Save button is enabled after editing
    await expect(page.getByRole('button', { name: /save/i })).toBeEnabled();

    // ── Step 4: Click Save — change reason modal should appear ───────────────
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for the change reason modal to appear
    await expect(page.getByText('Save Prompt Changes')).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 2: Change Reason Modal ─────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-change-reason-modal.png`,
      fullPage: true,
    });

    // Verify modal structure
    await expect(page.getByText('Describe what changed in this version')).toBeVisible();

    // ── Step 5: Fill change reason ───────────────────────────────────────────
    const changeReasonTextarea = page.locator('div[role="dialog"] textarea');
    await expect(changeReasonTextarea).toBeVisible();
    await changeReasonTextarea.fill('Added seniority and instruction to include exact amount owed');

    // ── Step 6: Click Save in change reason modal ────────────────────────────
    // Wait for the PATCH response
    const updateResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/ai/admin/prompts/') &&
        resp.request().method() === 'PATCH',
      { timeout: 15000 },
    );

    // Click the Save button inside the modal dialog
    const modalSaveButton = page.locator('div[role="dialog"]').getByRole('button', { name: /save/i });
    await expect(modalSaveButton).toBeEnabled();
    await modalSaveButton.click();

    // Wait for the API response
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBeLessThan(300);

    // Wait for UI to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify version 2 is now active in the sidebar
    await expect(page.getByText('v2')).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 3: Version 2 Created ───────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-version-2-created.png`,
      fullPage: true,
    });

    // ── Step 7: Click on v1 in version sidebar to see diff ───────────────────
    // The version sidebar lists versions. Click on v1 (the non-active one)
    const versionList = page.locator('[role="list"][aria-label="Version history"]');
    await expect(versionList).toBeVisible({ timeout: 10000 });

    // Click on v1 item in the version list
    const v1Item = versionList.locator('[role="listitem"]').filter({ hasText: 'v1' });
    await expect(v1Item).toBeVisible();
    await v1Item.click();

    // Wait for the version detail to load and diff to render
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify diff view is shown
    await expect(page.getByText(/changes.*v1.*vs.*current/i)).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 4: Diff View Shown ─────────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-diff-view-shown.png`,
      fullPage: true,
    });

    // ── Step 8: Verify 'Restore This Version' button is visible ──────────────
    const restoreButton = page.getByRole('button', { name: /restore this version/i });
    await expect(restoreButton).toBeVisible({ timeout: 10000 });

    // ── Step 9: Click 'Restore This Version' ─────────────────────────────────
    // Wait for the restore POST response
    const restoreResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/versions/') &&
        resp.url().includes('/restore') &&
        resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await restoreButton.click();

    // Wait for the API response
    const restoreResponse = await restoreResponsePromise;
    expect(restoreResponse.status()).toBeLessThan(300);

    // Wait for UI to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify success toast
    await expect(
      page.getByText(/version restored/i).or(page.getByText(/now active.*v3/i)),
    ).toBeVisible({ timeout: 10000 });

    // Verify v3 is now shown in the version sidebar
    await expect(page.getByText('v3')).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 5: Version 3 Restored ──────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-version-3-restored.png`,
      fullPage: true,
    });
  });
});
