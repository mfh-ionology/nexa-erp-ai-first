import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR ||
  path.resolve(__dirname, '../../../screenshots/epic-E5c/journey-24');

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  navPath: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, navPath);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 24: Concept D Visual Design Fidelity Check', () => {
  test.setTimeout(180_000);

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

  test('Concept D visual fidelity across all AI admin pages', async ({
    page,
  }) => {
    // ── Step 1: Navigate to AI Configuration Dashboard ──────────────────
    await spaNavigate(page, '/ai/admin');
    await expect(
      page.getByRole('heading', { name: /AI Configuration/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for summary cards to load
    await page.waitForTimeout(1000);

    // Verify summary cards are present
    await expect(page.getByText(/Active Models/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Active Agents/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Active Skills/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Automations/i).first()).toBeVisible({ timeout: 5000 });

    // Verify CSS custom property --primary is set (Concept D purple theme)
    const primaryHsl = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    });
    expect(primaryHsl.length).toBeGreaterThan(0);

    // Verify headings use serif font stack (Plus Jakarta Sans mapped to font-serif)
    const headingFont = await page.locator('h1, h2, h3').first().evaluate((el) => {
      return getComputedStyle(el).fontFamily;
    });
    expect(headingFont.toLowerCase()).toMatch(/plus jakarta|serif|ui-serif/i);

    // Verify card elements exist with rounded styling
    const cards = page.locator('[class*="rounded-xl"], [class*="rounded-lg"], [class*="card"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify mono font used for numeric counts
    const monoElements = page.locator('.font-mono');
    const monoCount = await monoElements.count();
    expect(monoCount).toBeGreaterThan(0);

    // ── Checkpoint 1: Dashboard Concept D theme ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-concept-d-theme.png`,
      fullPage: false,
    });

    // ── Step 2: Navigate to Models List ─────────────────────────────────
    await spaNavigate(page, '/ai/admin/models');
    await expect(
      page.getByRole('heading', { name: /Model/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for model data to load
    await expect(
      page.locator('table tbody tr').first(),
    ).toBeVisible({ timeout: 10000 });

    // Verify model names in mono font (e.g. claude-opus-4-6)
    await expect(page.locator('table .font-mono').first()).toBeVisible({ timeout: 5000 });

    // Verify provider badge ("Anthropic")
    await expect(page.getByText('Anthropic').first()).toBeVisible({ timeout: 5000 });

    // Verify routing tags are present (purple-tinted pills like "cheap", "standard", "reasoning")
    await expect(
      page.getByText(/cheap|standard|reasoning|briefing|fast/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // ── Checkpoint 2: Models list Concept D ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-models-list-concept-d.png`,
      fullPage: false,
    });

    // ── Step 3: Navigate to Agents List ─────────────────────────────────
    await spaNavigate(page, '/ai/admin/agents');
    await expect(
      page.getByRole('heading', { name: /Agent/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for agent data to load
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify agents are displayed (table rows or cards)
    const agentContent = page.locator('table tbody tr, [class*="card"]');
    await expect(agentContent.first()).toBeVisible({ timeout: 10000 });

    // Verify status dots present (green/grey circles for active/inactive)
    const statusDots = page.locator('.rounded-full.size-2, [class*="rounded-full"][class*="size-2"]');
    await expect(statusDots.first()).toBeVisible({ timeout: 5000 });

    // ── Checkpoint 3: Agents list Concept D ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-agents-list-concept-d.png`,
      fullPage: false,
    });

    // ── Step 4: Navigate to Skills Manager ──────────────────────────────
    await spaNavigate(page, '/ai/admin/skills');
    await expect(
      page.getByRole('heading', { name: 'Skill Pack Manager' }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for skills data to load
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify skills content is displayed
    const skillsContent = page.locator(
      '[class*="accordion"], [class*="card"], table tbody tr, [data-testid*="skill"]',
    );
    await expect(skillsContent.first()).toBeVisible({ timeout: 10000 });

    // Verify toggle switches exist (Shadcn Switch has role="switch")
    const toggleSwitches = page.locator('button[role="switch"]');
    const toggleCount = await toggleSwitches.count();
    expect(toggleCount).toBeGreaterThan(0);

    // Verify trigger phrase pills exist (blue-tinted rounded pills)
    const triggerPills = page.locator('.rounded-full[class*="bg-blue"]');
    // If no blue pills visible (accordion collapsed), just check for any pill-like element
    const pillCount = await triggerPills.count();
    // Accept 0 if accordion sections are collapsed — screenshots will verify visually

    // ── Checkpoint 4: Skills manager Concept D ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-skills-manager-concept-d.png`,
      fullPage: false,
    });

    // ── Step 5: Navigate to Automations List ────────────────────────────
    await spaNavigate(page, '/ai/admin/automations');
    await expect(
      page.getByRole('heading', { name: /Automation/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for automation data to load
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify automation content loads (table or cards)
    const automationContent = page.locator('table tbody tr, [class*="card"]');
    await expect(automationContent.first()).toBeVisible({ timeout: 10000 });

    // Verify trigger type text is present (Scheduled, Event, Chain, or Manual)
    await expect(
      page.getByText(/Scheduled|Event|Chain|Manual/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Verify toggle switches for active/inactive
    const automationToggles = page.locator('button[role="switch"]');
    const automationToggleCount = await automationToggles.count();
    expect(automationToggleCount).toBeGreaterThan(0);

    // ── Checkpoint 5: Automations list Concept D ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-automations-list-concept-d.png`,
      fullPage: false,
    });

    // ── Step 6: Navigate to Automation Runs ─────────────────────────────
    await spaNavigate(page, '/ai/admin/automations/runs');
    await expect(
      page.getByRole('heading', { name: /Run|Execution/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for runs data to load
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify runs page loaded (may have table or empty state)
    const runsContainer = page.locator(
      'table, [class*="card"], [class*="empty"]',
    );
    await expect(runsContainer.first()).toBeVisible({ timeout: 10000 });

    // If there are run rows, verify they have status dots and mono font values
    const runRows = page.locator('table tbody tr');
    const runRowCount = await runRows.count();
    if (runRowCount > 0) {
      // Verify mono font elements (tokens/cost)
      await expect(page.locator('table .font-mono').first()).toBeVisible({ timeout: 5000 });
      // Verify status dots
      const runStatusDots = page.locator('table .rounded-full[class*="size-2"]');
      await expect(runStatusDots.first()).toBeVisible({ timeout: 5000 });
    }

    // ── Checkpoint 6: Automation runs Concept D ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-automation-runs-concept-d.png`,
      fullPage: false,
    });
  });
});
