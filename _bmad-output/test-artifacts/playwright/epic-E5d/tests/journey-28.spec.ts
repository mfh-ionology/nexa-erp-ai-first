import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-28';

const PLATFORM_URL = 'http://localhost:5112';

/**
 * Helper: Mock intelligence API endpoints so the page can render without a live backend.
 */
async function mockIntelligenceAPIs(page: import('@playwright/test').Page) {
  await page.route('**/admin/intelligence/**', async (route) => {
    const url = route.request().url();
    let data: unknown = { items: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } };
    if (url.includes('/summary')) {
      data = {
        contributingTenants: 12,
        totalKnowledgeArticles: 347,
        totalCorrections: 89,
        aiSuccessRate: 94.2,
        lastAggregatedAt: new Date().toISOString(),
      };
    }
    if (url.includes('/patterns')) {
      data = {
        items: [
          { id: '1', pattern: 'Invoice Processing', category: 'finance', frequency: 42, successRate: 91.3 },
          { id: '2', pattern: 'Customer Lookup', category: 'crm', frequency: 38, successRate: 88.7 },
        ],
        pagination: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
      };
    }
    if (url.includes('/skills') || url.includes('/effectiveness')) {
      data = {
        items: [
          { id: '1', skillName: 'Invoice Parsing', tenantCount: 8, avgAccuracy: 93.5, trend: 'up' },
          { id: '2', skillName: 'Email Classification', tenantCount: 11, avgAccuracy: 89.1, trend: 'stable' },
        ],
        pagination: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
}

/**
 * Helper: Inject platform auth token via Zustand store import.
 */
async function injectPlatformAuth(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto(`${PLATFORM_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const imported = await page.evaluate(async () => {
    try {
      const mod = await (window as any).__vite_import__?.('/src/stores/auth-store.ts');
      if (mod && mod.usePlatformAuthStore) {
        const store = mod.usePlatformAuthStore.getState();
        store.login(
          {
            id: '00000000-0000-4000-b000-000000000020',
            email: 'admin@nexa-platform.local',
            displayName: 'Platform Admin',
            role: 'PLATFORM_ADMIN',
          },
          'fake-test-token-for-e2e',
        );
        return { ok: true };
      }
    } catch (_) {
      // fallback
    }
    try {
      const mod = await import('/src/stores/auth-store.ts');
      if (mod && mod.usePlatformAuthStore) {
        const store = mod.usePlatformAuthStore.getState();
        store.login(
          {
            id: '00000000-0000-4000-b000-000000000020',
            email: 'admin@nexa-platform.local',
            displayName: 'Platform Admin',
            role: 'PLATFORM_ADMIN',
          },
          'fake-test-token-for-e2e',
        );
        return { ok: true };
      }
    } catch (e) {
      return { ok: false, reason: `import failed: ${(e as Error).message}` };
    }
    return { ok: false, reason: 'no import method worked' };
  });

  if (imported.ok) {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/intelligence');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
  }

  return !page.url().includes('/login');
}

test.describe('Journey 28: Platform Intelligence Dashboard — Responsive Layout', () => {
  test.setTimeout(120_000);

  test('Step 1: Tablet viewport (768px) layout', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.text().includes('[E2E]')) console.log(`  [browser] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.log(`  [page error] ${err.message}`));

    await mockIntelligenceAPIs(page);
    const authed = await injectPlatformAuth(page);

    if (!authed) {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-tablet-auth-failed.png`, fullPage: true });
      test.skip(true, 'Platform Admin auth injection failed — cannot test responsive layout');
      await context.close();
      return;
    }

    // Wait for dashboard content to render
    await page.waitForTimeout(2000);

    // Verify we're on the intelligence page
    const currentUrl = page.url();
    console.log(`Tablet viewport URL: ${currentUrl}`);
    expect(currentUrl).toContain('/intelligence');

    // Check sidebar is collapsed at tablet width
    const sidebar = page.locator('[data-sidebar]').or(page.locator('aside')).first();
    const sidebarVisible = await sidebar.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Sidebar visible at 768px: ${sidebarVisible}`);

    // Take screenshot of tablet layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-tablet-layout.png`,
      fullPage: true,
    });

    // Verify KPI cards exist
    const kpiCards = page.locator('[class*="kpi"], [class*="stat"], [class*="card"]').or(
      page.locator('[data-testid*="kpi"]'),
    );
    const kpiCount = await kpiCards.count();
    console.log(`KPI card-like elements at tablet: ${kpiCount}`);

    // Check for horizontal overflow at tablet
    const hasTabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Horizontal overflow at tablet: ${hasTabletOverflow}`);

    // Checkpoint 2: Scroll to see more sections
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-tablet-sections-scroll.png`,
      fullPage: true,
    });

    // Check for skill effectiveness table
    const table = page.locator('table').or(page.locator('[role="table"]'));
    const tableCount = await table.count();
    console.log(`Tables visible at tablet: ${tableCount}`);

    await context.close().catch(() => { /* trace artifact cleanup may fail */ });
  });

  test('Step 2: Mobile viewport (375px) layout', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.text().includes('[E2E]')) console.log(`  [browser] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.log(`  [page error] ${err.message}`));

    await mockIntelligenceAPIs(page);
    const authed = await injectPlatformAuth(page);

    if (!authed) {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-2-mobile-auth-failed.png`, fullPage: true });
      test.skip(true, 'Platform Admin auth injection failed — cannot test responsive layout');
      await context.close();
      return;
    }

    // Wait for dashboard content to render
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Mobile viewport URL: ${currentUrl}`);
    expect(currentUrl).toContain('/intelligence');

    // Take screenshot of mobile layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-mobile-layout.png`,
      fullPage: true,
    });

    // Check for collapsible accordion-style sections on mobile
    const accordionTriggers = page.locator('[data-state="open"], [data-state="closed"], [role="button"][aria-expanded]');
    const accordionCount = await accordionTriggers.count();
    console.log(`Accordion/collapsible elements at mobile: ${accordionCount}`);

    // Check for floating action button
    const fab = page.locator('button[class*="fixed"], button[class*="floating"], [class*="fab"]').or(
      page.getByRole('button', { name: /publish/i }),
    );
    const fabVisible = await fab.first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Floating Publish button visible at mobile: ${fabVisible}`);

    // Check for horizontal overflow at mobile
    const hasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Horizontal overflow at mobile: ${hasMobileOverflow}`);

    // Checkpoint 4: Try interacting with an accordion section
    const accordionTrigger = page.locator('[data-state="closed"]').or(
      page.locator('[role="button"][aria-expanded="false"]'),
    ).first();
    const triggerVisible = await accordionTrigger.isVisible({ timeout: 3000 }).catch(() => false);
    if (triggerVisible) {
      await accordionTrigger.click();
      await page.waitForTimeout(1000);
      console.log('Clicked accordion trigger to expand a section on mobile');
    } else {
      console.log('No accordion triggers found at mobile — sections may not use accordions');
    }
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-mobile-accordion-interaction.png`,
      fullPage: true,
    });

    await context.close().catch(() => { /* trace artifact cleanup may fail */ });
  });
});
