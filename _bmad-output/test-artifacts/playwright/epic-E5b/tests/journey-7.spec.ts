import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-7';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 7: Forget Everything — Destructive Action', () => {
  test('should require typing FORGET to confirm and clear all memories', async ({
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

    // Check if we have memories to delete
    const hasMemories = (await page.locator('article').count()) > 0;

    // ── Visual Checkpoint 1: Memory page loaded ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-memory-page-loaded.png`,
      fullPage: true,
    });

    if (!hasMemories) {
      // PREREQUISITE NOT MET: No seed data. Document and skip gracefully.
      await expect(page.getByText('No memories yet')).toBeVisible();
      test.skip(
        true,
        'PREREQUISITE NOT MET: No AI memories seeded in the database. ' +
          'Journey 7 requires seeded memories to test the Forget Everything flow. ' +
          'The memory page loads correctly and shows the empty state, but the ' +
          'forget-all flow cannot be tested without seed data.',
      );
      return;
    }

    // ── Step 2: Click "Forget Everything" button in danger zone ─────────
    const forgetButton = page.getByRole('button', {
      name: /forget everything/i,
    });
    await expect(forgetButton).toBeVisible();
    await forgetButton.click();

    // ── Verify destructive confirmation dialog appears ──────────────────
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Verify dialog title and body
    await expect(dialog.getByText('Forget Everything').first()).toBeVisible();
    await expect(
      dialog.getByText(
        'This will permanently delete ALL of your AI memories. This action cannot be undone.',
      ),
    ).toBeVisible();

    // Verify confirmation input with label
    const confirmInput = page.locator('#forget-confirm-input');
    await expect(confirmInput).toBeVisible();
    await expect(dialog.getByText(/type forget to confirm/i)).toBeVisible();

    // Verify the confirm button is DISABLED initially
    const confirmBtn = dialog.getByRole('button', {
      name: /forget everything/i,
    });
    await expect(confirmBtn).toBeDisabled();

    // Verify Cancel button is present
    await expect(
      dialog.getByRole('button', { name: /cancel/i }),
    ).toBeVisible();

    // ── Visual Checkpoint 2: Dialog opened, confirm disabled ────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-forget-dialog-opened.png`,
    });

    // ── Step 3: Type partial confirmation "FORG" ────────────────────────
    await confirmInput.fill('FORG');

    // Confirm button should still be disabled (incomplete word)
    await expect(confirmBtn).toBeDisabled();

    // ── Visual Checkpoint 3: Partial confirmation — button still disabled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-partial-confirm-disabled.png`,
    });

    // ── Step 4: Type full confirmation "FORGET" ─────────────────────────
    await confirmInput.fill('FORGET');

    // Confirm button should now be ENABLED (red variant)
    await expect(confirmBtn).toBeEnabled();

    // ── Visual Checkpoint 4: Full confirmation — button enabled ─────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-full-confirm-enabled.png`,
    });

    // ── Step 5: Click the confirm button ────────────────────────────────
    await confirmBtn.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Toast notification should appear
    await expect(
      page.getByText('All memories have been deleted'),
    ).toBeVisible({ timeout: 5000 });

    // Empty state should be displayed
    await expect(
      page.getByRole('heading', { name: /no memories yet/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(
        'As you interact with the AI, it will remember your preferences and decisions',
      ),
    ).toBeVisible();

    // ── Visual Checkpoint 5: Empty state after forget all ───────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-empty-state-after-forget.png`,
      fullPage: true,
    });
  });
});
