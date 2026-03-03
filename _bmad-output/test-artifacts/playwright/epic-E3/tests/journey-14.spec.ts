import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-14';

test.describe('Journey 14: Admin Navigates to Dead Letter Queue', () => {
  test('Admin logs in and navigates to the Dead Letter Queue page', async ({ page }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('textbox', { name: /password/i }).or(page.locator('input[type="password"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Visual checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // Step 2: Fill login form with admin credentials
    await page.getByRole('textbox', { name: /email/i }).fill('admin@nexa-test.co.uk');
    await page.locator('input[type="password"]').fill('Admin123!');

    // Step 3: Click Sign In
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login page (dashboard should load)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Visual checkpoint 2: Dashboard loaded with sidebar
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-dashboard-loaded.png` });

    // Verify sidebar is visible with System module section
    const sidebar = page.getByRole('navigation').or(page.locator('[data-testid="sidebar"]')).or(page.locator('nav, aside'));
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });

    // Step 4: Click Dead Letter Queue link in sidebar
    // Try multiple selector strategies for the DLQ link
    const dlqLink = page.getByRole('link', { name: /dead letter/i })
      .or(page.getByText(/dead letter queue/i))
      .or(page.locator('[data-testid="sidebar-link-dead-letter-queue"]'))
      .or(page.locator('a[href*="dead-letter"]'));

    await dlqLink.first().click({ timeout: 10000 });

    // Wait for DLQ page to load
    await page.waitForURL((url) => url.pathname.includes('dead-letter'), { timeout: 10000 });

    // Visual checkpoint 3: Dead Letter Queue page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-dlq-page-loaded.png` });

    // Verify DLQ page elements
    // Page heading
    const pageHeading = page.getByRole('heading', { name: /dead letter/i })
      .or(page.getByText(/dead letter queue/i).first());
    await expect(pageHeading).toBeVisible({ timeout: 5000 });

    // Filter controls should be present
    const filterSection = page.getByRole('textbox', { name: /event name/i })
      .or(page.getByPlaceholder(/event name/i))
      .or(page.locator('[data-testid="filter-event-name"]'));

    // Data table should be present (either with entries or showing empty state)
    const dataTable = page.getByRole('table')
      .or(page.locator('[data-testid="dlq-table"]'))
      .or(page.locator('table'));

    const emptyState = page.getByText(/no.*entries/i)
      .or(page.getByText(/no.*failed.*events/i))
      .or(page.getByText(/empty/i));

    // Either the table has rows or an empty state message is shown
    const tableVisible = await dataTable.first().isVisible().catch(() => false);
    const emptyVisible = await emptyState.first().isVisible().catch(() => false);

    expect(tableVisible || emptyVisible).toBe(true);
  });
});
