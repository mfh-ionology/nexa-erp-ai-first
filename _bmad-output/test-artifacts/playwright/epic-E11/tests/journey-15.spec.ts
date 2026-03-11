import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-15';

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

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle');
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

test.describe('Journey 15: Task Panel on Invoice Detail Page', () => {
  test('TaskPanel embedded on invoice detail page with entity-linked task creation', async ({
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
    const invoiceHeading = page.locator('h1').filter({ hasText: /INV-2026-0042/i });
    await expect(invoiceHeading).toBeVisible({ timeout: 10000 });

    // Step 3: Verify TaskPanel is visible on the detail page
    // Look for the "+ Add Task" button (may show i18n key "tasks.panel.addTask" or resolved "Add Task")
    const addTaskBtn = page.locator('button').filter({
      hasText: /Add Task|addTask/i,
    });
    await expect(addTaskBtn.first()).toBeVisible({ timeout: 10000 });

    // -- Checkpoint 1: Invoice detail page with TaskPanel visible --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-invoice-detail-with-task-panel.png`,
      fullPage: true,
    });

    // Step 4: Click "+ Add Task" button in TaskPanel header
    await addTaskBtn.first().click();
    await page.waitForTimeout(1000);

    // Verify Create Task dialog opens
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.first()).toBeVisible({ timeout: 10000 });

    // Verify entity link chip with INV-2026-0042
    const entityChip = dialog.first().locator('span').filter({ hasText: /INV-2026-0042/i });
    await expect(entityChip.first()).toBeVisible({ timeout: 5000 });

    // -- Checkpoint 2: Create Task dialog with entity pre-filled --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-create-dialog-entity-prefilled.png`,
      fullPage: true,
    });

    // Step 5: Fill in the task title
    const titleInput = dialog.first().locator('input[type="text"], input:not([type])').first();
    await titleInput.click();
    await titleInput.fill('Chase payment for this invoice');
    await page.waitForTimeout(300);
    await expect(titleInput).toHaveValue('Chase payment for this invoice');

    // Step 6: Click "Create" button
    // Button text may be raw i18n key "tasks.create.submit" or resolved "Create"
    const submitBtn = dialog.first().locator('button[type="submit"]');
    const submitBtnCount = await submitBtn.count();

    if (submitBtnCount > 0) {
      await submitBtn.first().click();
    } else {
      const createBtnByText = dialog.first().locator('button').filter({
        hasText: /tasks\.create\.submit|^Create$/,
      });
      await createBtnByText.last().click();
    }

    // Wait for creation to process
    await page.waitForTimeout(3000);

    // -- Checkpoint 3: After submit --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-task-created-panel-refreshed.png`,
      fullPage: true,
    });

    // Check outcome: dialog should close on success
    const dialogStillVisible = await dialog.first().isVisible().catch(() => false);

    if (!dialogStillVisible) {
      // Dialog closed — task creation succeeded
      const newTaskText = page.getByText('Chase payment for this invoice');
      const taskVisible = await newTaskText.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(taskVisible).toBeTruthy();
    } else {
      // Dialog stayed open — API likely failed.
      // Check for error toast (destructive variant from onError)
      const errorToast = page.locator('[data-sonner-toast][data-type="error"], [role="status"]').filter({
        hasText: /fail|error|createFailed/i,
      });
      const hasErrorToast = await errorToast.first().isVisible().catch(() => false);

      // BUG: Task creation from TaskPanel context fails — dialog stays open.
      // The API call to POST /tasks with entityType/entityId is rejected.
      // This is a known bug to document rather than a test issue.
      // Mark test as soft-fail: the UI elements (panel, dialog, entity chip) work correctly,
      // but the backend task creation fails.
      console.log('BUG: Create Task dialog stayed open after submit — API call likely failed');
      console.log('Error toast visible:', hasErrorToast);

      // Still fail the test to flag the bug
      expect(
        dialogStillVisible,
        'BUG: Dialog remained open after clicking Create — task creation API call failed. EntityType=CustomerInvoice, EntityId=mock-uuid. See missing-functionality-epic-E11.md.',
      ).toBeFalsy();
    }
  });
});
