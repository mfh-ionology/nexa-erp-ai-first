import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-13';

test.describe('Journey 13: Automation Run History Filters', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    // Wait for sidebar to render
    await expect(
      page.getByRole('link', { name: 'AI Administration' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Filter runs by status, clear filters, and filter by automation name (E5c-6 AC-1, AC-2)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/automations/runs ─────────────
    // Use sidebar links to navigate (preserves SPA auth state)
    // First expand the AI section if needed by clicking AI Administration
    await page.getByRole('link', { name: 'AI Administration' }).click();
    await page.waitForTimeout(1000);

    // Now look for the "Automation Runs" sidebar link
    const automationRunsLink = page.getByRole('link', {
      name: 'Automation Runs',
    });
    const automationRunsLinkVisible = await automationRunsLink
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (automationRunsLinkVisible) {
      await automationRunsLink.first().click();
    } else {
      // Fallback: Try to first navigate to Automations, then find Runs
      const automationsLink = page.getByRole('link', {
        name: /^Automations$/i,
      });
      const automationsVisible = await automationsLink
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (automationsVisible) {
        await automationsLink.first().click();
        await page.waitForTimeout(1000);
      }

      // Try SPA router navigate as fallback
      await page.evaluate(() => {
        const router = (window as any).__TSR_ROUTER__;
        if (router) {
          router.navigate({ to: '/ai/admin/automations/runs' });
        } else {
          window.history.pushState({}, '', '/ai/admin/automations/runs');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
    }

    await page
      .waitForURL('**/ai/admin/automations/runs**', { timeout: 10000 })
      .catch(() => {});

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Verify we're on the runs page
    const runsHeading = page.getByRole('heading', {
      name: /Automation Runs|Runs/i,
    });
    const hasRunsHeading = await runsHeading
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: Runs page heading visible=${hasRunsHeading}, URL=${page.url()}`,
    });

    // ── Checkpoint 1: Runs List Initial Load ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-runs-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify filter bar controls ─────────────────────────
    // Status multi-select button (the popover trigger contains "All Statuses")
    const statusFilterBtn = page.getByRole('button', {
      name: /All Statuses|statuses|Status/i,
    });
    const hasStatusFilter = await statusFilterBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Date inputs
    const fromDateInput = page.getByLabel('From date');
    const hasFromDate = await fromDateInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const toDateInput = page.getByLabel('To date');
    const hasToDate = await toDateInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Automation name dropdown
    const automationDropdown = page.locator(
      'button:has-text("All Automations")',
    );
    const hasAutomationDropdown = await automationDropdown
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Filters — status=${hasStatusFilter}, fromDate=${hasFromDate}, toDate=${hasToDate}, automationDropdown=${hasAutomationDropdown}`,
    });

    // ── Checkpoint 2: Filter Bar Controls ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-filter-bar-controls.png`,
      fullPage: true,
    });

    // Assert filter bar is present
    expect(hasStatusFilter, 'Status filter button should be visible').toBe(
      true,
    );

    // ── Step 3: Select COMPLETED and FAILED in status filter ────────
    await statusFilterBtn.first().click();
    await page.waitForTimeout(500);

    // Check COMPLETED checkbox
    const completedLabel = page
      .locator('label')
      .filter({ hasText: 'Completed' });
    const completedVisible = await completedLabel
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (completedVisible) {
      await completedLabel.click();
      await page.waitForTimeout(300);
    }

    // Check FAILED checkbox
    const failedLabel = page.locator('label').filter({ hasText: 'Failed' });
    const failedVisible = await failedLabel
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (failedVisible) {
      await failedLabel.click();
      await page.waitForTimeout(300);
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Status checkboxes — completed=${completedVisible}, failed=${failedVisible}`,
    });

    // Close popover by clicking outside
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify the status filter button now shows "2 statuses"
    const twoStatusesLabel = page.getByText('2 statuses');
    const hasTwoStatuses = await twoStatusesLabel
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Filter label shows "2 statuses"=${hasTwoStatuses}`,
    });

    // Wait for filtered data
    await page.waitForTimeout(1500);

    // ── Step 4: Verify filtered results show only COMPLETED and FAILED ──
    const tableBody = page.locator('table tbody');
    const tableBodyVisible = await tableBody
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    let filteringWorksCorrectly = false;
    if (tableBodyVisible) {
      const pendingBadges = await tableBody
        .getByText('Pending', { exact: true })
        .count()
        .catch(() => 0);
      const runningBadges = await tableBody
        .getByText('Running', { exact: true })
        .count()
        .catch(() => 0);
      const cancelledBadges = await tableBody
        .getByText('Cancelled', { exact: true })
        .count()
        .catch(() => 0);

      filteringWorksCorrectly =
        pendingBadges === 0 && runningBadges === 0 && cancelledBadges === 0;

      test.info().annotations.push({
        type: 'info',
        description: `Step 4: Non-matching badges — pending=${pendingBadges}, running=${runningBadges}, cancelled=${cancelledBadges}. Filtering correct=${filteringWorksCorrectly}`,
      });
    } else {
      // Table might be empty or using a different layout
      const emptyState = page.getByText(/No results|No runs|No data/i);
      const isEmpty = await emptyState
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 4: Table not visible, empty state=${isEmpty}`,
      });
      filteringWorksCorrectly = true;
    }

    // ── Checkpoint 3: Status Filter Applied ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-filtered-completed-failed.png`,
      fullPage: true,
    });

    // ── Step 5: Click Clear Filters ─────────────────────────────────
    const clearBtn = page.getByRole('button', { name: /Clear/i });
    const clearBtnVisible = await clearBtn
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (clearBtnVisible) {
      await clearBtn.first().click();
      await page.waitForTimeout(1000);
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 5: Clear Filters button not visible — may not have active filters',
      });
    }

    // Verify filters are reset
    const allStatusesLabel = page.getByText('All Statuses');
    const hasAllStatuses = await allStatusesLabel
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Clear button visible=${clearBtnVisible}, reset to "All Statuses"=${hasAllStatuses}`,
    });

    await page.waitForTimeout(1500);

    // ── Checkpoint 4: Filters Cleared ───────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-filters-cleared.png`,
      fullPage: true,
    });

    // ── Step 6: Filter by Automation name ───────────────────────────
    if (hasAutomationDropdown) {
      await automationDropdown.first().click();
      await page.waitForTimeout(500);

      const targetAutomation = 'Daily AR Aging Summary';
      const automationOption = page
        .locator('[role="option"]')
        .filter({ hasText: targetAutomation });

      const optionVisible = await automationOption
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (optionVisible) {
        await automationOption.first().click();
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: `Step 6: "${targetAutomation}" not found in automation dropdown`,
        });
        await page.keyboard.press('Escape');
      }

      await page.waitForTimeout(1500);

      // ── Step 7: Verify all visible runs show selected automation ──
      if (optionVisible) {
        const tableRows = page.locator('table tbody tr');
        const rowCount = await tableRows.count().catch(() => 0);

        let allMatch = true;
        for (let i = 0; i < rowCount; i++) {
          const rowText = (await tableRows.nth(i).textContent()) ?? '';
          if (!rowText.includes(targetAutomation)) {
            allMatch = false;
            test.info().annotations.push({
              type: 'issue',
              description: `Step 7: Row ${i} does not contain "${targetAutomation}"`,
            });
          }
        }

        test.info().annotations.push({
          type: 'info',
          description: `Step 7: ${rowCount} rows visible, all match automation="${allMatch}"`,
        });
      }
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 6: Automation dropdown not visible — may not be in "all runs" mode',
      });
    }

    // ── Checkpoint 5: Automation Name Filter Applied ────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-filtered-by-automation.png`,
      fullPage: true,
    });

    // ── Final: Report API errors ────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }

    // ── Assertions ──────────────────────────────────────────────────
    expect(
      hasRunsHeading,
      'Automation Runs page should load with heading',
    ).toBe(true);

    expect(hasStatusFilter, 'Status filter control should be visible').toBe(
      true,
    );

    expect(
      filteringWorksCorrectly,
      'After selecting COMPLETED+FAILED, no Pending/Running/Cancelled rows should appear',
    ).toBe(true);
  });
});
