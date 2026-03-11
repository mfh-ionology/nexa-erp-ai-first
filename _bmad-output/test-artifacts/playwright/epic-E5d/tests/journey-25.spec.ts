import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-25';

const PLATFORM_URL = 'http://localhost:5112';

test.describe('Journey 25: Platform Dashboard — Publish Knowledge Workflow', () => {
  test.setTimeout(120_000);

  test('Open publish panel, fill form, and publish knowledge article', async ({ page }) => {
    // Debug logging
    page.on('console', (msg) => {
      if (msg.text().includes('[E2E]') || msg.text().includes('[FETCH MOCK]')) {
        console.log(`  [browser] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`  [page error] ${err.message}`);
    });

    // ── Mock intelligence API endpoints via page.route ──
    await page.route('**/admin/intelligence/**', async (route) => {
      const url = route.request().url();
      let data: unknown = { items: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } };

      if (url.includes('/summary')) {
        data = {
          contributingTenants: 5,
          totalKnowledgeArticles: 42,
          totalCorrections: 54,
          aiSuccessRate: 91.5,
          lastAggregatedAt: new Date().toISOString(),
        };
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
    });

    // Mock knowledge article endpoints (create/publish)
    await page.route('**/knowledge**', async (route) => {
      const method = route.request().method();

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(route.request().postData() || '{}');
        } catch {
          // ignore parse error
        }
        console.log(`  [mock] Knowledge ${method}: ${JSON.stringify(body).slice(0, 200)}`);

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'ka-published-1',
              title: body.title || 'Untitled',
              content: body.content || '',
              category: body.category || 'BEST_PRACTICE',
              status: 'PUBLISHED',
              eligibleTenants: 3,
            },
          }),
        });
        return;
      }

      // GET — list
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

    // Try to import and call the Zustand auth store directly via Vite
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
        // Try dynamic import
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
      // SPA navigate to intelligence page
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
      test.skip(true, 'Platform Admin auth injection failed — cannot test publish workflow');
      return;
    }

    // Checkpoint 1: Dashboard loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-intelligence-dashboard.png`,
      fullPage: true,
    });

    // Verify page loaded
    const pageHeading = page
      .getByRole('heading', { name: /intelligence/i })
      .or(page.getByText(/ai intelligence/i))
      .first();
    await expect(pageHeading).toBeVisible({ timeout: 10000 });

    // ── Step 2: Click Publish Knowledge FAB ──
    const publishFab = page
      .getByRole('button', { name: /publish knowledge/i })
      .or(page.locator('button[aria-label="Publish Knowledge"]'))
      .or(page.locator('[data-testid="publish-knowledge-fab"]'))
      .first();
    await expect(publishFab).toBeVisible({ timeout: 10000 });
    await publishFab.click();
    await page.waitForTimeout(1500);

    // Checkpoint 2: Publish panel open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-publish-panel-open.png`,
      fullPage: true,
    });

    // Verify the publish knowledge side panel is open
    const publishPanel = page
      .locator('div[role="dialog"][aria-label="Publish Knowledge Article"]')
      .or(page.locator('div[role="dialog"]').filter({ hasText: /publish knowledge/i }))
      .first();
    await expect(publishPanel).toBeVisible({ timeout: 10000 });

    // Verify form fields exist
    const titleInput = publishPanel.locator('#knowledge-title')
      .or(publishPanel.getByLabel(/title/i))
      .or(publishPanel.getByPlaceholder(/title/i))
      .first();
    const contentArea = publishPanel.locator('#knowledge-content')
      .or(publishPanel.getByLabel(/content/i))
      .or(publishPanel.locator('textarea'))
      .first();
    const categorySelect = publishPanel.locator('#knowledge-category')
      .or(publishPanel.getByLabel(/category/i))
      .first();

    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(contentArea).toBeVisible({ timeout: 5000 });
    await expect(categorySelect).toBeVisible({ timeout: 5000 });

    // Verify Target Industries and Target Plan Tiers labels are present
    const industriesLabel = publishPanel.getByText(/target industries/i).first();
    const planTiersLabel = publishPanel.getByText(/target plan tiers/i).first();
    await expect(industriesLabel).toBeVisible({ timeout: 5000 });
    await expect(planTiersLabel).toBeVisible({ timeout: 5000 });

    // ── Step 3: Fill the form ──
    await titleInput.fill('Best Practice: EU Reverse Charge VAT Handling');

    await contentArea.fill(
      'When UK businesses purchase goods or services from EU suppliers, the reverse charge mechanism should be applied. Use the designated reverse charge VAT code rather than standard rate. This applies to both B2B goods and services transactions.',
    );

    // Select BEST_PRACTICE category
    await categorySelect.selectOption('BEST_PRACTICE').catch(async () => {
      await categorySelect.click();
      await page.waitForTimeout(500);
      const bestPracticeOption = page.getByRole('option', { name: /best.?practice/i })
        .or(page.getByText(/best.?practice/i))
        .first();
      await bestPracticeOption.click();
    });

    // Select target industries — click chip buttons or checkboxes
    const constructionChip = publishPanel
      .getByRole('button', { name: /construction/i })
      .or(publishPanel.getByLabel(/construction/i))
      .first();
    const manufacturingChip = publishPanel
      .getByRole('button', { name: /manufacturing/i })
      .or(publishPanel.getByLabel(/manufacturing/i))
      .first();

    if (await constructionChip.isVisible().catch(() => false)) {
      await constructionChip.click();
    }
    if (await manufacturingChip.isVisible().catch(() => false)) {
      await manufacturingChip.click();
    }

    // Select target plan tiers
    const professionalChip = publishPanel
      .getByRole('button', { name: /professional/i })
      .or(publishPanel.getByLabel(/professional/i))
      .first();
    const enterpriseChip = publishPanel
      .getByRole('button', { name: /enterprise/i })
      .or(publishPanel.getByLabel(/enterprise/i))
      .first();

    if (await professionalChip.isVisible().catch(() => false)) {
      await professionalChip.click();
    }
    if (await enterpriseChip.isVisible().catch(() => false)) {
      await enterpriseChip.click();
    }

    // Checkpoint 3: Form filled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-filled.png`,
      fullPage: true,
    });

    // Verify form values
    const filledTitle = await titleInput.inputValue();
    expect(filledTitle).toBe('Best Practice: EU Reverse Charge VAT Handling');

    const filledContent = await contentArea.inputValue();
    expect(filledContent).toContain('reverse charge mechanism');

    // ── Step 4: Click Save & Publish ──
    const publishBtn = publishPanel
      .getByRole('button', { name: /save & publish/i })
      .or(publishPanel.getByRole('button', { name: /^publish$/i }))
      .first();
    await expect(publishBtn).toBeVisible({ timeout: 5000 });
    await publishBtn.click();
    await page.waitForTimeout(2000);

    // Checkpoint 4: Publish success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-publish-success.png`,
      fullPage: true,
    });

    // Verify success toast or indication
    const successToast = page
      .getByText(/knowledge article published/i)
      .or(page.getByText(/published.*tenant/i))
      .or(page.getByText(/successfully published/i))
      .or(page.getByText(/success/i))
      .first();
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verify the panel closes after successful publish
    await expect(publishPanel).not.toBeVisible({ timeout: 10000 });
  });
});
