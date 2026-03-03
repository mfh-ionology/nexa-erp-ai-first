import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-11';

// Seed user credentials (ADMIN role)
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 11: Admin Skill Detail & Override (ADMIN Role)', () => {
  test('Admin can view skill details, save override, and reset to default', async ({ page }) => {
    // ── Pre-step: Log in as ADMIN ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for sidebar to confirm login succeeded
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/skills ──
    const skillsLink = sidebar.getByRole('link', { name: 'Skills' });
    await expect(skillsLink).toBeVisible();
    await skillsLink.click();

    await page.waitForURL('**/ai/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for skill cards or empty state
    const skillCardLocator = page.locator('article[role="button"]').first();
    const emptyStateHeading = page.getByRole('heading', { name: 'No skills available' });
    await expect(skillCardLocator.or(emptyStateHeading)).toBeVisible({ timeout: 15000 });

    const hasSkills = await skillCardLocator.isVisible();

    if (!hasSkills) {
      test.info().annotations.push({
        type: 'prerequisite_not_met',
        description:
          'No skills data seeded. Admin skill detail & override tests require seed data.',
      });

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-skill-detail-sheet-open.png`,
        fullPage: true,
      });

      test.skip(true, 'No skills data seeded — skill detail tests require seed data');
      return;
    }

    // ── Step 2: Click first skill card to open detail sheet ──
    const firstSkillCard = page.locator('article[role="button"]').first();
    const skillHeading = firstSkillCard.locator('h3');
    const skillName = await skillHeading.textContent();
    expect(skillName).toBeTruthy();

    await firstSkillCard.click();

    // Wait for sheet to open — the sheet renders with the skill name as title
    const sheetContent = page.locator('[data-state="open"][role="dialog"]');
    await expect(sheetContent).toBeVisible({ timeout: 5000 });

    // Verify admin-specific controls are present
    const activeToggle = sheetContent.getByRole('switch', { name: 'Active' });
    await expect(activeToggle).toBeVisible({ timeout: 5000 });

    // Verify Save Override button exists (admin-only)
    const saveButton = sheetContent.getByRole('button', { name: 'Save Override' });
    await expect(saveButton).toBeVisible();

    // Verify Reset to Default button exists
    const resetButton = sheetContent.getByRole('button', { name: 'Reset to Default' });
    await expect(resetButton).toBeVisible();

    // Verify Cancel button exists
    const cancelButton = sheetContent.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible();

    // Verify trigger phrases section is present (editable for admin — has input)
    const triggerPhraseGroup = sheetContent.locator('[role="group"]').first();
    await expect(triggerPhraseGroup).toBeVisible();

    // Verify priority input is present (admin-only)
    const priorityInput = sheetContent.locator('input[type="number"]');
    await expect(priorityInput).toBeVisible();

    // Verify skill instructions section (read-only pre block)
    const instructionsBlock = sheetContent.locator('pre').first();
    await expect(instructionsBlock).toBeVisible();

    // Visual Checkpoint 1: Sheet open with admin controls
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-skill-detail-sheet-open.png`,
      fullPage: true,
    });

    // ── Step 3: Toggle Active/Inactive switch ──
    const wasChecked = await activeToggle.isChecked();
    await activeToggle.click();

    // Verify toggle state changed
    if (wasChecked) {
      await expect(activeToggle).not.toBeChecked();
    } else {
      await expect(activeToggle).toBeChecked();
    }

    // ── Step 4: Add trigger phrase "display records" ──
    // The trigger phrase input is inside a [role="group"] — find the text input within it
    const triggerInput = triggerPhraseGroup.locator('input[type="text"]');
    await expect(triggerInput).toBeVisible();

    await triggerInput.fill('display records');
    await triggerInput.press('Enter');

    // Verify the new phrase appears as a green pill
    const newPhrasePill = triggerPhraseGroup.getByText('display records');
    await expect(newPhrasePill).toBeVisible({ timeout: 3000 });

    // ── Step 5: Change priority to 150 ──
    // Note: the input has max=100, so we test what value actually gets set
    await priorityInput.fill('');
    await priorityInput.fill('150');
    await expect(priorityInput).toHaveValue('150');

    // ── Step 6: Click Save Override ──
    await saveButton.click();

    // Wait for toast notification "Skill override saved"
    const saveToast = page.getByText('Skill override saved');
    await expect(saveToast).toBeVisible({ timeout: 10000 });

    // Sheet should close after save
    await expect(sheetContent).not.toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 2: Override saved toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-override-saved-toast.png`,
      fullPage: true,
    });

    // ── Step 7: Click the same skill card again ──
    // Wait for query invalidation to complete and cards to re-render
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Re-locate skill cards after re-render
    const updatedSkillCards = page.locator('article[role="button"]');
    await expect(updatedSkillCards.first()).toBeVisible({ timeout: 10000 });

    // Expand any collapsed module sections to find our skill
    const collapsedSections = page.locator('button[aria-expanded="false"]');
    const collapsedCount = await collapsedSections.count();
    for (let i = 0; i < collapsedCount; i++) {
      await collapsedSections.nth(0).click();
      await page.waitForTimeout(200);
    }

    // Find the same skill by name and click it
    const targetCard = page.locator('article[role="button"]', {
      has: page.locator(`h3:has-text("${skillName}")`),
    });
    await expect(targetCard).toBeVisible({ timeout: 5000 });
    await targetCard.click();

    // Wait for sheet to re-open
    const reopenedSheet = page.locator('[data-state="open"][role="dialog"]');
    await expect(reopenedSheet).toBeVisible({ timeout: 5000 });

    // Verify the overridden values are present
    // Check that "display records" trigger phrase is still there
    const overriddenPhrase = reopenedSheet.getByText('display records');
    await expect(overriddenPhrase).toBeVisible({ timeout: 5000 });

    // Check that the "Custom override applied" badge is visible
    const overrideBadge = reopenedSheet.getByText('Custom override applied');
    await expect(overrideBadge).toBeVisible({ timeout: 5000 });

    // Check that Reset to Default is now enabled (it's disabled when no override exists)
    const resetBtnReopened = reopenedSheet.getByRole('button', { name: 'Reset to Default' });
    await expect(resetBtnReopened).toBeEnabled();

    // Visual Checkpoint 3: Sheet with overrides
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-sheet-with-overrides.png`,
      fullPage: true,
    });

    // ── Step 8: Click Reset to Default ──
    await resetBtnReopened.click();

    // Wait for toast notification "Override removed — using default settings"
    const resetToast = page.getByText('Override removed — using default settings');
    await expect(resetToast).toBeVisible({ timeout: 10000 });

    // Sheet should close after reset
    await expect(reopenedSheet).not.toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 4: Override reset toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-override-reset-toast.png`,
      fullPage: true,
    });

    // Verify the override badge is no longer on the skill card
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Re-locate the card and verify no override badge
    const finalCard = page.locator('article[role="button"]', {
      has: page.locator(`h3:has-text("${skillName}")`),
    });

    // Expand collapsed sections again if needed
    const collapsedAfterReset = page.locator('button[aria-expanded="false"]');
    const collapsedCountAfterReset = await collapsedAfterReset.count();
    for (let i = 0; i < collapsedCountAfterReset; i++) {
      await collapsedAfterReset.nth(0).click();
      await page.waitForTimeout(200);
    }

    await expect(finalCard).toBeVisible({ timeout: 5000 });

    // The override badge text should NOT be present on the card
    const cardOverrideBadge = finalCard.getByText('Custom override applied');
    await expect(cardOverrideBadge).not.toBeVisible();
  });
});
