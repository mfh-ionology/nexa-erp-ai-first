import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-12';

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
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: login and navigate to Knowledge Management page.
 */
async function loginAndNavigateToKnowledge(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('admin@nexa-erp.dev');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('NexaDev2026!');

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible' });
  await signInButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 12: Corrections Tab — Stats Panel & Grouped List', () => {
  test.setTimeout(120_000);

  test('Corrections tab displays stats KPIs and grouped correction list with accordion', async ({
    page,
  }) => {
    // ── Login and navigate to Knowledge Management ──────────────────
    await loginAndNavigateToKnowledge(page);
    await spaNavigate(page, '/ai/admin/knowledge');

    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // ── Step 1: Click Corrections tab (or deep-link) ────────────────
    const correctionsTab = page.getByRole('tab', { name: /corrections/i });
    await expect(correctionsTab).toBeVisible({ timeout: 10000 });
    await correctionsTab.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Check for 500 crash
    const hasCrashed = await page
      .locator('text=Something went wrong')
      .isVisible()
      .catch(() => false);

    if (hasCrashed) {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-corrections-tab-crash.png`,
        fullPage: true,
      });
      bugs.push('BUG: Clicking Corrections tab causes 500 error (app crash).');
      // Try recovery via deep-link
      await page.goto('/login', { waitUntil: 'networkidle', timeout: 15000 });
      await loginAndNavigateToKnowledge(page);
      await spaNavigate(page, '/ai/admin/knowledge#corrections');
      await page.waitForTimeout(2000);
    }

    // Verify Corrections tab is active
    await expect(correctionsTab).toHaveAttribute('data-state', 'active', {
      timeout: 5000,
    });

    // Verify URL hash
    await expect(page).toHaveURL(/#corrections/);

    // ── Verify Stats KPI cards ──────────────────────────────────────
    // Look for correction-specific stats
    const statsTexts = [
      /total corrections/i,
      /last 30 days|30.day/i,
      /by type|type breakdown/i,
      /auto.resolved/i,
    ];

    let statsFound = 0;
    for (const statPattern of statsTexts) {
      const statEl = page.getByText(statPattern).first();
      const visible = await statEl.isVisible().catch(() => false);
      if (visible) {
        statsFound++;
        console.log(`Stats KPI found: ${statPattern}`);
      } else {
        console.log(`Stats KPI NOT found: ${statPattern}`);
      }
    }

    if (statsFound === 0) {
      // Check for any stat-like cards in the corrections tab panel
      const anyStatCards = await page
        .locator('[class*="stat"], [class*="kpi"], [class*="metric"], [class*="card"]')
        .count();
      console.log(`Found ${anyStatCards} stat-like elements in corrections tab`);

      if (anyStatCards === 0) {
        bugs.push(
          'BUG: Corrections tab has no stats KPI cards (expected 4: Total Corrections, Last 30 Days, By Type, Auto-resolved).',
        );
      }
    } else if (statsFound < 4) {
      console.log(
        `WARNING: Only ${statsFound}/4 expected stats KPIs found in Corrections tab`,
      );
    }

    // Checkpoint 1: Corrections tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-corrections-tab-loaded.png`,
      fullPage: true,
    });

    // ── Verify grouped corrections by type ──────────────────────────
    // Look for correction type group labels
    const typeLabels = ['TERMINOLOGY', 'PROCESS', 'DATA', 'PREFERENCE', 'OTHER'];
    let typesFound = 0;
    for (const typeLabel of typeLabels) {
      const el = page.getByText(new RegExp(typeLabel, 'i')).first();
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        typesFound++;
        console.log(`Correction type group found: ${typeLabel}`);
      }
    }

    if (typesFound === 0) {
      // Try accordion/collapsible elements
      const accordions = await page
        .locator('[data-state="open"], [data-state="closed"], [role="button"][aria-expanded]')
        .count();
      console.log(`Found ${accordions} accordion-like elements`);

      if (accordions === 0) {
        bugs.push(
          'BUG: Corrections tab has no grouped correction type sections (expected accordion groups: TERMINOLOGY, PROCESS, DATA, PREFERENCE, OTHER).',
        );
      }
    } else {
      console.log(`Found ${typesFound}/${typeLabels.length} correction type groups`);
    }

    // ── Step 2: Verify correction card details ──────────────────────
    // Look for correction card elements
    const createArticleBtn = page.getByRole('button', { name: /create article/i });
    const createArticleBtnCount = await createArticleBtn.count();

    // Look for status badges (auto-resolved/pending)
    const autoResolvedBadge = page.getByText(/auto.resolved/i);
    const pendingBadge = page.getByText(/pending/i);
    const autoResolvedVisible = await autoResolvedBadge.first().isVisible().catch(() => false);
    const pendingVisible = await pendingBadge.first().isVisible().catch(() => false);

    // Look for timestamps
    const timestamps = await page
      .locator('time, [class*="timestamp"], [class*="date"], [class*="time"]')
      .count();

    console.log(`Create Article buttons: ${createArticleBtnCount}`);
    console.log(`Auto-resolved badges visible: ${autoResolvedVisible}`);
    console.log(`Pending badges visible: ${pendingVisible}`);
    console.log(`Timestamp elements: ${timestamps}`);

    if (createArticleBtnCount === 0) {
      // Check if there are any corrections at all
      const emptyState = await page
        .getByText(/no corrections|no data|empty/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (emptyState) {
        console.log('Corrections tab shows empty state — no corrections to verify');
      } else {
        bugs.push(
          'BUG: Correction cards missing "Create Article" action button.',
        );
      }
    }

    if (!autoResolvedVisible && !pendingVisible) {
      const hasCorrections = createArticleBtnCount > 0 || typesFound > 0;
      if (hasCorrections) {
        bugs.push(
          'BUG: Correction cards missing status badges (auto-resolved/pending).',
        );
      }
    }

    // Checkpoint 2: Correction card details
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-correction-card-details.png`,
      fullPage: true,
    });

    // ── Step 3: Expand/collapse accordion group ─────────────────────
    // Find an accordion trigger to toggle
    const accordionTriggers = page.locator(
      '[data-state="open"] > [role="button"], ' +
      '[role="button"][aria-expanded="true"], ' +
      'button[data-state="open"], ' +
      '[class*="AccordionTrigger"], ' +
      '[class*="accordion-trigger"]',
    );
    let accordionTriggerCount = await accordionTriggers.count();

    // Fallback: try any collapsible header that contains a type label
    if (accordionTriggerCount === 0) {
      const fallbackTriggers = page.locator(
        '[data-radix-collection-item], ' +
        'button:has-text("TERMINOLOGY"), ' +
        'button:has-text("PROCESS"), ' +
        'button:has-text("DATA"), ' +
        'div[role="button"]:has-text("TERMINOLOGY"), ' +
        'div[role="button"]:has-text("PROCESS")',
      );
      accordionTriggerCount = await fallbackTriggers.count();

      if (accordionTriggerCount > 0) {
        const trigger = fallbackTriggers.first();
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        await page.waitForTimeout(500);
        console.log('Clicked fallback accordion trigger');
      } else {
        bugs.push(
          'BUG: No accordion triggers found for correction type groups — cannot test expand/collapse.',
        );
      }
    } else {
      // Click the first open accordion trigger to collapse it
      const trigger = accordionTriggers.first();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await page.waitForTimeout(500);

      // Verify it collapsed
      const collapsed = await page
        .locator('[data-state="closed"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (collapsed) {
        console.log('Accordion collapsed successfully');
      } else {
        console.log('WARNING: Accordion may not have collapsed (no data-state="closed" found)');
      }
    }

    // Checkpoint 3: Accordion collapsed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-accordion-collapsed.png`,
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
