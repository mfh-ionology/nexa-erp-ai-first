import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-9';

test.describe('Journey 9: View Template Detail and Create a Version', () => {
  test('should navigate to template detail view and create a new version with selection criteria', async ({
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

    // ── Step 2: Click 'E2E Test Invoice Template' card to open detail view ──
    const e2eTemplateCard = page.locator('.cursor-pointer.rounded-xl', {
      hasText: 'E2E Test Invoice Template',
    });
    await expect(e2eTemplateCard).toBeVisible({ timeout: 10000 });

    // Click the card body (not the overflow menu) to navigate to detail view
    await e2eTemplateCard.click();

    // Wait for detail view to load — should show template name as heading
    await expect(page.locator('h2', { hasText: 'E2E Test Invoice Template' })).toBeVisible({
      timeout: 10000,
    });

    // Verify detail view elements: template info card with Document Type, Page Size, Status, Versions
    await expect(page.getByText('Document Type')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Page Size')).toBeVisible();
    await expect(page.getByText('Status', { exact: true }).first()).toBeVisible();

    // Verify Versions section header with count
    const versionsHeader = page.locator('h3', { hasText: 'Versions' });
    await expect(versionsHeader).toBeVisible({ timeout: 5000 });

    // Verify "Create Version" button is visible (purple)
    const createVersionBtn = page.getByRole('button', { name: /Create Version/i });
    await expect(createVersionBtn).toBeVisible();

    // CP-1: Template detail view loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-template-detail-view.png`,
      fullPage: true,
    });

    // ── Step 3: Verify Preview capability is visible ──────────────────────
    // Preview panel should be in the right column of the detail view
    const previewSection = page.getByText(/Preview|preview/i).first();
    await expect(previewSection).toBeVisible({ timeout: 5000 });

    // ── Step 4: Click "Create Version" button to open version editor ─────
    await createVersionBtn.click();

    // Wait for dialog to appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    await expect(dialog.getByRole('heading', { name: 'Create Version' })).toBeVisible();

    // Verify Selection Criteria section
    await expect(dialog.getByText('Selection Criteria')).toBeVisible();

    // Verify selection criteria fields
    await expect(dialog.getByLabel('Language Code')).toBeVisible();
    await expect(dialog.getByLabel('Branch Code')).toBeVisible();
    await expect(dialog.getByLabel('Number Series ID')).toBeVisible();
    await expect(dialog.getByLabel('Access Group')).toBeVisible();
    await expect(dialog.getByLabel('Customer Group ID')).toBeVisible();

    // Verify collapsible override sections exist
    await expect(dialog.getByText('HTML Override')).toBeVisible();
    await expect(dialog.getByText('CSS Override')).toBeVisible();
    await expect(dialog.getByText('Header Override')).toBeVisible();
    await expect(dialog.getByText('Footer Override')).toBeVisible();

    // Verify Email Settings section
    await expect(dialog.getByText('Email Settings')).toBeVisible();

    // Verify Priority and Active toggle
    await expect(dialog.getByLabel('Priority')).toBeVisible();
    await expect(dialog.getByLabel('Active')).toBeVisible();

    // Verify Cancel and Create buttons
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Create Version/i })).toBeVisible();

    // CP-2: Version editor dialog open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-version-editor-dialog.png`,
      fullPage: true,
    });

    // ── Step 5: Fill version form with French locale data ────────────────
    await dialog.getByLabel('Language Code').fill('fr');
    await dialog.getByLabel('Branch Code').fill('PARIS');

    // Set priority to 10
    const priorityInput = dialog.getByLabel('Priority');
    await priorityInput.clear();
    await priorityInput.fill('10');

    // isActive toggle should already be on by default (true), verify it
    const activeSwitch = dialog.getByRole('switch');
    const isChecked = await activeSwitch.getAttribute('data-state');
    if (isChecked !== 'checked') {
      await activeSwitch.click();
    }

    // Fill email settings
    await dialog.getByLabel('Email Subject').fill('Votre facture {{document.number}}');
    await dialog.getByLabel('Email Body').fill('Veuillez trouver ci-joint votre facture.');
    await dialog.getByLabel('Reply-To Email').fill('facturation@acme.fr');

    // ── Step 6: Open HTML Override collapsible section ────────────────────
    // Click the HTML Override collapsible trigger button
    const htmlOverrideButton = dialog.getByRole('button', { name: /HTML Override/i });
    await htmlOverrideButton.click();

    // Wait for collapsible content to expand
    await page.waitForTimeout(300);

    // ── Step 7: Fill HTML Override textarea ───────────────────────────────
    const htmlTextarea = dialog.locator('textarea').first();
    await expect(htmlTextarea).toBeVisible({ timeout: 5000 });
    await htmlTextarea.fill(
      '<html><body><h1>FACTURE</h1><p>Facture: {{document.number}}</p><p>Date: {{formatDate document.date}}</p><p>Client: {{counterparty.name}}</p>{{#each lines}}<p>{{description}}: {{formatCurrency lineTotal ../metadata.currencyCode}}</p>{{/each}}<p>Total: {{formatCurrency totals.total metadata.currencyCode}}</p></body></html>',
    );

    // ── Step 8: Click Create button to save the version ──────────────────
    // Scroll to the bottom of the dialog to see the Create button
    const createBtn = dialog.getByRole('button', { name: /Create Version/i });
    await createBtn.scrollIntoViewIfNeeded();
    await createBtn.click();

    // Wait for dialog to close (version created successfully)
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Wait for the versions list to update
    await page.waitForTimeout(1500);

    // Verify version count updated to (1)
    await expect(page.getByText('(1)')).toBeVisible({ timeout: 10000 });

    // Verify the new version card is visible with correct info
    // Priority: 10 should be visible
    await expect(page.getByText('Priority: 10')).toBeVisible({ timeout: 5000 });

    // Active badge should be green
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

    // CP-3: Version created successfully
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-version-created.png`,
      fullPage: true,
    });

    // ── Step 9: Verify selection criteria summary ────────────────────────
    // The version card should show the criteria summary with "Lang: fr" and "Branch: PARIS"
    await expect(page.getByText(/Lang: fr/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Branch: PARIS/)).toBeVisible({ timeout: 5000 });

    // Verify overflow menu (three-dot "Version actions" button) exists on the version card
    const versionActionsBtn = page.getByRole('button', { name: 'Version actions' });
    await expect(versionActionsBtn).toBeVisible();
  });
});
