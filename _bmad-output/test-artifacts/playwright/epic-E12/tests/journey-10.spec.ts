import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-10';

test.describe('Journey 10: Edit a Template Version', () => {
  test('should edit an existing version to change priority and add access group criterion', async ({
    page,
  }) => {
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

    // Wait for template list to load
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

    // ── Step 2: Click 'E2E Test Invoice Template' card to enter detail view ──
    const e2eTemplateCard = page.locator('.cursor-pointer.rounded-xl', {
      hasText: 'E2E Test Invoice Template',
    });
    await expect(e2eTemplateCard).toBeVisible({ timeout: 10000 });
    await e2eTemplateCard.click();

    // Wait for detail view to load — should show template name as heading
    await expect(page.locator('h2', { hasText: 'E2E Test Invoice Template' })).toBeVisible({
      timeout: 10000,
    });

    // Verify versions section header with count
    const versionsHeader = page.locator('h3', { hasText: 'Versions' });
    await expect(versionsHeader).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click three-dot overflow menu on the French version card ──
    // The French version card should be present (created by journey 9)
    // Look for a version card containing criteria like "Lang: fr" or "Branch: PARIS"
    const frenchVersionCard = page.locator('[class*="rounded"]', {
      hasText: /fr|PARIS/,
    });

    // Find the overflow/actions button on the French version card
    // Try several patterns for locating the three-dot menu button
    let versionActionsBtn = frenchVersionCard.getByRole('button', { name: 'Version actions' });
    let btnVisible = await versionActionsBtn.isVisible().catch(() => false);

    if (!btnVisible) {
      // Fallback: look for any three-dot menu button near the French version
      versionActionsBtn = frenchVersionCard.locator('button').filter({
        has: page.locator('svg'),
      }).last();
      btnVisible = await versionActionsBtn.isVisible().catch(() => false);
    }

    if (!btnVisible) {
      // Broader fallback: any "Version actions" button on the page
      versionActionsBtn = page.getByRole('button', { name: 'Version actions' });
    }

    await expect(versionActionsBtn).toBeVisible({ timeout: 5000 });
    await versionActionsBtn.click();

    // Wait for overflow menu to appear
    await page.waitForTimeout(500);

    // Verify menu options
    const menuPopover = page.locator('[role="menu"], [role="menuitem"], [data-radix-menu-content]').first();
    await expect(page.getByRole('menuitem', { name: /Edit/i }).first()).toBeVisible({ timeout: 5000 });

    // ── Step 4: Click "Edit" option in overflow menu ─────────────────────
    await page.getByRole('menuitem', { name: /Edit/i }).first().click();

    // Wait for the version editor dialog to open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title indicates editing
    const editHeading = dialog.locator('h2, h3, [class*="title"]').first();
    await expect(editHeading).toBeVisible();

    // Verify pre-populated fields
    const langInput = dialog.getByLabel('Language Code');
    await expect(langInput).toBeVisible({ timeout: 5000 });
    await expect(langInput).toHaveValue('fr');

    const branchInput = dialog.getByLabel('Branch Code');
    await expect(branchInput).toBeVisible();
    await expect(branchInput).toHaveValue('PARIS');

    const priorityInput = dialog.getByLabel('Priority');
    await expect(priorityInput).toBeVisible();
    await expect(priorityInput).toHaveValue('10');

    // Verify Active toggle is ON
    const activeSwitch = dialog.getByRole('switch');
    if (await activeSwitch.count() > 0) {
      const switchState = await activeSwitch.getAttribute('data-state');
      expect(switchState).toBe('checked');
    }

    // CP-1: Version editor dialog with pre-populated data
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-edit-dialog-prepopulated.png`,
      fullPage: true,
    });

    // ── Step 5: Update priority to 20 and set Access Group to SALES ─────
    await priorityInput.clear();
    await priorityInput.fill('20');

    const accessGroupInput = dialog.getByLabel('Access Group');
    await expect(accessGroupInput).toBeVisible({ timeout: 5000 });
    await accessGroupInput.clear();
    await accessGroupInput.fill('SALES');

    // ── Step 6: Click Update button to save changes ─────────────────────
    const updateBtn = dialog.getByRole('button', { name: /Update/i });
    await expect(updateBtn).toBeVisible({ timeout: 5000 });
    await updateBtn.scrollIntoViewIfNeeded();
    await updateBtn.click();

    // Wait for dialog to close (update saved)
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Wait for version card to refresh
    await page.waitForTimeout(1500);

    // Verify priority updated to 20
    await expect(page.getByText('Priority: 20')).toBeVisible({ timeout: 10000 });

    // Verify criteria summary includes "Group: SALES"
    await expect(page.getByText(/Group: SALES/i)).toBeVisible({ timeout: 5000 });

    // Verify existing criteria still shown
    await expect(page.getByText(/Lang: fr/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Branch: PARIS/)).toBeVisible({ timeout: 5000 });

    // Verify Active badge still visible
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

    // CP-2: Version updated — card shows new priority and criteria
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-version-updated.png`,
      fullPage: true,
    });
  });
});
