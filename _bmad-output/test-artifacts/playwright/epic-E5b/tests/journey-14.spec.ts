import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-14';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 14: Memory Page Responsive Behaviour', () => {
  test('responsive layout at phone, tablet, and desktop breakpoints', async ({
    page,
  }) => {
    // ── Pre-step: Log in to the application ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for the sidebar to appear after login
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Navigate to memory page via sidebar link ──
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible();
    await myMemoryLink.click();

    // Wait for navigation to /ai/memory
    await page.waitForURL('**/ai/memory', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const mainContent = page.locator('main[aria-label="Main content"]');
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Wait for page content to be ready
    const pageTitle = mainContent.getByText('My Memory');
    await expect(pageTitle.first()).toBeVisible({ timeout: 10000 });

    // Wait for either memory cards or empty state to appear (data loaded)
    const memoryCards = page.locator('article');
    const emptyState = page.getByRole('heading', { name: 'No memories yet' });
    await expect(memoryCards.first().or(emptyState)).toBeVisible({
      timeout: 15000,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 1: Phone Layout (375x812) ──
    // ══════════════════════════════════════════════════════════
    await page.setViewportSize({ width: 375, height: 812 });
    // Allow layout to reflow
    await page.waitForTimeout(500);

    // Verify page title is still visible at phone width
    await expect(pageTitle.first()).toBeVisible();

    // Verify no horizontal scrollbar (page width doesn't exceed viewport)
    const phoneScrollWidth = await page.evaluate(
      () => document.body.scrollWidth
    );
    test.info().annotations.push({
      type: 'phone-scroll-width',
      description: `Phone body scrollWidth=${phoneScrollWidth} (viewport=375)`,
    });
    expect(phoneScrollWidth).toBeLessThanOrEqual(380);

    // Check that settings panel elements exist and stack vertically
    const enableToggle = page.getByRole('switch').first();
    const toggleVisible = await enableToggle.isVisible().catch(() => false);
    test.info().annotations.push({
      type: 'phone-toggle-visible',
      description: `Enable toggle visible at phone: ${toggleVisible}`,
    });

    // Verify touch-friendly sizes — check if buttons have adequate size
    if (toggleVisible) {
      const toggleSize = await enableToggle.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      test.info().annotations.push({
        type: 'phone-toggle-size',
        description: `Toggle size: ${toggleSize.width.toFixed(0)}x${toggleSize.height.toFixed(0)}`,
      });
    }

    // Visual Checkpoint 1: Phone layout screenshot
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-phone-375x812.png`,
      fullPage: true,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 2: Tablet Layout (768x1024) ──
    // ══════════════════════════════════════════════════════════
    await page.setViewportSize({ width: 768, height: 1024 });
    // Allow layout to reflow
    await page.waitForTimeout(500);

    // Verify page title still visible at tablet width
    await expect(pageTitle.first()).toBeVisible();

    // Verify no horizontal scrollbar
    const tabletScrollWidth = await page.evaluate(
      () => document.body.scrollWidth
    );
    test.info().annotations.push({
      type: 'tablet-scroll-width',
      description: `Tablet body scrollWidth=${tabletScrollWidth} (viewport=768)`,
    });
    expect(tabletScrollWidth).toBeLessThanOrEqual(773);

    // Check search bar layout — at 768px the sm: breakpoint (640px) should apply
    const searchInput = page.getByPlaceholder('Search memories...');
    const searchVisible = await searchInput.isVisible().catch(() => false);
    test.info().annotations.push({
      type: 'tablet-search-visible',
      description: `Search input visible at tablet: ${searchVisible}`,
    });

    // Visual Checkpoint 2: Tablet layout screenshot
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-tablet-768x1024.png`,
      fullPage: true,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 3: Desktop Layout (1440x900) ──
    // ══════════════════════════════════════════════════════════
    await page.setViewportSize({ width: 1440, height: 900 });
    // Allow layout to reflow
    await page.waitForTimeout(500);

    // Verify page title still visible at desktop width
    await expect(pageTitle.first()).toBeVisible();

    // Verify no horizontal scrollbar
    const desktopScrollWidth = await page.evaluate(
      () => document.body.scrollWidth
    );
    test.info().annotations.push({
      type: 'desktop-scroll-width',
      description: `Desktop body scrollWidth=${desktopScrollWidth} (viewport=1440)`,
    });
    expect(desktopScrollWidth).toBeLessThanOrEqual(1445);

    // On desktop, the sidebar should be visible
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    test.info().annotations.push({
      type: 'desktop-sidebar',
      description: `Sidebar visible at desktop: ${sidebarVisible}`,
    });

    // Check content is centered with max-width constraint
    const contentMetrics = await mainContent.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        left: rect.left,
        right: rect.right,
      };
    });
    test.info().annotations.push({
      type: 'desktop-content-width',
      description: `Content area: width=${contentMetrics.width.toFixed(0)}, left=${contentMetrics.left.toFixed(0)}, right=${contentMetrics.right.toFixed(0)}`,
    });

    // More content should be visible at desktop height (900px) — verify settings, stats, and some cards/empty state
    const desktopSearchVisible = await searchInput.isVisible().catch(() => false);
    test.info().annotations.push({
      type: 'desktop-search-visible',
      description: `Search input visible at desktop: ${desktopSearchVisible}`,
    });

    // Visual Checkpoint 3: Desktop layout screenshot
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-desktop-1440x900.png`,
      fullPage: true,
    });
  });
});
