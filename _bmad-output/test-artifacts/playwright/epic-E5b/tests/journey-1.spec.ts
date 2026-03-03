import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-1';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 1: AI Section Appears in Sidebar Navigation', () => {
  test('AI sidebar section exists with Morning Briefing, My Memory, and Skills items', async ({
    page,
  }) => {
    // Pre-step: Log in to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill login form — the app redirects unauthenticated users to login
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for the sidebar to appear after login (indicates dashboard loaded)
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // Checkpoint 1: Screenshot of app shell loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-app-shell-loaded.png`,
      fullPage: true,
    });

    // Step 2: Verify the AI section heading exists in the sidebar
    // The sidebar renders group titles as uppercase <span> elements
    const aiSectionHeading = sidebar.getByText('AI', { exact: true });
    await expect(aiSectionHeading).toBeVisible();

    // Step 3: The sidebar uses a flat layout (no collapsible accordion per section).
    // All nav items are always visible when the sidebar is expanded.
    // Verify the 3 AI navigation items exist.

    const morningBriefingLink = sidebar.getByRole('link', { name: 'Morning Briefing' });
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    const skillsLink = sidebar.getByRole('link', { name: 'Skills' });

    await expect(morningBriefingLink).toBeVisible();
    await expect(myMemoryLink).toBeVisible();
    await expect(skillsLink).toBeVisible();

    // Checkpoint 2: Screenshot showing AI section with all 3 items
    // Scroll the AI section into view first for a cleaner screenshot
    await aiSectionHeading.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-ai-section-with-items.png`,
      fullPage: true,
    });

    // Step 4: Verify all 3 items have the correct text
    await expect(morningBriefingLink).toHaveText('Morning Briefing');
    await expect(myMemoryLink).toHaveText('My Memory');
    await expect(skillsLink).toHaveText('Skills');

    // Verify the links point to the correct routes
    await expect(morningBriefingLink).toHaveAttribute('href', '/ai/briefing');
    await expect(myMemoryLink).toHaveAttribute('href', '/ai/memory');
    await expect(skillsLink).toHaveAttribute('href', '/ai/skills');

    // Verify divider exists above the AI section (showDivider: true)
    // The divider is a div with border-t class rendered before the AI group heading
    const aiGroupContainer = aiSectionHeading.locator('..');
    const divider = aiGroupContainer.locator('div.border-t').first();
    await expect(divider).toBeVisible();
  });
});
