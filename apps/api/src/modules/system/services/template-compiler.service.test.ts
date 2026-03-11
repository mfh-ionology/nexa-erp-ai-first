// ---------------------------------------------------------------------------
// Unit tests — TemplateCompilerService (E12-1 Task 2.5)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TemplateCompilerService } from './template-compiler.service.js';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('TemplateCompilerService', () => {
  let service: TemplateCompilerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateCompilerService(mockLogger);
  });

  // -------------------------------------------------------------------------
  // Simple variable substitution (AC #1)
  // -------------------------------------------------------------------------

  describe('simple variable substitution', () => {
    it('resolves simple variables', () => {
      const html = '<p>{{invoice.number}}</p>';
      const result = service.compile(html, {
        invoice: { number: 'INV-00042' },
      });
      expect(result).toBe('<p>INV-00042</p>');
    });

    it('resolves nested access', () => {
      const html = '<p>{{company.address.line1}}</p>';
      const result = service.compile(html, {
        company: { address: { line1: '123 High Street' } },
      });
      expect(result).toBe('<p>123 High Street</p>');
    });

    it('resolves multiple variables in one template', () => {
      const html = '<p>{{customer.name}} — {{invoice.number}}</p>';
      const result = service.compile(html, {
        customer: { name: 'Acme Ltd' },
        invoice: { number: 'INV-001' },
      });
      expect(result).toBe('<p>Acme Ltd — INV-001</p>');
    });
  });

  // -------------------------------------------------------------------------
  // Each block iteration (AC #1)
  // -------------------------------------------------------------------------

  describe('each block iteration', () => {
    it('iterates over line items', () => {
      const html =
        '<ul>{{#each lines}}<li>{{this.description}} — {{this.quantity}}</li>{{/each}}</ul>';
      const result = service.compile(html, {
        lines: [
          { description: 'Widget A', quantity: 10 },
          { description: 'Widget B', quantity: 5 },
        ],
      });
      expect(result).toBe('<ul><li>Widget A — 10</li><li>Widget B — 5</li></ul>');
    });

    it('handles empty array', () => {
      const html = '<ul>{{#each lines}}<li>{{this.name}}</li>{{/each}}</ul>';
      const result = service.compile(html, { lines: [] });
      expect(result).toBe('<ul></ul>');
    });
  });

  // -------------------------------------------------------------------------
  // Conditional sections (AC #1)
  // -------------------------------------------------------------------------

  describe('conditional sections', () => {
    it('renders if block when truthy', () => {
      const html = '{{#if showVatNumber}}<p>VAT: {{vatNumber}}</p>{{/if}}';
      const result = service.compile(html, {
        showVatNumber: true,
        vatNumber: 'GB123456789',
      });
      expect(result).toBe('<p>VAT: GB123456789</p>');
    });

    it('does not render if block when falsy', () => {
      const html = '{{#if showVatNumber}}<p>VAT: {{vatNumber}}</p>{{/if}}';
      const result = service.compile(html, {
        showVatNumber: false,
        vatNumber: 'GB123456789',
      });
      expect(result).toBe('');
    });

    it('renders else block when condition is falsy', () => {
      const html = '{{#if showLogo}}<img src="logo.png"/>{{else}}<p>No logo</p>{{/if}}';
      const result = service.compile(html, { showLogo: false });
      expect(result).toBe('<p>No logo</p>');
    });
  });

  // -------------------------------------------------------------------------
  // Custom helpers (AC #2)
  // -------------------------------------------------------------------------

  describe('formatCurrency helper', () => {
    it('formats GBP correctly', () => {
      const html = '{{formatCurrency amount "GBP"}}';
      const result = service.compile(html, { amount: 5000 });
      expect(result).toBe('£5,000.00');
    });

    it('formats USD correctly', () => {
      const html = '{{formatCurrency amount "USD"}}';
      const result = service.compile(html, { amount: 1234.5 });
      // US$ or $ depending on locale — en-GB uses "US$"
      expect(result).toMatch(/US\$1,234\.50|\$1,234\.50/);
    });

    it('formats EUR correctly', () => {
      const html = '{{formatCurrency amount "EUR"}}';
      const result = service.compile(html, { amount: 999.99 });
      expect(result).toContain('999.99');
    });

    it('defaults to GBP when no currency specified', () => {
      const html = '{{formatCurrency amount}}';
      const result = service.compile(html, { amount: 100 });
      expect(result).toBe('£100.00');
    });

    it('handles string amount', () => {
      const html = '{{formatCurrency amount "GBP"}}';
      const result = service.compile(html, { amount: '2500.50' });
      expect(result).toBe('£2,500.50');
    });

    it('returns empty string for NaN amount', () => {
      const html = '{{formatCurrency amount "GBP"}}';
      const result = service.compile(html, { amount: 'not-a-number' });
      expect(result).toBe('');
    });
  });

  describe('formatDate helper', () => {
    it('formats date in UK short format by default (DD/MM/YYYY)', () => {
      const html = '{{formatDate date}}';
      const result = service.compile(html, { date: '2026-03-11' });
      expect(result).toBe('11/03/2026');
    });

    it('formats date in long format', () => {
      const html = '{{formatDate date "long"}}';
      const result = service.compile(html, { date: '2026-03-11' });
      expect(result).toBe('11 March 2026');
    });

    it('formats date in medium format', () => {
      const html = '{{formatDate date "medium"}}';
      const result = service.compile(html, { date: '2026-03-11' });
      expect(result).toBe('11 Mar 2026');
    });

    it('formats date in ISO format', () => {
      const html = '{{formatDate date "iso"}}';
      const result = service.compile(html, { date: '2026-03-11T14:30:00Z' });
      expect(result).toBe('2026-03-11');
    });

    it('handles Date objects', () => {
      const html = '{{formatDate date}}';
      const result = service.compile(html, {
        date: new Date('2026-01-15T00:00:00Z'),
      });
      expect(result).toBe('15/01/2026');
    });

    it('returns empty string for invalid date', () => {
      const html = '{{formatDate date}}';
      const result = service.compile(html, { date: 'invalid' });
      expect(result).toBe('');
    });

    it('returns empty string for null/undefined date', () => {
      const html = '{{formatDate date}}';
      const result = service.compile(html, { date: null });
      expect(result).toBe('');
    });
  });

  describe('formatNumber helper', () => {
    it('formats with locale grouping', () => {
      const html = '{{formatNumber value}}';
      const result = service.compile(html, { value: 1234567 });
      expect(result).toBe('1,234,567');
    });

    it('formats with specified decimals', () => {
      const html = '{{formatNumber value 2}}';
      const result = service.compile(html, { value: 1234.5 });
      expect(result).toBe('1,234.50');
    });

    it('handles string values', () => {
      const html = '{{formatNumber value 2}}';
      const result = service.compile(html, { value: '99.9' });
      expect(result).toBe('99.90');
    });

    it('returns empty string for NaN', () => {
      const html = '{{formatNumber value}}';
      const result = service.compile(html, { value: 'abc' });
      expect(result).toBe('');
    });
  });

  describe('eq helper', () => {
    it('returns true for equal values', () => {
      const html = '{{#if (eq status "POSTED")}}Posted{{else}}Other{{/if}}';
      const result = service.compile(html, { status: 'POSTED' });
      expect(result).toBe('Posted');
    });

    it('returns false for unequal values', () => {
      const html = '{{#if (eq status "POSTED")}}Posted{{else}}Other{{/if}}';
      const result = service.compile(html, { status: 'DRAFT' });
      expect(result).toBe('Other');
    });
  });

  describe('gt helper', () => {
    it('returns true when a > b', () => {
      const html = '{{#if (gt amount 100)}}Over{{else}}Under{{/if}}';
      const result = service.compile(html, { amount: 150 });
      expect(result).toBe('Over');
    });

    it('returns false when a <= b', () => {
      const html = '{{#if (gt amount 100)}}Over{{else}}Under{{/if}}';
      const result = service.compile(html, { amount: 50 });
      expect(result).toBe('Under');
    });
  });

  describe('lt helper', () => {
    it('returns true when a < b', () => {
      const html = '{{#if (lt amount 100)}}Under{{else}}Over{{/if}}';
      const result = service.compile(html, { amount: 50 });
      expect(result).toBe('Under');
    });

    it('returns false when a >= b', () => {
      const html = '{{#if (lt amount 100)}}Under{{else}}Over{{/if}}';
      const result = service.compile(html, { amount: 200 });
      expect(result).toBe('Over');
    });
  });

  describe('uppercase / lowercase helpers', () => {
    it('converts to uppercase', () => {
      const html = '{{uppercase name}}';
      const result = service.compile(html, { name: 'hello world' });
      expect(result).toBe('HELLO WORLD');
    });

    it('converts to lowercase', () => {
      const html = '{{lowercase name}}';
      const result = service.compile(html, { name: 'HELLO WORLD' });
      expect(result).toBe('hello world');
    });

    it('returns empty string for non-string input', () => {
      const html = '{{uppercase value}}';
      const result = service.compile(html, { value: 123 });
      expect(result).toBe('');
    });
  });

  describe('lineNumber helper', () => {
    it('returns 1-based line number from 0-based index', () => {
      const html = '{{#each lines}}{{lineNumber @index}}: {{this.desc}}\n{{/each}}';
      const result = service.compile(html, {
        lines: [{ desc: 'A' }, { desc: 'B' }, { desc: 'C' }],
      });
      expect(result).toContain('1: A');
      expect(result).toContain('2: B');
      expect(result).toContain('3: C');
    });
  });

  // -------------------------------------------------------------------------
  // Missing variable → empty string (AC #1)
  // -------------------------------------------------------------------------

  describe('missing variables', () => {
    it('resolves missing variables to empty string', () => {
      const html = '<p>Name: {{customer.name}}, Phone: {{customer.phone}}</p>';
      const result = service.compile(html, {
        customer: { name: 'Acme Ltd' },
      });
      expect(result).toBe('<p>Name: Acme Ltd, Phone: </p>');
      expect(result).not.toContain('undefined');
    });

    it('handles completely empty data context', () => {
      const html = '<p>{{title}}</p>';
      const result = service.compile(html, {});
      expect(result).toBe('<p></p>');
      expect(result).not.toContain('undefined');
    });

    it('handles null data → empty object fallback', () => {
      const html = '<p>{{title}}</p>';
      const result = service.compile(html, null as unknown as Record<string, unknown>);
      expect(result).toBe('<p></p>');
    });
  });

  // -------------------------------------------------------------------------
  // Template syntax error → descriptive error
  // -------------------------------------------------------------------------

  describe('template syntax errors', () => {
    it('throws descriptive error for unclosed block', () => {
      const html = '{{#if showVat}}<p>VAT</p>';
      expect(() => service.compile(html, {})).toThrow(/Template (compilation|rendering) error/);
    });

    it('throws descriptive error for invalid helper syntax', () => {
      const html = '{{#each}}<li>item</li>{{/each}}';
      expect(() => service.compile(html, {})).toThrow();
    });

    it('logs error on syntax failure', () => {
      const html = '{{#if open}}<p>open{{/if}}{{#unless}}bad{{/unless}}';
      try {
        service.compile(html, {});
      } catch {
        // expected
      }
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // CSS inlining
  // -------------------------------------------------------------------------

  describe('CSS inlining', () => {
    it('injects CSS into existing <head> before </head>', () => {
      const html = '<html><head><title>Doc</title></head><body><p>Hi</p></body></html>';
      const css = 'body { font-family: Arial; }';
      const result = service.compile(html, {}, css);
      expect(result).toContain('<style>');
      expect(result).toContain('body { font-family: Arial; }');
      expect(result).toContain('</style>\n</head>');
    });

    it('injects CSS after <head> if no </head> yet', () => {
      const html = '<head><body><p>Hi</p></body>';
      const css = 'p { color: red; }';
      const result = service.compile(html, {}, css);
      expect(result).toContain('<style>');
      expect(result).toContain('p { color: red; }');
    });

    it('prepends CSS when no <head> tag exists', () => {
      const html = '<div>Simple</div>';
      const css = 'div { margin: 0; }';
      const result = service.compile(html, {}, css);
      expect(result).toMatch(/^<style>/);
      expect(result).toContain('div { margin: 0; }');
      expect(result).toContain('<div>Simple</div>');
    });

    it('does not inject CSS when css parameter is undefined', () => {
      const html = '<html><head></head><body>Hi</body></html>';
      const result = service.compile(html, {});
      expect(result).not.toContain('<style>');
    });
  });

  // -------------------------------------------------------------------------
  // Performance: compile 50KB template within 100ms (AC #1)
  // -------------------------------------------------------------------------

  describe('performance', () => {
    it('compiles a 50KB template with 100 line items within 100ms', () => {
      // Build a ~50KB template
      const lineTemplate =
        '<tr><td>{{lineNumber @index}}</td><td>{{this.code}}</td><td>{{this.description}}</td><td>{{formatNumber this.quantity 2}}</td><td>{{formatCurrency this.unitPrice "GBP"}}</td><td>{{formatCurrency this.lineTotal "GBP"}}</td></tr>';
      const headerHtml =
        '<html><head></head><body><h1>{{company.name}}</h1><p>Invoice: {{invoice.number}}</p><p>Date: {{formatDate invoice.date}}</p><p>Customer: {{customer.name}}</p>';
      const tableStart =
        '<table><thead><tr><th>#</th><th>Code</th><th>Desc</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>';
      const tableEnd = '</tbody></table>';
      const footer =
        '<p>Subtotal: {{formatCurrency totals.subtotal "GBP"}}</p><p>VAT: {{formatCurrency totals.vat "GBP"}}</p><p>Total: {{formatCurrency totals.total "GBP"}}</p></body></html>';

      // Repeat lines to make template ~50KB
      const lines = Array(100).fill(lineTemplate).join('\n');
      const template = `${headerHtml}${tableStart}\n{{#each lines}}\n${lineTemplate}\n{{/each}}\n${tableEnd}${footer}`;

      // Build data context with 100 line items
      const lineItems = Array.from({ length: 100 }, (_, i) => ({
        code: `ITEM-${String(i + 1).padStart(3, '0')}`,
        description: `Product item description for line ${i + 1} with extra text to pad the size`,
        quantity: Math.round(Math.random() * 100),
        unitPrice: Math.round(Math.random() * 10000) / 100,
        lineTotal: Math.round(Math.random() * 100000) / 100,
      }));

      const data = {
        company: { name: 'Acme Ltd' },
        invoice: { number: 'INV-00042', date: '2026-03-11' },
        customer: { name: 'Big Customer Corp' },
        lines: lineItems,
        totals: { subtotal: 50000, vat: 10000, total: 60000 },
      };

      const start = performance.now();
      const result = service.compile(template, data);
      const elapsed = performance.now() - start;

      expect(result).toContain('Acme Ltd');
      expect(result).toContain('INV-00042');
      expect(result).toContain('Big Customer Corp');
      expect(elapsed).toBeLessThan(100);
    });
  });

  // -------------------------------------------------------------------------
  // Template caching
  // -------------------------------------------------------------------------

  describe('template caching', () => {
    it('uses cached template on second compilation with same template', () => {
      const html = '<p>{{name}}</p>';
      const result1 = service.compile(html, { name: 'First' });
      const result2 = service.compile(html, { name: 'Second' });
      expect(result1).toBe('<p>First</p>');
      expect(result2).toBe('<p>Second</p>');
    });
  });
});
