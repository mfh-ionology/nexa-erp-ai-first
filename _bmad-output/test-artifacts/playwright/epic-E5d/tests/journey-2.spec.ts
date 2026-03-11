import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-2';

/** Track bugs found during test execution */
const bugs: string[] = [];

/**
 * SPA navigate without losing auth tokens (Zustand in-memory).
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
 * Login and navigate to Knowledge Management page.
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

  await spaNavigate(page, '/ai/admin/knowledge');

  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe('Journey 2: Knowledge Articles Tab — List View & Category Grouping', () => {
  test.setTimeout(120_000);

  test('Articles display grouped by category with badges, confidence indicators, source labels, and action buttons', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge ────────────────────────
    await loginAndNavigateToKnowledge(page);

    // Verify Knowledge Articles tab is active by default
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Checkpoint 1: Articles Tab Initial Load
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-articles-tab-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify article category accordion sections ─────────────
    // Check if page crashed
    const hasCrashed = await page
      .locator('text=Something went wrong')
      .isVisible()
      .catch(() => false);

    if (hasCrashed) {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-crash-500.png`,
        fullPage: true,
      });
      bugs.push('BUG: Knowledge Articles tab shows 500 error on load.');
      // Cannot continue if the tab content crashed
      throw new Error(
        'Knowledge Articles tab crashed with 500 error. Cannot verify article list.\n' +
          bugs.join('\n'),
      );
    }

    // Look for category accordion sections
    const expectedCategories = [
      'Business Processes',
      'Terminology',
      'Industry Rules',
      'Custom Fields',
      'Historical Patterns',
    ];

    const foundCategories: string[] = [];
    for (const category of expectedCategories) {
      // Category headers may be in accordion trigger buttons or headings
      const categoryElement = page.getByText(new RegExp(category, 'i'));
      const isVisible = await categoryElement.first().isVisible().catch(() => false);
      if (isVisible) {
        foundCategories.push(category);
      } else {
        bugs.push(`BUG: Category section "${category}" not visible in articles tab.`);
      }
    }

    console.log(`Found ${foundCategories.length}/5 category sections: ${foundCategories.join(', ')}`);

    // Check that first 3 sections are expanded by default (they should have data-state="open")
    for (let i = 0; i < 3 && i < foundCategories.length; i++) {
      const categoryName = foundCategories[i];
      const trigger = page
        .locator('button[data-state]')
        .filter({ hasText: new RegExp(categoryName, 'i') });
      const state = await trigger.first().getAttribute('data-state').catch(() => null);
      if (state && state !== 'open') {
        bugs.push(
          `BUG: Category "${categoryName}" (position ${i + 1}) should be expanded by default but has data-state="${state}".`,
        );
      }
    }

    // Checkpoint 2: Category Accordion Sections
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-category-accordion-sections.png`,
      fullPage: true,
    });

    // ── Step 3: Verify article card badges and indicators ──────────────
    // Look for article cards — they should be within the expanded category sections
    // Check for source badges (any of the 4 types)
    const sourceBadgeTexts = ['Admin', 'AI Generated', 'Platform', 'From Corrections'];
    let foundAnySourceBadge = false;
    for (const badgeText of sourceBadgeTexts) {
      const badge = page.getByText(new RegExp(badgeText, 'i'));
      if (await badge.first().isVisible().catch(() => false)) {
        foundAnySourceBadge = true;
        console.log(`Found source badge: ${badgeText}`);
        break;
      }
    }
    if (!foundAnySourceBadge) {
      bugs.push('BUG: No source badges (Admin/AI Generated/Platform/From Corrections) visible on any article card.');
    }

    // Check for confidence score indicators (percentage like "85%" or "100%")
    const confidenceIndicator = page.locator('[class*="confidence"], [aria-label*="confidence"]');
    let foundConfidence = await confidenceIndicator.first().isVisible().catch(() => false);
    if (!foundConfidence) {
      // Fallback: look for percentage text patterns in article area
      const percentText = page.locator('text=/\\d+%/');
      foundConfidence = await percentText.first().isVisible().catch(() => false);
    }
    if (!foundConfidence) {
      bugs.push('BUG: No confidence score indicators visible on article cards.');
    }

    // Check for chunk count display (e.g., "3 chunks" or just a number with chunks label)
    const chunkText = page.getByText(/chunk/i);
    const foundChunks = await chunkText.first().isVisible().catch(() => false);
    if (!foundChunks) {
      bugs.push('BUG: No chunk count visible on article cards.');
    }

    // Check for usage count (e.g., "Used 5 times" or "0 uses")
    const usageText = page.getByText(/used|uses|usage/i);
    const foundUsage = await usageText.first().isVisible().catch(() => false);
    if (!foundUsage) {
      bugs.push('BUG: No usage count visible on article cards.');
    }

    // Check for active toggle switch on article cards
    const toggleSwitch = page.locator('button[role="switch"]');
    const foundToggle = await toggleSwitch.first().isVisible().catch(() => false);
    if (!foundToggle) {
      bugs.push('BUG: No isActive toggle switch visible on article cards.');
    }

    // Check for overflow menu (three dots / ellipsis button)
    const overflowMenu = page.locator(
      'button[aria-label*="more"], button[aria-label*="menu"], button[aria-label*="option"], [data-testid*="overflow"], [data-testid*="menu"]',
    );
    let foundOverflow = await overflowMenu.first().isVisible().catch(() => false);
    if (!foundOverflow) {
      // Fallback: look for ellipsis icon buttons
      const ellipsisBtn = page.locator('button:has(svg)').filter({ hasText: '' });
      // Try a broader approach — just check for any small icon button near article cards
      foundOverflow = await page
        .locator('[class*="overflow"], [class*="more-menu"]')
        .first()
        .isVisible()
        .catch(() => false);
    }

    // Checkpoint 3: Article Card Detail
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-article-card-detail.png`,
      fullPage: true,
    });

    // ── Step 4: Verify unconfirmed article "Needs Review" badge ────────
    const needsReviewBadge = page.getByText(/needs review/i);
    const foundNeedsReview = await needsReviewBadge.first().isVisible().catch(() => false);

    if (!foundNeedsReview) {
      console.log(
        'No "Needs Review" badges visible — may be expected if all articles are confirmed.',
      );
    } else {
      console.log('"Needs Review" badge found on unconfirmed article(s).');
    }

    // Checkpoint 4: Needs Review Badge
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-needs-review-badge.png`,
      fullPage: true,
    });

    // ── Step 5: Verify action bar buttons ──────────────────────────────
    // "Upload Document" button (primary purple)
    const uploadBtn = page.getByRole('button', { name: /upload document/i });
    const foundUpload = await uploadBtn.isVisible().catch(() => false);
    if (!foundUpload) {
      bugs.push('BUG: "Upload Document" button not visible in action bar.');
    }

    // "Create Article" button (outline)
    const createBtn = page.getByRole('button', { name: /create article/i });
    const foundCreate = await createBtn.isVisible().catch(() => false);
    if (!foundCreate) {
      bugs.push('BUG: "Create Article" button not visible in action bar.');
    }

    console.log(`Upload Document button visible: ${foundUpload}`);
    console.log(`Create Article button visible: ${foundCreate}`);

    // Checkpoint 4: Action Bar Buttons
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-action-bar-buttons.png`,
      fullPage: true,
    });

    // ── Summary ────────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` +
          bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found during Journey 2:\n` + bugs.join('\n'),
      );
    }
  });
});
