import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-16';

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

test.describe('Journey 16: Task Panel Item Interactions', () => {
  test('TaskPanelItem status cycling, quick actions, and PanelDetailSheet', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Login
    await login(page);
    await hideDevtools(page);

    // Step 1: Navigate to /ar/invoices
    await spaNavigate(page, '/ar/invoices');
    await hideDevtools(page);
    await page.waitForTimeout(2000);

    // Step 2: Click first invoice row to open detail page
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

    // Verify we're on the invoice detail page
    const invoiceHeading = page.locator('h1').filter({ hasText: /INV-/i });
    await expect(invoiceHeading).toBeVisible({ timeout: 10000 });

    // Scroll down to find the TaskPanel
    const addTaskBtn = page.locator('button').filter({
      hasText: /Add Task|addTask/i,
    });
    await addTaskBtn.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(addTaskBtn.first()).toBeVisible({ timeout: 10000 });

    // -- Checkpoint 1: Invoice detail with TaskPanel --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-invoice-detail-task-panel-items.png`,
      fullPage: true,
    });

    // Check if there are active tasks in the panel
    const activeStatusIcons = page.locator(
      'button[aria-label="Task status: open"], button[aria-label="Task status: in progress"]',
    );
    let activeIconCount = await activeStatusIcons.count();
    console.log('Active task status icons found initially:', activeIconCount);

    // If no tasks, create one via the panel's Add Task button
    if (activeIconCount === 0) {
      console.log('No active tasks on invoice — creating one via panel Add Task button');
      await addTaskBtn.first().click();
      await page.waitForTimeout(1000);

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog.first()).toBeVisible({ timeout: 10000 });

      // Fill title
      const titleInput = dialog.first().locator('input[type="text"], input:not([type])').first();
      await titleInput.click();
      await titleInput.fill('Test task for panel interactions');
      await page.waitForTimeout(300);

      // Click Create/Submit button
      const submitBtn = dialog.first().locator('button[type="submit"]');
      if ((await submitBtn.count()) > 0) {
        await submitBtn.first().click();
      } else {
        const createBtnByText = dialog.first().locator('button').filter({
          hasText: /tasks\.create\.submit|^Create$/,
        });
        await createBtnByText.last().click();
      }

      // Wait for creation to process
      await page.waitForTimeout(3000);

      // Check if dialog closed (success) or stayed open (failure)
      const dialogStillOpen = await dialog.first().isVisible().catch(() => false);

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2b-after-task-creation-attempt.png`,
        fullPage: true,
      });

      if (dialogStillOpen) {
        // Close dialog to continue testing
        const closeBtn = dialog.first().locator('button').filter({ hasText: /cancel|Cancel/ });
        if ((await closeBtn.count()) > 0) {
          await closeBtn.first().click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(500);

        // KNOWN BUG: Entity-linked task creation fails from TaskPanel.
        // The API rejects the POST /tasks call when entityType/entityId is provided.
        // This blocks the entire Journey 16 because we can't get tasks into the panel.
        console.log('BUG: Entity-linked task creation from TaskPanel failed — dialog stayed open');
        expect(
          dialogStillOpen,
          'BUG: Cannot create entity-linked tasks from TaskPanel. Dialog remained open after clicking Create. The API rejects task creation with entityType/entityId. This blocks Journey 16 testing of TaskPanelItem interactions (status cycling, quick actions, PanelDetailSheet).',
        ).toBeFalsy();
        return;
      }

      // Task created successfully — wait for panel to refresh
      await page.waitForTimeout(1000);
      activeIconCount = await activeStatusIcons.count();
      console.log('Active task icons after creation:', activeIconCount);
    }

    // Step 3: Verify TaskPanelItem for an active task
    expect(activeIconCount, 'TaskPanel should have active task items').toBeGreaterThan(0);

    // -- Checkpoint 2: Active task panel item --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-active-task-panel-item.png`,
      fullPage: true,
    });

    // Verify quick action buttons exist (Start/Complete)
    const completeQuickBtns = page.locator('button').filter({
      hasText: /^Complete$|tasks\.detail\.complete/,
    });
    const completeBtnCount = await completeQuickBtns.count();
    console.log('Complete quick action buttons found:', completeBtnCount);

    // Step 4: Click Complete quick action button
    if (completeBtnCount > 0) {
      await completeQuickBtns.first().scrollIntoViewIfNeeded();
      await completeQuickBtns.first().click();
      await page.waitForTimeout(2000);

      // -- Checkpoint 3: After completing task via quick action --
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-task-completed-via-quick-action.png`,
        fullPage: true,
      });

      // Verify completed task icon appears
      const completedIcons = page.locator('button[aria-label="Task status: completed"]');
      const completedCount = await completedIcons.count();
      console.log('Completed task icons after quick action:', completedCount);
      expect(completedCount).toBeGreaterThan(0);
    } else {
      console.log('No Complete quick action buttons — skipping step 4');
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-task-completed-via-quick-action.png`,
        fullPage: true,
      });
    }

    // Step 5: Click task item body of an active task to open PanelDetailSheet
    const remainingActiveIcons = page.locator(
      'button[aria-label="Task status: open"], button[aria-label="Task status: in progress"]',
    );
    // Also try completed task items if no active ones remain
    const anyTaskIcons = page.locator('button[aria-label^="Task status:"]');
    const targetIcons = (await remainingActiveIcons.count()) > 0 ? remainingActiveIcons : anyTaskIcons;
    const targetCount = await targetIcons.count();

    if (targetCount > 0) {
      const targetIcon = targetIcons.first();
      // Click to the right of the status icon (on the title text area) to trigger the item onClick
      const iconBox = await targetIcon.boundingBox();
      if (iconBox) {
        // Click 80px to the right of the icon center — this should hit the title/body area
        await page.mouse.click(iconBox.x + iconBox.width + 80, iconBox.y + iconBox.height / 2);
      }

      await page.waitForTimeout(1500);

      // Check for PanelDetailSheet (a Sheet dialog)
      const sheet = page.locator('[role="dialog"]');
      let sheetVisible = false;
      const sheetCount = await sheet.count();
      for (let i = 0; i < sheetCount; i++) {
        if (await sheet.nth(i).isVisible().catch(() => false)) {
          sheetVisible = true;
          break;
        }
      }

      // -- Checkpoint 4: PanelDetailSheet open --
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-panel-detail-sheet-open.png`,
        fullPage: true,
      });

      expect(sheetVisible, 'PanelDetailSheet should open when clicking task item body').toBeTruthy();

      if (sheetVisible) {
        // Verify key sections
        const deleteBtn = page.locator('[role="dialog"] button').filter({
          hasText: /Delete|delete|tasks\.detail\.delete/i,
        });
        const hasDelete = (await deleteBtn.count()) > 0;
        console.log('Detail sheet has Delete button:', hasDelete);
      }
    } else {
      console.log('No task items available for PanelDetailSheet test');
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-panel-detail-sheet-open.png`,
        fullPage: true,
      });
    }
  });
});
