import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-27';

const bugs: string[] = [];

/**
 * Helper: SPA navigate without losing auth tokens (Zustand in-memory).
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Helper: login via API and inject tokens into the app, then navigate to Knowledge page.
 */
async function loginAndNavigateToKnowledge(page: import('@playwright/test').Page) {
  // First load the app so we have a page context
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Do login via Playwright's request API (bypasses browser fetch issues)
  const loginResp = await page.request.post('/api/v1/auth/login', {
    data: { email: 'admin@nexa-erp.dev', password: 'NexaDev2026!' },
  });

  if (!loginResp.ok()) {
    throw new Error(`Login API failed: ${loginResp.status()} ${await loginResp.text()}`);
  }

  const loginData = await loginResp.json();
  const { accessToken, user } = loginData.data;
  console.log(`Login successful for ${user.email}, role: ${user.role}`);

  // Inject tokens into the app's auth store via page.evaluate
  await page.evaluate(({ token, userData }) => {
    // Set tokens in localStorage/sessionStorage as the app expects
    localStorage.setItem('nexa-auth-token', token);

    // Also try to set the Zustand store directly if it's on window
    try {
      const authStoreData = {
        state: {
          accessToken: token,
          user: userData,
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('nexa-auth-storage', JSON.stringify(authStoreData));
    } catch (e) {
      console.log('Could not set auth store:', e);
    }
  }, { token: accessToken, userData: user });

  // Reload to pick up the stored auth
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if we're authenticated (not on login page)
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    // Fallback: try the UI login flow with a longer timeout
    console.log('API token injection did not work, trying UI login...');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();

    // Wait for either redirect or error message
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 60000,
      });
    } catch {
      // Take a diagnostic screenshot
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/login-stuck.png` });
      throw new Error('Login timed out — API request never completed in browser context');
    }
  }

  await page.waitForLoadState('domcontentloaded');

  // Navigate to Knowledge Management
  await spaNavigate(page, '/ai/admin/knowledge');
  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe('Journey 27: Tenant Knowledge Management — Responsive Layout', () => {
  test.setTimeout(180_000);

  test('Knowledge page adapts correctly to tablet and mobile viewports', async ({
    page,
  }) => {
    // Log browser console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
    });

    // ── Login at default viewport ──────────────────────────────────
    await loginAndNavigateToKnowledge(page);

    // ════════════════════════════════════════════════════════════════
    // STEP 1: Tablet viewport (768px)
    // ════════════════════════════════════════════════════════════════
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    // Verify page still renders correctly
    const headingTablet = page.getByRole('heading', { name: 'Knowledge Management' });
    await expect(headingTablet).toBeVisible({ timeout: 10000 });

    // Check tabs are still visible at tablet width
    const tabsVisible = await page
      .getByRole('tab', { name: /knowledge articles/i })
      .isVisible()
      .catch(() => false);

    if (!tabsVisible) {
      const anyTabs = await page.getByRole('tab').count();
      console.log(`Tabs visible at 768px: ${anyTabs}`);
      if (anyTabs === 0) {
        bugs.push(
          'BUG: No tabs visible at tablet viewport (768px) — expected 5 tabs to remain visible.',
        );
      }
    } else {
      console.log('Tabs visible at 768px — good');
    }

    // Check KPI cards layout
    const kpiCards = page.locator(
      '[class*="stat"], [class*="kpi"], [class*="metric"], [class*="card"]',
    );
    const kpiCount = await kpiCards.count();
    console.log(`KPI-like elements at tablet: ${kpiCount}`);

    // Check sidebar state
    const sidebar = page.locator('[data-sidebar], [class*="sidebar"], nav[class*="Sidebar"]');
    const sidebarVisible = await sidebar.first().isVisible().catch(() => false);

    const hamburger = page.locator(
      'button[class*="hamburger"], button[aria-label*="menu"], button[aria-label*="Menu"], ' +
      '[class*="SidebarTrigger"], button:has(svg[class*="menu"])',
    );
    const hamburgerVisible = await hamburger.first().isVisible().catch(() => false);

    console.log(`Sidebar visible at tablet: ${sidebarVisible}`);
    console.log(`Hamburger menu at tablet: ${hamburgerVisible}`);

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasOverflow) {
      bugs.push('BUG: Horizontal overflow detected at tablet viewport (768px).');
    }

    // Checkpoint 1: Tablet layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-tablet-layout.png`,
      fullPage: true,
    });

    // ── Step 1b: Tablet tab interaction ────────────────────────────
    const trainingTab = page.getByRole('tab', { name: /training/i });
    const trainingTabVisible = await trainingTab.isVisible().catch(() => false);

    if (trainingTabVisible) {
      await trainingTab.click();
      await page.waitForTimeout(1000);
      console.log('Clicked Training tab at tablet viewport');
    } else {
      console.log('Training tab not directly visible at tablet — may be in overflow');
    }

    // Checkpoint 2: Tablet tab interaction
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-tablet-tab-interaction.png`,
      fullPage: true,
    });

    // ════════════════════════════════════════════════════════════════
    // STEP 2: Mobile viewport (375px)
    // ════════════════════════════════════════════════════════════════
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);

    // Verify page still renders
    const headingMobile = page.getByRole('heading', { name: 'Knowledge Management' });
    const headingMobileVisible = await headingMobile.isVisible().catch(() => false);

    if (!headingMobileVisible) {
      const anyHeading = await page
        .getByText(/knowledge/i)
        .first()
        .isVisible()
        .catch(() => false);
      console.log(`Knowledge heading visible at mobile: ${anyHeading}`);
    } else {
      console.log('Knowledge Management heading visible at mobile');
    }

    // Check for accordion layout
    const horizontalTabs = await page.getByRole('tab').count();
    const accordionItems = await page
      .locator(
        '[data-state="open"][data-orientation], ' +
        '[class*="accordion"], ' +
        '[class*="Accordion"], ' +
        '[role="button"][aria-expanded]',
      )
      .count();

    console.log(`Horizontal tabs at mobile: ${horizontalTabs}`);
    console.log(`Accordion items at mobile: ${accordionItems}`);

    // Check sidebar is fully collapsed
    const sidebarMobile = page.locator(
      '[data-sidebar="sidebar"], [class*="sidebar"]:not([class*="trigger"])',
    );
    const sidebarMobileVisible = await sidebarMobile
      .first()
      .isVisible()
      .catch(() => false);

    const hamburgerMobile = page.locator(
      'button[class*="hamburger"], button[aria-label*="menu"], button[aria-label*="Menu"], ' +
      '[class*="SidebarTrigger"], button:has(svg[class*="menu"])',
    );
    const hamburgerMobileVisible = await hamburgerMobile
      .first()
      .isVisible()
      .catch(() => false);

    console.log(`Sidebar visible at mobile: ${sidebarMobileVisible}`);
    console.log(`Hamburger at mobile: ${hamburgerMobileVisible}`);

    // Check for horizontal overflow at mobile
    const hasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasMobileOverflow) {
      bugs.push('BUG: Horizontal overflow detected at mobile viewport (375px).');
    }

    // Checkpoint 3: Mobile layout
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-mobile-layout.png`,
      fullPage: true,
    });

    // ── Step 2b: Mobile tab/accordion interaction ──────────────────
    if (horizontalTabs > 0) {
      const knowledgeTab = page.getByRole('tab', { name: /knowledge articles/i });
      const knowledgeTabMobileVisible = await knowledgeTab.isVisible().catch(() => false);
      if (knowledgeTabMobileVisible) {
        await knowledgeTab.click();
        await page.waitForTimeout(500);
        console.log('Clicked Knowledge Articles tab at mobile');
      }
    } else if (accordionItems > 0) {
      const trigger = page
        .locator('[role="button"][aria-expanded], [class*="accordion"] button')
        .first();
      const triggerVisible = await trigger.isVisible().catch(() => false);
      if (triggerVisible) {
        await trigger.click();
        await page.waitForTimeout(500);
        console.log('Clicked accordion trigger at mobile');
      }
    }

    // Checkpoint 4: Mobile interaction
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-mobile-accordion-interaction.png`,
      fullPage: true,
    });

    // ── Summary ─────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` +
          bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found:\n` + bugs.join('\n'),
      );
    }
  });
});
