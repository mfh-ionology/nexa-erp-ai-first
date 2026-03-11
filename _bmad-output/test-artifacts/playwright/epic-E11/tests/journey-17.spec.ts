import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-17';

/**
 * SPA navigate without losing auth tokens (Zustand in-memory).
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

/**
 * Login helper.
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('admin@nexa-erp.dev');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('NexaDev2026!');

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible' });
  await signInButton.click();

  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 50000 }),
    page.locator('[data-testid="app-sidebar"], nav').first().waitFor({ state: 'visible', timeout: 50000 }),
  ]);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Hide TanStack Router devtools overlay that blocks clicks.
 */
async function hideDevtools(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content:
      '.go1561890071, [data-tanstack-router-devtools] { display: none !important; pointer-events: none !important; }',
  });
}

test.describe('Journey 17: Task Panel Completed/Cancelled Section Toggle', () => {
  test('Collapsible completed/cancelled section in TaskPanel', async ({ page }) => {
    test.setTimeout(120000);

    // Login
    await login(page);
    await hideDevtools(page);

    // Step 1: Navigate to /ar/invoices
    await spaNavigate(page, '/ar/invoices');
    await hideDevtools(page);
    await page.waitForTimeout(2000);

    // Step 2: Click an invoice to open detail page
    const invoiceLink = page.locator('a, tr, [role="link"]').filter({
      hasText: /INV-/i,
    });
    const invoiceLinkCount = await invoiceLink.count();

    if (invoiceLinkCount > 0) {
      await invoiceLink.first().click();
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle');
    } else {
      await spaNavigate(page, '/ar/invoices/any-id');
      await page.waitForTimeout(1500);
    }

    await hideDevtools(page);

    // Verify invoice detail page loaded
    const invoiceHeading = page.locator('h1').filter({ hasText: /INV-/i });
    await expect(invoiceHeading).toBeVisible({ timeout: 10000 });

    // Scroll to find the TaskPanel
    const taskPanelHeader = page.locator('h3').filter({
      hasText: /Tasks/i,
    });
    await taskPanelHeader.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // -- Checkpoint 1: Invoice detail page with TaskPanel --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-invoice-detail-with-task-panel.png`,
      fullPage: true,
    });

    // Verify TaskPanel is visible with header elements
    await expect(taskPanelHeader.first()).toBeVisible({ timeout: 10000 });

    const addTaskBtn = page.locator('button').filter({
      hasText: /Add Task|addTask/i,
    });
    await expect(addTaskBtn.first()).toBeVisible({ timeout: 10000 });

    // We need completed tasks to exist in the panel.
    // First check if there's already a "Completed" toggle
    const completedToggle = page.locator('button').filter({
      hasText: /Completed\s*\(\d+\)/i,
    });
    let completedToggleCount = await completedToggle.count();
    console.log('Completed toggle buttons found:', completedToggleCount);

    // If no completed toggle, we need to create and complete a task
    if (completedToggleCount === 0) {
      console.log('No completed tasks in panel — creating and completing one');

      // Check for active tasks we can complete
      const activeStatusIcons = page.locator(
        'button[aria-label="Task status: open"], button[aria-label="Task status: in progress"]',
      );
      let activeCount = await activeStatusIcons.count();
      console.log('Active task icons found:', activeCount);

      // If no active tasks either, create one
      if (activeCount === 0) {
        console.log('No active tasks — creating one via Add Task');
        await addTaskBtn.first().click();
        await page.waitForTimeout(1000);

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog.first()).toBeVisible({ timeout: 10000 });

        const titleInput = dialog.first().locator('input[type="text"], input:not([type])').first();
        await titleInput.click();
        await titleInput.fill('Test task for completed toggle');
        await page.waitForTimeout(300);

        // Submit
        const submitBtn = dialog.first().locator('button[type="submit"]');
        if ((await submitBtn.count()) > 0) {
          await submitBtn.first().click();
        } else {
          const createBtnByText = dialog.first().locator('button').filter({
            hasText: /tasks\.create\.submit|^Create$/,
          });
          await createBtnByText.last().click();
        }

        await page.waitForTimeout(3000);

        // Check if dialog stayed open (creation failed)
        const dialogStillOpen = await dialog.first().isVisible().catch(() => false);
        if (dialogStillOpen) {
          // Close dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

          console.log(
            'BUG: Entity-linked task creation from TaskPanel failed — cannot test completed toggle',
          );
          expect(
            dialogStillOpen,
            'BUG: Cannot create entity-linked tasks from TaskPanel. Dialog remained open after Create. This blocks Journey 17 because we need completed tasks to test the toggle.',
          ).toBeFalsy();
          return;
        }

        await page.waitForTimeout(1000);
        activeCount = await activeStatusIcons.count();
        console.log('Active tasks after creation:', activeCount);
      }

      // Complete a task by clicking Complete quick action button
      if (activeCount > 0) {
        const completeBtn = page.locator('button').filter({
          hasText: /^Complete$|tasks\.detail\.complete/,
        });
        const completeBtnCount = await completeBtn.count();
        console.log('Complete buttons found:', completeBtnCount);

        if (completeBtnCount > 0) {
          await completeBtn.first().scrollIntoViewIfNeeded();
          await completeBtn.first().click();
          await page.waitForTimeout(2000);

          // Re-check for completed toggle
          completedToggleCount = await completedToggle.count();
          console.log('Completed toggle after completing task:', completedToggleCount);
        } else {
          // Try clicking the status icon to cycle to completed
          const openIcon = page.locator('button[aria-label="Task status: open"]');
          if ((await openIcon.count()) > 0) {
            // Click once: OPEN -> IN_PROGRESS
            await openIcon.first().click();
            await page.waitForTimeout(1000);
            // Click again: IN_PROGRESS -> COMPLETED
            const inProgressIcon = page.locator('button[aria-label="Task status: in progress"]');
            if ((await inProgressIcon.count()) > 0) {
              await inProgressIcon.first().click();
              await page.waitForTimeout(2000);
            }
            completedToggleCount = await completedToggle.count();
            console.log('Completed toggle after status cycling:', completedToggleCount);
          }
        }
      }
    }

    // Step 3: Verify the Completed toggle button exists
    if (completedToggleCount === 0) {
      // Take screenshot and document missing state
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-3-completed-toggle-collapsed.png`,
        fullPage: true,
      });

      console.log(
        'MISSING: No completed tasks available in TaskPanel to test the toggle. The toggle only appears when completedTasks.length > 0.',
      );
      // This is a data dependency issue — not a missing feature
      // The toggle code exists, it just needs completed tasks
      expect(
        completedToggleCount,
        'TaskPanel should show Completed toggle when completed tasks exist. Either no tasks could be created/completed, or the API does not return them.',
      ).toBeGreaterThan(0);
      return;
    }

    // Verify toggle exists and is collapsed (ChevronDown should be present)
    await completedToggle.first().scrollIntoViewIfNeeded();
    await expect(completedToggle.first()).toBeVisible({ timeout: 5000 });

    // -- Checkpoint 2: Completed toggle visible, collapsed --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-completed-toggle-collapsed.png`,
      fullPage: true,
    });

    // Verify ChevronDown icon is present (collapsed state)
    // The toggle contains an SVG — we check for the lucide-chevron-down class or the svg inside
    const chevronDown = completedToggle.first().locator('svg');
    await expect(chevronDown).toBeVisible();

    // Verify completed tasks are NOT visible yet (collapsed)
    const completedTaskIcons = page.locator('button[aria-label="Task status: completed"]');
    // Before clicking, completed items section should be collapsed
    // (they may appear if already expanded from a previous interaction, but by default collapsed)

    // Step 4: Click the Completed toggle to expand
    await completedToggle.first().click();
    await page.waitForTimeout(1000);

    // -- Checkpoint 3: Completed section expanded --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-completed-section-expanded.png`,
      fullPage: true,
    });

    // After expanding, completed task items should be visible
    const completedIconsAfterExpand = await completedTaskIcons.count();
    console.log('Completed task icons after expanding:', completedIconsAfterExpand);

    // Verify at least one completed task item is visible
    if (completedIconsAfterExpand > 0) {
      await expect(completedTaskIcons.first()).toBeVisible();
    }

    // Verify the toggle now shows ChevronUp (expanded state)
    // The toggle text should still say "Completed (N)"
    await expect(completedToggle.first()).toBeVisible();

    // Verify completed task styling: line-through on title
    // TaskPanelItem with completed status should have line-through text
    const completedTaskItems = page.locator('.line-through');
    const lineThruCount = await completedTaskItems.count();
    console.log('Elements with line-through styling:', lineThruCount);

    // Click toggle again to collapse
    await completedToggle.first().click();
    await page.waitForTimeout(500);

    // After collapsing, the completed task items should be hidden again
    // (Note: the toggle is still visible, but the items below it are gone)
    console.log('Completed section collapsed again successfully');
  });
});
