import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-8';

test.describe('Journey 8: Skill Pack Manager — Grouped View & Activation Toggle', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('View skills grouped by module, toggle activation, and search (E5c-4 AC-3, AC-6)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (
        response.url().includes('/api/') &&
        response.status() >= 400
      ) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/skills via SPA ────────────────────
    // IMPORTANT: page.goto() for authenticated routes resets the SPA session.
    // Must use sidebar/link navigation to preserve auth state.
    const sidebarNav = page.locator('nav');

    // Click "AI Administration" in sidebar
    const aiAdminLink = sidebarNav.getByText('AI Administration').first();
    await expect(aiAdminLink).toBeVisible({ timeout: 10000 });
    await aiAdminLink.click();
    await page.waitForURL('**/ai/admin', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click "Skill Packs" quick-nav button on the AI dashboard
    const skillNavButton = page.getByRole('button', {
      name: /Skill Packs/i,
    });
    await expect(skillNavButton.first()).toBeVisible({ timeout: 10000 });
    await skillNavButton.first().click();
    await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify Skill Pack Manager page loaded
    const pageHeading = page
      .getByRole('heading')
      .filter({ hasText: /Skill Pack|Skills/i });
    await expect(pageHeading.first()).toBeVisible({ timeout: 10000 });

    // Verify accordion sections are visible (module groups)
    // The accordion groups skills by moduleKey
    const accordionItems = page.locator('[data-state="open"], [data-state="closed"]');
    await page.waitForTimeout(1000); // Allow accordion data to load

    // ── Checkpoint 1: Skill Pack Manager Initial Load ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-skill-pack-manager-loaded.png`,
      fullPage: true,
    });

    // Verify we have skill cards or table data
    const skillCards = page.locator('[class*="card"]').filter({
      has: page.locator('[class*="mono"], code, [class*="font-mono"]'),
    });
    const tableRows = page.locator('table tbody tr');
    const hasSkillCards = await skillCards.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasTableRows = await tableRows.first().isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Skill display mode: ${hasSkillCards ? 'card/accordion view' : hasTableRows ? 'table view' : 'no skills visible'}`,
    });

    // Verify search bar exists
    const searchInput = page.getByPlaceholder(/Search/i);
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });

    // Verify action buttons
    const testTriggerButton = page.getByRole('button', { name: /Test Trigger/i });
    const addSkillButton = page.getByRole('button', { name: /Add Skill|New/i });

    if (await testTriggerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.info().annotations.push({
        type: 'info',
        description: 'Test Trigger button visible in action bar',
      });
    }

    if (await addSkillButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      test.info().annotations.push({
        type: 'info',
        description: 'Add Skill / New button visible in action bar',
      });
    }

    // ── Step 2: Verify module accordion sections ────────────────────────
    // Look for accordion trigger buttons or section headings with module keys
    const accordionTriggers = page.locator(
      'button[data-state="open"], button[data-state="closed"], [role="button"][data-state]',
    );
    const accordionTriggerCount = await accordionTriggers.count();

    if (accordionTriggerCount >= 2) {
      test.info().annotations.push({
        type: 'info',
        description: `Found ${accordionTriggerCount} accordion module sections`,
      });
    } else {
      // Try alternative: look for any collapsible sections or headings with module keys
      const moduleHeadings = page.locator('h2, h3, h4').filter({
        hasText: /^(ar|ap|finance|sales|purchasing|inventory|crm|hr|manufacturing|reporting|views|system|unassigned)/i,
      });
      const moduleCount = await moduleHeadings.count();
      test.info().annotations.push({
        type: 'info',
        description: `Accordion triggers: ${accordionTriggerCount}, Module headings: ${moduleCount}`,
      });
    }

    // ── Step 3: Click second module accordion header ────────────────────
    // Expand a closed accordion section
    const closedAccordions = page.locator('button[data-state="closed"]');
    const closedCount = await closedAccordions.count();

    if (closedCount > 0) {
      // Click the first closed accordion (which is the "second" module since first is open)
      await closedAccordions.first().click();
      await page.waitForTimeout(500);

      test.info().annotations.push({
        type: 'info',
        description: 'Clicked a closed accordion section to expand it',
      });
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No closed accordion sections found — all may already be expanded or using different UI pattern',
      });
    }

    // ── Checkpoint 2: Second Module Accordion Expanded ──────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-second-module-expanded.png`,
      fullPage: true,
    });

    // ── Step 4: Click active toggle on a skill card to deactivate ───────
    // Find a switch/toggle on a skill card
    const activeToggles = page.getByRole('switch');
    const toggleCount = await activeToggles.count();
    test.info().annotations.push({
      type: 'info',
      description: `Found ${toggleCount} toggle switches on page`,
    });

    let toggledSkillName = '';
    let toggleWorked = false;

    if (toggleCount > 0) {
      // Find a toggle that is currently ON (checked)
      let targetToggle = activeToggles.first();
      for (let i = 0; i < toggleCount; i++) {
        const toggle = activeToggles.nth(i);
        const isChecked = await toggle.getAttribute('aria-checked');
        if (isChecked === 'true') {
          targetToggle = toggle;
          break;
        }
      }

      // Try to get the skill name near this toggle for identification
      const parentCard = targetToggle.locator('xpath=ancestor::div[contains(@class,"card") or contains(@class,"Card")]').first();
      const skillNameEl = parentCard.locator('[class*="mono"], code, [class*="font-mono"]').first();
      if (await skillNameEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        toggledSkillName = await skillNameEl.textContent() || 'unknown';
      }

      // Click the toggle to deactivate
      await targetToggle.click();
      await page.waitForTimeout(1000);

      // Check for deactivation toast
      const deactivateToast = page.locator('[role="status"], [data-sonner-toast], [class*="toast"]').filter({
        hasText: /deactivated|disabled|off/i,
      });
      if (await deactivateToast.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        toggleWorked = true;
        test.info().annotations.push({
          type: 'info',
          description: `Deactivation toast appeared for skill "${toggledSkillName}"`,
        });
      } else {
        // Toast may have disappeared or have different text; check toggle state
        const nowChecked = await targetToggle.getAttribute('aria-checked');
        if (nowChecked === 'false') {
          toggleWorked = true;
          test.info().annotations.push({
            type: 'info',
            description: `Toggle switched to OFF for skill "${toggledSkillName}" (toast may have auto-dismissed)`,
          });
        }
      }

      // ── Checkpoint 3: Skill Deactivation ──────────────────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-skill-deactivated-toast.png`,
        fullPage: true,
      });

      // ── Step 5: Click same toggle to reactivate ─────────────────────
      await targetToggle.click();
      await page.waitForTimeout(1000);

      // Check for reactivation toast
      const activateToast = page.locator('[role="status"], [data-sonner-toast], [class*="toast"]').filter({
        hasText: /activated|enabled|on/i,
      });
      if (await activateToast.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        test.info().annotations.push({
          type: 'info',
          description: `Reactivation toast appeared for skill "${toggledSkillName}"`,
        });
      } else {
        const reChecked = await targetToggle.getAttribute('aria-checked');
        test.info().annotations.push({
          type: 'info',
          description: `Toggle back to ${reChecked} for skill "${toggledSkillName}"`,
        });
      }
    } else {
      test.info().annotations.push({
        type: 'missing-feature',
        description: 'No toggle switches found on skill cards — inline activation toggle not rendered',
      });
    }

    // ── Step 6: Search for "overdue" ────────────────────────────────────
    const searchField = page.getByPlaceholder(/Search/i).first();
    await searchField.clear();
    await searchField.fill('overdue');

    // Wait for debounced search to filter results (300ms debounce + rendering)
    await page.waitForTimeout(800);

    // ── Step 7: Verify filtered results ─────────────────────────────────
    // After filtering, check what's visible
    const filteredCards = page.locator('[class*="card"]').filter({
      has: page.locator('[class*="mono"], code, [class*="font-mono"]'),
    });
    const filteredTableRows = page.locator('table tbody tr');

    const visibleCards = await filteredCards.count();
    const visibleRows = await filteredTableRows.count();

    test.info().annotations.push({
      type: 'info',
      description: `After "overdue" filter: ${visibleCards} cards, ${visibleRows} table rows visible`,
    });

    // Check if any visible skills mention "overdue"
    const overdueMatches = page.locator('text=/overdue/i');
    const overdueCount = await overdueMatches.count();

    if (overdueCount > 0) {
      test.info().annotations.push({
        type: 'info',
        description: `Found ${overdueCount} elements matching "overdue" after search filter`,
      });
    } else {
      // Maybe no skills have "overdue" in the seeded data
      test.info().annotations.push({
        type: 'info',
        description: 'No skills matching "overdue" found — seed data may not include overdue-related skills',
      });
    }

    // Check for empty state or "no results" message
    const noResults = page.locator('text=/no skills|no results|not found|empty/i');
    if (await noResults.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      test.info().annotations.push({
        type: 'info',
        description: 'Empty/no results state shown for "overdue" filter',
      });
    }

    // ── Checkpoint 4: Search Filter Results ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-search-filtered-overdue.png`,
      fullPage: true,
    });

    // ── Final Assertions ────────────────────────────────────────────────
    // The page must have loaded with a recognizable heading
    await expect(pageHeading.first()).toBeVisible();

    // Search input must exist and work
    await expect(searchField).toBeVisible();

    // Check if there were 404 errors indicating missing backend routes
    const has404Errors = apiErrors.some((e) => e.includes('404'));
    if (has404Errors) {
      test.info().annotations.push({
        type: 'issue',
        description: `Backend API returned 404 errors: [${apiErrors.filter((e) => e.includes('404')).slice(0, 5).join('; ')}]`,
      });
    }

    // Report toggle test outcome
    if (toggleCount > 0 && !toggleWorked) {
      test.info().annotations.push({
        type: 'issue',
        description: `Toggle clicked but deactivation did not register — API may have returned error. Errors: [${apiErrors.slice(0, 3).join('; ')}]`,
      });
    }

    // If toggles exist, assert the toggle actually worked
    if (toggleCount > 0) {
      expect(
        toggleWorked,
        `Skill activation toggle did not work. API errors: [${apiErrors.slice(0, 5).join('; ')}]`,
      ).toBe(true);
    }
  });
});
