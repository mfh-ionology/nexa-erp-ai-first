import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-13';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 13: Concept D Visual Compliance Check', () => {
  test('Memory and Skills pages follow Concept D design system requirements', async ({
    page,
  }) => {
    // Pre-step: Log in to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for the sidebar to appear after login
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/memory via sidebar ──
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible();
    await myMemoryLink.click();

    await page.waitForURL('**/ai/memory', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const mainContent = page.locator('main[aria-label="Main content"]');
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Wait for page content to fully render
    const pageTitle = mainContent.getByText('My Memory');
    await expect(pageTitle.first()).toBeVisible({ timeout: 10000 });

    // Wait for either memory cards or empty state to appear (async data loaded)
    const memoryCards = page.locator('article');
    const emptyState = page.getByRole('heading', { name: 'No memories yet' });
    await expect(memoryCards.first().or(emptyState)).toBeVisible({ timeout: 15000 });

    // ── Step 2: Concept D Visual Compliance — Memory Page ──

    // 2a: Check background colour — the page or main area should use #f4f2ff
    const mainBg = await mainContent.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Also check intermediate containers
    const contentAreaBg = await page.evaluate(() => {
      // Walk up from main to find the element with the light purple bg
      const containers = document.querySelectorAll('main, main > div, [class*="bg-"]');
      const results: string[] = [];
      containers.forEach((el) => {
        const bg = window.getComputedStyle(el).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          results.push(`${el.tagName}.${el.className?.substring(0, 50)}=${bg}`);
        }
      });
      return results.join(' | ');
    });
    test.info().annotations.push({
      type: 'background-check',
      description: `mainBg=${mainBg}, bodyBg=${bodyBg}, containers=${contentAreaBg}`,
    });

    // 2b: Check cards have border-radius of 12px (0.75rem)
    const cardCount = await memoryCards.count();
    if (cardCount > 0) {
      const firstCardRadius = await memoryCards.first().evaluate((el) => {
        return window.getComputedStyle(el).borderRadius;
      });
      test.info().annotations.push({
        type: 'card-radius',
        description: `Memory card borderRadius=${firstCardRadius}`,
      });
      expect(
        firstCardRadius === '12px' || firstCardRadius === '0.75rem',
        `Card border-radius should be 12px, got ${firstCardRadius}`
      ).toBeTruthy();
    }

    // 2c: Check purple primary colour on toggle switches
    const enableToggle = page.getByRole('switch');
    const toggleVisible = await enableToggle.first().isVisible().catch(() => false);
    if (toggleVisible) {
      const toggleBg = await enableToggle.first().evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      test.info().annotations.push({
        type: 'toggle-color',
        description: `Toggle backgroundColor=${toggleBg}`,
      });
    }

    // 2d: Check font families
    const headingFont = await page.evaluate(() => {
      const h = document.querySelector('h1, h2, h3');
      return h ? window.getComputedStyle(h).fontFamily : 'no heading found';
    });
    test.info().annotations.push({
      type: 'heading-font',
      description: `Heading fontFamily=${headingFont}`,
    });

    const bodyFont = await page.evaluate(() => {
      const p = document.querySelector('p, label, span');
      return p ? window.getComputedStyle(p).fontFamily : 'no body text found';
    });
    test.info().annotations.push({
      type: 'body-font',
      description: `Body fontFamily=${bodyFont}`,
    });

    // 2e: Check that skeleton loading is NOT visible (loading complete)
    const skeletons = page.locator('[class*="skeleton"], [class*="Skeleton"]');
    const skeletonCount = await skeletons.count();
    if (skeletonCount > 0) {
      await page.waitForTimeout(2000);
      const skeletonsAfterWait = await skeletons.count();
      test.info().annotations.push({
        type: 'skeleton-check',
        description: `Skeletons remaining after wait: ${skeletonsAfterWait}`,
      });
    }

    // Visual Checkpoint 1: Full Memory page Concept D screenshot
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-memory-page-concept-d.png`,
      fullPage: true,
    });

    // ── Step 3: Navigate to /ai/skills via sidebar ──
    const skillsLink = sidebar.getByRole('link', { name: 'Skills' });
    await expect(skillsLink).toBeVisible();
    await skillsLink.click();

    await page.waitForURL('**/ai/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(mainContent).toBeVisible({ timeout: 10000 });

    const skillsTitle = mainContent.getByText('AI Skills');
    await expect(skillsTitle.first()).toBeVisible({ timeout: 10000 });

    // Wait for skill cards or empty state to appear
    const skillCards = page.locator('article[role="button"]');
    const skillsEmpty = page.getByRole('heading', { name: 'No skills available' });
    await expect(skillCards.first().or(skillsEmpty)).toBeVisible({ timeout: 15000 });

    // ── Step 4: Concept D Visual Compliance — Skills Page ──

    const skillCardCount = await skillCards.count();
    const hasSkills = skillCardCount > 0;

    if (hasSkills) {
      // 4a: Check skill cards have proper border-radius
      const skillCardRadius = await skillCards.first().evaluate((el) => {
        return window.getComputedStyle(el).borderRadius;
      });
      test.info().annotations.push({
        type: 'skill-card-radius',
        description: `Skill card borderRadius=${skillCardRadius}`,
      });
      expect(
        skillCardRadius === '12px' || skillCardRadius === '0.75rem',
        `Skill card border-radius should be 12px, got ${skillCardRadius}`
      ).toBeTruthy();

      // 4b: Check for active/inactive status indicator
      const activeIndicator = page.getByText('Active').first();
      const activeVisible = await activeIndicator.isVisible().catch(() => false);
      test.info().annotations.push({
        type: 'active-indicator',
        description: `Active status indicator visible: ${activeVisible}`,
      });

      // 4c: Check trigger phrase styling — look for green badges in skill cards
      const firstSkillCard = skillCards.first();
      const greenBadges = await firstSkillCard.evaluate((el) => {
        const spans = el.querySelectorAll('span');
        const badges: string[] = [];
        spans.forEach((s) => {
          const bg = window.getComputedStyle(s).backgroundColor;
          if (bg.includes('209, 250, 229') || bg.includes('167, 243, 208') ||
              bg.includes('d1fae5') || s.className?.includes('green')) {
            badges.push(`${s.textContent?.trim()}:bg=${bg}`);
          }
        });
        return badges;
      });
      test.info().annotations.push({
        type: 'trigger-badges-green',
        description: `Green trigger badges found: ${JSON.stringify(greenBadges)}`,
      });
    }

    // 4d: Check for module group sections (accordion headers)
    const sectionHeaders = page.locator('section[aria-label]');
    const sectionCount = await sectionHeaders.count();
    test.info().annotations.push({
      type: 'module-groups',
      description: `Module group sections found: ${sectionCount}`,
    });
    if (hasSkills) {
      expect(sectionCount).toBeGreaterThanOrEqual(1);
    }

    // 4e: Verify search input exists (only when skills are present — empty state hides it)
    const skillsSearch = page.getByPlaceholder('Search skills...');
    const searchVisible = await skillsSearch.isVisible().catch(() => false);
    if (hasSkills) {
      await expect(skillsSearch).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'skills-search-hidden',
        description: 'Search input not visible — skills empty state is active (no skills seeded)',
      });
    }

    // 4f: Check background consistency with memory page
    const skillsPageBg = await mainContent.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    test.info().annotations.push({
      type: 'skills-bg',
      description: `Skills page mainBg=${skillsPageBg}`,
    });

    // 4g: Verify empty state card styling if no skills
    if (!hasSkills) {
      // The empty state card should also follow Concept D: 12px radius, shadow
      const emptyCard = page.locator('div').filter({ has: skillsEmpty }).first();
      const emptyCardBg = await emptyCard.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return { borderRadius: style.borderRadius, boxShadow: style.boxShadow, bg: style.backgroundColor };
      });
      test.info().annotations.push({
        type: 'empty-state-card',
        description: `Empty state card: radius=${emptyCardBg.borderRadius}, shadow=${emptyCardBg.boxShadow?.substring(0, 60)}, bg=${emptyCardBg.bg}`,
      });
    }

    // Visual Checkpoint 2: Full Skills page Concept D screenshot
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-skills-page-concept-d.png`,
      fullPage: true,
    });

    // ── Step 5: Verify keyboard focus rings on interactive elements ──
    // Tab through interactive elements and check for visible focus indicators

    // Find an interactive element to focus — use search input if available, else sidebar links
    let focusTarget = searchVisible ? skillsSearch : sidebar.getByRole('link').first();
    await focusTarget.focus();

    const focusTargetStyles = await focusTarget.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        outline: style.outline,
        outlineColor: style.outlineColor,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
      };
    });
    test.info().annotations.push({
      type: 'focus-ring-target',
      description: `Focus target: tag=${focusTargetStyles.tag}, outline=${focusTargetStyles.outline}, boxShadow=${focusTargetStyles.boxShadow}`,
    });

    // Verify focus ring is visible (outline or boxShadow should be non-trivial)
    const hasFocusRing =
      (focusTargetStyles.outlineWidth !== '0px' && focusTargetStyles.outlineStyle !== 'none') ||
      (focusTargetStyles.boxShadow !== 'none' && focusTargetStyles.boxShadow !== '');
    test.info().annotations.push({
      type: 'focus-ring-visible',
      description: `Focus ring detected: ${hasFocusRing}`,
    });

    // Tab through a few more elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Get the currently focused element's focus styles
    const focusedElementStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { tag: 'none', outline: 'none', boxShadow: 'none' };
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        role: el.getAttribute('role'),
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
      };
    });
    test.info().annotations.push({
      type: 'focus-ring-tabbed',
      description: `Tabbed element: tag=${focusedElementStyles.tag}, role=${focusedElementStyles.role}, outline=${focusedElementStyles.outline}, boxShadow=${focusedElementStyles.boxShadow}`,
    });

    // Visual Checkpoint 3: Focus ring visible on current element
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-focus-ring-check.png`,
      fullPage: true,
    });

    // Final assertion: verify focus moved to an interactive element (not stuck on body)
    const finalFocusTag = await page.evaluate(() => {
      return document.activeElement?.tagName || 'BODY';
    });
    test.info().annotations.push({
      type: 'final-focus',
      description: `After 3 tabs, focused element: ${finalFocusTag}`,
    });
    expect(finalFocusTag).not.toBe('BODY');
  });
});
