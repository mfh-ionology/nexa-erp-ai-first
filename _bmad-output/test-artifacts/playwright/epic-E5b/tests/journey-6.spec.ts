import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-6';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 6: Delete a Single Memory', () => {
  test('should delete a memory with confirmation dialog and verify removal', async ({
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

    // ── Step 1: Navigate to /ai/memory via sidebar link ─────────────────
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible({ timeout: 5000 });
    await myMemoryLink.click();
    await expect(page).toHaveURL(/\/ai\/memory/, { timeout: 10000 });

    // Wait for the page to finish loading (either memory cards or empty state)
    // First check if memory cards appear, or if we get the empty state
    const memoryCardOrEmpty = page.locator('article, h2:has-text("No memories yet")');
    await expect(memoryCardOrEmpty.first()).toBeVisible({ timeout: 15000 });

    // Check if we're in the empty state (no memories seeded)
    const hasMemories = await page.locator('article').count() > 0;

    // ── Visual Checkpoint 1: Memory page loaded ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-memory-page-loaded.png`,
      fullPage: true,
    });

    if (!hasMemories) {
      // PREREQUISITE NOT MET: No seed data. Document and skip gracefully.
      // The empty state itself is verified — page renders correctly.
      await expect(page.getByText('No memories yet')).toBeVisible();
      test.skip(
        true,
        'PREREQUISITE NOT MET: No AI memories seeded in the database. ' +
          'Journey 6 requires at least 1 seeded memory to test deletion. ' +
          'The memory page loads correctly and shows the empty state, but the ' +
          'delete flow cannot be tested without seed data.',
      );
      return;
    }

    // ── Step 2: Note the count badge for the first category section ─────
    const firstSection = page.locator('section[aria-label]').first();
    await expect(firstSection).toBeVisible();

    const sectionHeader = firstSection.locator('button[aria-expanded]');
    const countBadge = sectionHeader.locator('span').filter({ hasText: /^\d+$/ });
    const initialCountText = await countBadge.first().textContent();
    const initialCount = parseInt(initialCountText || '0', 10);

    // Count the number of article cards before deletion
    const cardsBeforeDeletion = await firstSection.locator('article').count();
    expect(cardsBeforeDeletion).toBeGreaterThan(0);

    // ── Step 3: Click delete button (trash icon) on the first memory card ──
    // The delete button is hidden until hover (opacity-0 group-hover:opacity-100)
    const firstCard = firstSection.locator('article').first();
    await firstCard.hover();

    const deleteButton = firstCard.getByRole('button', { name: 'Delete Memory' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // ── Verify confirmation dialog appears ──────────────────────────────
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Verify dialog content
    await expect(dialog.getByText('Delete Memory')).toBeVisible();
    await expect(
      dialog.getByText('Delete this memory? This action cannot be undone.'),
    ).toBeVisible();

    // Verify Cancel and Delete buttons are present
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    const confirmDeleteButton = dialog.getByRole('button', { name: 'Delete' });
    await expect(confirmDeleteButton).toBeVisible();

    // ── Visual Checkpoint 2: Delete confirmation dialog ─────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-delete-confirmation-dialog.png`,
      fullPage: true,
    });

    // ── Step 4: Click Delete confirm button ─────────────────────────────
    await confirmDeleteButton.click();

    // Wait for the dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify toast message appears
    await expect(page.getByText('Memory deleted')).toBeVisible({
      timeout: 5000,
    });

    // Verify the card count decreased
    const cardsAfterDeletion = await firstSection.locator('article').count();
    expect(cardsAfterDeletion).toBe(cardsBeforeDeletion - 1);

    // Verify the count badge decremented (if section still has cards)
    if (cardsAfterDeletion > 0) {
      const updatedCountText = await countBadge.first().textContent();
      const updatedCount = parseInt(updatedCountText || '0', 10);
      expect(updatedCount).toBe(initialCount - 1);
    }

    // ── Visual Checkpoint 3: Memory deleted, toast visible ──────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-memory-deleted-toast.png`,
      fullPage: true,
    });
  });
});
