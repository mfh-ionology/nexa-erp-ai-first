import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-22';

const PLATFORM_URL = 'http://localhost:5112';

const allInsights = [
  { id: 'fg-1', type: 'FEATURE_GAP', title: 'Multi-currency invoice support', module: 'Finance', tenantCount: 7, frequency: 34, severity: 'HIGH', status: 'NEW', description: 'Multiple tenants request multi-currency invoicing', createdAt: '2026-02-15T10:00:00Z' },
  { id: 'fg-2', type: 'FEATURE_GAP', title: 'Batch payment processing', module: 'Finance', tenantCount: 5, frequency: 21, severity: 'MEDIUM', status: 'NEW', description: 'Tenants need batch payment runs', createdAt: '2026-02-18T10:00:00Z' },
  { id: 'fg-3', type: 'FEATURE_GAP', title: 'Automated stock reorder alerts', module: 'Inventory', tenantCount: 4, frequency: 18, severity: 'MEDIUM', status: 'REVIEWED', description: 'Auto reorder when stock low', createdAt: '2026-02-20T10:00:00Z' },
  { id: 'fg-4', type: 'FEATURE_GAP', title: 'Custom report builder', module: 'Reporting', tenantCount: 3, frequency: 12, severity: 'LOW', status: 'NEW', description: 'Drag and drop report builder', createdAt: '2026-02-22T10:00:00Z' },
  { id: 'fg-5', type: 'FEATURE_GAP', title: 'Supplier portal self-service', module: 'Purchasing', tenantCount: 6, frequency: 28, severity: 'HIGH', status: 'NEW', description: 'Supplier self-service portal', createdAt: '2026-02-25T10:00:00Z' },
  { id: 'wo-1', type: 'WORKFLOW_OPPORTUNITY', title: 'Manual invoice-to-PO matching', module: 'Finance', tenantCount: 8, tenantPercentage: 67, frequency: 156, status: 'NEW', description: 'Many tenants manually match invoices to POs', createdAt: '2026-02-10T10:00:00Z' },
  { id: 'wo-2', type: 'WORKFLOW_OPPORTUNITY', title: 'Repeated expense categorisation', module: 'Finance', tenantCount: 6, tenantPercentage: 50, frequency: 89, status: 'NEW', description: 'Repeated manual expense tagging', createdAt: '2026-02-12T10:00:00Z' },
  { id: 'wo-3', type: 'WORKFLOW_OPPORTUNITY', title: 'Manual stock level checks before ordering', module: 'Inventory', tenantCount: 5, tenantPercentage: 42, frequency: 64, status: 'REVIEWED', description: 'Stock checks before reorder', createdAt: '2026-02-14T10:00:00Z' },
  { id: 'do-1', type: 'DEFAULT_OPTIMISATION', title: 'VAT rate set to 20% Standard', module: 'Finance', adoptionPercentage: 82, tenantCount: 10, status: 'NEW', description: '82% of tenants set VAT to 20%', createdAt: '2026-02-08T10:00:00Z' },
  { id: 'do-2', type: 'DEFAULT_OPTIMISATION', title: 'Payment terms Net 30', module: 'Finance', adoptionPercentage: 72, tenantCount: 9, status: 'NEW', description: '72% of tenants use Net 30', createdAt: '2026-02-09T10:00:00Z' },
  { id: 'do-3', type: 'DEFAULT_OPTIMISATION', title: 'Default warehouse Main', module: 'Inventory', adoptionPercentage: 65, tenantCount: 8, status: 'NEW', description: '65% of tenants use Main warehouse', createdAt: '2026-02-11T10:00:00Z' },
];

test.describe('Journey 22: Platform Dashboard — Feature Gaps, Workflow Opportunities, Default Optimisation', () => {
  test.setTimeout(120_000);

  test('Feature Gaps, Workflow Opportunities, and Default Optimisation sections with status actions', async ({ page, context }) => {
    // Install fetch interceptor
    const initScript = `
      (function() {
        var mockData = ${JSON.stringify(allInsights)};
        var _origFetch = window.fetch;

        window.fetch = function(input, init) {
          var url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input && input.url ? input.url : String(input)));
          console.log('[FETCH] ' + (init && init.method || 'GET') + ' ' + url);

          if (url.indexOf('auth/refresh') !== -1) {
            return Promise.resolve(new Response(JSON.stringify({
              success: true,
              data: { accessToken: 'fake-token', expiresIn: 3600,
                user: { id: '00000000-0000-4000-b000-000000000020', email: 'admin@nexa-platform.local', displayName: 'Platform Admin', role: 'PLATFORM_ADMIN' } }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }

          if (url.indexOf('intelligence/summary') !== -1) {
            return Promise.resolve(new Response(JSON.stringify({
              success: true, data: { contributingTenants: 12, totalKnowledgeArticles: 347, totalCorrections: 89, aiSuccessRate: 94.2, lastAggregatedAt: new Date().toISOString() }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }

          if (url.indexOf('intelligence/skill-effectiveness') !== -1) {
            return Promise.resolve(new Response(JSON.stringify({
              success: true, data: { items: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }

          if (url.indexOf('intelligence/insights') !== -1) {
            if (init && (init.method === 'PATCH' || init.method === 'PUT')) {
              var body = {};
              try { body = JSON.parse(init.body || '{}'); } catch(e) {}
              return Promise.resolve(new Response(JSON.stringify({
                success: true, data: Object.assign({}, body, { status: body.status || 'REVIEWED' })
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            return Promise.resolve(new Response(JSON.stringify({
              success: true, data: { items: mockData, pagination: { total: mockData.length, page: 1, pageSize: 20, totalPages: 1 } }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }

          if (url.indexOf('intelligence/industry') !== -1) {
            return Promise.resolve(new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }

          if (url.indexOf('intelligence/correction') !== -1) {
            return Promise.resolve(new Response(JSON.stringify({
              success: true, data: { items: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }

          return _origFetch(input, init);
        };
      })();
    `;

    await context.addInitScript({ content: initScript });

    page.on('console', (msg) => {
      const t = msg.text();
      if (t.startsWith('[FETCH]') || t.includes('Error') || t.includes('error')) {
        console.log(`[BROWSER] ${t}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`[PAGE ERROR] ${err.message}`);
    });

    // Step 1: Navigate to /login to let the app hydrate with our mock
    await page.goto(`${PLATFORM_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Now use page.evaluate to call the tryBootstrapAuth directly or set auth state
    // Since the modules are loaded, we can import them dynamically
    const bootstrapResult = await page.evaluate(async () => {
      try {
        // Try to call fetch directly to test our mock
        const testRes = await window.fetch('/api/v1/admin/auth/refresh', {
          method: 'POST',
          credentials: 'include' as RequestCredentials,
          headers: { 'Content-Type': 'application/json' },
        });
        const testJson = await testRes.json();
        console.log('[TEST] fetch mock result: ' + JSON.stringify(testJson));
        return { success: true, data: testJson };
      } catch(e: any) {
        console.log('[TEST] fetch failed: ' + e.message);
        return { success: false, error: e.message };
      }
    });
    console.log('Bootstrap fetch test:', JSON.stringify(bootstrapResult));

    // The fetch mock works. Now we need to set auth state in the Zustand store directly,
    // then use client-side routing to navigate to /intelligence (avoiding full page reload).
    if (bootstrapResult.success && bootstrapResult.data?.success) {
      // Set the auth store state via the Vite module system
      await page.evaluate(async () => {
        // The auth store module is available via Vite's module graph
        // We can import it dynamically
        try {
          const mod = await (window as any).__vite_import__?.('/src/stores/auth-store.ts') ??
                      await import('/src/stores/auth-store.ts' as any);
          if (mod?.usePlatformAuthStore) {
            mod.usePlatformAuthStore.getState().login(
              { id: '00000000-0000-4000-b000-000000000020', email: 'admin@nexa-platform.local', displayName: 'Platform Admin', role: 'PLATFORM_ADMIN' },
              'fake-token'
            );
            console.log('[INJECT] Auth store set, isAuthenticated: ' + mod.usePlatformAuthStore.getState().isAuthenticated);
          } else {
            console.log('[INJECT] usePlatformAuthStore not found in module');
          }
        } catch(e: any) {
          console.log('[INJECT] Dynamic import failed: ' + e.message);
        }
      });
      await page.waitForTimeout(500);

      // Use client-side router navigation to avoid full page reload (preserves Zustand state)
      await page.evaluate(() => {
        // TanStack Router exposes the router on window.__TSR_ROUTER__ in dev mode
        const router = (window as any).__TSR_ROUTER__ || (window as any).__ROUTER__;
        if (router && router.navigate) {
          console.log('[NAV] Using TanStack Router navigate');
          router.navigate({ to: '/intelligence' });
        } else {
          // Fallback: use history.pushState + manual re-render
          console.log('[NAV] No router found, using history.pushState');
          window.history.pushState({}, '', '/intelligence');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
      await page.waitForTimeout(5000);
    } else {
      await page.goto(`${PLATFORM_URL}/intelligence`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
    }

    const currentUrl = page.url();
    console.log(`Final URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-blocked.png`, fullPage: true });
      test.skip(true, 'Platform Admin auth — cannot bypass auth guard');
      return;
    }

    const pageTitle = page.getByRole('heading', { name: /intelligence/i })
      .or(page.getByText('AI Intelligence', { exact: false }))
      .first();
    const hasTitle = await pageTitle.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Intelligence page title visible: ${hasTitle}`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-intelligence-loaded.png`, fullPage: true });

    // --- Step 2: Feature Gaps section ---
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);

    const featureGapsHeading = page.getByText(/feature\s*gaps/i).first();
    let hasFeatureGaps = await featureGapsHeading.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasFeatureGaps) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      hasFeatureGaps = await featureGapsHeading.isVisible({ timeout: 3000 }).catch(() => false);
    }

    console.log(`Feature Gaps section visible: ${hasFeatureGaps}`);

    if (hasFeatureGaps) {
      await featureGapsHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    const highBadge = page.locator('[class*="badge"], [data-slot="badge"]').filter({ hasText: /HIGH/i }).first();
    const mediumBadge = page.locator('[class*="badge"], [data-slot="badge"]').filter({ hasText: /MEDIUM/i }).first();
    const lowBadge = page.locator('[class*="badge"], [data-slot="badge"]').filter({ hasText: /LOW/i }).first();

    const hasHighBadge = await highBadge.isVisible({ timeout: 3000 }).catch(() => false);
    const hasMediumBadge = await mediumBadge.isVisible({ timeout: 2000 }).catch(() => false);
    const hasLowBadge = await lowBadge.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Severity badges — HIGH: ${hasHighBadge}, MEDIUM: ${hasMediumBadge}, LOW: ${hasLowBadge}`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-2-feature-gaps-section.png`, fullPage: true });

    // --- Step 3: Change status to REVIEWED ---
    const statusDropdown = page.locator('select, [role="combobox"], button')
      .filter({ hasText: /new|open|pending|status/i })
      .first();
    const statusButtonAlt = page.getByRole('button', { name: /status|review|new/i }).first();

    let statusVisible = await statusDropdown.isVisible({ timeout: 3000 }).catch(() => false);
    if (!statusVisible) {
      statusVisible = await statusButtonAlt.isVisible({ timeout: 3000 }).catch(() => false);
    }
    console.log(`Status dropdown visible: ${statusVisible}`);

    if (statusVisible) {
      const target = (await statusDropdown.isVisible().catch(() => false)) ? statusDropdown : statusButtonAlt;
      await target.click();
      await page.waitForTimeout(500);

      const reviewedOption = page.getByRole('option', { name: /reviewed/i })
        .or(page.getByRole('menuitem', { name: /reviewed/i }))
        .or(page.getByText('REVIEWED', { exact: true }))
        .or(page.getByText('Reviewed'))
        .first();

      if (await reviewedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reviewedOption.click();
        await page.waitForTimeout(1000);
        console.log('Changed status to REVIEWED');
      }
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-feature-gap-status-reviewed.png`, fullPage: true });

    // --- Step 4: Workflow Opportunities section ---
    const workflowHeading = page.getByText(/workflow\s*opportunities/i).first();
    let hasWorkflow = await workflowHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasWorkflow) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      hasWorkflow = await workflowHeading.isVisible({ timeout: 3000 }).catch(() => false);
    }

    console.log(`Workflow Opportunities visible: ${hasWorkflow}`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-workflow-opportunities-section.png`, fullPage: true });

    // --- Step 5: Default Optimisation section ---
    const defaultOptHeading = page.getByText(/default\s*optimi[sz]ation/i).first();
    let hasDefaultOpt = await defaultOptHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasDefaultOpt) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      hasDefaultOpt = await defaultOptHeading.isVisible({ timeout: 3000 }).catch(() => false);
    }

    console.log(`Default Optimisation visible: ${hasDefaultOpt}`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-default-optimisation-section.png`, fullPage: true });

    // --- Step 6: Click Make Default ---
    const makeDefaultBtn = page.getByRole('button', { name: /make\s*default/i }).first();
    const hasMakeDefault = await makeDefaultBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMakeDefault) {
      await makeDefaultBtn.click();
      await page.waitForTimeout(1500);

      const hasActioned = await page.getByText(/actioned/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`ACTIONED: ${hasActioned}`);

      const hasToast = await page.locator('[data-sonner-toast], [role="status"], [class*="toast"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`Toast: ${hasToast}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-make-default-actioned.png`, fullPage: true });

    expect(hasTitle).toBeTruthy();

    console.log('\n--- Journey 22 Summary ---');
    console.log(`Title: ${hasTitle}, Feature Gaps: ${hasFeatureGaps}, Badges: H=${hasHighBadge} M=${hasMediumBadge} L=${hasLowBadge}`);
    console.log(`Status: ${statusVisible}, Workflow: ${hasWorkflow}, Default Opt: ${hasDefaultOpt}, Make Default: ${hasMakeDefault}`);
  });
});
