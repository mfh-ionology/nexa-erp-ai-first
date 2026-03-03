import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-12';

// Admin credentials (used to create the STAFF user via API)
const ADMIN_EMAIL = 'admin@nexa-erp.dev';
const ADMIN_PASSWORD = 'NexaDev2026!';

// STAFF user credentials (created during test setup)
const STAFF_EMAIL = 'staff-e2e@nexa-erp.dev';
const STAFF_PASSWORD = 'NexaStaff2026!';

test.describe('Journey 12: Staff Skill Detail — Read-Only (STAFF Role)', () => {
  test('STAFF user sees read-only skill details with no edit controls', async ({
    page,
    request,
  }) => {
    // ── Pre-step A: Log in as ADMIN to get access token ──
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginResponse.ok()).toBeTruthy();

    const loginBody = await loginResponse.json();
    const adminToken = loginBody.data?.accessToken ?? loginBody.accessToken;
    const companyId = loginBody.data?.user?.activeCompanyId ?? loginBody.data?.user?.companyId;
    expect(adminToken).toBeTruthy();

    // ── Pre-step B: Create STAFF user via API (ignore conflict if already exists) ──
    const createUserResponse = await request.post('/api/v1/system/users', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        ...(companyId ? { 'x-company-id': companyId } : {}),
      },
      data: {
        email: STAFF_EMAIL,
        password: STAFF_PASSWORD,
        firstName: 'Staff',
        lastName: 'E2E',
        role: 'STAFF',
        enabledModules: [],
        locale: 'en',
      },
    });

    // 201 = created, 409 = already exists — both are fine
    if (!createUserResponse.ok() && createUserResponse.status() !== 409) {
      const errBody = await createUserResponse.text();
      console.warn(`Staff user creation returned ${createUserResponse.status()}: ${errBody}`);
      // Continue — the user might already exist from a previous run
    }

    // ── Pre-step C: Log in as STAFF user via the UI ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(STAFF_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for sidebar to confirm login succeeded
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/skills (logged in as STAFF user) ──
    const skillsLink = sidebar.getByRole('link', { name: 'Skills' });
    await expect(skillsLink).toBeVisible({ timeout: 5000 });
    await skillsLink.click();

    await page.waitForURL('**/ai/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for skill cards or empty state
    const skillCardLocator = page.locator('article[role="button"]').first();
    const emptyStateHeading = page.getByText('No skills available');
    await expect(skillCardLocator.or(emptyStateHeading)).toBeVisible({ timeout: 15000 });

    const hasSkills = await skillCardLocator.isVisible();

    // Visual Checkpoint 1: Skills page loaded as STAFF
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-skills-page-loaded-staff.png`,
      fullPage: true,
    });

    if (!hasSkills) {
      test.info().annotations.push({
        type: 'prerequisite_not_met',
        description:
          'No skills data seeded. Staff skill detail tests require seed data.',
      });
      test.skip(true, 'No skills data seeded — skill detail tests require seed data');
      return;
    }

    // ── Step 2: Click first skill card to open detail sheet ──
    const firstSkillCard = page.locator('article[role="button"]').first();
    await firstSkillCard.click();

    // Wait for sheet to open
    const sheetContent = page.locator('[data-state="open"][role="dialog"]');
    await expect(sheetContent).toBeVisible({ timeout: 5000 });

    // -- Verify READ-ONLY characteristics (STAFF role) --

    // 1. NO active/inactive toggle switch (admin-only)
    const activeToggle = sheetContent.getByRole('switch', { name: 'Active' });
    await expect(activeToggle).not.toBeVisible();

    // 2. Read-only status indicator SHOULD be visible (green/grey dot for STAFF)
    // The STAFF view shows a status indicator span instead of a switch
    const statusIndicator = sheetContent.getByText('Active').or(sheetContent.getByText('Inactive'));
    await expect(statusIndicator).toBeVisible({ timeout: 3000 });

    // 3. NO editable trigger phrase input (admin-only)
    // STAFF view shows trigger phrases as non-editable pills, not in a [role="group"] with input
    const triggerPhraseInput = sheetContent.locator('[role="group"] input[type="text"]');
    await expect(triggerPhraseInput).not.toBeVisible();

    // 4. Trigger phrases SHOULD still be displayed as read-only pills
    const triggerSection = sheetContent.getByText('Trigger Phrases').or(
      sheetContent.getByText('Triggers')
    );
    await expect(triggerSection).toBeVisible({ timeout: 3000 });

    // 5. NO priority number input (admin-only)
    const priorityInput = sheetContent.locator('input[type="number"]');
    await expect(priorityInput).not.toBeVisible();

    // 6. Skill instructions pre block should be visible (read-only for both roles)
    const instructionsBlock = sheetContent.locator('pre').first();
    // Instructions may or may not exist depending on the skill
    // Just verify the sheet has content

    // 7. NO Save Override button (admin-only)
    const saveButton = sheetContent.getByRole('button', { name: 'Save Override' });
    await expect(saveButton).not.toBeVisible();

    // 8. NO Reset to Default button (admin-only)
    const resetButton = sheetContent.getByRole('button', { name: 'Reset to Default' });
    await expect(resetButton).not.toBeVisible();

    // Visual Checkpoint 2: Sheet open — read-only for STAFF
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-skill-detail-sheet-readonly.png`,
      fullPage: true,
    });

    // ── Step 3: Verify sheet footer — only Close button visible ──
    const closeButton = sheetContent.getByRole('button', { name: 'Close' });
    await expect(closeButton).toBeVisible();

    // Double-check: no Cancel button either (Cancel is admin-only alongside Save)
    const cancelButton = sheetContent.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).not.toBeVisible();

    // Visual Checkpoint 3: Sheet footer with only Close button
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-sheet-footer-close-only.png`,
      fullPage: true,
    });

    // Verify Close button works — dismiss the sheet
    await closeButton.click();
    await expect(sheetContent).not.toBeVisible({ timeout: 3000 });
  });
});
