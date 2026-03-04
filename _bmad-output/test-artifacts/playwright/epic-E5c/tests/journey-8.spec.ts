import { test, expect } from '@playwright/test';

import * as path from 'path';

// Resolve screenshots dir relative to this test file
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', '..', 'screenshots', 'epic-E5c', 'journey-8');

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

// Unique suffix to avoid 409 conflicts on re-runs
const AGENT_SLUG = `test-ar-collector-${Date.now()}`;
const AGENT_DISPLAY_NAME = 'AR Collection Agent';

test.describe('Journey 8: Create a New AI Agent', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
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
  });

  test('Create a new AI agent with model, prompt, guardrails, and tools', async ({ page }) => {
    // ── Step 1: Navigate to /ai/admin/agents ───────────────────────────
    await spaNavigate(page, '/ai/admin/agents');
    await page.waitForTimeout(2000);

    // Verify agent list page loaded
    const pageContent = page.getByText('Agent', { exact: false });
    await expect(pageContent.first()).toBeVisible({ timeout: 15000 });

    // ── Checkpoint 1: Agent List Page Loaded ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-agent-list-page.png`,
      fullPage: true,
    });

    // ── Step 2: Verify seeded agents visible ───────────────────────────
    // The agent list uses a table; verify at least some seeded agents are showing
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // ── Step 3: Click "New" button to create a new agent ────────────────
    const newButton = page.getByRole('button', { name: /new/i });
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();

    // Wait for navigation to agent form
    await page.waitForURL('**/ai/admin/agents/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify tabs are visible
    const mainTab = page.getByRole('tab', { name: 'Main' });
    await expect(mainTab).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Tools' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Guardrails' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Triggers' })).toBeVisible();

    // ── Checkpoint 2: Agent Form — Create Mode (Main Tab) ───────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-agent-form-create-mode.png`,
      fullPage: true,
    });

    // ── Step 4: Fill Main tab fields ────────────────────────────────────
    // Name field — use placeholder to disambiguate from "Display Name"
    const nameInput = page.getByPlaceholder('invoice-creator');
    await nameInput.fill(AGENT_SLUG);

    // Display Name field
    const displayNameInput = page.getByPlaceholder('Invoice Creator Agent');
    await displayNameInput.fill(AGENT_DISPLAY_NAME);

    // Description field
    const descriptionInput = page.getByPlaceholder('Describe what this agent does');
    await descriptionInput.fill('Handles accounts receivable collection workflows');

    // Model dropdown — select a model (look for Sonnet)
    const modelTrigger = page.locator('button[role="combobox"]').first();
    await modelTrigger.click();
    await page.waitForTimeout(300);
    // Try to find a Sonnet model option
    const modelOption = page.getByRole('option').filter({ hasText: /sonnet/i }).first();
    const modelOptionVisible = await modelOption.isVisible().catch(() => false);
    if (modelOptionVisible) {
      await modelOption.click();
    } else {
      // Pick the first non-auto option (index 0 is auto-route)
      const firstRealModel = page.getByRole('option').nth(1);
      if (await firstRealModel.isVisible().catch(() => false)) {
        await firstRealModel.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await page.waitForTimeout(300);

    // Prompt dropdown — select a prompt
    const promptTrigger = page.locator('button[role="combobox"]').nth(1);
    await promptTrigger.click();
    await page.waitForTimeout(300);
    // Pick the first available prompt
    const firstPrompt = page.getByRole('option').first();
    await expect(firstPrompt).toBeVisible({ timeout: 5000 });
    await firstPrompt.click();
    await page.waitForTimeout(300);

    // Routing Tags — click the "+ standard" tag button
    const standardTagButton = page.locator('button').filter({ hasText: '+ standard' });
    if (await standardTagButton.isVisible().catch(() => false)) {
      await standardTagButton.click();
    }

    // Max Turns — clear and fill with 15
    const maxTurnsInput = page.getByRole('spinbutton', { name: 'Max Turns' });
    await maxTurnsInput.clear();
    await maxTurnsInput.fill('15');

    // ── Checkpoint 3: Main Tab Filled ───────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-main-tab-filled.png`,
      fullPage: true,
    });

    // ── Step 5: Click Guardrails tab ────────────────────────────────────
    const guardrailsTab = page.getByRole('tab', { name: 'Guardrails' });
    await guardrailsTab.click();
    await page.waitForTimeout(500);

    // ── Step 6: Fill Guardrails tab ─────────────────────────────────────
    // canRead — TagInput: type entity name and press Enter
    const canReadInput = page.getByPlaceholder(/entity name.*press Enter/i).first();
    await expect(canReadInput).toBeVisible({ timeout: 5000 });
    await canReadInput.fill('customer');
    await canReadInput.press('Enter');
    await page.waitForTimeout(200);
    await canReadInput.fill('customerinvoice');
    await canReadInput.press('Enter');
    await page.waitForTimeout(200);

    // canWrite — TagInput: type entity name and press Enter
    const canWriteInput = page.getByPlaceholder(/entity name.*press Enter/i).nth(1);
    await canWriteInput.fill('customerinvoice');
    await canWriteInput.press('Enter');
    await page.waitForTimeout(200);

    // requiresApproval — toggle the switch ON
    const approvalSection = page.locator('.flex.items-center').filter({ hasText: /Require Approval/i });
    const approvalSwitch = approvalSection.locator('[role="switch"]');
    if (await approvalSwitch.isVisible().catch(() => false)) {
      const isChecked = await approvalSwitch.getAttribute('data-state');
      if (isChecked !== 'checked') {
        await approvalSwitch.click();
        await page.waitForTimeout(300);
      }
    }

    // dataScope — select "Module data"
    // The Data Scope select trigger
    const guardrailsContent = page.locator('[role="tabpanel"]');
    const dataScopeTrigger = guardrailsContent.locator('button[role="combobox"]').first();
    if (await dataScopeTrigger.isVisible().catch(() => false)) {
      await dataScopeTrigger.click();
      await page.waitForTimeout(300);
      const moduleOption = page.getByRole('option', { name: 'Module data' });
      await expect(moduleOption).toBeVisible({ timeout: 3000 });
      await moduleOption.click();
      await page.waitForTimeout(300);
    }

    // ── Checkpoint 4: Guardrails Tab Configured ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-guardrails-configured.png`,
      fullPage: true,
    });

    // ── Step 7: Click Tools tab ─────────────────────────────────────────
    const toolsTab = page.getByRole('tab', { name: 'Tools' });
    await toolsTab.click();
    await page.waitForTimeout(500);

    // ── Step 8: Fill Tools tab — JSON array of tool names ───────────────
    const toolsTextarea = page.getByLabel('Tool Configuration');
    await expect(toolsTextarea).toBeVisible({ timeout: 5000 });
    await toolsTextarea.clear();
    await toolsTextarea.fill('["query_overdue_invoices", "send_reminder_email", "create_follow_up_task"]');
    // Trigger blur to validate JSON
    await toolsTextarea.blur();
    await page.waitForTimeout(300);

    // ── Step 9: Click Save button ───────────────────────────────────────
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for navigation to the newly created agent's detail page
    await page.waitForURL((url) => {
      return url.pathname.includes('/ai/admin/agents/') && !url.pathname.includes('/new');
    }, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify we're on the agent detail page with correct data
    await expect(page.getByRole('heading', { name: AGENT_DISPLAY_NAME })).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 5: Agent Created Successfully ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-agent-created-success.png`,
      fullPage: true,
    });

    // Verify the name field has the correct value in edit mode
    const editNameInput = page.getByPlaceholder('invoice-creator');
    await expect(editNameInput).toHaveValue(AGENT_SLUG);
  });
});
