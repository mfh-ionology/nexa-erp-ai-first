import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import path from 'node:path';

// ---------------------------------------------------------------------------
// TOTP helper — generates a 6-digit TOTP code from a Base32 secret
// Uses Node.js crypto (no external dependencies)
// ---------------------------------------------------------------------------

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of encoded.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string, timeStep = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Constants — match seeded data from apps/platform-api/prisma/seed.ts
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'admin@nexa-platform.local';
const ADMIN_PASSWORD = 'platform-admin-dev';
const MFA_SECRET = 'JBSWY3DPEHPK3PXP'; // Base32 of "Hello!" — well-known dev seed
const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E13b/journey-1',
);

// ---------------------------------------------------------------------------
// Journey 1: Login with Platform Credentials and MFA
// ---------------------------------------------------------------------------

test.describe('J1: Login with Platform Credentials and MFA', () => {
  test('complete login flow with invalid credentials, then valid + MFA', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1: Navigate to /login — verify login page loads
    // -----------------------------------------------------------------------
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /platform admin/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Visual checkpoint 1: Login page loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-login-page-loaded.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 2: Fill form with wrong password
    // -----------------------------------------------------------------------
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill('wrong-password');

    // -----------------------------------------------------------------------
    // Step 3: Click Sign In — expect error message
    // -----------------------------------------------------------------------
    await page.getByRole('button', { name: /sign in/i }).click();
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Invalid email or password');

    // Visual checkpoint 2: Invalid credentials error
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-invalid-credentials-error.png'),
      fullPage: true,
    });

    // Verify button is re-enabled after error
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();

    // -----------------------------------------------------------------------
    // Step 4: Fill form with correct password
    // -----------------------------------------------------------------------
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);

    // -----------------------------------------------------------------------
    // Step 5: Click Sign In — expect MFA challenge (202 response)
    // -----------------------------------------------------------------------
    await page.getByRole('button', { name: /sign in/i }).click();

    // MFA Code field should appear
    const mfaInput = page.getByLabel('MFA Code');
    await expect(mfaInput).toBeVisible();

    // Button text should change to "Verify & Sign In"
    await expect(
      page.getByRole('button', { name: /verify & sign in/i }),
    ).toBeVisible();

    // Previous error should be cleared
    await expect(errorAlert).not.toBeVisible();

    // Visual checkpoint 3: MFA challenge displayed
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-mfa-challenge-displayed.png'),
      fullPage: true,
    });

    // -----------------------------------------------------------------------
    // Step 6: Fill MFA code with valid TOTP
    // -----------------------------------------------------------------------
    const totpCode = generateTOTP(MFA_SECRET);
    await mfaInput.fill(totpCode);

    // -----------------------------------------------------------------------
    // Step 7: Click "Verify & Sign In" — expect redirect to dashboard
    // -----------------------------------------------------------------------
    await page.getByRole('button', { name: /verify & sign in/i }).click();

    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 10000 });

    // Verify dashboard content loaded
    await expect(page.getByText('Dashboard')).toBeVisible();

    // Verify sidebar is present with PLATFORM ADMIN branding
    const sidebar = page.getByRole('navigation', { name: /platform navigation/i });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('PLATFORM ADMIN', { exact: true })).toBeVisible();

    // Verify key navigation items exist in the sidebar
    const expectedNavItems = [
      'Dashboard',
      'AI Intelligence',
      'Tenants',
      'Plans',
      'AI Usage',
      'Billing',
      'Support Console',
      'Monitoring',
      'Audit Log',
      'Settings',
    ];
    for (const navItem of expectedNavItems) {
      await expect(sidebar.getByText(navItem, { exact: true })).toBeVisible();
    }

    // Visual checkpoint 4: Dashboard after successful login
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-dashboard-after-login.png'),
      fullPage: true,
    });
  });
});
