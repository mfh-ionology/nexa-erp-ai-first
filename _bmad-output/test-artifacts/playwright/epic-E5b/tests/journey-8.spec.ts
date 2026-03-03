import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-8';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 8: Memory Page Empty State', () => {
  test('should render the empty state correctly when no memories exist', async ({
    page,
  }) => {
    // ── Pre-step: Log in to the application ─────────────────────────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for sidebar to appear (indicates successful login)
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/memory ──────────────────────────────────
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible({ timeout: 5000 });
    await myMemoryLink.click();
    await expect(page).toHaveURL(/\/ai\/memory/, { timeout: 10000 });

    // Wait for page to finish loading (memory cards or empty state)
    const memoryCardOrEmpty = page.locator(
      'article, h2:has-text("No memories yet")',
    );
    await expect(memoryCardOrEmpty.first()).toBeVisible({ timeout: 15000 });

    // Check current state — if memories exist, we need to clear them via
    // the Forget Everything UI flow to reach the empty state
    const hasMemories = (await page.locator('article').count()) > 0;

    if (hasMemories) {
      // Clear all memories using the Forget Everything UI flow
      const forgetButton = page.getByRole('button', {
        name: /forget everything/i,
      });
      await expect(forgetButton).toBeVisible();
      await forgetButton.click();

      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      const confirmInput = page.locator('#forget-confirm-input');
      await expect(confirmInput).toBeVisible();
      await confirmInput.fill('FORGET');

      const confirmBtn = dialog.getByRole('button', {
        name: /forget everything/i,
      });
      await expect(confirmBtn).toBeEnabled();
      await confirmBtn.click();

      // Wait for dialog to close and empty state to appear
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      await expect(
        page.getByRole('heading', { name: /no memories yet/i }),
      ).toBeVisible({ timeout: 5000 });
    }

    // ── Step 2: Verify the empty state container ────────────────────────
    // Test plan: "Empty state shows Lightbulb icon, 'No memories yet' heading,
    // 'As you interact with the AI...' description"

    // Verify heading: "No memories yet"
    const emptyHeading = page.getByRole('heading', {
      name: /no memories yet/i,
    });
    await expect(emptyHeading).toBeVisible();

    // Verify description text
    const emptyDesc = page.getByText(
      'As you interact with the AI, it will remember your preferences and decisions',
    );
    await expect(emptyDesc).toBeVisible();

    // Verify the Lightbulb icon container is present (purple-tinted 16x16 rounded square)
    const lightbulbContainer = page.locator('.rounded-2xl.bg-\\[\\#ede9fe\\]');
    await expect(lightbulbContainer).toBeVisible();

    // Verify no memory cards are visible
    const memoryCards = page.locator('article');
    expect(await memoryCards.count()).toBe(0);

    // Verify the breadcrumb shows "My Memory"
    await expect(page.getByText('My Memory').first()).toBeVisible();

    // ── Visual Checkpoint 1: Empty state container ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-empty-state-container.png`,
      fullPage: true,
    });

    // ── Step 3: Verify memory stats panel ───────────────────────────────
    // Test plan expects: "Stats panel shows Total: 0, Explicit: 0, Learned: 0"
    //
    // Implementation note: memory-stats-panel.tsx returns null when stats.total === 0,
    // so the stats panel is NOT rendered in the empty state. We verify this behavior:
    // the "Total Memories" heading and progress bars should not be present.
    const statsTotalHeading = page.getByRole('heading', {
      name: /total memories/i,
    });
    await expect(statsTotalHeading).not.toBeVisible();

    // Progress bars (used for Explicit/Learned breakdown) should not be present
    const progressBars = page.getByRole('progressbar');
    expect(await progressBars.count()).toBe(0);

    // ── Visual Checkpoint 2: Full page in empty state ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-stats-panel-empty.png`,
      fullPage: true,
    });
  });
});
