import { describe, expect, it } from 'vitest';
import { renderNotificationTemplate } from './template-renderer.js';

describe('renderNotificationTemplate', () => {
  describe('variable substitution', () => {
    it('substitutes string variables', () => {
      const result = renderNotificationTemplate(
        'Approval required',
        'Invoice {{invoiceNumber}} requires your approval.',
        null,
        { invoiceNumber: 'INV-2026-0042' },
      );

      expect(result.title).toBe('Approval required');
      expect(result.body).toBe('Invoice INV-2026-0042 requires your approval.');
      expect(result.actionUrl).toBeNull();
    });

    it('substitutes numeric variables', () => {
      const result = renderNotificationTemplate(
        'Order #{{orderId}}',
        'Your order totalling {{total}} items has been confirmed.',
        null,
        { orderId: 12345, total: 7 },
      );

      expect(result.title).toBe('Order #12345');
      expect(result.body).toBe('Your order totalling 7 items has been confirmed.');
    });

    it('substitutes boolean variables', () => {
      const result = renderNotificationTemplate('Status update', 'Urgent: {{isUrgent}}', null, {
        isUrgent: true,
      });

      expect(result.body).toBe('Urgent: true');
    });
  });

  describe('missing variable graceful fallback', () => {
    it('renders empty string for undefined variables (Handlebars default)', () => {
      const result = renderNotificationTemplate(
        'Hello {{userName}}',
        'Your {{entityType}} #{{entityId}} was updated.',
        null,
        { entityType: 'invoice' },
      );

      // userName and entityId are missing — Handlebars renders empty string
      expect(result.title).toBe('Hello ');
      expect(result.body).toBe('Your invoice # was updated.');
    });

    it('does not crash on completely empty context', () => {
      const result = renderNotificationTemplate('{{title}}', '{{body}}', null, {});

      expect(result.title).toBe('');
      expect(result.body).toBe('');
    });
  });

  describe('nested object access', () => {
    it('accesses nested properties with dot notation', () => {
      const result = renderNotificationTemplate(
        '{{entity.type}} update',
        '{{entity.type}} #{{entity.id}} by {{actor.name}}',
        null,
        {
          entity: { type: 'Invoice', id: 'INV-001' },
          actor: { name: 'John Smith' },
        },
      );

      expect(result.title).toBe('Invoice update');
      expect(result.body).toBe('Invoice #INV-001 by John Smith');
    });

    it('handles missing nested properties gracefully', () => {
      const result = renderNotificationTemplate(
        '{{entity.type}}',
        '{{entity.missing.deep}}',
        null,
        { entity: { type: 'Order' } },
      );

      expect(result.title).toBe('Order');
      expect(result.body).toBe('');
    });
  });

  describe('{{#each}} blocks for array data', () => {
    it('iterates over an array of items', () => {
      const result = renderNotificationTemplate(
        'Stock alerts',
        '{{#each items}}{{this.sku}}: {{this.qty}} left\n{{/each}}',
        null,
        {
          items: [
            { sku: 'WIDGET-A', qty: 3 },
            { sku: 'GADGET-B', qty: 0 },
          ],
        },
      );

      expect(result.body).toContain('WIDGET-A: 3 left');
      expect(result.body).toContain('GADGET-B: 0 left');
    });

    it('renders nothing for empty array', () => {
      const result = renderNotificationTemplate(
        'Updates',
        '{{#each items}}{{this}}{{/each}}',
        null,
        { items: [] },
      );

      expect(result.body).toBe('');
    });
  });

  describe('invalid template syntax returns fallback', () => {
    it('returns fallback with eventName and JSON context on bad syntax', () => {
      const context = { eventName: 'approval.requested', userId: 'u-1' };
      const result = renderNotificationTemplate(
        '{{#if}}', // invalid — #if requires an argument
        'body text',
        null,
        context,
      );

      expect(result.title).toBe('approval.requested');
      expect(result.body).toBe(JSON.stringify(context));
      expect(result.actionUrl).toBeNull();
    });

    it('returns "unknown_event" when eventName is absent from context', () => {
      const result = renderNotificationTemplate('{{#if}}', 'body', null, { someField: 'value' });

      expect(result.title).toBe('unknown_event');
    });
  });

  describe('actionUrl rendering', () => {
    it('renders actionUrl template when provided', () => {
      const result = renderNotificationTemplate(
        'View document',
        'Click to view.',
        '/invoices/{{invoiceId}}',
        { invoiceId: 'inv-abc-123' },
      );

      expect(result.actionUrl).toBe('/invoices/inv-abc-123');
    });

    it('returns null when actionUrlTemplate is null', () => {
      const result = renderNotificationTemplate('Title', 'Body', null, {});

      expect(result.actionUrl).toBeNull();
    });
  });

  describe('formatDate helper', () => {
    it('formats an ISO date string with default settings (en-GB short)', () => {
      const result = renderNotificationTemplate(
        'Due: {{formatDate dueDate}}',
        'Invoice is due on {{formatDate dueDate "medium"}}.',
        null,
        { dueDate: '2026-03-15' },
      );

      expect(result.title).toBe('Due: 15/03/2026');
      expect(result.body).toBe('Invoice is due on 15 Mar 2026.');
    });

    it('returns empty string for null/undefined date', () => {
      const result = renderNotificationTemplate('{{formatDate missingDate}}', 'body', null, {});

      expect(result.title).toBe('');
    });
  });

  describe('formatMoney helper', () => {
    it('formats a monetary value with default GBP/en-GB', () => {
      const result = renderNotificationTemplate(
        'Payment: {{formatMoney amount}}',
        'Total: {{formatMoney total}}',
        null,
        { amount: 1234.56, total: '9999.99' },
      );

      expect(result.title).toBe('Payment: £1,234.56');
      expect(result.body).toBe('Total: £9,999.99');
    });

    it('formats with explicit currency code', () => {
      const result = renderNotificationTemplate('{{formatMoney amount "USD"}}', 'body', null, {
        amount: 500,
      });

      // US dollar formatting (en-GB locale by default)
      expect(result.title).toContain('500.00');
      expect(result.title).toMatch(/US\$|\$/);
    });

    it('returns empty string for null/undefined amount', () => {
      const result = renderNotificationTemplate('{{formatMoney missingAmount}}', 'body', null, {});

      expect(result.title).toBe('');
    });
  });

  describe('template caching', () => {
    it('returns consistent results on repeated calls (cache hit path)', () => {
      const template = 'Hello {{name}}';
      const context = { name: 'World' };

      const result1 = renderNotificationTemplate(template, 'body', null, context);
      const result2 = renderNotificationTemplate(template, 'body', null, context);

      expect(result1.title).toBe('Hello World');
      expect(result2.title).toBe('Hello World');
    });
  });
});
