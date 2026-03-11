import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-4';

/** Track bugs found during test execution */
const bugs: string[] = [];

/**
 * SPA navigate without losing auth tokens (Zustand in-memory).
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

/**
 * Login and navigate to Knowledge Management page.
 */
async function loginAndNavigateToKnowledge(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('admin@nexa-erp.dev');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('NexaDev2026!');

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible' });
  await signInButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle');

  await spaNavigate(page, '/ai/admin/knowledge');

  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe('Journey 4: Create Knowledge Article via Dialog', () => {
  test.setTimeout(120_000);

  test('Create a new knowledge article through the Create Article dialog', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge ─────────────────────────
    await loginAndNavigateToKnowledge(page);

    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Verify Create Article button is visible
    const createArticleBtn = page.getByRole('button', { name: /create article/i });
    await expect(createArticleBtn).toBeVisible({ timeout: 5000 });

    // Checkpoint 1: Knowledge page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-knowledge-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click "Create Article" button ───────────────────────────
    await createArticleBtn.click();
    await page.waitForTimeout(500);

    // Verify dialog opened
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    const dialogTitle = dialog.getByText(/create knowledge article/i);
    const hasTitleText = await dialogTitle.isVisible().catch(() => false);
    if (!hasTitleText) {
      bugs.push('BUG: Create Article dialog missing "Create Knowledge Article" title text.');
    }

    // Verify form fields are present
    const titleInput = dialog.getByPlaceholder(/article title/i);
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    const contentArea = dialog.getByPlaceholder(/write your article content/i);
    await expect(contentArea).toBeVisible({ timeout: 3000 });

    // Checkpoint 2: Create Article dialog open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-create-article-dialog-open.png`,
      fullPage: true,
    });

    // ── Step 3: Fill the article creation form ──────────────────────────
    await titleInput.fill('EU Reverse Charge VAT Rules');

    // Select category — click the category combobox trigger
    const categoryTrigger = dialog.locator('button[role="combobox"]').first();
    if (await categoryTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryTrigger.click();
      await page.waitForTimeout(300);

      // Select TERMINOLOGY from dropdown options
      const terminologyOption = page.getByRole('option', { name: /terminology/i });
      if (await terminologyOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await terminologyOption.click();
      } else {
        // Fallback: Radix Select item
        const fallbackOption = page
          .locator('[role="listbox"] [role="option"]')
          .filter({ hasText: /terminology/i })
          .first();
        if (await fallbackOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fallbackOption.click();
        } else {
          // Last resort: click any text matching "Terminology"
          await page.getByText('Terminology', { exact: true }).click();
        }
      }
      await page.waitForTimeout(300);
    } else {
      bugs.push('BUG: Cannot find category combobox in Create Article dialog.');
    }

    // Fill content
    await contentArea.fill(
      'In our company, VAT code 3 is used for reverse charge on EU purchases. When processing invoices from EU suppliers, always apply VAT code 3 instead of standard rate.',
    );

    // Verify title field has expected value
    await expect(titleInput).toHaveValue('EU Reverse Charge VAT Rules');

    // Checkpoint 3: Form filled with test data
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-filled.png`,
      fullPage: true,
    });

    // ── Step 4: Click Save / Create Article button ──────────────────────
    // The submit button in create mode is labeled "Create Article"
    const submitBtn = dialog.getByRole('button', { name: /create article/i }).last();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      // Fallback: try Save button
      const saveBtn = dialog.getByRole('button', { name: /save/i });
      await saveBtn.click();
    }

    // Wait for dialog to close (indicates success)
    const dialogClosed = await dialog
      .waitFor({ state: 'hidden', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!dialogClosed) {
      // Check for error messages inside dialog
      const errorText = await dialog
        .locator('[role="alert"], .text-destructive, .text-red-500')
        .textContent()
        .catch(() => null);
      if (errorText) {
        bugs.push(`BUG: Article creation failed with error: ${errorText}`);
      } else {
        bugs.push('BUG: Dialog did not close after clicking Create Article — possible submission failure.');
      }
      // Take screenshot of the stuck dialog
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-dialog-stuck-error.png`,
        fullPage: true,
      });
    }

    // Wait for toast notification
    await page.waitForTimeout(1500);

    // Check for success toast
    const toast = page
      .locator('[data-sonner-toast], [role="status"], [class*="toast"]')
      .first();
    const toastVisible = await toast.isVisible({ timeout: 5000 }).catch(() => false);
    if (toastVisible) {
      const toastText = await toast.textContent().catch(() => '');
      console.log(`Toast message: "${toastText}"`);
      if (!/created|indexed|success/i.test(toastText || '')) {
        bugs.push(`BUG: Toast does not indicate success. Got: "${toastText}"`);
      }
    } else {
      console.warn('No success toast detected — may have auto-dismissed.');
    }

    // Checkpoint 4: Article created successfully
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-article-created-success.png`,
      fullPage: true,
    });

    // Verify the new article appears in the list
    const newArticle = page.getByText('EU Reverse Charge VAT Rules');
    const articleVisible = await newArticle
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!articleVisible) {
      bugs.push(
        'BUG: Newly created article "EU Reverse Charge VAT Rules" not visible in the articles list after creation.',
      );
    } else {
      console.log('New article "EU Reverse Charge VAT Rules" visible in list.');
    }

    // Verify page is still functional
    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible();

    // ── Summary ─────────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` +
          bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found during article creation:\n` +
          bugs.join('\n'),
      );
    }
  });
});
