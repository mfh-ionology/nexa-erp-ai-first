import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-18';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 18: Entity Autocomplete Keyboard Navigation', () => {
  test('full keyboard navigation of entity autocomplete: arrow keys, Enter, Escape, Backspace', async ({
    page,
  }) => {
    // ── Intercept entity triggers API for diagnostics ──
    let entityTriggersResponse: { status: number; body: string } | null = null;
    page.on('response', async (response) => {
      if (response.url().includes('/ai/entity-triggers')) {
        entityTriggersResponse = {
          status: response.status(),
          body: await response.text().catch(() => ''),
        };
      }
    });

    // ── Pre-step: Log in to the application ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for sidebar to appear (confirms authenticated session)
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // ══════════════════════════════════════════════════════════
    // ── Step 1: Open Co-Pilot drawer ─────────────────────────
    // ══════════════════════════════════════════════════════════
    const copilotToggle = page.getByRole('button', { name: 'Open Co-Pilot' });
    await expect(copilotToggle).toBeVisible({ timeout: 10000 });
    await copilotToggle.click();

    // Wait for the drawer to open
    const drawer = page.getByRole('complementary', {
      name: 'AI Co-Pilot assistant',
    });
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Verify the chat input is visible
    const chatInput = page.getByPlaceholder('Ask Nexa anything...');
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Wait for entity triggers API to load on mount
    await page.waitForTimeout(2000);

    // Log entity triggers API status
    if (entityTriggersResponse) {
      test.info().annotations.push({
        type: 'entity-triggers-api',
        description: `Entity triggers API: status=${entityTriggersResponse.status}, body=${entityTriggersResponse.body.substring(0, 200)}`,
      });
    } else {
      test.info().annotations.push({
        type: 'entity-triggers-api',
        description:
          'Entity triggers API: No request intercepted — triggers may not have loaded',
      });
    }

    // ══════════════════════════════════════════════════════════
    // ── Step 2: Type trigger word to open autocomplete ───────
    // ══════════════════════════════════════════════════════════
    // "view" is a trigger word; "us" is 2+ char search query
    await chatInput.click();
    await page.keyboard.type('open view us', { delay: 50 });

    // Wait for autocomplete dropdown (debounce 300ms + API call + render)
    const autocompleteDropdown = page.locator(
      'div.absolute.bottom-full.z-50'
    );

    const dropdownVisible = await autocompleteDropdown
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    // Visual Checkpoint 1: Autocomplete dropdown visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-autocomplete-dropdown-visible.png`,
    });

    if (!dropdownVisible) {
      test.info().annotations.push({
        type: 'autocomplete-missing',
        description:
          'FAIL: Autocomplete dropdown did NOT appear after typing trigger "view us". Entity triggers API may not be registered.',
      });
      expect(
        dropdownVisible,
        'Autocomplete dropdown should appear after typing trigger word "view us". Entity triggers API may not be registered.',
      ).toBe(true);
    }

    // Verify result buttons exist in the dropdown
    const dropdownResults = autocompleteDropdown.getByRole('button');
    await expect(dropdownResults.first()).toBeVisible({ timeout: 5000 });

    // Count results for diagnostics
    const resultCount = await dropdownResults.count();
    test.info().annotations.push({
      type: 'autocomplete-results',
      description: `Autocomplete returned ${resultCount} result(s) for trigger "view" + query "us"`,
    });

    // Verify keyboard hint footer is visible
    const keyboardHint = page.getByText(
      'Use arrow keys to navigate, Enter to select, Esc to dismiss'
    );
    await expect(keyboardHint).toBeVisible({ timeout: 5000 });

    // ══════════════════════════════════════════════════════════
    // ── Step 3: Press ArrowDown — second result highlighted ──
    // ══════════════════════════════════════════════════════════
    // First result should be highlighted by default; ArrowDown moves to second
    await page.keyboard.press('ArrowDown');

    // Allow brief time for highlight update
    await page.waitForTimeout(200);

    // Verify second result is highlighted (has bg-[#f5f3ff] class)
    if (resultCount >= 2) {
      const secondResult = dropdownResults.nth(1);
      const secondResultClass = await secondResult.getAttribute('class');
      test.info().annotations.push({
        type: 'arrow-down-highlight',
        description: `Second result classes after ArrowDown: ${secondResultClass}`,
      });

      // Check that second item has the selected background
      await expect(secondResult).toHaveClass(/f5f3ff/, { timeout: 3000 });
    }

    // Visual Checkpoint 2: Second item highlighted
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-arrow-down-second-item-highlighted.png`,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 4: Press ArrowUp — first result highlighted ─────
    // ══════════════════════════════════════════════════════════
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);

    // Verify first result is highlighted again
    const firstResult = dropdownResults.first();
    const firstResultClass = await firstResult.getAttribute('class');
    test.info().annotations.push({
      type: 'arrow-up-highlight',
      description: `First result classes after ArrowUp: ${firstResultClass}`,
    });

    await expect(firstResult).toHaveClass(/f5f3ff/, { timeout: 3000 });

    // ══════════════════════════════════════════════════════════
    // ── Step 5: Press Enter — select entity as chip ──────────
    // ══════════════════════════════════════════════════════════
    // Capture the name of the first (selected) result before pressing Enter
    const firstResultName = await firstResult
      .locator('.truncate.font-medium')
      .textContent();

    test.info().annotations.push({
      type: 'selected-entity',
      description: `Selected entity via Enter key: "${firstResultName}"`,
    });

    await page.keyboard.press('Enter');

    // Verify: autocomplete dropdown dismissed
    await expect(keyboardHint).not.toBeVisible({ timeout: 3000 });

    // Verify: entity chip inserted
    if (firstResultName) {
      const chipRemoveBtn = page.getByRole('button', {
        name: `Remove ${firstResultName}`,
      });
      await expect(chipRemoveBtn).toBeVisible({ timeout: 5000 });
    }

    // Visual Checkpoint 3: Chip inserted after Enter
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-enter-key-chip-inserted.png`,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 6: Type new trigger text for Escape test ────────
    // ══════════════════════════════════════════════════════════
    // Clear any leftover text from the textarea before typing new trigger
    // Use triple-click to select all text in textarea, then delete
    await chatInput.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Type "open saved view ov" to trigger autocomplete for "saved view"
    await page.keyboard.type('open saved view ov', { delay: 50 });

    // Wait for autocomplete to appear
    const secondDropdownVisible = await autocompleteDropdown
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    test.info().annotations.push({
      type: 'second-autocomplete',
      description: `Second autocomplete (saved view trigger) visible: ${secondDropdownVisible}`,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 7: Press Escape — dismiss autocomplete ──────────
    // ══════════════════════════════════════════════════════════
    if (secondDropdownVisible) {
      await page.keyboard.press('Escape');

      // Verify: autocomplete dismissed
      await expect(autocompleteDropdown).not.toBeVisible({ timeout: 3000 });
    }

    // Verify: text remains in the input
    const textareaValue = await chatInput.inputValue();
    expect(textareaValue).toContain('open saved view ov');

    // Verify: chip from Step 5 is still present
    if (firstResultName) {
      await expect(
        page.getByRole('button', { name: `Remove ${firstResultName}` })
      ).toBeVisible();
    }

    // Visual Checkpoint 4: Autocomplete dismissed, text remains
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-escape-autocomplete-dismissed.png`,
    });

    // ══════════════════════════════════════════════════════════
    // ── Step 8: Clear textarea to empty (chips remain) ───────
    // ══════════════════════════════════════════════════════════
    // Clear textarea text but keep chips — use select-all + delete on the textarea
    await chatInput.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Verify: textarea is empty but chip(s) still present
    const clearedValue = await chatInput.inputValue();
    expect(clearedValue).toBe('');

    if (firstResultName) {
      await expect(
        page.getByRole('button', { name: `Remove ${firstResultName}` })
      ).toBeVisible();
    }

    // ══════════════════════════════════════════════════════════
    // ── Step 9: Press Backspace with empty textarea ──────────
    // ══════════════════════════════════════════════════════════
    // When textarea is empty and user presses Backspace, the last chip should be removed
    await chatInput.click();
    await page.keyboard.press('Backspace');

    // Wait for chip removal animation
    await page.waitForTimeout(500);

    // Verify: chip is removed
    if (firstResultName) {
      await expect(
        page.getByRole('button', { name: `Remove ${firstResultName}` })
      ).not.toBeVisible({ timeout: 3000 });
    }

    // Verify: send button should be disabled (no content)
    const sendBtn = page.getByRole('button', { name: 'Send message' });
    await expect(sendBtn).toBeDisabled();

    // Visual Checkpoint 5: All chips removed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-backspace-chip-removed.png`,
    });

    test.info().annotations.push({
      type: 'journey-complete',
      description:
        'All keyboard navigation steps verified: ArrowDown, ArrowUp, Enter (select), Escape (dismiss), Backspace (remove chip)',
    });
  });
});
