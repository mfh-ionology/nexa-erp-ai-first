import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import * as path from 'path';

// ── TOTP helper ──────────────────────────────────────────────────────────
const MFA_SECRET = 'JBSWY3DPEHPK3PXP';

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of str.toUpperCase()) {
    if (c === '=') break;
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string, period = 30, digits = 6): string {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / period);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(time / 0x100000000), 0);
  buf.writeUInt32BE(time & 0xffffffff, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      (hmac[offset + 1] << 16) |
      (hmac[offset + 2] << 8) |
      hmac[offset + 3]) %
    10 ** digits;
  return code.toString().padStart(digits, '0');
}

// ── Screenshot directory ─────────────────────────────────────────────────
const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E3b/journey-1',
);

// ── Journey #1: Platform Admin Login with MFA ────────────────────────────
test.describe('j01 — Platform Admin Login with MFA', () => {
  test('Platform admin can log in with email, password, and TOTP code', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /login ─────────────────────────────────────
    await page.goto('/login');
    // Verify login page loaded
    await expect(
      page.getByRole('heading', { name: /login|sign in|platform/i }),
    ).toBeVisible();

    // Visual Checkpoint 1: Login page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-1-login-page.png'),
      fullPage: true,
    });

    // Verify key login page elements
    const emailField =
      page.getByLabel(/email/i) ||
      page.getByPlaceholder(/email/i);
    const passwordField =
      page.getByLabel(/password/i) ||
      page.getByPlaceholder(/password/i);
    const signInButton = page.getByRole('button', {
      name: /sign in|log in|login/i,
    });

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(signInButton).toBeVisible();

    // ── Step 2: Fill login form ────────────────────────────────────────
    await emailField.fill('admin@nexa-platform.local');
    await passwordField.fill('PlatformAdmin123!');

    // ── Step 3: Click Sign In — expect MFA step ────────────────────────
    await signInButton.click();

    // Wait for MFA verification screen to appear
    const mfaCodeInput = page.getByLabel(/code|totp|mfa|verification/i)
      .or(page.getByPlaceholder(/code|totp|6.digit/i))
      .or(page.locator('input[name="mfaCode"]'))
      .or(page.locator('input[name="totp"]'))
      .or(page.locator('input[maxlength="6"]'));

    await expect(mfaCodeInput.first()).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 2: MFA verification screen
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-3-mfa-verification.png'),
      fullPage: true,
    });

    // Verify MFA screen elements
    const verifyButton = page.getByRole('button', {
      name: /verify|confirm|submit/i,
    });
    await expect(verifyButton).toBeVisible();

    // Check for instructional text
    await expect(
      page
        .getByText(/authenticator|enter.*code|verification/i)
        .first(),
    ).toBeVisible();

    // ── Step 4: Enter TOTP code ────────────────────────────────────────
    const totpCode = generateTOTP(MFA_SECRET);
    await mfaCodeInput.first().fill(totpCode);

    // ── Step 5: Click Verify — expect dashboard redirect ───────────────
    await verifyButton.click();

    // Wait for dashboard to load (URL should change away from /login)
    await page.waitForURL(/(?!.*\/login).*/, { timeout: 15000 });

    // Visual Checkpoint 3: Dashboard loaded
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-5-dashboard-loaded.png'),
      fullPage: true,
    });

    // Verify dashboard elements
    // Sidebar navigation should be visible with key sections
    const sidebar = page.locator('nav, [role="navigation"], aside').first();
    await expect(sidebar).toBeVisible();

    // Check for expected navigation items
    await expect(
      page.getByRole('link', { name: /tenants/i })
        .or(page.getByText(/tenants/i).first()),
    ).toBeVisible();

    await expect(
      page.getByRole('link', { name: /plans/i })
        .or(page.getByText(/plans/i).first()),
    ).toBeVisible();

    // Check user identity is shown
    await expect(
      page.getByText(/admin@nexa-platform\.local/i)
        .or(page.getByText(/platform.admin/i).first()),
    ).toBeVisible();
  });
});
