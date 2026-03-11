import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-5';

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

test.describe('Journey 5: Upload Document Flow', () => {
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

  test('Upload a document via paste content method', async ({ page }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge#articles ──────────────
    await spaNavigate(page, '/ai/admin/knowledge');

    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify Knowledge Articles tab is active
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Checkpoint 1: Knowledge Articles Tab Loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-knowledge-articles-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click "Upload Document" button ────────────────────────
    const uploadButton = page.getByRole('button', { name: /upload document/i });
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
    await uploadButton.click();
    await page.waitForTimeout(500);

    // Verify dialog opened with correct title
    const dialogTitle = page.getByRole('heading', { name: 'Upload Document' });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify drag-drop zone
    await expect(
      page.getByText('Drop files here or click to browse'),
    ).toBeVisible();

    // Verify file type hint
    await expect(
      page.getByText('Supports .txt, .md files'),
    ).toBeVisible();

    // Verify "or paste content" separator
    await expect(page.getByText('or paste content', { exact: true })).toBeVisible();

    // Verify content textarea placeholder
    await expect(
      page.getByPlaceholder('Paste your document content here...'),
    ).toBeVisible();

    // Verify title input placeholder
    await expect(page.getByPlaceholder('Article title')).toBeVisible();

    // Verify category selector placeholder
    await expect(page.getByText('Select a category')).toBeVisible();

    // Verify Upload & Create button is disabled (no content yet)
    const submitButton = page.getByRole('button', { name: /upload & create/i });
    await expect(submitButton).toBeDisabled();

    // Checkpoint 2: Upload Dialog Open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-upload-dialog-open.png`,
      fullPage: true,
    });

    // ── Step 3: Fill form — paste content method ──────────────────────
    const contentTextarea = page.getByPlaceholder('Paste your document content here...');
    await contentTextarea.fill(
      '## Purchase Order Approval Process\n\n### Orders under £1000\n- Auto-approved by system\n\n### Orders £1000–£5000\n- Requires department manager approval\n\n### Orders over £5000\n- Requires Finance Director sign-off (within 24 hours)\n- If Finance Director unavailable, CFO can approve',
    );

    // Fill title
    const titleInput = page.getByPlaceholder('Article title');
    await titleInput.fill('PO Approval Workflow SOP');

    // Select category — "Business Processes" (BUSINESS_PROCESS)
    const categoryTrigger = page.getByRole('combobox');
    await categoryTrigger.click();
    await page.waitForTimeout(300);

    const businessProcessOption = page.getByRole('option', { name: 'Business Processes' });
    await expect(businessProcessOption).toBeVisible({ timeout: 3000 });
    await businessProcessOption.click();
    await page.waitForTimeout(300);

    // Verify Upload & Create button is now enabled
    await expect(submitButton).toBeEnabled();

    // Checkpoint 3: Form Filled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-filled.png`,
      fullPage: true,
    });

    // ── Step 4: Click Submit ──────────────────────────────────────────
    await submitButton.click();

    // Wait for the dialog to close (indicates success)
    await expect(dialogTitle).toBeHidden({ timeout: 15000 });

    // Wait for success toast
    const successToast = page.getByText('Knowledge article created and indexed');
    await expect(successToast).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);

    // Checkpoint 4: Article Created Success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-article-created-success.png`,
      fullPage: true,
    });

    // Verify the new article appears in the list
    const newArticle = page.getByText('PO Approval Workflow SOP').first();
    await expect(newArticle).toBeVisible({ timeout: 10000 });

    // ── Summary ──────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` + bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found during Upload Document flow:\n` + bugs.join('\n'),
      );
    }

    console.log('SUCCESS: Upload Document flow completed — article created and visible in list');
  });
});
