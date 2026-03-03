import { describe, expect, it } from 'vitest';

import {
  renderNotificationEmailHtml,
  renderNotificationEmailText,
} from './notification-email-template.js';
import type { NotificationEmailData } from './notification-email-template.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseData(overrides?: Partial<NotificationEmailData>): NotificationEmailData {
  return {
    title: 'Invoice Approved',
    body: '<p>Your invoice <strong>INV-001</strong> has been approved.</p>',
    actionUrl: 'https://app.nexa-erp.com/invoices/INV-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// renderNotificationEmailHtml
// ---------------------------------------------------------------------------

describe('renderNotificationEmailHtml', () => {
  it('should contain the notification title', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('Invoice Approved');
  });

  it('should contain the notification body', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('INV-001');
    expect(html).toContain('has been approved');
  });

  it('should contain the action URL in a link', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('https://app.nexa-erp.com/invoices/INV-001');
    expect(html).toContain('View Details');
  });

  it('should omit the action button when actionUrl is null', () => {
    const html = renderNotificationEmailHtml(baseData({ actionUrl: null }));
    expect(html).not.toContain('View Details');
    expect(html).not.toContain('<a href=');
  });

  it('should use custom actionLabel when provided', () => {
    const html = renderNotificationEmailHtml(baseData({ actionLabel: 'Open Invoice' }));
    expect(html).toContain('Open Invoice');
    expect(html).not.toContain('View Details');
  });

  it('should default companyName to "Nexa ERP"', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('Nexa ERP');
  });

  it('should use custom companyName when provided', () => {
    const html = renderNotificationEmailHtml(baseData({ companyName: 'Acme Ltd' }));
    expect(html).toContain('Acme Ltd');
  });

  it('should default unsubscribeHint to preference management text', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('Manage your notification preferences in Settings');
  });

  it('should use custom unsubscribeHint when provided', () => {
    const html = renderNotificationEmailHtml(
      baseData({ unsubscribeHint: 'Reply STOP to unsubscribe' }),
    );
    expect(html).toContain('Reply STOP to unsubscribe');
  });

  it('should render <img> tag when logoUrl is provided', () => {
    const html = renderNotificationEmailHtml(
      baseData({ logoUrl: 'https://cdn.example.com/logo.png' }),
    );
    expect(html).toContain('<img');
    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('alt=');
  });

  it('should render company name text when logoUrl is null', () => {
    const html = renderNotificationEmailHtml(baseData({ logoUrl: null, companyName: 'Test Corp' }));
    expect(html).not.toContain('<img');
    expect(html).toContain('Test Corp');
  });

  it('should use inline styles only (no <style> block in <head>)', () => {
    const html = renderNotificationEmailHtml(baseData());
    const headMatch = html.match(/<head>[\s\S]*?<\/head>/);
    expect(headMatch).toBeTruthy();
    expect(headMatch![0]).not.toContain('<style');
  });

  it('should include role="presentation" on layout tables', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('role="presentation"');
  });

  it('should contain "Powered by Nexa ERP" in footer', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('Powered by Nexa ERP');
  });

  it('should use Concept D purple background color #f4f2ff', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('#f4f2ff');
  });

  it('should use Concept D primary purple #7c3aed for header and button', () => {
    const html = renderNotificationEmailHtml(baseData());
    // Header background
    expect(html).toContain('background-color:#7c3aed');
  });

  it('should be a complete HTML document', () => {
    const html = renderNotificationEmailHtml(baseData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
  });

  it('should escape HTML entities in title', () => {
    const html = renderNotificationEmailHtml(
      baseData({ title: 'Test <script>alert("xss")</script>' }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should strip script tags from body', () => {
    const html = renderNotificationEmailHtml(
      baseData({ body: '<p>Hello</p><script>alert("xss")</script>' }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert("xss")');
    expect(html).toContain('<p>Hello</p>');
  });

  it('should strip iframe tags from body', () => {
    const html = renderNotificationEmailHtml(
      baseData({ body: '<p>Hello</p><iframe src="https://evil.com"></iframe>' }),
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<p>Hello</p>');
  });

  it('should remove event handler attributes from body', () => {
    const html = renderNotificationEmailHtml(baseData({ body: '<p onclick="alert(1)">Hello</p>' }));
    expect(html).not.toContain('onclick');
    expect(html).toContain('<p>Hello</p>');
  });

  it('should remove javascript: URLs from body', () => {
    const html = renderNotificationEmailHtml(
      baseData({ body: '<a href="javascript:alert(1)">Click</a>' }),
    );
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Click</a>');
  });
});

// ---------------------------------------------------------------------------
// renderNotificationEmailText
// ---------------------------------------------------------------------------

describe('renderNotificationEmailText', () => {
  it('should contain title, body, and action URL', () => {
    const text = renderNotificationEmailText({
      title: 'Invoice Approved',
      body: '<p>Your invoice INV-001 has been approved.</p>',
      actionUrl: 'https://app.nexa-erp.com/invoices/INV-001',
    });

    expect(text).toContain('Invoice Approved');
    expect(text).toContain('Your invoice INV-001 has been approved.');
    expect(text).toContain('https://app.nexa-erp.com/invoices/INV-001');
  });

  it('should format as title\\n\\nbody\\n\\nactionUrl', () => {
    const text = renderNotificationEmailText({
      title: 'Title',
      body: 'Body text',
      actionUrl: 'https://example.com',
    });

    expect(text).toBe('Title\n\nBody text\n\nhttps://example.com');
  });

  it('should strip HTML tags from body', () => {
    const text = renderNotificationEmailText({
      title: 'Title',
      body: '<p>Hello <strong>World</strong></p>',
      actionUrl: null,
    });

    expect(text).toContain('Hello World');
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('<strong>');
  });

  it('should omit action URL when null', () => {
    const text = renderNotificationEmailText({
      title: 'Title',
      body: 'Body',
      actionUrl: null,
    });

    expect(text).toBe('Title\n\nBody');
  });
});
