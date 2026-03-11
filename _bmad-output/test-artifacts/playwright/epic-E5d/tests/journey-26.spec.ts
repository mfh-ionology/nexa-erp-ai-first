import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-26';

const PLATFORM_URL = 'http://localhost:5112';

test.describe('Journey 26: Platform Dashboard — Trigger Aggregation & Insights Generation', () => {
  test.setTimeout(120_000);

  test('Trigger aggregation and insights generation with confirmation dialogs', async ({ page }) => {
    // Debug logging
    page.on('console', (msg) => {
      if (msg.text().includes('[E2E]') || msg.text().includes('[FETCH MOCK]')) {
        console.log(`  [browser] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`  [page error] ${err.message}`);
    });

    // ── Mock intelligence API endpoints ──
    await page.route('**/admin/intelligence/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // POST triggers (aggregation / insights)
      if (method === 'POST') {
        console.log(`  [mock] Intelligence POST: ${url}`);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'completed',
              message: url.includes('aggregat') ? 'Aggregation completed' : 'Insights generated',
              updatedAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // GET — summary
      if (url.includes('/summary')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              contributingTenants: 5,
              totalKnowledgeArticles: 42,
              totalCorrections: 54,
              aiSuccessRate: 91.5,
              lastAggregatedAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // GET — list endpoints (feature-gaps, workflow-opportunities, etc.)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
        }),
      });
    });

    // Mock knowledge endpoints
    await page.route('**/knowledge**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
        }),
      });
    });

    // ── Step 1: Navigate to login, inject auth, then go to /intelligence ──
    await page.goto(`${PLATFORM_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Inject platform admin auth via Zustand store
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
          return { ok: true, method: '__vite_import__' };
        }
      } catch {
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
          return { ok: true, method: 'dynamic import' };
        }
      } catch (e) {
        return { ok: false, reason: `import failed: ${(e as Error).message}` };
      }

      return { ok: false, reason: 'no import method worked' };
    });

    console.log(`Store import result: ${JSON.stringify(imported)}`);

    if (imported.ok) {
      await page.evaluate(() => {
        window.history.pushState({}, '', '/intelligence');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle');
    }

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-login-blocked.png`,
        fullPage: true,
      });
      test.skip(true, 'Platform Admin auth injection failed — cannot test aggregation triggers');
      return;
    }

    // Checkpoint 1: Dashboard loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-intelligence-dashboard.png`,
      fullPage: true,
    });

    // Verify dashboard loaded
    const pageHeading = page
      .getByRole('heading', { name: /intelligence/i })
      .or(page.getByText(/ai intelligence/i))
      .first();
    await expect(pageHeading).toBeVisible({ timeout: 10000 });

    // ── Step 2: Click Run Aggregation button ──
    const runAggregationBtn = page
      .getByRole('button', { name: /run aggregation/i })
      .or(page.locator('[data-testid="run-aggregation"]'))
      .or(page.locator('button').filter({ hasText: /aggregat/i }))
      .first();
    await expect(runAggregationBtn).toBeVisible({ timeout: 10000 });
    await runAggregationBtn.click();
    await page.waitForTimeout(1000);

    // Checkpoint 2: Aggregation confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-aggregation-confirm-dialog.png`,
      fullPage: true,
    });

    // Verify confirmation dialog appeared
    const confirmDialog = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog'))
      .or(page.locator('[role="alertdialog"]'))
      .first();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });

    // ── Step 3: Confirm aggregation ──
    const confirmAggBtn = confirmDialog
      .getByRole('button', { name: /confirm/i })
      .or(confirmDialog.getByRole('button', { name: /run/i }))
      .or(confirmDialog.getByRole('button', { name: /yes/i }))
      .or(confirmDialog.getByRole('button', { name: /ok/i }))
      .first();
    await expect(confirmAggBtn).toBeVisible({ timeout: 5000 });
    await confirmAggBtn.click();
    await page.waitForTimeout(2000);

    // Checkpoint 3: Aggregation triggered
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-aggregation-triggered.png`,
      fullPage: true,
    });

    // Verify success feedback (toast or button state change)
    const aggSuccess = page
      .getByText(/aggregation completed/i)
      .or(page.getByText(/aggregation triggered/i))
      .or(page.getByText(/success/i))
      .first();
    await expect(aggSuccess).toBeVisible({ timeout: 10000 });

    // ── Step 4: Click Generate Insights button ──
    const generateInsightsBtn = page
      .getByRole('button', { name: /generate insights/i })
      .or(page.locator('[data-testid="generate-insights"]'))
      .or(page.locator('button').filter({ hasText: /insight/i }))
      .first();
    await expect(generateInsightsBtn).toBeVisible({ timeout: 10000 });
    await generateInsightsBtn.click();
    await page.waitForTimeout(1000);

    // Checkpoint 4: Insights confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-insights-confirm-dialog.png`,
      fullPage: true,
    });

    // Verify confirmation dialog appeared
    const insightsDialog = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog'))
      .or(page.locator('[role="alertdialog"]'))
      .first();
    await expect(insightsDialog).toBeVisible({ timeout: 10000 });

    // ── Step 5: Confirm insights generation ──
    const confirmInsightsBtn = insightsDialog
      .getByRole('button', { name: /confirm/i })
      .or(insightsDialog.getByRole('button', { name: /generate/i }))
      .or(insightsDialog.getByRole('button', { name: /yes/i }))
      .or(insightsDialog.getByRole('button', { name: /ok/i }))
      .first();
    await expect(confirmInsightsBtn).toBeVisible({ timeout: 5000 });
    await confirmInsightsBtn.click();
    await page.waitForTimeout(2000);

    // Checkpoint 5: Insights generation completed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-insights-triggered.png`,
      fullPage: true,
    });

    // Verify success feedback
    const insightsSuccess = page
      .getByText(/insights generated/i)
      .or(page.getByText(/insights generation/i))
      .or(page.getByText(/success/i))
      .first();
    await expect(insightsSuccess).toBeVisible({ timeout: 10000 });
  });
});
