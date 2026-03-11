import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-1';

/** Track bugs found during test execution */
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
 * Used for initial setup and recovery after crashes.
 */
async function loginAndNavigateToKnowledge(page: import('@playwright/test').Page) {
  // Full page reload to clear any crashed state
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('admin@nexa-erp.dev');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('NexaDev2026!');

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible' });
  await signInButton.click();

  // Wait for redirect away from login — use longer timeout for recovery scenarios
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle');

  // SPA-navigate to Knowledge Management (preserves auth tokens)
  await spaNavigate(page, '/ai/admin/knowledge');

  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

/**
 * Helper: recover from a 500 crash by doing a full page reload and re-login.
 * Returns true if recovery succeeded, false if it failed.
 */
async function recoverFromCrash(page: import('@playwright/test').Page): Promise<boolean> {
  try {
    // Full page reload — don't rely on clicking Reload button in crashed state
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Check if we're on the Knowledge page already (session may still be valid)
    const onKnowledge = page.url().includes('/ai/admin/knowledge');
    if (onKnowledge) {
      const heading = page.getByRole('heading', { name: 'Knowledge Management' });
      if (await heading.isVisible().catch(() => false)) {
        return true;
      }
    }

    // Check if we landed on login
    const onLogin = page.url().includes('/login');
    if (onLogin) {
      await loginAndNavigateToKnowledge(page);
      return true;
    }

    // We're on some other page — SPA navigate to knowledge
    await spaNavigate(page, '/ai/admin/knowledge');
    const heading = page.getByRole('heading', { name: 'Knowledge Management' });
    if (await heading.isVisible().catch(() => false)) {
      return true;
    }

    // Last resort: full re-login
    await loginAndNavigateToKnowledge(page);
    return true;
  } catch (e) {
    console.error('Crash recovery failed:', e);
    return false;
  }
}

/**
 * Helper: click a tab and check if the page crashed.
 * Returns true if tab switched successfully, false if crashed.
 */
async function clickTabSafe(
  page: import('@playwright/test').Page,
  tabName: string,
  screenshotName: string,
): Promise<boolean> {
  const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
  await tab.click();
  await page.waitForTimeout(1000);

  // Check if the page crashed (500 error)
  const hasCrashed = await page
    .locator('text=Something went wrong')
    .isVisible()
    .catch(() => false);

  if (hasCrashed) {
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/${screenshotName}-crash-500.png`,
      fullPage: true,
    });
    const msg = `BUG: Clicking "${tabName}" tab causes 500 error (app crash).`;
    console.error(msg);
    bugs.push(msg);
    return false;
  }

  // Verify tab is active
  await expect(tab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/${screenshotName}.png`,
    fullPage: true,
  });
  return true;
}

test.describe('Journey 1: Knowledge Management Page Shell & Navigation', () => {
  test.setTimeout(120_000);

  test('Page shell loads with tabs, stats panel, sidebar nav, and tab switching', async ({
    page,
  }) => {
    // ── Step 1: Login and navigate to /ai/admin/knowledge ─────────────
    await loginAndNavigateToKnowledge(page);

    // Verify 5 tabs are present
    const tabNames = [
      'Knowledge Articles',
      'Training Examples',
      'Corrections',
      'Suggested',
      'Settings',
    ];
    for (const tabName of tabNames) {
      await expect(
        page.getByRole('tab', { name: new RegExp(tabName, 'i') }),
      ).toBeVisible({ timeout: 5000 });
    }

    // Verify Knowledge Articles tab is active by default
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Checkpoint 1: Page Initial Load
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-page-initial-load.png`,
      fullPage: true,
    });

    // ── Step 2: Verify sidebar navigation — Knowledge item under AI Administration ──
    const knowledgeNavItem = page.locator('a[href*="/ai/admin/knowledge"]');
    await expect(knowledgeNavItem.first()).toBeVisible({ timeout: 5000 });

    // ── Step 3: Verify Stats panel KPI cards ────────────────────────────
    await expect(page.getByText('Total Articles')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('RAG Retrieval Rate')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Correction Trend')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Pending Reviews')).toBeVisible({ timeout: 5000 });

    // Checkpoint 2: KPI Stats Cards
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-kpi-stats-cards.png`,
      fullPage: true,
    });

    // ── Step 4: Click Training Examples tab ─────────────────────────────
    let trainingOk = await clickTabSafe(page, 'Training Examples', 'step-4-training-tab-active');
    if (trainingOk) {
      await expect(page).toHaveURL(/#training/);
    }

    // If Training tab crashed, recover for next tab test
    let canContinue = true;
    if (!trainingOk) {
      canContinue = await recoverFromCrash(page);
    }

    // ── Step 5: Click Corrections tab ──────────────────────────────────
    let correctionsOk = false;
    if (canContinue) {
      correctionsOk = await clickTabSafe(page, 'Corrections', 'step-5-corrections-tab');
      if (correctionsOk) {
        await expect(page).toHaveURL(/#corrections/);
      }
    } else {
      bugs.push('BUG: Skipped Corrections tab test — crash recovery failed.');
    }

    // If Corrections tab crashed, recover for next tab test
    if (!correctionsOk && canContinue) {
      canContinue = await recoverFromCrash(page);
    }

    // ── Step 6: Click Suggested tab ────────────────────────────────────
    let suggestedOk = false;
    if (canContinue) {
      suggestedOk = await clickTabSafe(page, 'Suggested', 'step-6-suggested-tab');
      if (suggestedOk) {
        await expect(page).toHaveURL(/#suggested/);
      }
    } else {
      bugs.push('BUG: Skipped Suggested tab test — crash recovery failed.');
    }

    if (!suggestedOk && canContinue) {
      canContinue = await recoverFromCrash(page);
    }

    // ── Step 7: Click Settings tab ─────────────────────────────────────
    let settingsOk = false;
    if (canContinue) {
      settingsOk = await clickTabSafe(page, 'Settings', 'step-7-settings-tab');
      if (settingsOk) {
        await expect(page).toHaveURL(/#settings/);
      }
    } else {
      bugs.push('BUG: Skipped Settings tab test — crash recovery failed.');
    }

    if (!settingsOk && canContinue) {
      canContinue = await recoverFromCrash(page);
    }

    // ── Step 8: Deep-link to Corrections tab via URL (SPA navigate) ────
    if (!canContinue) {
      bugs.push('BUG: Skipped deep-link test — crash recovery failed.');
    }

    if (canContinue) {
    await spaNavigate(page, '/ai/admin/knowledge#corrections');
    await page.waitForTimeout(1000);

    // Check if deeplink page loaded or crashed
    const deepLinkCrashed = await page
      .locator('text=Something went wrong')
      .isVisible()
      .catch(() => false);

    if (deepLinkCrashed) {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-8-deeplink-corrections-crash.png`,
        fullPage: true,
      });
      bugs.push('BUG: Deep-linking to #corrections causes 500 error.');
    } else {
      const correctionsTabDeep = page.getByRole('tab', { name: /corrections/i });
      const isActive = await correctionsTabDeep
        .getAttribute('data-state')
        .catch(() => null);

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-8-deeplink-corrections.png`,
        fullPage: true,
      });

      if (isActive === 'active') {
        console.log('Deep-link to #corrections works correctly.');
      } else {
        console.warn('Deep-link to #corrections did not activate Corrections tab.');
      }
    }
    } // end if (canContinue) for step 8

    // ── Summary ────────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(`\nBUGS FOUND (${bugs.length}):\n` + bugs.map((b) => `  - ${b}`).join('\n'));
      // Fail the test to report bugs
      throw new Error(
        `${bugs.length} bug(s) found during tab navigation:\n` +
          bugs.join('\n') +
          '\n\nSteps 1-3 (page load, sidebar, KPI cards) passed. Tab switching had crashes.',
      );
    }
  });
});
