import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-16';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 16: Entity Selection & Chip Insertion', () => {
  test('should select entity from autocomplete and insert/remove chip in chat input', async ({
    page,
  }) => {
    // ── Intercept entity triggers API for diagnostics ──────────────────
    let entityTriggersResponse: { status: number; body: string } | null = null;
    page.on('response', async (response) => {
      if (response.url().includes('/ai/entity-triggers')) {
        entityTriggersResponse = {
          status: response.status(),
          body: await response.text().catch(() => ''),
        };
      }
    });

    // ── Pre-step: Log in to the application ────────────────────────────
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

    // ══════════════════════════════════════════════════════════════════
    // ── Step 1: Open Co-Pilot drawer ─────────────────────────────────
    // ══════════════════════════════════════════════════════════════════
    const openCopilotBtn = page.getByRole('button', { name: 'Open Co-Pilot' });
    await expect(openCopilotBtn).toBeVisible({ timeout: 10000 });
    await openCopilotBtn.click();

    // Wait for the drawer to be visible
    const drawer = page.getByRole('complementary', {
      name: 'AI Co-Pilot assistant',
    });
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Verify the chat input is visible inside the drawer
    const chatInput = page.getByPlaceholder('Ask Nexa anything...');
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 1: Co-Pilot drawer open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-copilot-drawer-open.png`,
    });

    // Wait briefly for entity triggers API to load on mount
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
        description:
          'Entity triggers API: No request intercepted — triggers may not have loaded',
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // ── Step 2: Type trigger text to activate autocomplete ───────────
    // ══════════════════════════════════════════════════════════════════
    // "view" is a trigger word; "us" is 2+ char search query
    // Use keyboard.type() for realistic keystroke simulation (trigger detection watches input events)
    await chatInput.click();
    await page.keyboard.type('open view us', { delay: 50 });

    // Wait for autocomplete dropdown to appear (debounce 300ms + API call + render)
    const autocompleteDropdown = page.locator(
      'div.absolute.bottom-full.z-50'
    );
    const autocompleteHint = page.getByText(
      'Use arrow keys to navigate, Enter to select, Esc to dismiss'
    );

    const dropdownVisible = await autocompleteDropdown
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    // Visual checkpoint 2: Autocomplete dropdown
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

    // ══════════════════════════════════════════════════════════════════
    // ── Step 3: Click first result — entity chip insertion ───────────
    // ══════════════════════════════════════════════════════════════════
    // Capture the name of the first result for later assertions
    const firstResultName = await dropdownResults
      .first()
      .locator('.truncate.font-medium')
      .textContent();

    test.info().annotations.push({
      type: 'first-result',
      description: `First autocomplete result: "${firstResultName}"`,
    });

    // Click the first result
    await dropdownResults.first().click();

    // Verify: autocomplete dropdown should be dismissed
    await expect(autocompleteHint).not.toBeVisible({ timeout: 3000 });

    // Verify: entity chip should appear in the input area
    // The chip has a remove button with aria-label "Remove {entityName}"
    if (firstResultName) {
      const chipRemoveBtn = page.getByRole('button', {
        name: `Remove ${firstResultName}`,
      });
      await expect(chipRemoveBtn).toBeVisible({ timeout: 5000 });
    }

    // Verify: chip text is visible
    if (firstResultName) {
      await expect(page.getByText(firstResultName).first()).toBeVisible();
    }

    // Visual checkpoint 3: Entity chip inserted
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-entity-chip-inserted.png`,
    });

    // ══════════════════════════════════════════════════════════════════
    // ── Step 4: Type additional text after the chip ──────────────────
    // ══════════════════════════════════════════════════════════════════
    // The textarea should be refocused after chip insertion
    // Use keyboard.type() to append text (not fill() which would clear)
    await chatInput.click();
    await page.keyboard.type(' please show me this view', { delay: 30 });

    // Verify: chip is still present
    if (firstResultName) {
      await expect(
        page.getByRole('button', { name: `Remove ${firstResultName}` })
      ).toBeVisible();
    }

    // Verify: send button should be enabled since we have content
    const sendBtn = page.getByRole('button', { name: 'Send message' });
    await expect(sendBtn).toBeEnabled();

    // Visual checkpoint 4: Chip plus text together
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-chip-plus-text.png`,
    });

    // ══════════════════════════════════════════════════════════════════
    // ── Step 5: Remove entity chip by clicking X button ──────────────
    // ══════════════════════════════════════════════════════════════════
    if (firstResultName) {
      const removeBtn = page.getByRole('button', {
        name: `Remove ${firstResultName}`,
      });
      await removeBtn.click();

      // Verify: chip is removed
      await expect(removeBtn).not.toBeVisible({ timeout: 3000 });
    }

    // Visual checkpoint 5: Chip removed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-chip-removed.png`,
    });
  });
});
