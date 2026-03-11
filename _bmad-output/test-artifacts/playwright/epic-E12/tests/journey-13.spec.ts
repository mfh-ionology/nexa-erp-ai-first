import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-13';

test.describe('Journey 13: Clone an Existing Template', () => {
  test('should clone the E2E Test Invoice Template with a new name', async ({ page }) => {
    // ── Step 1: Navigate to /settings/document-templates ────────────────
    await page.goto('/');

    // Authenticate if redirected to login
    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    // Wait for app layout
    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // Navigate to document templates page
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const linkCount = await docTemplatesLink.count();

    if (linkCount > 0) {
      await docTemplatesLink.first().click();
    } else {
      await page.evaluate(async () => {
        const mod = await import('/src/router.ts');
        await mod.router.navigate({ to: '/settings/document-templates' });
      });
    }

    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );

    // Wait for template list to load (accordion group count badge)
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Wait for skeletons to clear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // CP-1: Template list loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-template-list-loaded.png`,
      fullPage: true,
    });

    // Verify the E2E Test Invoice Template card is visible
    const e2eTemplateCard = page.locator('.cursor-pointer.rounded-xl', {
      hasText: 'E2E Test Invoice Template',
    });
    await expect(e2eTemplateCard).toBeVisible({ timeout: 10000 });

    // ── Step 2: Click the three-dot overflow menu on the E2E Test Invoice Template card ──
    const overflowBtn = e2eTemplateCard.getByRole('button', { name: 'Template actions' });
    await expect(overflowBtn).toBeVisible({ timeout: 5000 });
    await overflowBtn.click();

    // Wait for dropdown menu to appear
    await page.waitForTimeout(300);

    // CP-2: Overflow menu open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-overflow-menu-open.png`,
      fullPage: true,
    });

    // Verify Clone option is in the menu
    const cloneMenuItem = page.getByRole('menuitem', { name: /Clone/i });
    await expect(cloneMenuItem).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click Clone option in overflow menu ──────────────────────
    await cloneMenuItem.click();

    // Wait for clone editor form to render
    await expect(
      page.locator('h2', { hasText: 'Clone Template' }),
    ).toBeVisible({ timeout: 10000 });

    // CP-3: Clone editor form pre-populated
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-clone-editor-form.png`,
      fullPage: true,
    });

    // Verify form is pre-populated:
    // - Name field should contain '(Copy)' suffix from the source template
    const nameInput = page.locator('input[name="name"]').or(
      page.getByRole('textbox', { name: /template name/i }),
    );
    await expect(nameInput.first()).toBeVisible({ timeout: 5000 });
    const nameValue = await nameInput.first().inputValue();
    expect(nameValue).toContain('(Copy)');

    // - Document type should show a selected value (SALES_INVOICE) and be enabled (not disabled)
    // The Select trigger should NOT have a disabled attribute in clone mode
    const docTypeSelect = page.locator('button[role="combobox"]').first();
    await expect(docTypeSelect).toBeEnabled({ timeout: 5000 });

    // - HTML Template textarea should be pre-populated (non-empty)
    const htmlTextarea = page.locator('textarea').filter({ hasText: /.+/ }).first();
    await expect(htmlTextarea).toBeVisible({ timeout: 5000 });

    // - isDefault checkbox should be unchecked
    const isDefaultCheckbox = page.getByRole('checkbox');
    const isChecked = await isDefaultCheckbox.isChecked();
    expect(isChecked).toBe(false);

    // ── Step 4: Update the name to 'E2E Cloned Invoice Template' ────────
    await nameInput.first().click();
    await nameInput.first().fill('E2E Cloned Invoice Template');

    // CP-4: Name field updated
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-name-updated.png`,
      fullPage: true,
    });

    const updatedNameValue = await nameInput.first().inputValue();
    expect(updatedNameValue).toBe('E2E Cloned Invoice Template');

    // ── Step 5: Click Save (Create Template) button ─────────────────────
    const saveBtn = page.getByRole('button', { name: /Create Template/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    // Wait for the form to close and the list to re-appear
    // The page should return to list mode showing template groups
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Wait a moment for any toast notification
    await page.waitForTimeout(1000);

    // CP-5: Clone saved successfully — back on list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-clone-saved-success.png`,
      fullPage: true,
    });

    // Verify the cloned template appears in the list
    const clonedTemplateCard = page.locator('.cursor-pointer.rounded-xl', {
      hasText: 'E2E Cloned Invoice Template',
    });
    await expect(clonedTemplateCard).toBeVisible({ timeout: 10000 });

    // Verify the original template is still present
    await expect(e2eTemplateCard).toBeVisible({ timeout: 5000 });

    // Verify the clone has an Active badge
    const clonedBadge = clonedTemplateCard.getByText('Active');
    await expect(clonedBadge).toBeVisible({ timeout: 5000 });
  });
});
