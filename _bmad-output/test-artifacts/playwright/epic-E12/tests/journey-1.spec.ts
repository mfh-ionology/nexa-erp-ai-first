import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-1';

test.describe('Journey 1: Navigate to Document Templates Page', () => {
  test('should navigate to Document Templates page and verify T7 layout with seeded templates', async ({
    page,
  }) => {
    // ── Step 1: Navigate to / and log in ────────────────────────────────────
    await page.goto('/');

    // If redirected to login, authenticate first
    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for navigation away from login page (permissions fetch may take a few seconds)
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    // Wait for the app layout (sidebar) to appear — confirms auth succeeded
    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // Verify dashboard loaded with sidebar visible
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

    // CP-1: Screenshot — Dashboard after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-loaded.png`,
      fullPage: false,
    });

    // ── Step 2: Attempt to find Document Templates in sidebar ───────────────
    // The sidebar uses group titles. Check for "Document Templates" link.
    // NOTE: The sidebar does NOT currently have a "Document Templates" link
    // (missing feature — documented separately).
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const docTemplatesLinkCount = await docTemplatesLink.count();

    if (docTemplatesLinkCount > 0) {
      await docTemplatesLink.first().click();
    } else {
      // Sidebar link missing — use TanStack Router's navigate() via Vite's module system
      // to perform client-side navigation without losing in-memory Zustand auth state.
      await page.evaluate(async () => {
        const mod = await import('/src/router.ts');
        await mod.router.navigate({ to: '/settings/document-templates' });
      });
    }

    // ── Step 3: Verify page navigates to /settings/document-templates ───────
    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );

    // Wait for page content to load (heading, buttons, or skeleton)
    await page.waitForSelector('h1, h2, button, [class*="skeleton"]', { timeout: 10000 });

    // Wait for any loading skeletons to disappear (templates loading from API)
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 15000 },
      );
    } catch {
      // Skeletons may have already disappeared before we checked
    }

    // CP-2: Screenshot — Document Templates page layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-document-templates-page.png`,
      fullPage: false,
    });

    // ── Step 4: Verify breadcrumb shows 'System' and 'Document Templates' ──
    const pageText = await page.locator('body').textContent();
    expect(pageText).toContain('System');
    expect(pageText).toContain('Document Templates');

    // ── Step 5: Verify "Add Template" button with purple background ─────────
    const addTemplateButton = page.getByRole('button', { name: /add template/i });
    await expect(addTemplateButton).toBeVisible({ timeout: 10000 });

    // Verify it has the purple background (#7c3aed) → rgb(124, 58, 237)
    const buttonBgColor = await addTemplateButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(buttonBgColor).toMatch(/rgb\(124,\s*58,\s*237\)/);

    // ── Step 6: Verify document type filter dropdown ────────────────────────
    // The filter uses a Radix Select with "All Document Types" as default text
    const filterTrigger = page.locator('button[role="combobox"]').first();
    await expect(filterTrigger).toBeVisible();

    const filterText = await filterTrigger.textContent();
    expect(filterText).toContain('All Document Types');

    // ── Step 7: Verify search input is present ──────────────────────────────
    const searchInput = page.getByPlaceholder(/search by name/i);
    await expect(searchInput).toBeVisible();

    // ── Step 8: Verify template cards grouped by document type ──────────────
    // Wait for template data to load from API — look for accordion triggers
    // that contain document type badges (e.g., "Sales Invoice", "Credit Note")
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Accordion items have data-state="open" or "closed"
    const accordionItems = page.locator('[data-state="open"], [data-state="closed"]');
    const accordionCount = await accordionItems.count();

    // Should have at least 5 document type sections (from 14 seeded templates)
    expect(accordionCount).toBeGreaterThanOrEqual(5);

    // Verify template cards are present — cards have cursor-pointer and rounded-xl
    const templateCards = page.locator('.cursor-pointer.rounded-xl');
    const cardCount = await templateCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Verify Active badges exist
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

    // Verify Default badges exist
    await expect(page.getByText('Default', { exact: true }).first()).toBeVisible();

    // Verify version count is shown (e.g., "0 versions", "1 version", "2 versions")
    await expect(page.getByText(/\d+ versions?/).first()).toBeVisible();

    // CP-3: Screenshot — Template groups and cards
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-template-groups-and-cards.png`,
      fullPage: true,
    });
  });
});
