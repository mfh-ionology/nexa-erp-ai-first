import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-8';

// --- Mock API responses matching the API envelope format ---

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-access-token-jwt',
    refreshToken: 'mock-refresh-token-jwt',
    expiresIn: 3600,
    user: {
      id: 'usr-001',
      email: 'admin@nexa-test.com',
      firstName: 'Admin',
      lastName: 'Demo',
      role: 'ADMIN',
      enabledModules: ['system', 'finance', 'sales'],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

const MOCK_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-001',
    companyId: 'comp-001',
    role: 'ADMIN',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-001', code: 'ADMIN', name: 'Administrators' }],
    permissions: {
      system: {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
      finance: {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
      sales: {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
    },
    fieldOverrides: {},
    enabledModules: ['system', 'finance', 'sales'],
  },
};

/** Set up API mocks for login + permissions. */
async function mockApis(page: Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_RESPONSE),
    });
  });

  await page.route('**/api/v1/system/my-permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PERMISSIONS_RESPONSE),
    });
  });
}

/** Log in via the login form (standard pattern from journey-1). */
async function performLogin(page: Page) {
  await page.goto('/');
  await page.waitForURL('**/login', { timeout: 10_000 });

  await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-test.com');
  await page.getByPlaceholder('Enter your password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for login form to disappear
  await expect(page.getByPlaceholder('you@company.co.uk')).not.toBeVisible({
    timeout: 15_000,
  });

  // Wait for dashboard to load
  await expect(
    page.getByRole('heading', { name: /Dashboard/i }),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 8: Co-Pilot Dock — Cmd+K and Drawer', () => {
  test('Cmd+K opens command palette, type INV- for entity results, open/close Co-Pilot drawer with chat', async ({
    page,
  }) => {
    // Set up all API mocks before navigation
    await mockApis(page);

    // ─── Pre-condition: Log in at desktop viewport (1280×720 from config) ───
    await performLogin(page);

    // Hide TanStack Query devtools overlay that can intercept pointer events
    await page.evaluate(() => {
      const devtools = document.querySelector('.tsqd-parent-container');
      if (devtools instanceof HTMLElement) devtools.style.display = 'none';
    });

    // Visual checkpoint 0: Dashboard loaded with search input in header
    const header = page.locator('[role="banner"]');
    await expect(header).toBeVisible();

    // Verify the search trigger is visible in the header (desktop)
    const searchCombobox = page.locator('[role="combobox"][aria-label="Search or ask Nexa AI"]');
    await expect(searchCombobox).toBeVisible({ timeout: 5_000 });

    // Verify the Chat button is visible
    const chatButton = page.getByRole('button', { name: 'Open Co-Pilot' });
    await expect(chatButton).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-0-dashboard-with-search.png`,
      fullPage: true,
    });

    // ─── Step 2: Press Cmd+K to open command palette and focus search ───
    await page.keyboard.press('Meta+k');

    // The popover should open — look for the CommandInput inside the popover
    const commandInput = page.locator('[data-slot="command-input"]');
    await expect(commandInput).toBeVisible({ timeout: 5_000 });
    await expect(commandInput).toBeFocused();

    // Visual checkpoint 2: Command palette popover open with focused input
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-cmd-k-search-focused.png`,
      fullPage: true,
    });

    // ─── Step 3: Type "INV-" to trigger entity search results ───
    await commandInput.fill('INV-');

    // Wait for entity results to appear in the command list
    const entityGroup = page.locator('[data-slot="command-group"]').filter({
      hasText: 'Entities',
    });
    await expect(entityGroup).toBeVisible({ timeout: 5_000 });

    // Verify entity result items are present (disabled placeholder items)
    const entityItems = entityGroup.locator('[data-slot="command-item"]');
    await expect(entityItems.first()).toBeVisible();

    // Entity results should show "Entity search coming in E7" text
    await expect(entityGroup.getByText('Entity search coming in E7').first()).toBeVisible();

    // Visual checkpoint 3: Entity results shown for "INV-"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-entity-results-inv.png`,
      fullPage: true,
    });

    // ─── Step 4: Press Escape to close search dropdown ───
    await page.keyboard.press('Escape');

    // The command input and popover should close
    await expect(commandInput).not.toBeVisible({ timeout: 3_000 });

    // ─── Step 5: Click Chat button to open Co-Pilot drawer ───
    await chatButton.click();

    // The Co-Pilot drawer should open (role="complementary" with copilot aria-label)
    const drawer = page.locator('[role="complementary"][aria-label="AI Co-Pilot assistant"]');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Verify drawer header with "Co-Pilot" title
    await expect(drawer.getByText('Co-Pilot', { exact: true })).toBeVisible();

    // Verify close button is present in drawer
    const drawerCloseButton = drawer.getByRole('button', { name: 'Close Co-Pilot' });
    await expect(drawerCloseButton).toBeVisible();

    // Verify empty state message (no conversations yet)
    await expect(
      drawer.getByText(/I'm your Nexa Co-Pilot/),
    ).toBeVisible({ timeout: 3_000 });

    // Verify input area is present with placeholder
    const copilotInput = drawer.getByRole('textbox', { name: 'Message the Co-Pilot' });
    await expect(copilotInput).toBeVisible();

    // Verify send button is present (disabled when input is empty)
    const sendButton = drawer.getByRole('button', { name: 'Send message' });
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();

    // Visual checkpoint 4: Co-Pilot drawer open with empty state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-copilot-drawer-open.png`,
      fullPage: true,
    });

    // ─── Step 6: Type "Show me overdue invoices" in Co-Pilot input ───
    await copilotInput.fill('Show me overdue invoices');

    // Verify the text is filled
    await expect(copilotInput).toHaveValue('Show me overdue invoices');

    // Send button should now be enabled
    await expect(sendButton).toBeEnabled();

    // ─── Step 7: Press Enter to submit the message ───
    // Using keyboard Enter (the CopilotInput handles Enter to submit, Shift+Enter for newline)
    await copilotInput.press('Enter');

    // Wait for the user message bubble to appear in the chat area
    // User messages have bg-primary (purple) and are on the right side
    const userMessage = drawer.getByText('Show me overdue invoices');
    await expect(userMessage).toBeVisible({ timeout: 5_000 });

    // Wait for the AI placeholder response to appear
    // The store generates a placeholder response with content from copilot.placeholder.aiResponse
    const aiResponse = drawer.getByText(/I received your message/);
    await expect(aiResponse).toBeVisible({ timeout: 5_000 });

    // Input should be cleared after sending
    await expect(copilotInput).toHaveValue('');

    // Visual checkpoint 5: User message and AI response visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-chat-message-sent.png`,
      fullPage: true,
    });

    // ─── Step 8: Click Chat button in header to close the drawer ───
    // The header chat button now shows "Close Co-Pilot" since drawer is open
    // Scope to header (role="banner") to avoid matching the close button inside the drawer
    const closeChatButton = header.getByRole('button', { name: 'Close Co-Pilot' });
    await closeChatButton.click();

    // Drawer should close — the complementary element should collapse (w-0)
    // Wait for the drawer content to become not visible
    await expect(drawer.getByText('Co-Pilot', { exact: true })).not.toBeVisible({ timeout: 5_000 });

    // The header chat button should revert to "Open Co-Pilot"
    await expect(
      page.getByRole('button', { name: 'Open Co-Pilot' }),
    ).toBeVisible({ timeout: 3_000 });

    // Visual checkpoint 6: Drawer closed, full-width content restored
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-drawer-closed.png`,
      fullPage: true,
    });
  });
});
