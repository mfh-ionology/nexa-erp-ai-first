// ---------------------------------------------------------------------------
// Template Compiler Service — E12-1 Task 2
// Handlebars-based template compilation for document PDF generation.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { format as fnsFormat } from 'date-fns';
import Handlebars from 'handlebars';
import type { Logger } from 'pino';

// ---------------------------------------------------------------------------
// Isolated Handlebars environment with custom helpers (AC #2)
// ---------------------------------------------------------------------------

function createHandlebarsEnv(): typeof Handlebars {
  const env = Handlebars.create();

  // {{formatCurrency amount currency}} → "£5,000.00"
  env.registerHelper(
    'formatCurrency',
    function (amount: unknown, currencyCode: unknown, _options: unknown) {
      // Handle case where currencyCode is the Handlebars options hash (only 1 arg passed)
      const cur = typeof currencyCode === 'string' ? currencyCode : 'GBP';
      const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0'));
      if (isNaN(num)) return '';
      try {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: cur,
        }).format(num);
      } catch {
        return `${num.toFixed(2)} ${cur}`;
      }
    },
  );

  // {{formatDate date format?}} → "11/03/2026" (UK default dd/MM/yyyy)
  // Uses date-fns for deterministic, locale-independent formatting
  env.registerHelper('formatDate', function (date: unknown, format: unknown) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(String(date));
    if (isNaN(d.getTime())) return '';

    // If format is a Handlebars options hash (no explicit format arg), default to 'short'
    const fmt = typeof format === 'string' ? format : 'short';

    // Map named presets to date-fns format strings
    const FORMAT_MAP: Record<string, string> = {
      short: 'dd/MM/yyyy',
      medium: 'd MMM yyyy',
      long: 'd MMMM yyyy',
      iso: 'yyyy-MM-dd',
    };

    const pattern = FORMAT_MAP[fmt] ?? fmt;
    return fnsFormat(d, pattern);
  });

  // {{formatNumber value decimals?}} → "1,234.50"
  env.registerHelper('formatNumber', function (value: unknown, decimals: unknown) {
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
    if (isNaN(num)) return '';

    const dec = typeof decimals === 'number' ? decimals : undefined;
    const opts: Intl.NumberFormatOptions = {};
    if (dec !== undefined) {
      opts.minimumFractionDigits = dec;
      opts.maximumFractionDigits = dec;
    }
    return new Intl.NumberFormat('en-GB', opts).format(num);
  });

  // {{eq a b}} — strict equality for conditionals: {{#if (eq status "POSTED")}}
  env.registerHelper('eq', function (a: unknown, b: unknown) {
    return a === b;
  });

  // {{gt a b}} — numeric greater-than
  env.registerHelper('gt', function (a: unknown, b: unknown) {
    return Number(a) > Number(b);
  });

  // {{lt a b}} — numeric less-than
  env.registerHelper('lt', function (a: unknown, b: unknown) {
    return Number(a) < Number(b);
  });

  // {{uppercase str}} → "HELLO"
  env.registerHelper('uppercase', function (str: unknown) {
    return typeof str === 'string' ? str.toUpperCase() : '';
  });

  // {{lowercase str}} → "hello"
  env.registerHelper('lowercase', function (str: unknown) {
    return typeof str === 'string' ? str.toLowerCase() : '';
  });

  // {{lineNumber @index}} → 1-based line number from 0-based index
  env.registerHelper('lineNumber', function (index: unknown) {
    const num = typeof index === 'number' ? index : parseInt(String(index ?? '0'), 10);
    return isNaN(num) ? '' : num + 1;
  });

  // Missing variables → empty string (AC #1: no "undefined" in output)
  env.registerHelper('helperMissing', function () {
    return '';
  });

  return env;
}

// ---------------------------------------------------------------------------
// TemplateCompilerService
// ---------------------------------------------------------------------------

export class TemplateCompilerService {
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly hbs: typeof Handlebars;
  private static readonly MAX_CACHE_SIZE = 200;

  constructor(private readonly logger: Logger) {
    this.hbs = createHandlebarsEnv();
  }

  /**
   * Compile a Handlebars HTML template with data context and optional CSS.
   *
   * @param templateHtml - Handlebars template HTML string
   * @param data         - Data context for variable substitution
   * @param css          - Optional CSS to inject into a <style> block in <head>
   * @returns Fully rendered HTML string ready for PDF rendering
   */
  compile(templateHtml: string, data: Record<string, unknown> | object, css?: string): string {
    const safeData = data ?? {};

    // Compile or fetch from cache
    let render: HandlebarsTemplateDelegate;
    try {
      render = this.getCompiledTemplate(templateHtml);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: message }, 'template-compiler: template syntax error');
      throw new Error(`Template compilation error: ${message}`);
    }

    // Render the template with the data context
    let html: string;
    try {
      html = render(safeData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: message }, 'template-compiler: template rendering error');
      throw new Error(`Template rendering error: ${message}`);
    }

    // Inject CSS into <style> block if provided
    if (css) {
      html = this.injectCss(html, css);
    }

    return html;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getCompiledTemplate(templateHtml: string): HandlebarsTemplateDelegate {
    const cacheKey = createHash('sha256').update(templateHtml).digest('hex');
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Promote to most-recently-used by re-inserting
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    const compiled = this.hbs.compile(templateHtml, { strict: false });

    // Evict oldest if cache full
    if (this.cache.size >= TemplateCompilerService.MAX_CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }

    this.cache.set(cacheKey, compiled);
    return compiled;
  }

  /**
   * Inject CSS into the HTML document.
   *
   * If the HTML contains a <head> tag, insert a <style> block inside it.
   * If no <head> tag exists, prepend the <style> block to the HTML.
   */
  private injectCss(html: string, css: string): string {
    const styleBlock = `<style>\n${css}\n</style>`;

    if (html.includes('</head>')) {
      return html.replace('</head>', `${styleBlock}\n</head>`);
    }

    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n${styleBlock}`);
    }

    // No <head> tag — prepend
    return `${styleBlock}\n${html}`;
  }
}
