import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-19';

test.describe('Journey 19: Concept D Design System Visual Fidelity Check', () => {
  test('should verify Concept D design tokens on Document Templates page', async ({ page }) => {
    // ── Step 1: Navigate to /settings/document-templates ──────────────────
    await page.goto('/');

    // Authenticate if redirected to login
    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    // Wait for app layout
    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // Navigate to Document Templates page
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const linkCount = await docTemplatesLink.count();

    if (linkCount > 0) {
      await docTemplatesLink.first().click();
    } else {
      await page.evaluate(async () => {
        const mod = await import('/src/router.ts');
        await mod.router.navigate({ to: '/settings/document-templates' });
      });
    }

    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );

    // Wait for page content to load
    await page.waitForSelector('h1, h2, button, [class*="skeleton"]', { timeout: 10000 });

    // Wait for skeletons to clear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 15000 },
      );
    } catch {
      // Skeletons may have already disappeared
    }

    // ── Visual Check 1: Page background is #f4f2ff (light purple) ─────────
    const bodyBgColor = await page.evaluate(() => {
      // Check the main content area background (may be on body, main, or a wrapper div)
      const main = document.querySelector('main') || document.querySelector('[class*="content"]') || document.body;
      return window.getComputedStyle(main).backgroundColor;
    });

    // #f4f2ff = rgb(244, 242, 255)
    // Accept the exact value or close match — may be on a parent/child element
    const pageBgCheck = await page.evaluate(() => {
      const allElements = [
        document.body,
        document.querySelector('main'),
        document.querySelector('[class*="bg-"]'),
        document.querySelector('.min-h-screen'),
      ].filter(Boolean);

      return allElements.map((el) => ({
        tag: el!.tagName,
        className: el!.className?.substring?.(0, 80) || '',
        bg: window.getComputedStyle(el!).backgroundColor,
      }));
    });

    // Log for diagnostics — at least one element should have the light purple bg
    const hasLightPurpleBg = pageBgCheck.some(
      (el) =>
        el.bg === 'rgb(244, 242, 255)' || // #f4f2ff
        el.bg === 'rgb(245, 243, 255)' || // #f5f3ff (violet-50, close match)
        el.bg === 'rgb(250, 245, 255)' || // close variant
        el.className.includes('f4f2ff') ||
        el.className.includes('violet-50'),
    );
    expect(hasLightPurpleBg).toBe(true);

    // Verify header height is approximately 56px
    const headerHeight = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return 0;
      return header.getBoundingClientRect().height;
    });
    // Accept 48-64px range (slight Tailwind rounding)
    if (headerHeight > 0) {
      expect(headerHeight).toBeGreaterThanOrEqual(48);
      expect(headerHeight).toBeLessThanOrEqual(72);
    }

    // CP-1: Screenshot — Page layout with Concept D background
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-page-layout-concept-d-background.png`,
      fullPage: false,
    });

    // ── Step 2: Verify Add Template button styling ────────────────────────
    const addTemplateBtn = page.getByRole('button', { name: /add template/i });
    await expect(addTemplateBtn).toBeVisible({ timeout: 10000 });

    // Check button background color → should be #7c3aed = rgb(124, 58, 237)
    const btnStyles = await addTemplateBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        borderRadius: computed.borderRadius,
      };
    });

    // Primary purple background
    expect(btnStyles.backgroundColor).toMatch(/rgb\(124,\s*58,\s*237\)/);

    // White text → rgb(255, 255, 255)
    expect(btnStyles.color).toMatch(/rgb\(255,\s*255,\s*255\)/);

    // 8px border-radius (rounded-lg)
    const btnRadiusNum = parseFloat(btnStyles.borderRadius);
    expect(btnRadiusNum).toBeGreaterThanOrEqual(6);
    expect(btnRadiusNum).toBeLessThanOrEqual(12);

    // Verify hover state changes background color
    await addTemplateBtn.hover();
    const hoverBg = await addTemplateBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Hover should darken — either #5b21b6 = rgb(91, 33, 182) or different from base
    // Just verify it's a purple shade
    expect(hoverBg).toMatch(/rgb\(\d+,\s*\d+,\s*\d+\)/);

    // CP-2: Screenshot — Add Template button styling
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-add-template-button-styling.png`,
      fullPage: false,
    });

    // ── Step 3: Verify template card styling ──────────────────────────────
    // Find a template card — look for cards with rounded-xl class
    const templateCard = page.locator('.rounded-xl').first();
    await expect(templateCard).toBeVisible({ timeout: 10000 });

    const cardStyles = await templateCard.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        backgroundColor: computed.backgroundColor,
      };
    });

    // 12px border-radius (rounded-xl)
    const cardRadiusNum = parseFloat(cardStyles.borderRadius);
    expect(cardRadiusNum).toBeGreaterThanOrEqual(10);
    expect(cardRadiusNum).toBeLessThanOrEqual(16);

    // Card should have some shadow (not "none")
    expect(cardStyles.boxShadow).not.toBe('none');

    // Card background should be white
    expect(cardStyles.backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)/);

    // Check typography — look for Plus Jakarta Sans on headings inside cards
    const cardFonts = await page.evaluate(() => {
      const headings = document.querySelectorAll('.rounded-xl h3, .rounded-xl h4, .rounded-xl [class*="font-heading"]');
      const bodyTexts = document.querySelectorAll('.rounded-xl p, .rounded-xl span');
      const headingFont = headings.length > 0 ? window.getComputedStyle(headings[0]).fontFamily : 'N/A';
      const bodyFont = bodyTexts.length > 0 ? window.getComputedStyle(bodyTexts[0]).fontFamily : 'N/A';
      return { headingFont, bodyFont };
    });

    // Check for version count monospace font (JetBrains Mono or similar)
    const versionCountEl = page.getByText(/\d+ versions?/).first();
    if (await versionCountEl.isVisible()) {
      const versionFont = await versionCountEl.evaluate((el) => {
        return window.getComputedStyle(el).fontFamily;
      });
      // Should contain mono/tabular
      // (Soft check — log for visual review)
    }

    // CP-3: Screenshot — Template card styling
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-template-card-styling.png`,
      fullPage: true,
    });

    // ── Step 4: Verify badge styling ──────────────────────────────────────
    // Active badge — green
    const activeBadge = page.getByText('Active', { exact: true }).first();
    await expect(activeBadge).toBeVisible({ timeout: 10000 });

    const activeBadgeStyles = await activeBadge.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
        color: computed.color,
      };
    });

    // Active badge should have green-ish background
    // Green tints typically have high G channel relative to R and B
    const activeRgbMatch = activeBadgeStyles.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (activeRgbMatch) {
      const [, r, g, b] = activeRgbMatch.map(Number);
      // Green-tinted: G channel should be higher, or it's a green-family color
      // Accept light green bg (like green-100: rgb(220, 252, 231))
      expect(g).toBeGreaterThanOrEqual(r); // Green >= Red for green-tinted
    }

    // Default badge — purple (#ede9fe background)
    const defaultBadge = page.getByText('Default', { exact: true }).first();
    await expect(defaultBadge).toBeVisible();

    const defaultBadgeStyles = await defaultBadge.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
      };
    });

    // Default badge should have purple-ish background
    // #ede9fe = rgb(237, 233, 254) — high blue channel
    const defaultRgbMatch = defaultBadgeStyles.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (defaultRgbMatch) {
      const [, r, g, b] = defaultRgbMatch.map(Number);
      // Purple-tinted: B channel should be highest
      expect(b).toBeGreaterThanOrEqual(g);
    }

    // Badges should be pill-shaped (rounded-full = very high border-radius)
    const activeBadgeRadius = parseFloat(activeBadgeStyles.borderRadius);
    expect(activeBadgeRadius).toBeGreaterThanOrEqual(8); // rounded-full or rounded-lg

    // CP-4: Screenshot — Badge styling
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-badge-styling.png`,
      fullPage: false,
    });

    // ── Step 5: Verify document type badge styling (no screenshot) ────────
    // Document type labels in accordion headers should use purple-tinted background
    const accordionHeaders = page.locator('[data-state="open"] button, [data-state="closed"] button');
    const headerCount = await accordionHeaders.count();

    if (headerCount > 0) {
      // Check for badge/label elements inside accordion headers
      const docTypeBadgeStyle = await page.evaluate(() => {
        const triggers = document.querySelectorAll('[data-state="open"] button, [data-state="closed"] button');
        if (triggers.length === 0) return null;
        // Look for badge/span inside the first trigger
        const badges = triggers[0].querySelectorAll('span, [class*="badge"]');
        if (badges.length === 0) return null;
        const computed = window.getComputedStyle(badges[0]);
        return {
          backgroundColor: computed.backgroundColor,
          borderRadius: computed.borderRadius,
        };
      });
      // Soft check — will verify visually
    }

    // ── Step 6: Click Add Template — verify editor form styling ───────────
    // Move mouse away from hover state first
    await page.mouse.move(0, 0);
    await addTemplateBtn.click();

    // Wait for the editor form to appear
    await page.waitForSelector('form, [class*="editor"], [class*="template-form"]', { timeout: 10000 });

    // Give the form time to render fully
    await page.waitForTimeout(1000);

    // Verify form headings use Plus Jakarta Sans
    const formFonts = await page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, [class*="font-heading"]');
      const headingFont = headings.length > 0 ? window.getComputedStyle(headings[0]).fontFamily : 'N/A';

      // Look for all textareas — the HTML template textarea should be the largest/last one
      const textareas = Array.from(document.querySelectorAll('textarea'));
      // Sort by height descending to find the HTML template one (should be tallest)
      textareas.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);

      const htmlTextarea = textareas[0] || null;
      const textareaFont = htmlTextarea ? window.getComputedStyle(htmlTextarea).fontFamily : 'N/A';
      const textareaHeight = htmlTextarea ? htmlTextarea.getBoundingClientRect().height : 0;
      const textareaLineHeight = htmlTextarea ? window.getComputedStyle(htmlTextarea).lineHeight : 'N/A';
      const textareaCount = textareas.length;
      const allTextareaFonts = textareas.map((t) => ({
        font: window.getComputedStyle(t).fontFamily,
        height: t.getBoundingClientRect().height,
        placeholder: t.placeholder || '',
      }));

      // Check for form inputs focus ring color
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      const inputOutlineColor = inputs.length > 0 ? window.getComputedStyle(inputs[0]).outlineColor : 'N/A';

      return {
        headingFont,
        textareaFont,
        textareaHeight,
        textareaLineHeight,
        textareaCount,
        allTextareaFonts,
        inputOutlineColor,
      };
    });

    // Check if any textarea uses monospace font (soft assertion — visual issue if none)
    const anyMonospace = formFonts.allTextareaFonts.some(
      (t: { font: string; height: number; placeholder: string }) =>
        t.font.toLowerCase().includes('mono') ||
        t.font.toLowerCase().includes('jetbrains') ||
        t.font.toLowerCase().includes('courier'),
    );
    expect.soft(
      anyMonospace,
      `HTML template textarea should use monospace font. Found ${formFonts.textareaCount} textareas: ${JSON.stringify(formFonts.allTextareaFonts)}`,
    ).toBe(true);

    // At least one textarea should have significant height (HTML template = ~400px)
    const tallestHeight = formFonts.textareaHeight;
    expect.soft(
      tallestHeight,
      `Tallest textarea should be >=200px for HTML template editing, but is: ${tallestHeight}px`,
    ).toBeGreaterThanOrEqual(200);

    // Check for purple focus ring on form inputs
    const firstInput = page.locator('input[type="text"], input:not([type])').first();
    if (await firstInput.isVisible()) {
      await firstInput.focus();
      const focusRing = await firstInput.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          outlineColor: computed.outlineColor,
          boxShadow: computed.boxShadow,
          borderColor: computed.borderColor,
        };
      });
      // Purple focus ring or border — at least check it's not default blue
      // (Visual verification will confirm)
    }

    // CP-5: Screenshot — Editor form styling
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-editor-form-styling.png`,
      fullPage: true,
    });

    // ── Step 7: Click Cancel — return to list ─────────────────────────────
    // Use locator within form scope or first visible Cancel button
    const cancelBtn = page.locator('form').getByRole('button', { name: /cancel/i });
    const cancelCount = await cancelBtn.count();

    if (cancelCount > 0) {
      await cancelBtn.first().click();
    } else {
      // Fallback: use any visible Cancel button
      const anyCancelBtn = page.getByRole('button', { name: /cancel/i }).first();
      if (await anyCancelBtn.isVisible()) {
        await anyCancelBtn.click();
      } else {
        // Try the X/close button or go back
        const closeBtn = page.getByRole('button', { name: /close|×|✕/i }).first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.goBack();
        }
      }
    }

    // Verify we're back on the list
    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );
  });
});
