import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-5';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 5: Edit an Existing Memory', () => {
  test('should edit a memory via the edit dialog with optimistic update', async ({
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

    // Wait for the sidebar to appear (indicates dashboard loaded)
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/memory via sidebar link ─────────────────
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible({ timeout: 5000 });
    await myMemoryLink.click();

    // Wait for the URL to change to /ai/memory
    await page.waitForURL('**/ai/memory', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify page title "My Memory" is present in the main content area
    const mainContent = page.getByRole('main', { name: 'Main content' });
    await expect(mainContent.getByText('My Memory')).toBeVisible();

    // Wait for the page to fully load: either memory cards appear OR the empty state
    // We race both locators to handle the async data fetch completing
    const memoryCardLocator = page.locator('article').first();
    const emptyStateLocator = page.getByRole('heading', {
      name: /No memories yet/i,
    });

    // Wait until one of these becomes visible (whichever comes first)
    await expect(
      memoryCardLocator.or(emptyStateLocator)
    ).toBeVisible({ timeout: 15000 });

    // Now check which state we're in
    const isEmpty = await emptyStateLocator.isVisible();

    if (isEmpty) {
      // PREREQUISITE NOT MET: No AI memories have been seeded.
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-memory-page-empty-state.png`,
        fullPage: true,
      });

      // Verify the empty state renders correctly
      await expect(emptyStateLocator).toBeVisible();
      await expect(
        page.getByText(
          'As you interact with the AI, it will remember your preferences and decisions'
        )
      ).toBeVisible();

      // Skip test due to missing prerequisite — seed data not present
      test.skip(
        true,
        'PREREQUISITE NOT MET: No AI memories seeded. The test plan requires ' +
          '"AI memory seeded with 10+ memories across 5 categories (PREFERENCE, ' +
          'WORKFLOW, DECISION, INSTRUCTION, ENTITY_CONTEXT)". ' +
          'Run the AI memory seed script before executing this journey.'
      );
      return;
    }

    // ── If memories exist, proceed with the edit flow ────────────────────
    const firstMemoryCard = memoryCardLocator;

    // Visual Checkpoint 1: Memory page loaded with cards
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-memory-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click the Edit button on the first memory card ──────────
    // Hover over the first card to reveal the action buttons (hidden until hover)
    await firstMemoryCard.hover();

    // Click the edit button (aria-label "Edit Memory")
    const editButton = firstMemoryCard.getByRole('button', {
      name: /Edit Memory/i,
    });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify the edit dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title "Edit Memory"
    await expect(dialog.getByText('Edit Memory')).toBeVisible();

    // Verify textarea is pre-filled with memory content (not empty)
    const textarea = dialog.getByRole('textbox');
    await expect(textarea).toBeVisible();
    const originalContent = await textarea.inputValue();
    expect(originalContent.length).toBeGreaterThan(0);

    // Verify Cancel and Save buttons exist
    await expect(
      dialog.getByRole('button', { name: /Cancel/i })
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /Save/i })
    ).toBeVisible();

    // Visual Checkpoint 2: Edit dialog open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-edit-dialog-open.png`,
      fullPage: true,
    });

    // ── Step 3: Clear and type new content ──────────────────────────────
    await textarea.clear();
    await textarea.fill(
      'Updated preference: Always use Net 60 payment terms'
    );

    // Verify the textarea shows the new content
    await expect(textarea).toHaveValue(
      'Updated preference: Always use Net 60 payment terms'
    );

    // Verify Save button is enabled (not disabled)
    const saveButton = dialog.getByRole('button', { name: /Save/i });
    await expect(saveButton).toBeEnabled();

    // ── Step 4: Click Save button ───────────────────────────────────────
    await saveButton.click();

    // Verify dialog closes
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Verify the memory card content updates (optimistic update)
    await expect(
      page.getByText('Updated preference: Always use Net 60 payment terms')
    ).toBeVisible({ timeout: 5000 });

    // Verify success toast "Memory updated" appears
    // Sonner renders toasts inside [data-sonner-toast] elements
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /Memory updated/i,
    });
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 3: Memory updated with toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-memory-updated-toast.png`,
      fullPage: true,
    });
  });
});
