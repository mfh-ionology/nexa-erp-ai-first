import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-9';

test.describe('Journey 9: Skill Edit Form & Test Trigger Panel', () => {
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

  test('Edit skill form tabs and test trigger routing (E5c-4 AC-4, AC-5)', async ({
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

    // ── Step 1: Navigate to /ai/admin/skills via sidebar ─────────────────
    // IMPORTANT: Never use page.goto() for authenticated routes — it resets SPA session.
    // Use sidebar navigation → AI Administration → dashboard quick-nav button.
    const sidebarNav = page.locator('nav');

    // Click "AI Administration" in sidebar
    const aiAdminLink = sidebarNav.getByText('AI Administration').first();
    await expect(aiAdminLink).toBeVisible({ timeout: 10000 });
    await aiAdminLink.click();
    await page.waitForURL('**/ai/admin', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click "Skill Packs" quick-nav button on the AI dashboard
    const skillNavButton = page.getByRole('button', { name: /Skill Packs/i });
    await expect(skillNavButton.first()).toBeVisible({ timeout: 15000 });
    await skillNavButton.first().click();
    await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify Skill Pack Manager page loaded
    const pageHeading = page
      .getByRole('heading')
      .filter({ hasText: /Skill Pack|Skills/i });
    await expect(pageHeading.first()).toBeVisible({ timeout: 10000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Skill Pack Manager loaded',
    });

    // ── Step 2: Check if skills exist, then click first card ─────────────
    // Skill cards have role="button" and aria-label="View skill {displayName}"
    await page.waitForTimeout(2000); // Allow data to load

    const skillCards = page.locator('[role="button"][aria-label^="View skill"]');
    const noSkillsMessage = page.locator('text=/No skills found/i');
    const cardCount = await skillCards.count();
    const hasNoSkills = await noSkillsMessage.isVisible({ timeout: 2000 }).catch(() => false);

    let clickedSkill = false;
    let skillName = '';
    let mainVisible = false;
    let triggersVisible = false;
    let contentVisible = false;
    let schemaVisible = false;

    if (hasNoSkills || cardCount === 0) {
      // No skills seeded — record this as missing test data
      test.info().annotations.push({
        type: 'missing-feature',
        description: `Step 2: No skills found in database (cards: ${cardCount}, noSkillsMsg: ${hasNoSkills}). Cannot test skill edit form. Skill seed data from E5/E5b not present for this tenant.`,
      });

      // ── Checkpoint 1: Skills Empty State ──────────────────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-skill-edit-form.png`,
        fullPage: true,
      });
    } else {
      // Skills exist — click the first one
      const ariaLabel = (await skillCards.first().getAttribute('aria-label')) || '';
      skillName = ariaLabel.replace('View skill ', '');
      await skillCards.first().click();
      clickedSkill = true;

      await page.waitForURL('**/ai/admin/skills/**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      test.info().annotations.push({
        type: 'info',
        description: `Step 2: Opened skill edit form for "${skillName.trim()}"`,
      });

      // Verify tabs: Main, Triggers, Content, Schema
      const tabsList = page.getByRole('tablist');
      await expect(tabsList.first()).toBeVisible({ timeout: 10000 });

      const mainTab = page.getByRole('tab', { name: /Main/i });
      const triggersTab = page.getByRole('tab', { name: /Trigger/i });
      const contentTab = page.getByRole('tab', { name: /Content/i });
      const schemaTab = page.getByRole('tab', { name: /Schema/i });

      mainVisible = await mainTab.isVisible({ timeout: 3000 }).catch(() => false);
      triggersVisible = await triggersTab.isVisible({ timeout: 3000 }).catch(() => false);
      contentVisible = await contentTab.isVisible({ timeout: 3000 }).catch(() => false);
      schemaVisible = await schemaTab.isVisible({ timeout: 3000 }).catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Tabs: Main=${mainVisible}, Triggers=${triggersVisible}, Content=${contentVisible}, Schema=${schemaVisible}`,
      });

      // ── Checkpoint 1: Skill Edit Form ──────────────────────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-skill-edit-form.png`,
        fullPage: true,
      });

      // ── Step 3: Click Triggers tab ─────────────────────────────────────
      if (triggersVisible) {
        await triggersTab.click();
        await page.waitForTimeout(500);

        const bluePills = page.locator('.bg-blue-50');
        const redPills = page.locator('.bg-red-50');

        test.info().annotations.push({
          type: 'info',
          description: `Step 3: Triggers tab — blue pills: ${await bluePills.count()}, red pills: ${await redPills.count()}`,
        });

        // ── Checkpoint 2: Triggers Tab ────────────────────────────────────
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-3-triggers-tab.png`,
          fullPage: true,
        });
      }

      // ── Step 4: Click Content tab ──────────────────────────────────────
      if (contentVisible) {
        await contentTab.click();
        await page.waitForTimeout(500);

        const contentTextarea = page.locator('textarea');
        const hasTextarea = await contentTextarea.first().isVisible({ timeout: 5000 }).catch(() => false);

        if (hasTextarea) {
          const val = await contentTextarea.first().inputValue();
          test.info().annotations.push({
            type: 'info',
            description: `Step 4: Content tab textarea — ${val.length} chars`,
          });
        }

        // ── Checkpoint 3: Content Tab ─────────────────────────────────────
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-4-content-tab.png`,
          fullPage: true,
        });
      }

      // ── Step 5: Navigate back to Skill Pack Manager ────────────────────
      const breadcrumbLink = page.getByRole('link', { name: /AI Administration/i });
      const backButton = page.getByRole('button', { name: /Back|Cancel/i });

      if (await breadcrumbLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click AI Administration breadcrumb → then navigate to skills again
        await breadcrumbLink.first().click();
        await page.waitForURL('**/ai/admin', { timeout: 10000 });
        await page.waitForLoadState('networkidle');

        // Navigate back to skills via quick-nav
        const skillBtn = page.getByRole('button', { name: /Skill Packs/i });
        await expect(skillBtn.first()).toBeVisible({ timeout: 10000 });
        await skillBtn.first().click();
        await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
      } else if (await backButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await backButton.first().click();
        await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
      } else {
        await page.goBack();
        await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
      }

      await page.waitForLoadState('networkidle');
      await expect(pageHeading.first()).toBeVisible({ timeout: 10000 });

      test.info().annotations.push({
        type: 'info',
        description: 'Step 5: Navigated back to Skill Pack Manager',
      });
    }

    // ── Step 6: Click Test Trigger button ────────────────────────────────
    // This can be tested even without skills — the panel is independent
    const testTriggerButton = page.getByRole('button', { name: /Test Trigger/i });
    const hasTestTriggerBtn = await testTriggerButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTestTriggerBtn) {
      await testTriggerButton.click();
      await page.waitForTimeout(500);

      // Verify Sheet panel opened (shadcn Sheet renders as role="dialog")
      const sheetContent = page.locator('[role="dialog"]');
      const sheetVisible = await sheetContent.first().isVisible({ timeout: 5000 }).catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 6: Test Trigger clicked — dialog visible=${sheetVisible}`,
      });

      // ── Checkpoint 4: Test Trigger Panel Open ───────────────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-test-trigger-panel.png`,
        fullPage: true,
      });

      // ── Step 7: Fill trigger phrase ─────────────────────────────────────
      const phraseInput = page.getByPlaceholder(/phrase|trigger|type/i);
      const dialogInput = sheetContent.first().locator('input[type="text"], input:not([type])');

      let filledPhrase = false;

      if (await phraseInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await phraseInput.first().fill('show me overdue invoices');
        filledPhrase = true;
      } else if (await dialogInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await dialogInput.first().fill('show me overdue invoices');
        filledPhrase = true;
      }

      test.info().annotations.push({
        type: 'info',
        description: `Step 7: Phrase input filled=${filledPhrase}`,
      });

      // ── Step 8: Click Test / Run button ────────────────────────────────
      if (filledPhrase) {
        const testButton = sheetContent.first().getByRole('button', { name: /^Test$|Run|Route/i });
        const fallbackBtn = page.getByRole('button', { name: /^Test$|Run|Route/i });

        let clickedTestBtn = false;

        if (await testButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await testButton.first().click();
          clickedTestBtn = true;
        } else if (await fallbackBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await fallbackBtn.first().click();
          clickedTestBtn = true;
        }

        if (clickedTestBtn) {
          // Wait for results (API call + rendering)
          await page.waitForTimeout(3000);

          // TestTriggerPanel renders ConfidenceBar with role="progressbar"
          const confidenceBars = page.locator('[role="progressbar"]');
          const noMatchWarning = page.locator('text=/No match|No skill|not found|no results/i');

          const confidenceCount = await confidenceBars.count();
          const hasNoMatch = await noMatchWarning.first().isVisible({ timeout: 3000 }).catch(() => false);

          test.info().annotations.push({
            type: 'info',
            description: `Step 8: Results — confidence bars: ${confidenceCount}, no-match: ${hasNoMatch}`,
          });

          if (confidenceCount === 0 && !hasNoMatch) {
            const spinner = page.locator('[class*="animate-spin"]');
            const isLoading = await spinner.first().isVisible({ timeout: 2000 }).catch(() => false);
            test.info().annotations.push({
              type: 'issue',
              description: `No trigger test results after 3s. Loading=${isLoading}. Errors: [${apiErrors.slice(-3).join('; ')}]`,
            });
          }

          // ── Checkpoint 5: Trigger Test Results ────────────────────────────
          await page.screenshot({
            path: `${SCREENSHOTS_DIR}/step-8-trigger-test-results.png`,
            fullPage: true,
          });
        } else {
          test.info().annotations.push({
            type: 'missing-feature',
            description: 'Step 8: Test/Run button not found inside trigger panel',
          });
        }
      } else {
        test.info().annotations.push({
          type: 'missing-feature',
          description: 'Step 7: Could not find input field in test trigger panel',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'missing-feature',
        description: 'Step 6: Test Trigger button not visible on Skill Pack Manager page',
      });
    }

    // ── Close any open dialogs before final assertions ─────────────────
    // The Test Trigger Sheet adds aria-hidden to background, hiding headings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ── Final Assertions ────────────────────────────────────────────────
    // The Skill Pack Manager page must be the current route
    await expect(page).toHaveURL(/\/ai\/admin\/skills/);

    // If skills existed, tabs should have been visible on the edit form
    if (clickedSkill) {
      expect(
        mainVisible || triggersVisible || contentVisible,
        'At least one expected tab (Main, Triggers, Content) should be visible',
      ).toBe(true);
    }

    // Test Trigger button should always exist on the Skill Pack Manager
    expect(hasTestTriggerBtn, 'Test Trigger button should be visible on Skill Pack Manager').toBe(true);

    if (apiErrors.length > 0) {
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: [${apiErrors.slice(0, 5).join('; ')}]`,
      });
    }
  });
});
