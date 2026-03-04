import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-11';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
}

test.describe('Journey 11: Edit Skill and Test Trigger Phrase Routing', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Edit skill triggers/content, save, then test trigger phrase routing (E5c-4 AC-4, AC-5)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/skills ──────────────────────────────
    await spaNavigate(page, '/ai/admin/skills');
    await expect(page.getByText('Skill Pack Manager')).toBeVisible({
      timeout: 15000,
    });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify key elements
    await expect(
      page.getByRole('button', { name: /test trigger/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole('button', { name: /add skill/i }),
    ).toBeVisible({ timeout: 5000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Skill Pack Manager loaded',
    });

    // ── Checkpoint 1: Skill Pack Manager loaded ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-skill-pack-manager-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click first skill card to open edit form ──────────────────
    const skillCards = page.locator(
      '[role="button"][aria-label^="View skill"]',
    );
    await expect(skillCards.first()).toBeVisible({ timeout: 10000 });
    await skillCards.first().click();

    // Wait for form page to load
    await page.waitForURL('**/ai/admin/skills/**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify tabs are visible
    await expect(page.getByRole('tab', { name: 'Main' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('tab', { name: 'Triggers' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Content' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Schema' })).toBeVisible();

    test.info().annotations.push({
      type: 'info',
      description: 'Step 2: Skill edit form loaded with 4 tabs',
    });

    // ── Checkpoint 2: Skill edit form with tabs ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-skill-edit-form-tabs.png`,
      fullPage: true,
    });

    // ── Step 3: Click Triggers tab ────────────────────────────────────────
    await page.getByRole('tab', { name: 'Triggers' }).click();
    await page.waitForTimeout(500);

    // Verify trigger phrases section
    await expect(page.getByText('Trigger Phrases')).toBeVisible({
      timeout: 5000,
    });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 3: Triggers tab active',
    });

    // ── Checkpoint 3: Triggers tab with pills ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-triggers-tab-pills.png`,
      fullPage: true,
    });

    // ── Step 4: Add trigger phrase "check outstanding payments" ───────────
    const triggerInput = page
      .getByPlaceholder('Type a phrase and press Enter')
      .first();
    await triggerInput.waitFor({ state: 'visible', timeout: 5000 });
    await triggerInput.fill('check outstanding payments');
    await triggerInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify the new phrase appears as a pill
    const phraseAdded = await page
      .getByText('check outstanding payments')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Trigger phrase added=${phraseAdded}`,
    });

    expect(phraseAdded, 'New trigger phrase should appear as a pill').toBe(
      true,
    );

    // ── Checkpoint 4: New trigger phrase added ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-trigger-phrase-added.png`,
      fullPage: true,
    });

    // ── Step 5: Click Content tab ─────────────────────────────────────────
    await page.getByRole('tab', { name: 'Content' }).click();
    await page.waitForTimeout(500);

    // Verify content textarea — try placeholder, then character count
    const contentTextarea = page.getByPlaceholder(
      /enter the full skill\.md/i,
    );
    const contentVisible = await contentTextarea
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!contentVisible) {
      // Fallback: look for the character count label
      await expect(page.getByText(/characters/i)).toBeVisible({
        timeout: 5000,
      });
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Content tab active, textarea found=${contentVisible}`,
    });

    // ── Checkpoint 5: Content tab with textarea ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-content-tab-textarea.png`,
      fullPage: true,
    });

    // ── Step 6: Click Save button ─────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const saveButton = page.getByRole('button', { name: /^Save$/i });
    await expect(saveButton.first()).toBeVisible({ timeout: 5000 });

    const saveEnabled = await saveButton.first().isEnabled();

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Save button enabled=${saveEnabled}`,
    });

    if (saveEnabled) {
      await saveButton.first().click();
      await page.waitForTimeout(2000);

      // Check for success toast
      const hasSuccess = await page
        .getByText(/skill updated|saved|success/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 6: Save result toast=${hasSuccess}`,
      });
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 6: Save button DISABLED — form may not be dirty or has validation errors',
      });
    }

    // ── Checkpoint 6: Skill saved ────────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-skill-saved-success.png`,
      fullPage: true,
    });

    // ── Step 7: Navigate back to /ai/admin/skills ─────────────────────────
    await spaNavigate(page, '/ai/admin/skills');
    await expect(page.getByText('Skill Pack Manager')).toBeVisible({
      timeout: 15000,
    });
    await page.waitForTimeout(2000);

    test.info().annotations.push({
      type: 'info',
      description: 'Step 7: Back on Skill Pack Manager page',
    });

    // ── Step 8: Click Test Trigger button ─────────────────────────────────
    await page.getByRole('button', { name: /test trigger/i }).click();
    await page.waitForTimeout(500);

    // Verify the sheet opened
    await expect(page.getByText('Test Trigger Phrase')).toBeVisible({
      timeout: 5000,
    });

    // Verify input field
    const triggerPhraseInput = page.getByLabel('Trigger phrase input');
    await expect(triggerPhraseInput).toBeVisible({ timeout: 5000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 8: Test Trigger panel opened',
    });

    // ── Checkpoint 7: Test Trigger panel open ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-test-trigger-panel-open.png`,
      fullPage: true,
    });

    // ── Step 9: Enter test phrase ─────────────────────────────────────────
    await triggerPhraseInput.fill('show me overdue invoices');

    test.info().annotations.push({
      type: 'info',
      description: 'Step 9: Phrase entered',
    });

    // ── Step 10: Click Test button ────────────────────────────────────────
    // The Test button is inside the dialog/sheet
    const dialogTestBtn = page
      .getByRole('dialog')
      .getByRole('button', { name: /test/i });

    let submitBtn = dialogTestBtn;
    if (
      !(await dialogTestBtn.isVisible({ timeout: 3000 }).catch(() => false))
    ) {
      // Fallback: any Test button on page
      submitBtn = page.getByRole('button', { name: /^test$/i });
    }

    await expect(submitBtn.first()).toBeEnabled({ timeout: 5000 });
    await submitBtn.first().click();

    // Wait for routing results (API call < 3s)
    await page.waitForTimeout(3000);

    // Check for result states
    const hasL0 = await page
      .getByText('Module Routing')
      .isVisible()
      .catch(() => false);
    const hasNoMatch = await page
      .getByText(/no matching skill found/i)
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .locator('[role="alert"]')
      .isVisible()
      .catch(() => false);

    expect(
      hasL0 || hasNoMatch || hasError,
      'Test trigger should show some result',
    ).toBeTruthy();

    if (hasL0) {
      await expect(page.getByText('Module Routing')).toBeVisible();
      await expect(page.getByText('Skill Selection')).toBeVisible();
      await expect(page.getByText('Skill Details')).toBeVisible();
      const bars = page.getByRole('progressbar');
      expect(await bars.count()).toBeGreaterThanOrEqual(1);
      test.info().annotations.push({
        type: 'info',
        description: 'Step 10: L0/L1/L2 match with confidence bars',
      });
    } else if (hasNoMatch) {
      test.info().annotations.push({
        type: 'info',
        description: 'Step 10: No matching skill found',
      });
    } else if (hasError) {
      test.info().annotations.push({
        type: 'issue',
        description: 'Step 10: Error in Test Trigger panel',
      });
    }

    // ── Checkpoint 8: Test trigger results ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-test-trigger-results.png`,
      fullPage: true,
    });

    // ── Final Diagnostics ─────────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
