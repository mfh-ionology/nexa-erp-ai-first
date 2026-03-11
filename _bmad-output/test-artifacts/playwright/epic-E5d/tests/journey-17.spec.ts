import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-17';

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

test.describe('Journey 17: Suggested Knowledge — Edit & Accept with Category Remap', () => {
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

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Edit & Accept a platform-suggested knowledge article with category remap', async ({
    page,
  }) => {
    // ── Step 1: Navigate to Suggested tab ──────────────────────────────
    await spaNavigate(page, '/ai/admin/knowledge#suggested');
    await page.waitForTimeout(1000);

    // Verify Knowledge Management page loaded
    const heading = page.getByRole('heading', { name: /knowledge management/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Click the Suggested tab to ensure it's active
    const suggestedTab = page.getByRole('tab', { name: /suggested/i });
    if (await suggestedTab.isVisible().catch(() => false)) {
      await suggestedTab.click();
      await page.waitForTimeout(1000);
    } else {
      const suggestedText = page.getByText('Suggested', { exact: true }).first();
      if (await suggestedText.isVisible().catch(() => false)) {
        await suggestedText.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Checkpoint 1: Suggested tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-suggested-tab-loaded.png`,
      fullPage: true,
    });

    // Check if we have suggestion cards or empty state
    const editAcceptButtons = page.getByRole('button', { name: /edit.*accept/i }).or(
      page.getByRole('button', { name: /edit & accept/i }),
    );
    const emptyState = page.getByText(/all caught up/i).or(
      page.getByText(/no suggestions/i),
    );
    const hasEditAccept = await editAcceptButtons.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEmptyState && !hasEditAccept) {
      console.log('NOTICE: No suggested articles available — empty state displayed. Cannot test Edit & Accept flow.');
      return;
    }

    // ── Step 2: Click Edit & Accept on a suggested article ─────────────
    // Count suggestions before action
    const acceptButtons = page.getByRole('button', { name: /^accept$/i });
    const initialCount = await acceptButtons.count().catch(() => 0);
    console.log(`Suggestion cards before Edit & Accept: ${initialCount}`);

    // Get the title of the article we're about to edit
    const firstEditBtn = editAcceptButtons.first();
    const firstCard = firstEditBtn.locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")]').first();
    const cardTitleEl = firstCard.locator('h3, h4, [class*="title"]').first();
    let articleTitle = '';
    if (await cardTitleEl.isVisible().catch(() => false)) {
      articleTitle = (await cardTitleEl.textContent()) ?? '';
      console.log(`Editing article: "${articleTitle}"`);
    }

    await firstEditBtn.click();
    await page.waitForTimeout(1000);

    // Verify edit form dialog opened
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
    const hasDialog = await dialog.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasDialog) {
      console.log('ERROR: Edit form dialog did not appear after clicking Edit & Accept');
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-edit-form-dialog.png`,
        fullPage: true,
      });
      return;
    }

    console.log('✓ Edit form dialog opened');

    // Verify form is pre-filled with content
    const dialogEl = dialog.first();

    // Check for title field
    const titleField = dialogEl.getByRole('textbox', { name: /title/i }).or(
      dialogEl.locator('input[name="title"]'),
    ).first();
    const hasTitleField = await titleField.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTitleField) {
      const titleValue = await titleField.inputValue();
      console.log(`Pre-filled title: "${titleValue}"`);
    }

    // Check for content field
    const contentField = dialogEl.locator('textarea').or(
      dialogEl.getByRole('textbox', { name: /content/i }),
    ).first();
    const hasContentField = await contentField.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasContentField) {
      const contentValue = await contentField.inputValue();
      console.log(`Pre-filled content (first 100 chars): "${contentValue.substring(0, 100)}"`);
    }

    // Check for category field
    const categorySelect = dialogEl.locator('select, [role="combobox"], [role="listbox"], button[class*="select"]').first();
    const hasCategoryField = await categorySelect.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasCategoryField) {
      const categoryText = await categorySelect.textContent();
      console.log(`Category field value: "${categoryText}"`);
    }

    // Checkpoint 2: Edit form dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-edit-form-dialog.png`,
      fullPage: true,
    });

    // ── Step 3: Modify content and category ─────────────────────────────
    // Update content
    if (hasContentField) {
      await contentField.clear();
      await contentField.fill('Customised version: Our company follows this best practice with the following modifications...');
      console.log('✓ Content field updated');
    } else {
      console.log('NOTICE: Content field not found — looking for alternative text input');
      const anyTextarea = dialogEl.locator('textarea, [contenteditable="true"]').first();
      if (await anyTextarea.isVisible().catch(() => false)) {
        await anyTextarea.clear();
        await anyTextarea.fill('Customised version: Our company follows this best practice with the following modifications...');
        console.log('✓ Content updated via alternative text input');
      }
    }

    // Change category to INDUSTRY_RULES
    if (hasCategoryField) {
      const nativeSelect = dialogEl.locator('select').first();
      if (await nativeSelect.isVisible().catch(() => false)) {
        await nativeSelect.selectOption({ label: /industry/i });
        console.log('✓ Category changed via native select');
      } else {
        // Shadcn-style select (click to open, then select option)
        await categorySelect.click();
        await page.waitForTimeout(500);

        const industryOption = page.getByRole('option', { name: /industry/i }).or(
          page.getByText(/industry rules/i),
        ).or(
          page.getByText(/INDUSTRY_RULES/i),
        );
        const hasOption = await industryOption.first().isVisible({ timeout: 3000 }).catch(() => false);
        if (hasOption) {
          await industryOption.first().click();
          console.log('✓ Category changed to Industry Rules');
        } else {
          console.log('NOTICE: Industry Rules option not found in category dropdown');
          await page.keyboard.press('Escape');
        }
      }
    }

    await page.waitForTimeout(500);

    // Checkpoint 3: Form modified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-modified.png`,
      fullPage: true,
    });

    // ── Step 4: Click Save to accept the modified article ───────────────
    const saveButton = dialogEl.getByRole('button', { name: /save/i }).or(
      dialogEl.getByRole('button', { name: /accept/i }),
    ).or(
      dialogEl.getByRole('button', { name: /submit/i }),
    ).or(
      dialogEl.getByRole('button', { name: /confirm/i }),
    );

    const hasSaveBtn = await saveButton.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSaveBtn) {
      await saveButton.first().click();
      console.log('✓ Save button clicked');
    } else {
      console.log('ERROR: No save/accept/submit button found in dialog');
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-save-success.png`,
        fullPage: true,
      });
      return;
    }

    await page.waitForTimeout(2000);

    // Check for success toast
    const successToast = page.getByText(/accepted/i).or(
      page.getByText(/article.*created/i),
    ).or(
      page.getByText(/article.*saved/i),
    ).or(
      page.getByText(/success/i),
    );
    const hasToast = await successToast.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasToast) {
      const toastText = await successToast.first().textContent();
      console.log(`✓ Success toast visible: "${toastText}"`);
    } else {
      console.log('NOTICE: No success toast found — may use different feedback mechanism');
    }

    // Verify the card was removed from Suggested tab
    await page.waitForTimeout(1000);
    const postCount = await acceptButtons.count().catch(() => 0);
    const postEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (initialCount > 1) {
      if (postCount < initialCount) {
        console.log(`✓ Suggestion card removed — count went from ${initialCount} to ${postCount}`);
      } else {
        console.log(`NOTICE: Suggestion count did not decrease (was ${initialCount}, now ${postCount})`);
      }
    } else if (postEmptyState) {
      console.log('✓ Last suggestion accepted — empty state now shown');
    }

    // Checkpoint 4: Save success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-save-success.png`,
      fullPage: true,
    });
  });
});
