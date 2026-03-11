import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-11';

test.describe('Journey 11: Preview a Template as PDF', () => {
  test('should generate a PDF preview with sample data and display controls', async ({
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

    // ── Step 2: Click three-dot overflow menu on 'E2E Test Invoice Template' card ──
    const e2eTemplateCard = page.locator('.cursor-pointer.rounded-xl', {
      hasText: 'E2E Test Invoice Template',
    });
    await expect(e2eTemplateCard).toBeVisible({ timeout: 10000 });

    // Find the overflow menu button on the card
    const overflowBtn = e2eTemplateCard.getByRole('button', { name: 'Template actions' });
    await expect(overflowBtn).toBeVisible({ timeout: 5000 });
    await overflowBtn.click();

    // Wait for dropdown menu to appear
    await page.waitForTimeout(300);

    // ── Step 3: Click "Preview" option in overflow menu ─────────────────
    const previewMenuItem = page.getByRole('menuitem', { name: /Preview/i });
    await expect(previewMenuItem).toBeVisible({ timeout: 5000 });
    await previewMenuItem.click();

    // Wait for detail view to load — template name heading
    await expect(page.locator('h2', { hasText: 'E2E Test Invoice Template' })).toBeVisible({
      timeout: 10000,
    });

    // ── Step 4: Verify preview panel initial state ──────────────────────
    // The preview panel should show its initial empty state
    const previewHeading = page.locator('h3', { hasText: 'Preview' });
    await expect(previewHeading).toBeVisible({ timeout: 5000 });

    // Verify initial state: dashed border box with instructions
    const initialStateText = page.getByText('Click "Generate Preview" to see a PDF preview with sample data.');
    await expect(initialStateText).toBeVisible({ timeout: 5000 });

    // Verify Generate Preview button visible
    const generateBtn = page.getByRole('button', { name: /Generate Preview/i });
    await expect(generateBtn).toBeVisible({ timeout: 5000 });

    // CP-1: Preview panel in initial state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-preview-initial-state.png`,
      fullPage: true,
    });

    // ── Step 5: Click "Generate Preview" button ─────────────────────────
    await generateBtn.click();

    // Verify loading state appears — spinner and "Generating PDF preview..." text
    // The loading state may be very brief, so we try to catch it but don't fail if it passes quickly
    try {
      await expect(page.getByText('Generating PDF preview...')).toBeVisible({ timeout: 3000 });
      // CP-2: Loading state
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-generating-preview.png`,
        fullPage: true,
      });
    } catch {
      // Loading state may have been too brief — capture whatever state we're in
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-generating-preview.png`,
        fullPage: true,
      });
    }

    // ── Step 6: Verify PDF preview iframe renders with controls ─────────
    // Wait for either the PDF iframe to appear or an error state
    const pdfIframe = page.locator('iframe[title="PDF Preview"]');
    const errorState = page.locator('.text-red-700');

    // Wait for one of: iframe visible OR error visible
    await expect(pdfIframe.or(errorState).first()).toBeVisible({ timeout: 30000 });

    // Check which state we ended up in
    const iframeVisible = await pdfIframe.isVisible().catch(() => false);
    const errorVisible = await errorState.isVisible().catch(() => false);

    if (iframeVisible) {
      // PDF generated successfully — verify controls
      // Verify Regenerate button replaced Generate Preview
      const regenerateBtn = page.getByRole('button', { name: /Regenerate/i });
      await expect(regenerateBtn).toBeVisible({ timeout: 5000 });

      // Verify Download button
      const downloadBtn = page.getByRole('button', { name: /Download/i });
      await expect(downloadBtn).toBeVisible({ timeout: 5000 });

      // Verify Open in New Tab button
      const openTabBtn = page.getByRole('button', { name: /Open in New Tab/i });
      await expect(openTabBtn).toBeVisible({ timeout: 5000 });

      // Verify Print button
      const printBtn = page.getByRole('button', { name: /Print/i });
      await expect(printBtn).toBeVisible({ timeout: 5000 });

      // CP-3: PDF preview rendered with controls
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-pdf-preview-rendered.png`,
        fullPage: true,
      });

      // ── Step 7: Verify Download button is clickable ─────────────────
      await expect(downloadBtn).toBeEnabled();

      // ── Step 8: Verify Open in New Tab button is clickable ──────────
      await expect(openTabBtn).toBeEnabled();

      // ── Step 9: Verify Print button is clickable ────────────────────
      await expect(printBtn).toBeEnabled();

      // CP-4: All controls visible and interactive
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-9-controls-visible.png`,
        fullPage: true,
      });
    } else if (errorVisible) {
      // PDF generation failed — capture the error state for debugging
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-pdf-preview-error.png`,
        fullPage: true,
      });

      // This is a test failure — PDF should have generated successfully
      const errorText = await errorState.textContent();
      expect(iframeVisible, `PDF preview failed to generate. Error: ${errorText ?? 'unknown'}`).toBe(true);
    } else {
      // Neither state — unexpected
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-unexpected-state.png`,
        fullPage: true,
      });
      expect(false, 'Neither PDF iframe nor error state appeared after 30s').toBe(true);
    }
  });
});
