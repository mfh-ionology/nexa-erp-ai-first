import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', '..', 'screenshots', 'epic-E5c', 'journey-9');

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, navPath: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, navPath);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

// Unique suffix for this test run
const AGENT_SLUG = `test-ar-collector-${Date.now()}`;
const AGENT_DISPLAY_NAME = 'AR Collection Agent';
const UPDATED_DISPLAY_NAME = 'AR Collection Specialist Agent';

test.describe('Journey 9: Agent List Search and Edit', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Capture the access token from the login API response.
    // Frontend calls /api/v1/auth/login (Vite proxies to backend /auth/login).
    let accessToken = '';
    page.on('response', async (response) => {
      if (response.url().includes('/auth/login') && response.ok()) {
        try {
          const body = await response.json();
          // Response envelope: { success: true, data: { user, tokens: { accessToken, refreshToken }, ... } }
          accessToken = body?.data?.tokens?.accessToken || '';
        } catch { /* skip */ }
      }
    });

    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');

    // Give time for the response listener to capture the token
    await page.waitForTimeout(1000);

    // Create the test agent via API so the search test has data
    if (accessToken) {
      // Vite proxies /api/v1/* → http://localhost:5100/*
      // Use the page's base URL to go through the proxy
      const proxyBase = '';

      // Get models and prompts to use valid IDs
      const modelsRes = await page.request.get(`/api/v1/ai/admin/models?isActive=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const modelsData = await modelsRes.json();
      const models = modelsData?.data ?? [];
      const sonnetModel = models.find(
        (m: { name: string }) => m.name.includes('sonnet'),
      );
      const modelId = sonnetModel?.id || models[0]?.id;

      const promptsRes = await page.request.get(`/api/v1/ai/admin/prompts?isActive=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const promptsData = await promptsRes.json();
      const prompts = promptsData?.data ?? [];
      const promptId = prompts[0]?.id;

      if (promptId) {
        const createRes = await page.request.post(`/api/v1/ai/admin/agents`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          data: {
            name: AGENT_SLUG,
            displayName: AGENT_DISPLAY_NAME,
            description: 'Handles accounts receivable collection workflows',
            modelId: modelId || null,
            promptId,
            routingTags: ['standard'],
            maxTurns: 15,
            isActive: true,
            tools: ['query_overdue_invoices', 'send_reminder_email', 'create_follow_up_task'],
            guardrails: {
              canRead: ['customer', 'customerinvoice'],
              canWrite: ['customerinvoice'],
              requiresApproval: true,
              blockedOperations: [],
              dataScope: 'module',
            },
            triggerConfig: [],
          },
        });

        if (!createRes.ok()) {
          const errBody = await createRes.text();
          console.warn(`Agent creation failed (${createRes.status()}): ${errBody}`);
        } else {
          console.log(`Created test agent: ${AGENT_SLUG}`);
        }
      } else {
        console.warn('No prompts available — agent creation skipped');
      }
    } else {
      console.warn('Could not capture access token from login response');
    }
  });

  test('Search agent list and edit agent display name', async ({ page }) => {
    // ── Step 1: Navigate to /ai/admin/agents ───────────────────────────
    await spaNavigate(page, '/ai/admin/agents');
    await page.waitForTimeout(2000);

    // Verify agent list page loaded — table with rows visible
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 15000 });

    // ── Checkpoint 1: Agent List Page Loaded ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-agent-list-page.png`,
      fullPage: true,
    });

    // ── Step 2: Search for "ar-collector" ──────────────────────────────
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('ar-collector');

    // Wait for debounce (300ms) + network response
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify filtered results show our test agent
    const filteredRows = page.locator('table tbody tr');
    await expect(filteredRows.first()).toBeVisible({ timeout: 10000 });

    // Verify the agent slug appears in the filtered results
    const agentNameCell = page.locator('table tbody tr').first().getByText(/ar-collector/i);
    await expect(agentNameCell).toBeVisible({ timeout: 5000 });

    // ── Checkpoint 2: Search Results Filtered ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-results-filtered.png`,
      fullPage: true,
    });

    // ── Step 3: Click on the agent row to open edit form ────────────────
    const agentRow = page.locator('table tbody tr').first();
    await agentRow.click();

    // Wait for navigation to agent edit page
    await page.waitForURL('**/ai/admin/agents/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify edit form loaded with tabs
    const mainTab = page.getByRole('tab', { name: 'Main' });
    await expect(mainTab).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Tools' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Guardrails' })).toBeVisible();

    // ── Checkpoint 3: Agent Edit Form Loaded ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-agent-edit-form.png`,
      fullPage: true,
    });

    // ── Step 4: Update the display name ─────────────────────────────────
    // Read the current display name to ensure we're actually changing it
    const displayNameInput = page.getByPlaceholder('Invoice Creator Agent');
    await expect(displayNameInput).toBeVisible({ timeout: 5000 });
    const currentDisplayName = await displayNameInput.inputValue();

    // Pick a different name based on what's currently set
    const newDisplayName = currentDisplayName === UPDATED_DISPLAY_NAME
      ? AGENT_DISPLAY_NAME  // Toggle back to original
      : UPDATED_DISPLAY_NAME;

    await displayNameInput.clear();
    await displayNameInput.fill(newDisplayName);

    // Ensure the Prompt field is populated — required for save.
    // If the loaded agent's promptId doesn't resolve in the dropdown, select one.
    const promptCombobox = page.locator('button[role="combobox"]').nth(1);
    const promptText = await promptCombobox.textContent();
    if (promptText?.includes('Select a prompt')) {
      await promptCombobox.click();
      await page.waitForTimeout(300);
      const firstPromptOption = page.getByRole('option').first();
      if (await firstPromptOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstPromptOption.click();
        await page.waitForTimeout(300);
      }
    }

    // ── Step 5: Click Save ──────────────────────────────────────────────
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for the success toast
    const successToast = page.getByText(/agent updated successfully/i);
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Wait for page to update
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify heading updated to new display name
    await expect(
      page.getByRole('heading', { name: newDisplayName }),
    ).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 4: Agent Updated Successfully ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-agent-updated-success.png`,
      fullPage: true,
    });
  });
});
