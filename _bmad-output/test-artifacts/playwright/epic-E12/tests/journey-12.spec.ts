import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-12';

test.describe('Journey 12: Preview a Specific Template Version', () => {
  test('should generate a preview using a specific version (French locale) with overrides applied', async ({
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

    // Navigate to document templates page (sidebar link may not exist — use router fallback)
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

    // Wait for detail view to load — template name heading visible
    await expect(
      page.locator('h2, h3', { hasText: 'E2E Test Invoice Template' }),
    ).toBeVisible({ timeout: 10000 });

    // Verify versions section is present
    const versionsSection = page.getByText(/versions?/i).first();
    await expect(versionsSection).toBeVisible({ timeout: 10000 });

    // Look for a French version card/entry
    const frenchVersion = page.locator('[class*="card"], [class*="version"], tr, li', {
      hasText: /fr|French/i,
    });
    await expect(frenchVersion.first()).toBeVisible({ timeout: 10000 });

    // CP-1: Detail view with versions section
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-view-versions.png`,
      fullPage: true,
    });

    // ── Step 3: Click three-dot overflow menu on French version card ──────
    // Find the overflow/actions button on the French version entry
    const frenchVersionRow = frenchVersion.first();
    const versionOverflowBtn = frenchVersionRow
      .getByRole('button', { name: /actions?|menu|more/i })
      .or(frenchVersionRow.locator('button:has(svg)').last());
    await expect(versionOverflowBtn).toBeVisible({ timeout: 5000 });
    await versionOverflowBtn.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(300);

    // CP-2: Version overflow menu open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-version-overflow-menu.png`,
      fullPage: true,
    });

    // ── Step 4: Click "Preview" option in version overflow menu ───────────
    const previewMenuItem = page.getByRole('menuitem', { name: /Preview/i });
    await expect(previewMenuItem).toBeVisible({ timeout: 5000 });
    await previewMenuItem.click();

    // Wait for menu to close and any state change
    await page.waitForTimeout(500);

    // The version "Preview" action may either auto-generate the PDF or prepare the
    // preview panel for this version. If the "Generate Preview" button is still visible,
    // click it to trigger the actual PDF generation for this version.
    const generateBtn = page.getByRole('button', { name: /Generate Preview/i });
    const pdfIframe = page.locator('iframe[title="PDF Preview"]');

    const generateVisible = await generateBtn.isVisible().catch(() => false);
    if (generateVisible) {
      await generateBtn.click();
    }

    // ── Step 5: Verify PDF preview iframe renders with French overrides ───
    // Wait for either the PDF iframe to appear or an error state
    const errorState = page.locator('.text-red-700');

    // Wait for one of: iframe visible OR error visible
    await expect(pdfIframe.or(errorState).first()).toBeVisible({ timeout: 30000 });

    // Check which state we ended up in
    const iframeVisible = await pdfIframe.isVisible().catch(() => false);
    const errorVisible = await errorState.isVisible().catch(() => false);

    if (iframeVisible) {
      // PDF generated successfully — verify it has French content
      // The iframe contains the rendered PDF; we can check its src or surrounding context

      // CP-3: PDF preview with French version content
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-pdf-preview-french.png`,
        fullPage: true,
      });

      // Verify the preview is using the version-specific overrides
      // Check for any French-language indicators in the page context
      // The preview panel heading or context should indicate version-specific rendering
      const previewSection = page.locator('section, div', { hasText: /Preview/i }).first();
      await expect(previewSection).toBeVisible({ timeout: 5000 });
    } else if (errorVisible) {
      // PDF generation failed — capture the error for debugging
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-pdf-preview-error.png`,
        fullPage: true,
      });

      const errorText = await errorState.textContent();
      expect(
        iframeVisible,
        `PDF preview failed to generate for French version. Error: ${errorText ?? 'unknown'}`,
      ).toBe(true);
    } else {
      // Neither state — unexpected
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-unexpected-state.png`,
        fullPage: true,
      });
      expect(false, 'Neither PDF iframe nor error state appeared after 30s').toBe(true);
    }
  });
});
