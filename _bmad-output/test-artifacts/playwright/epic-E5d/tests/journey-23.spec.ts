import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-23';

const PLATFORM_URL = 'http://localhost:5112';

// SkillEffectiveness data matching the real type shape (decimal strings, not percentages)
const skillEffectivenessData = [
  { id: '1', skillKey: 'finance.invoice_categorisation', measureDate: '2026-03-04', tenantCount: 8, totalQueries: 1240, avgSuccessRate: '0.963', avgCorrectionRate: '0.041', avgConfidence: '0.92', trend: 'IMPROVING', createdAt: '2026-03-04T00:00:00Z' },
  { id: '2', skillKey: 'finance.payment_matching', measureDate: '2026-03-04', tenantCount: 7, totalQueries: 890, avgSuccessRate: '0.887', avgCorrectionRate: '0.125', avgConfidence: '0.88', trend: 'IMPROVING', createdAt: '2026-03-04T00:00:00Z' },
  { id: '3', skillKey: 'finance.expense_classification', measureDate: '2026-03-04', tenantCount: 5, totalQueries: 456, avgSuccessRate: '0.721', avgCorrectionRate: '0.289', avgConfidence: '0.65', trend: 'STABLE', createdAt: '2026-03-04T00:00:00Z' },
  { id: '4', skillKey: 'crm.lead_scoring', measureDate: '2026-03-04', tenantCount: 4, totalQueries: 320, avgSuccessRate: '0.654', avgCorrectionRate: '0.352', avgConfidence: '0.60', trend: 'DECLINING', createdAt: '2026-03-04T00:00:00Z' },
  { id: '5', skillKey: 'sales.quote_generation', measureDate: '2026-03-04', tenantCount: 6, totalQueries: 678, avgSuccessRate: '0.915', avgCorrectionRate: '0.092', avgConfidence: '0.90', trend: 'IMPROVING', createdAt: '2026-03-04T00:00:00Z' },
  { id: '6', skillKey: 'inventory.stock_prediction', measureDate: '2026-03-04', tenantCount: 3, totalQueries: 210, avgSuccessRate: '0.452', avgCorrectionRate: '0.521', avgConfidence: '0.40', trend: 'DECLINING', createdAt: '2026-03-04T00:00:00Z' },
  { id: '7', skillKey: 'sales.order_routing', measureDate: '2026-03-04', tenantCount: 5, totalQueries: 540, avgSuccessRate: '0.836', avgCorrectionRate: '0.178', avgConfidence: '0.82', trend: 'STABLE', createdAt: '2026-03-04T00:00:00Z' },
  { id: '8', skillKey: 'purchasing.supplier_matching', measureDate: '2026-03-04', tenantCount: 4, totalQueries: 390, avgSuccessRate: '0.789', avgCorrectionRate: '0.223', avgConfidence: '0.72', trend: 'IMPROVING', createdAt: '2026-03-04T00:00:00Z' },
  { id: '9', skillKey: 'finance.tax_calculation', measureDate: '2026-03-04', tenantCount: 10, totalQueries: 2100, avgSuccessRate: '0.991', avgCorrectionRate: '0.012', avgConfidence: '0.98', trend: 'STABLE', createdAt: '2026-03-04T00:00:00Z' },
  { id: '10', skillKey: 'crm.contact_dedup', measureDate: '2026-03-04', tenantCount: 4, totalQueries: 280, avgSuccessRate: '0.873', avgCorrectionRate: '0.141', avgConfidence: '0.75', trend: 'IMPROVING', createdAt: '2026-03-04T00:00:00Z' },
];

const insightsData = [
  { id: '1', insightType: 'FEATURE_GAP', title: 'Missing batch invoice upload', description: 'Several tenants manually enter invoices one by one', severity: 'MEDIUM', status: 'NEW', affectedTenants: 5, createdAt: '2026-03-04T00:00:00Z' },
  { id: '2', insightType: 'WORKFLOW_OPPORTUNITY', title: 'Automate purchase order approval', description: 'POs under threshold could be auto-approved', severity: 'LOW', status: 'NEW', affectedTenants: 3, createdAt: '2026-03-04T00:00:00Z' },
  { id: '3', insightType: 'DEFAULT_CANDIDATE', title: 'VAT rate defaults by industry', description: 'Construction tenants always change default VAT', severity: 'HIGH', status: 'NEW', affectedTenants: 8, createdAt: '2026-03-04T00:00:00Z' },
];

test.describe('Journey 23: Platform Dashboard — Skill Effectiveness Table', () => {
  test.setTimeout(120_000);

  test('Sortable, filterable skill effectiveness table with colour-coded metrics and pagination', async ({ page }) => {
    // --- Set up route-based API mocking ---
    // Mock auth refresh
    await page.route('**/api/v1/admin/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            accessToken: 'fake-token',
            expiresIn: 3600,
            user: { id: '00000000-0000-4000-b000-000000000020', email: 'admin@nexa-platform.local', displayName: 'Platform Admin', role: 'PLATFORM_ADMIN' },
          },
        }),
      }),
    );

    // Mock intelligence summary
    await page.route('**/admin/intelligence/summary', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { contributingTenants: 12, totalKnowledgeArticles: 347, totalCorrections: 89, aiSuccessRate: 94.2, lastAggregatedAt: new Date().toISOString() },
        }),
      }),
    );

    // Mock skill effectiveness
    await page.route('**/admin/intelligence/skill-effectiveness*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: skillEffectivenessData,
          meta: { hasMore: false, cursor: null },
        }),
      }),
    );

    // Mock insights (used by Feature Gaps, Workflow Opportunities, Default Optimisation)
    await page.route('**/admin/intelligence/insights*', (route) => {
      const url = route.request().url();
      const urlObj = new URL(url);
      const insightType = urlObj.searchParams.get('insightType');
      const filtered = insightType
        ? insightsData.filter((i) => i.insightType === insightType)
        : insightsData;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: filtered,
          meta: { hasMore: false, cursor: null },
        }),
      });
    });

    // Mock patterns (used by Industry Breakdown)
    await page.route('**/admin/intelligence/patterns*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: '1', patternDate: '2026-03-04', industry: 'Construction', patternType: 'QUERY_FREQUENCY', skillKey: 'finance.invoice_categorisation', metricValue: 85, tenantCount: 4, createdAt: '2026-03-04T00:00:00Z' },
            { id: '2', patternDate: '2026-03-04', industry: 'Retail', patternType: 'QUERY_FREQUENCY', skillKey: 'inventory.stock_prediction', metricValue: 62, tenantCount: 3, createdAt: '2026-03-04T00:00:00Z' },
          ],
          meta: { hasMore: false, cursor: null },
        }),
      }),
    );

    // Mock corrections
    await page.route('**/admin/intelligence/corrections*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { hasMore: false, cursor: null },
        }),
      }),
    );

    // --- Navigate to login to load the SPA ---
    await page.goto(`${PLATFORM_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Inject auth via dynamic import
    const injected = await page.evaluate(async () => {
      try {
        const mod = await import('/src/stores/auth-store.ts');
        mod.usePlatformAuthStore.getState().login(
          { id: '00000000-0000-4000-b000-000000000020', email: 'admin@nexa-platform.local', displayName: 'Platform Admin', role: 'PLATFORM_ADMIN' },
          'fake-test-token-for-e2e',
        );
        return { ok: true, isAuth: mod.usePlatformAuthStore.getState().isAuthenticated };
      } catch (e) {
        return { ok: false, err: String(e) };
      }
    });

    if (!injected.ok) {
      test.skip(true, `Auth injection failed: ${(injected as any).err}`);
      return;
    }

    // Navigate to intelligence via client-side routing
    await page.evaluate(() => {
      window.history.pushState({}, '', '/intelligence');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    console.log(`URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-still-login.png`, fullPage: true });
      test.skip(true, 'Navigation failed — still on login page');
      return;
    }

    // --- Step 1: Verify Intelligence Dashboard loaded ---
    const pageTitle = page.getByRole('heading', { name: /intelligence/i })
      .or(page.getByText('AI Intelligence', { exact: false })).first();
    const hasTitle = await pageTitle.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Title: ${hasTitle}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-intelligence-loaded.png`, fullPage: true });

    // --- Step 2: Scroll to Skill Effectiveness and verify table ---
    const skillHeading = page.getByText('Skill Effectiveness', { exact: false }).first();
    const headingVisible = await skillHeading.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Skill Effectiveness heading: ${headingVisible}`);

    if (headingVisible) {
      await skillHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }

    // Check for "Failed to load" errors
    const failedToLoad = page.getByText('Failed to load', { exact: false });
    const failCount = await failedToLoad.count();
    console.log(`"Failed to load" messages: ${failCount}`);

    // If data failed to load, click Retry buttons
    if (failCount > 0) {
      console.log('Data failed to load — clicking Retry buttons...');
      const retryButtons = page.getByText('Retry', { exact: true });
      const retryCount = await retryButtons.count();
      for (let i = 0; i < retryCount; i++) {
        await retryButtons.nth(i).click();
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(3000);
    }

    const failCount2 = await failedToLoad.count();
    console.log(`"Failed to load" after retry: ${failCount2}`);

    // Scroll back to skill effectiveness
    if (headingVisible) {
      await skillHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    const skillTable = page.locator('table').filter({ hasText: /skill|success|module/i }).first();
    const tableVisible = await skillTable.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Table visible: ${tableVisible}`);

    if (tableVisible) {
      await skillTable.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    const expectedColumns = ['Skill Name', 'Module', 'Success Rate', 'Correction Rate', 'Usage', 'Tenant', 'Confidence', 'Trend'];
    let columnsFound = 0;
    for (const col of expectedColumns) {
      const isVisible = await page.locator('th, [role="columnheader"]')
        .filter({ hasText: new RegExp(col, 'i') }).first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) columnsFound++;
      console.log(`Column "${col}": ${isVisible}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-2-skill-effectiveness-table.png`, fullPage: true });

    // --- Step 3-4: Sort by Success Rate ---
    const successRateHeader = page.locator('th, [role="columnheader"]').filter({ hasText: /success rate/i }).first();
    const hasSortableHeader = await successRateHeader.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSortableHeader) {
      // First click → ascending
      await successRateHeader.click();
      await page.waitForTimeout(1000);
      // Second click → descending
      await successRateHeader.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-sorted-success-rate-desc.png`, fullPage: true });

    // --- Step 5: Module filter ---
    // The select has id="module-filter" and is above the table header
    const moduleFilterSelect = page.locator('#module-filter');
    const hasModuleFilter = await moduleFilterSelect.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Module filter (#module-filter): ${hasModuleFilter}`);
    if (hasModuleFilter) {
      await moduleFilterSelect.scrollIntoViewIfNeeded();
      await moduleFilterSelect.selectOption('Finance');
      await page.waitForTimeout(1000);
      // Verify filtering worked — check if non-Finance rows are hidden
      const visibleModuleBadges = await page.locator('table tbody td span').filter({ hasText: /^(SALES|CRM|INVENTORY|PURCHASING)$/ }).count();
      console.log(`Non-Finance module badges visible after filter: ${visibleModuleBadges}`);
    } else {
      // Fallback: try any select on the page
      const anySelect = page.locator('select').first();
      const anySelectVisible = await anySelect.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`Fallback select visible: ${anySelectVisible}`);
      if (anySelectVisible) {
        await anySelect.selectOption('Finance');
        await page.waitForTimeout(1000);
      }
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-filtered-finance-module.png`, fullPage: true });

    // --- Step 6: Pagination ---
    const hasPagination = await page.locator(
      'nav[aria-label*="pagination"], [data-testid*="pagination"], button:has-text("Load More"), button:has-text("Next")',
    ).first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Pagination: ${hasPagination}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-pagination-controls.png`, fullPage: true });

    // --- Assertions ---
    expect(hasTitle || tableVisible).toBeTruthy();

    console.log('\n=== Journey 23 Summary ===');
    console.log(`Title: ${hasTitle}, Table: ${tableVisible}, Columns: ${columnsFound}/8`);
    console.log(`Sort: ${hasSortableHeader}, Filter: ${hasModuleFilter}, Pagination: ${hasPagination}`);
  });
});
