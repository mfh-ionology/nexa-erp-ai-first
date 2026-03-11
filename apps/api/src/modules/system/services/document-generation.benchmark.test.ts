// ---------------------------------------------------------------------------
// Performance Benchmarks — Document Generation (E12-1 Task 10)
//
// Validates:
//   10.1 — Template compilation <100ms for 50KB template with 100 line items (AC #1)
//   10.2 — PDF generation <5s for 5-page invoice with 50 line items (NFR3)
//   10.3 — Browser reuse: 10 sequential PDFs with 1 browser, all within 10s
//
// Gated behind RUN_BENCHMARKS=true — skipped in CI by default.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TemplateCompilerService } from './template-compiler.service.js';
import { PdfGeneratorService } from './pdf-generator.service.js';

// ─── Gate ──────────────────────────────────────────────────────────────────

const RUN_BENCHMARKS = process.env.RUN_BENCHMARKS === 'true';

const describeIf = RUN_BENCHMARKS ? describe : describe.skip;

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/**
 * Run a function N times and return sorted durations with percentiles.
 */
async function benchmark(
  fn: () => Promise<void> | void,
  iterations: number,
): Promise<{ durations: number[]; p50: number; p95: number; p99: number; mean: number }> {
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  const p = (pct: number) => durations[Math.floor(durations.length * pct)]!;
  const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
  return { durations, p50: p(0.5), p95: p(0.95), p99: p(0.99), mean };
}

/**
 * Build a realistic invoice HTML template (~50KB) with Handlebars syntax.
 */
function build50KBTemplate(): string {
  const header = `<!DOCTYPE html>
<html>
<head><title>Invoice {{invoice.number}}</title></head>
<body>
<div class="invoice-header">
  <div class="company-info">
    {{#if showLogo}}<img src="{{company.logoUrl}}" alt="Logo" />{{/if}}
    <h1>{{company.name}}</h1>
    <p>{{company.legalName}}</p>
    <p>{{company.address.line1}}</p>
    <p>{{company.address.line2}}</p>
    <p>{{company.address.city}}, {{company.address.postcode}}</p>
    {{#if showVatNumber}}<p>VAT: {{company.vatNumber}}</p>{{/if}}
    {{#if showCompanyReg}}<p>Reg: {{company.companyNumber}}</p>{{/if}}
  </div>
  <div class="invoice-meta">
    <h2>INVOICE</h2>
    <p>Invoice No: {{invoice.number}}</p>
    <p>Date: {{formatDate invoice.date}}</p>
    <p>Due: {{formatDate invoice.dueDate}}</p>
    <p>Reference: {{invoice.reference}}</p>
    <p>Status: {{uppercase invoice.status}}</p>
  </div>
</div>
<div class="customer-info">
  <h3>Bill To:</h3>
  <p>{{customer.name}}</p>
  <p>{{customer.address.line1}}</p>
  <p>{{customer.address.city}}, {{customer.address.postcode}}</p>
  {{#if customer.vatNumber}}<p>VAT: {{customer.vatNumber}}</p>{{/if}}
  <p>Email: {{customer.contactEmail}}</p>
</div>`;

  const lineRow = `<tr>
  <td>{{lineNumber @index}}</td>
  <td>{{this.itemCode}}</td>
  <td>{{this.description}}</td>
  <td class="number">{{formatNumber this.quantity 2}}</td>
  <td class="number">{{formatCurrency this.unitPrice currency}}</td>
  {{#if this.discountPercent}}<td class="number">{{formatNumber this.discountPercent 1}}%</td>{{else}}<td>-</td>{{/if}}
  <td class="number">{{formatNumber this.vatRate 1}}%</td>
  <td class="number">{{formatCurrency this.vatAmount currency}}</td>
  <td class="number">{{formatCurrency this.lineTotal currency}}</td>
</tr>`;

  const table = `<table class="line-items">
<thead>
  <tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Disc</th><th>VAT %</th><th>VAT</th><th>Total</th></tr>
</thead>
<tbody>
{{#each lines}}
${lineRow}
{{/each}}
</tbody>
</table>`;

  const totals = `<div class="totals">
  <table>
    <tr><td>Subtotal:</td><td>{{formatCurrency totals.subtotal currency}}</td></tr>
    {{#each totals.vatBreakdown}}
    <tr><td>VAT @ {{formatNumber this.rate 1}}%:</td><td>{{formatCurrency this.vatAmount currency}}</td></tr>
    {{/each}}
    <tr><td>Total VAT:</td><td>{{formatCurrency totals.vatAmount currency}}</td></tr>
    <tr class="grand-total"><td><strong>Total:</strong></td><td><strong>{{formatCurrency totals.total currency}}</strong></td></tr>
    {{#if (gt totals.amountDue 0)}}
    <tr><td>Amount Due:</td><td>{{formatCurrency totals.amountDue currency}}</td></tr>
    {{/if}}
  </table>
</div>`;

  const footer = `<div class="footer">
  <p>{{invoice.notes}}</p>
  <p>Payment Terms: {{metadata.paymentTerms}}</p>
  {{#if showBankDetails}}
  <div class="bank-details">
    <p><strong>Bank Details</strong></p>
    <p>Bank: {{company.bankName}}</p>
    <p>Sort Code: {{company.bankSortCode}}</p>
    <p>Account: {{company.bankAccountNumber}}</p>
  </div>
  {{/if}}
  <p class="legal">{{company.legalName}} — Registered in England & Wales — Company No: {{company.companyNumber}}</p>
</div>
</body>
</html>`;

  // Pad with additional repeated sections to ensure ~50KB
  const extraSections: string[] = [];
  const sectionTemplate = `<div class="terms-section-{{sectionNum}}">
  <h4>Terms & Conditions — Section {{sectionNum}}</h4>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
  <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
</div>`;

  // Calculate current size and pad to ~50KB
  const coreParts = header + table + totals + footer;
  const targetSize = 50 * 1024;
  let currentSize = Buffer.byteLength(coreParts);
  let sectionNum = 1;
  while (currentSize < targetSize) {
    const section = sectionTemplate.replace(/\{\{sectionNum\}\}/g, String(sectionNum++));
    extraSections.push(section);
    currentSize += Buffer.byteLength(section);
  }

  return `${header}\n${table}\n${totals}\n${extraSections.join('\n')}\n${footer}`;
}

/**
 * Build a realistic data context with N line items.
 */
function buildDataContext(lineCount: number) {
  const lines = Array.from({ length: lineCount }, (_, i) => {
    const quantity = 1 + Math.floor(Math.random() * 20);
    const unitPrice = Math.round(Math.random() * 50000) / 100;
    const vatRate = [0, 5, 20][Math.floor(Math.random() * 3)]!;
    const lineTotal = quantity * unitPrice;
    const vatAmount = lineTotal * (vatRate / 100);
    return {
      itemCode: `SKU-${String(i + 1).padStart(4, '0')}`,
      description: `Product item ${i + 1} — professional grade component for enterprise applications`,
      quantity,
      unitPrice,
      discountPercent: i % 5 === 0 ? 10 : null,
      vatRate,
      vatAmount: Math.round(vatAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const vatAmount = lines.reduce((sum, l) => sum + l.vatAmount, 0);

  // Group VAT by rate
  const vatMap = new Map<number, { rate: number; taxableAmount: number; vatAmount: number }>();
  for (const line of lines) {
    const existing = vatMap.get(line.vatRate);
    if (existing) {
      existing.taxableAmount += line.lineTotal;
      existing.vatAmount += line.vatAmount;
    } else {
      vatMap.set(line.vatRate, {
        rate: line.vatRate,
        taxableAmount: line.lineTotal,
        vatAmount: line.vatAmount,
      });
    }
  }

  return {
    company: {
      name: 'Benchmark Manufacturing Ltd',
      legalName: 'Benchmark Manufacturing Limited',
      address: {
        line1: '42 Performance Avenue',
        line2: 'Enterprise Park',
        city: 'London',
        postcode: 'EC2A 4BQ',
      },
      vatNumber: 'GB123456789',
      companyNumber: '12345678',
      bankName: 'Barclays Business',
      bankSortCode: '20-00-00',
      bankAccountNumber: '12345678',
      logoUrl: 'https://example.com/logo.png',
      email: 'accounts@benchmark.co.uk',
      phone: '+44 20 7123 4567',
    },
    invoice: {
      number: 'INV-BENCH-001',
      date: '2026-03-11',
      dueDate: '2026-04-10',
      reference: 'PO-CUST-789',
      status: 'POSTED',
      notes: 'Payment due within 30 days. Late payments subject to statutory interest.',
    },
    customer: {
      name: 'Enterprise Solutions PLC',
      address: {
        line1: '100 Customer Road',
        city: 'Manchester',
        postcode: 'M1 1AA',
      },
      vatNumber: 'GB987654321',
      contactEmail: 'finance@enterprise-solutions.co.uk',
    },
    currency: 'GBP',
    lines,
    totals: {
      subtotal: Math.round(subtotal * 100) / 100,
      vatBreakdown: Array.from(vatMap.values()),
      vatAmount: Math.round(vatAmount * 100) / 100,
      total: Math.round((subtotal + vatAmount) * 100) / 100,
      amountDue: Math.round((subtotal + vatAmount) * 100) / 100,
    },
    metadata: {
      paymentTerms: 'Net 30',
    },
    showLogo: true,
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
  };
}

/**
 * Build a simple but valid HTML document for PDF rendering tests.
 * Generates content to fill approximately `pageCount` A4 pages.
 */
function buildMultiPageHtml(lineCount: number): string {
  const compiler = new TemplateCompilerService(mockLogger);
  const template = build50KBTemplate();
  const data = buildDataContext(lineCount);
  const css = `
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 20px; }
    .invoice-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .line-items { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .line-items th, .line-items td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
    .line-items th { background-color: #f5f5f5; }
    .number { text-align: right; }
    .totals { margin-top: 20px; float: right; }
    .grand-total td { border-top: 2px solid #333; }
    .footer { clear: both; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
    tr { page-break-inside: avoid; }
  `;
  return compiler.compile(template, data, css);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describeIf('Document Generation Performance Benchmarks', () => {
  // ─── 10.1: Template Compilation Benchmark ─────────────────────────────

  describe('10.1 — Template compilation benchmark', () => {
    it('compiles a 50KB template with 100 line items within 100ms (AC #1)', async () => {
      const compiler = new TemplateCompilerService(mockLogger);
      const template = build50KBTemplate();
      const data = buildDataContext(100);

      // Verify template is at least 50KB
      const templateSize = Buffer.byteLength(template);
      expect(templateSize).toBeGreaterThanOrEqual(50 * 1024);
      console.log(`  Template size: ${(templateSize / 1024).toFixed(1)}KB`);

      const iterations = 50;
      // Warm up the compiler cache
      compiler.compile(template, data);

      const stats = await benchmark(() => {
        compiler.compile(template, data);
      }, iterations);

      console.log(
        `[Benchmark] Template compilation — 50KB + 100 lines (${iterations} runs):\n` +
          `  p50: ${stats.p50.toFixed(2)}ms | p95: ${stats.p95.toFixed(2)}ms | p99: ${stats.p99.toFixed(2)}ms | mean: ${stats.mean.toFixed(2)}ms`,
      );

      // AC1: compilation within 100ms
      expect(stats.p95).toBeLessThan(100);
    });

    it('compiles a 50KB template WITHOUT cache within 100ms (cold start)', async () => {
      const template = build50KBTemplate();
      const data = buildDataContext(100);
      const iterations = 20;

      const stats = await benchmark(() => {
        // Create a new compiler each time to avoid cache hits
        const compiler = new TemplateCompilerService(mockLogger);
        compiler.compile(template, data);
      }, iterations);

      console.log(
        `[Benchmark] Template compilation — cold start (${iterations} runs):\n` +
          `  p50: ${stats.p50.toFixed(2)}ms | p95: ${stats.p95.toFixed(2)}ms | p99: ${stats.p99.toFixed(2)}ms | mean: ${stats.mean.toFixed(2)}ms`,
      );

      // Even cold-start compilation should be under 100ms
      expect(stats.p95).toBeLessThan(100);
    });
  });

  // ─── 10.2: PDF Generation Benchmark ───────────────────────────────────

  describe('10.2 — PDF generation benchmark', () => {
    let pdfService: PdfGeneratorService;

    beforeAll(async () => {
      pdfService = new PdfGeneratorService(mockLogger);
      await pdfService.init();
    }, 30_000);

    afterAll(async () => {
      await pdfService.close();
    });

    it('generates a 5-page invoice PDF with 50 line items within 5 seconds (NFR3)', async () => {
      // ~50 line items with multi-section content produces ~5 pages
      const html = buildMultiPageHtml(50);

      const start = performance.now();
      const pdfBuffer = await pdfService.generatePdf(html);
      const elapsed = performance.now() - start;

      // Verify we got a valid PDF
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString('ascii', 0, 5)).toBe('%PDF-');

      console.log(
        `[Benchmark] PDF generation — 50 lines (~5 pages):\n` +
          `  Elapsed: ${elapsed.toFixed(0)}ms | PDF size: ${(pdfBuffer.length / 1024).toFixed(1)}KB`,
      );

      // NFR3: within 5 seconds
      expect(elapsed).toBeLessThan(5000);
    }, 15_000);

    it('generates a large invoice PDF with 100 line items within 5 seconds (stress)', async () => {
      const html = buildMultiPageHtml(100);

      const start = performance.now();
      const pdfBuffer = await pdfService.generatePdf(html);
      const elapsed = performance.now() - start;

      expect(pdfBuffer.toString('ascii', 0, 5)).toBe('%PDF-');

      console.log(
        `[Benchmark] PDF generation — 100 lines (stress):\n` +
          `  Elapsed: ${elapsed.toFixed(0)}ms | PDF size: ${(pdfBuffer.length / 1024).toFixed(1)}KB`,
      );

      expect(elapsed).toBeLessThan(5000);
    }, 15_000);
  });

  // ─── 10.3: Browser Reuse Verification ─────────────────────────────────

  describe('10.3 — Browser reuse verification', () => {
    it('generates 10 PDFs sequentially with 1 browser, all within 10 seconds', async () => {
      const pdfService = new PdfGeneratorService(mockLogger);

      // Track browser launches by spying on init
      let launchCount = 0;
      const originalInit = pdfService.init.bind(pdfService);
      pdfService.init = async () => {
        launchCount++;
        return originalInit();
      };

      await pdfService.init();

      const simpleHtml = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
  <h1>Invoice #{{n}}</h1>
  <table><tr><td>Item</td><td>Amount</td></tr>
  <tr><td>Widget A</td><td>£100.00</td></tr>
  <tr><td>Widget B</td><td>£250.00</td></tr>
  </table>
  <p><strong>Total: £350.00</strong></p>
</body></html>`;

      const totalStart = performance.now();
      const results: Buffer[] = [];

      for (let i = 0; i < 10; i++) {
        const html = simpleHtml.replace('{{n}}', String(i + 1));
        const pdf = await pdfService.generatePdf(html);
        results.push(pdf);
      }

      const totalElapsed = performance.now() - totalStart;

      await pdfService.close();

      // Verify all 10 PDFs were generated successfully
      expect(results).toHaveLength(10);
      for (const pdf of results) {
        expect(pdf).toBeInstanceOf(Buffer);
        expect(pdf.length).toBeGreaterThan(0);
        expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-');
      }

      // Verify only 1 browser was launched (not 10)
      expect(launchCount).toBe(1);

      console.log(
        `[Benchmark] Browser reuse — 10 sequential PDFs:\n` +
          `  Total: ${totalElapsed.toFixed(0)}ms | Per-PDF avg: ${(totalElapsed / 10).toFixed(0)}ms | Browser launches: ${launchCount}`,
      );

      // All 10 within 10 seconds total (AC #6 requires <1s per PDF)
      // The key validation is browser reuse (1 launch, not 10).
      expect(totalElapsed).toBeLessThan(10_000);
    }, 30_000);
  });
});
