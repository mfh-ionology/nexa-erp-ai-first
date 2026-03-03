import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-17';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 17: Send Message with Entity Mentions & Display in Chat', () => {
  test('should send a message with entity mentions and display chips in chat history', async ({
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

    // Wait for entity triggers API to load on mount
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
    // Use keyboard.type() for realistic keystroke simulation
    await chatInput.click();
    await page.keyboard.type('open view us', { delay: 50 });

    // Wait for autocomplete dropdown (debounce 300ms + API call + render)
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
      path: `${SCREENSHOTS_DIR}/step-2-autocomplete-dropdown.png`,
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

    // Verify: autocomplete dropdown dismissed
    await expect(autocompleteHint).not.toBeVisible({ timeout: 3000 });

    // Verify: entity chip appears in the input area
    if (firstResultName) {
      const chipRemoveBtn = page.getByRole('button', {
        name: `Remove ${firstResultName}`,
      });
      await expect(chipRemoveBtn).toBeVisible({ timeout: 5000 });
    }

    // Visual checkpoint 3: Entity chip inserted
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-entity-chip-inserted.png`,
    });

    // ══════════════════════════════════════════════════════════════════
    // ── Step 4: Type additional text after the chip ──────────────────
    // ══════════════════════════════════════════════════════════════════
    // The textarea should be refocused after chip insertion.
    // Use keyboard.type() to append (not fill() which would clear).
    await chatInput.click();
    await page.keyboard.type(' show me all records', { delay: 30 });

    // Verify chip is still present
    if (firstResultName) {
      await expect(
        page.getByRole('button', { name: `Remove ${firstResultName}` })
      ).toBeVisible();
    }

    // Verify Send button is enabled
    const sendBtn = page.getByRole('button', { name: 'Send message' });
    await expect(sendBtn).toBeEnabled();

    // ══════════════════════════════════════════════════════════════════
    // ── Step 5: Click Send — message sent with entity chips ──────────
    // ══════════════════════════════════════════════════════════════════
    await sendBtn.click();

    // Wait for user message to appear in chat area
    const chatArea = page.locator('[aria-live="polite"]');
    await expect(chatArea).toBeVisible();

    // User's message text should appear in the chat
    const userMessageText = chatArea.getByText('show me all records');
    await expect(userMessageText.first()).toBeVisible({ timeout: 5000 });

    // Entity name should be visible in the user message (as a chip or text)
    if (firstResultName) {
      const entityInChat = chatArea.getByText(firstResultName);
      await expect(entityInChat.first()).toBeVisible({ timeout: 5000 });
    }

    // Input should be cleared after sending
    await expect(chatInput).toHaveValue('');

    // Entity chip remove buttons should no longer be in the input area
    if (firstResultName) {
      const chipRemoveBtn = page.getByRole('button', {
        name: `Remove ${firstResultName}`,
      });
      // The remove button was in the input area — after send it should be gone
      // (it may still appear in the chat bubble as display-only chip, but
      // the input area chips are cleared)
      // We check that the input area specifically no longer has chips
      const inputContainer = page.locator(
        '.shrink-0.border-t.border-border.px-4.py-3'
      );
      if (await inputContainer.isVisible()) {
        const inputChipRemove = inputContainer.getByRole('button', {
          name: `Remove ${firstResultName}`,
        });
        await expect(inputChipRemove).not.toBeVisible({ timeout: 3000 });
      }
    }

    // Visual checkpoint 4: Message sent with entity chips
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-message-sent-with-chips.png`,
    });

    // ══════════════════════════════════════════════════════════════════
    // ── Step 6: Verify streaming indicator ───────────────────────────
    // ══════════════════════════════════════════════════════════════════
    // The streaming indicator (pulsing dots) may appear briefly.
    try {
      const streamingIndicator = chatArea.locator(
        '.animate-pulse, [class*="animate-pulse"]'
      );
      await expect(streamingIndicator.first()).toBeVisible({ timeout: 5000 });

      // Visual checkpoint 5: Streaming indicator
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-streaming-indicator.png`,
      });
    } catch {
      // Streaming may complete too fast to capture — take screenshot anyway
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-streaming-indicator.png`,
      });
      test.info().annotations.push({
        type: 'streaming-too-fast',
        description:
          'Streaming indicator could not be captured — response may have arrived too quickly or used a placeholder.',
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // ── Step 7: Verify assistant response appears ────────────────────
    // ══════════════════════════════════════════════════════════════════
    // The assistant message has bg-muted class and appears left-aligned.
    // It should appear after streaming completes. Use generous timeout
    // since it may be a real AI call or a placeholder response.
    const assistantBubble = chatArea.locator(
      'div.rounded-lg.bg-muted.text-foreground'
    );
    await expect(assistantBubble.last()).toBeVisible({ timeout: 30000 });

    // Verify assistant message has text content
    const assistantText = assistantBubble.last().locator('p');
    await expect(assistantText).toBeVisible();
    const responseContent = await assistantText.textContent();
    expect(responseContent).toBeTruthy();
    expect(responseContent!.length).toBeGreaterThan(0);

    test.info().annotations.push({
      type: 'assistant-response',
      description: `Assistant response: "${responseContent?.substring(0, 200)}"`,
    });

    // Visual checkpoint 6: Assistant response displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-assistant-response.png`,
    });
  });
});
