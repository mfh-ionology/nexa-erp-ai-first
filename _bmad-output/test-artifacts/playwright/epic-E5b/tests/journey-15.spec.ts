import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-15';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 15: Entity Mention Trigger Word Detection in Chat', () => {
  test('typing trigger words in copilot chat activates entity autocomplete', async ({
    page,
  }) => {
    // ── Intercept entity triggers API to diagnose autocomplete availability ──
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

    // Wait for the sidebar to appear after login (confirms authenticated)
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ══════════════════════════════════════════════════════════
    // ── Step 1: Navigate to Dashboard ──
    // ══════════════════════════════════════════════════════════
    await page.waitForURL('**/', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify dashboard loaded — sidebar and main content area visible
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // ══════════════════════════════════════════════════════════
    // ── Step 2: Open Co-Pilot Drawer ──
    // ══════════════════════════════════════════════════════════
    const copilotToggle = page.getByRole('button', { name: 'Open Co-Pilot' });
    await expect(copilotToggle).toBeVisible({ timeout: 10000 });
    await copilotToggle.click();

    // Wait for the drawer to open — look for the complementary region
    const drawer = page.getByRole('complementary', {
      name: 'AI Co-Pilot assistant',
    });
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Verify the chat input is visible inside the drawer
    const chatInput = page.getByPlaceholder('Ask Nexa anything...');
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Verify send button exists (should be disabled initially with empty input)
    const sendButton = page.getByRole('button', { name: 'Send message' });
    await expect(sendButton).toBeVisible();

    // Visual Checkpoint 1: Co-Pilot drawer opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-copilot-drawer-opened.png`,
    });

    // Wait briefly for the entity triggers API call to complete (it fires on mount)
    await page.waitForTimeout(2000);

    // Log entity triggers API status for diagnostics
    if (entityTriggersResponse) {
      test.info().annotations.push({
        type: 'entity-triggers-api',
        description: `Entity triggers API: status=${entityTriggersResponse.status}, body=${entityTriggersResponse.body.substring(0, 200)}`,
      });
    } else {
      test.info().annotations.push({
        type: 'entity-triggers-api',
        description: 'Entity triggers API: No request intercepted — triggers may not have loaded',
      });
    }

    // ══════════════════════════════════════════════════════════
    // ── Step 3: Type trigger word + search query ──
    // ══════════════════════════════════════════════════════════
    // Type "open saved view ov" — "saved view" is a trigger word, "ov" is the search query (2+ chars)
    // Use keyboard.type() for realistic keystroke simulation (trigger detection watches input events)
    await chatInput.click();
    await page.keyboard.type('open saved view ov', { delay: 50 });

    // Wait for the autocomplete dropdown to appear after trigger detection + API search
    // The desktop dropdown is: div.absolute.bottom-full ... z-50, containing result buttons
    // Also check for the full dropdown container with the rounded-xl class
    const autocompleteDropdown = page.locator(
      'div.absolute.bottom-full.z-50'
    );

    // Allow time for: debounce (300ms) + API call + render
    const dropdownVisible = await autocompleteDropdown
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    // Take screenshot regardless of dropdown visibility
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-autocomplete-dropdown-visible.png`,
    });

    if (dropdownVisible) {
      // Verify the dropdown shows matching results — look for at least one result button
      const resultButtons = autocompleteDropdown.getByRole('button');
      await expect(resultButtons.first()).toBeVisible({ timeout: 5000 });

      // Count results for annotation
      const resultCount = await resultButtons.count();
      test.info().annotations.push({
        type: 'autocomplete-results',
        description: `Autocomplete returned ${resultCount} result(s) for trigger "saved view" + query "ov"`,
      });

      // ══════════════════════════════════════════════════════════
      // ── Step 4: Verify keyboard navigation hint ──
      // ══════════════════════════════════════════════════════════
      const keyboardHint = page.getByText(
        'Use arrow keys to navigate, Enter to select, Esc to dismiss'
      );
      await expect(keyboardHint).toBeVisible({ timeout: 5000 });

      test.info().annotations.push({
        type: 'keyboard-hint',
        description:
          'Keyboard navigation hint footer text is visible in autocomplete dropdown',
      });

      // Dismiss the autocomplete with Escape before next step
      await page.keyboard.press('Escape');
    } else {
      // Autocomplete did NOT appear — document as a failure for this critical feature
      test.info().annotations.push({
        type: 'autocomplete-missing',
        description:
          'FAIL: Autocomplete dropdown did NOT appear after typing trigger word "saved view" + query "ov". Likely cause: entity triggers API not registered on platform-api (port 3000) — returns 404.',
      });

      // This step is a hard requirement — fail the test
      expect(
        dropdownVisible,
        'Autocomplete dropdown should appear after typing trigger word "saved view ov". ' +
          'Entity triggers API may not be registered on the platform-api.',
      ).toBe(true);
    }

    // ══════════════════════════════════════════════════════════
    // ── Step 5: Type non-trigger text — no autocomplete ──
    // ══════════════════════════════════════════════════════════
    // Clear the input and type text that does NOT contain any trigger word
    await chatInput.fill('');
    await page.waitForTimeout(300); // Allow debounce to settle

    await chatInput.click();
    await page.keyboard.type('hello world', { delay: 50 });

    // Wait for debounce period to pass
    await page.waitForTimeout(500);

    // Verify NO autocomplete dropdown is visible
    const dropdownAfterPlainText = page.locator(
      'div.absolute.bottom-full.z-50'
    );

    // The dropdown should NOT be visible (either removed from DOM or hidden)
    await expect(dropdownAfterPlainText).not.toBeVisible({ timeout: 3000 });

    // Verify the send button is enabled (there's text in the input)
    await expect(sendButton).toBeEnabled();

    // Visual Checkpoint 3: No autocomplete for plain text
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-no-autocomplete-for-plain-text.png`,
    });

    test.info().annotations.push({
      type: 'no-autocomplete',
      description:
        'No autocomplete dropdown appeared for non-trigger text "hello world" — correct behavior',
    });
  });
});
