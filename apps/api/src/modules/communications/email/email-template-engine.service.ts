// ---------------------------------------------------------------------------
// Email Template Engine Service — E10-2 Task 3
// Handlebars-based template compilation, validation, and preview rendering.
// ---------------------------------------------------------------------------

import Handlebars from 'handlebars';
import type { EmailTemplate } from '@nexa/db';
import { getSampleData } from './email-template-sample-data.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CompiledTemplate {
  renderSubject: (data: Record<string, unknown>) => string;
  renderBody: (data: Record<string, unknown>) => string;
}

export interface PreviewResult {
  subject: string;
  bodyHtml: string;
  sampleData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Known merge variables per document type (AC #2)
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPE_VARIABLES: Record<string, string[]> = {
  CustomerInvoice: [
    'invoiceNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'dueDate',
    'issueDate',
    'lineItems',
    'companyName',
    'companyEmail',
    'companyPhone',
    'companyAddress',
  ],
  CustomerStatement: [
    'customerName',
    'customerEmail',
    'statementDate',
    'openingBalance',
    'closingBalance',
    'currency',
    'transactions',
    'companyName',
    'companyEmail',
  ],
  SalesQuote: [
    'quoteNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'validUntil',
    'lineItems',
    'companyName',
    'companyEmail',
  ],
  SalesOrder: [
    'orderNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'expectedDeliveryDate',
    'lineItems',
    'companyName',
    'companyEmail',
  ],
  PurchaseOrder: [
    'poNumber',
    'supplierName',
    'supplierEmail',
    'totalAmount',
    'currency',
    'expectedDeliveryDate',
    'lineItems',
    'companyName',
    'companyEmail',
  ],
  CreditNote: [
    'creditNoteNumber',
    'customerName',
    'customerEmail',
    'totalAmount',
    'currency',
    'reason',
    'originalInvoiceNumber',
    'companyName',
    'companyEmail',
  ],
  Payslip: [
    'employeeName',
    'employeeEmail',
    'payPeriod',
    'grossPay',
    'netPay',
    'currency',
    'deductions',
    'companyName',
  ],
};

/** All supported document types. */
export const SUPPORTED_DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_VARIABLES);

// ---------------------------------------------------------------------------
// Handlebars helpers registration (AC #2 — subtask 3.6)
// ---------------------------------------------------------------------------

/** Isolated Handlebars environment so custom helpers don't pollute the global instance. */
function createHandlebarsEnv(): typeof Handlebars {
  const env = Handlebars.create();

  // {{formatCurrency amount currency}} → "£1,250.00" / "1,250.00 GBP"
  env.registerHelper('formatCurrency', (amount: unknown, currency: unknown) => {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0'));
    const cur = String(currency ?? 'GBP');
    if (isNaN(num)) return String(amount ?? '');
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur }).format(num);
    } catch {
      // Fallback if currency code is invalid
      return `${num.toFixed(2)} ${cur}`;
    }
  });

  // {{formatDate date format?}} — format defaults to ISO date
  env.registerHelper('formatDate', (date: unknown, format: unknown) => {
    const d = date instanceof Date ? date : new Date(String(date ?? ''));
    if (isNaN(d.getTime())) return String(date ?? '');
    // If format is a Handlebars options hash (no explicit format arg), default to ISO
    if (typeof format !== 'string') {
      return d.toISOString().slice(0, 10);
    }
    // Simple format support: 'short', 'long', 'iso'
    switch (format) {
      case 'short':
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      case 'long':
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      default:
        return d.toISOString().slice(0, 10);
    }
  });

  return env;
}

// ---------------------------------------------------------------------------
// AST variable extraction
// ---------------------------------------------------------------------------

/**
 * Extract variable names referenced in a Handlebars template AST.
 * Walks the AST tree to find MustacheStatement and BlockStatement nodes
 * that reference PathExpression paths rooted at template data (not helpers).
 */
function extractVariablesFromAST(ast: hbs.AST.Program): Set<string> {
  const variables = new Set<string>();

  function visit(node: hbs.AST.Node): void {
    if (!node || typeof node !== 'object') return;

    // MustacheStatement: {{variable}} or {{helper arg}}
    if (node.type === 'MustacheStatement' || node.type === 'SubExpression') {
      const stmt = node as hbs.AST.MustacheStatement;
      if (stmt.path.type === 'PathExpression') {
        const pathExpr = stmt.path as hbs.AST.PathExpression;
        // Skip built-in helpers (if, each, unless, with, lookup, log)
        // and custom helpers (formatCurrency, formatDate) — those are not variables
        const builtins = new Set([
          'if',
          'each',
          'unless',
          'with',
          'lookup',
          'log',
          'formatCurrency',
          'formatDate',
        ]);
        if (!builtins.has(pathExpr.original)) {
          // Use the root part of dotted paths: "customer.name" → "customer"
          // But also track the full original for simple top-level vars
          variables.add(pathExpr.parts[0] as string);
        }
      }
      // Also check params for variable references (e.g., {{formatCurrency amount currency}})
      for (const param of stmt.params) {
        if (param.type === 'PathExpression') {
          const paramPath = param as hbs.AST.PathExpression;
          variables.add(paramPath.parts[0] as string);
        }
      }
    }

    // BlockStatement: {{#each lineItems}} ... {{/each}}
    if (node.type === 'BlockStatement') {
      const block = node as hbs.AST.BlockStatement;
      // The param is the variable being iterated/checked
      for (const param of block.params) {
        if (param.type === 'PathExpression') {
          const paramPath = param as hbs.AST.PathExpression;
          variables.add(paramPath.parts[0] as string);
        }
      }
      // Visit the body and inverse of block statements
      if (block.program) {
        for (const bodyNode of block.program.body) {
          visit(bodyNode);
        }
      }
      if (block.inverse) {
        for (const bodyNode of block.inverse.body) {
          visit(bodyNode);
        }
      }
      return; // Already visited children
    }

    // ContentStatement, CommentStatement — no variables
    // Recursively visit child nodes
    if ('body' in node && Array.isArray((node as hbs.AST.Program).body)) {
      for (const child of (node as hbs.AST.Program).body) {
        visit(child);
      }
    }
  }

  for (const statement of ast.body) {
    visit(statement);
  }

  return variables;
}

// ---------------------------------------------------------------------------
// EmailTemplateEngineService
// ---------------------------------------------------------------------------

export class EmailTemplateEngineService {
  private readonly cache = new Map<string, CompiledTemplate>();
  private readonly hbs: typeof Handlebars;
  private static readonly MAX_CACHE_SIZE = 200;

  constructor(private readonly logger: Logger) {
    this.hbs = createHandlebarsEnv();
  }

  // -------------------------------------------------------------------------
  // validateTemplate (AC #2 — subtask 3.3)
  // -------------------------------------------------------------------------

  validateTemplate(
    subjectTemplate: string,
    bodyHtmlTemplate: string,
    documentType: string,
  ): ValidationResult {
    const errors: string[] = [];

    const knownVars = DOCUMENT_TYPE_VARIABLES[documentType];
    if (!knownVars) {
      return { valid: false, errors: [`Unknown document type: ${documentType}`] };
    }

    // Compile subject template
    let subjectAST: hbs.AST.Program;
    try {
      subjectAST = this.hbs.parse(subjectTemplate);
    } catch (err) {
      errors.push(
        `Subject template syntax error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { valid: false, errors };
    }

    // Compile body template
    let bodyAST: hbs.AST.Program;
    try {
      bodyAST = this.hbs.parse(bodyHtmlTemplate);
    } catch (err) {
      errors.push(
        `Body template syntax error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { valid: false, errors };
    }

    // Extract variables from both templates
    const subjectVars = extractVariablesFromAST(subjectAST);
    const bodyVars = extractVariablesFromAST(bodyAST);
    const allVars = new Set([...subjectVars, ...bodyVars]);

    // Check for unknown variables
    const knownSet = new Set(knownVars);
    for (const v of allVars) {
      if (!knownSet.has(v)) {
        errors.push(
          `Unknown variable "{{${v}}}" for document type "${documentType}". Allowed variables: ${knownVars.join(', ')}`,
        );
      }
    }

    // Also verify the templates actually compile (catches unclosed blocks, etc.)
    try {
      this.hbs.compile(subjectTemplate);
    } catch (err) {
      errors.push(
        `Subject template compilation error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      this.hbs.compile(bodyHtmlTemplate);
    } catch (err) {
      errors.push(
        `Body template compilation error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  // -------------------------------------------------------------------------
  // compileTemplate (AC #5 — subtask 3.4)
  // -------------------------------------------------------------------------

  compileTemplate(template: EmailTemplate): CompiledTemplate {
    const cacheKey = `${template.id}:${template.updatedAt.toISOString()}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Promote to most-recently-used by re-inserting at end of Map
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      this.logger.debug({ templateId: template.id }, 'template-engine: cache hit');
      return cached;
    }

    // Evict stale entries for the same template ID (old updatedAt versions)
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${template.id}:`)) {
        this.cache.delete(key);
      }
    }

    const renderSubject = this.hbs.compile(template.subjectTemplate);
    const renderBody = this.hbs.compile(template.bodyHtmlTemplate);

    const compiled: CompiledTemplate = {
      renderSubject: (data) => renderSubject(data),
      renderBody: (data) => renderBody(data),
    };

    // Evict oldest entries if cache exceeds max size
    if (this.cache.size >= EmailTemplateEngineService.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, compiled);
    this.logger.debug({ templateId: template.id }, 'template-engine: compiled and cached');
    return compiled;
  }

  // -------------------------------------------------------------------------
  // renderPreview (AC #3 — subtask 3.5)
  // -------------------------------------------------------------------------

  renderPreview(template: EmailTemplate): PreviewResult {
    const sampleData = getSampleData(template.documentType);
    const compiled = this.compileTemplate(template);

    return {
      subject: compiled.renderSubject(sampleData),
      bodyHtml: compiled.renderBody(sampleData),
      sampleData,
    };
  }

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  /** Invalidate all cache entries for a given template ID. */
  invalidateCache(templateId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${templateId}:`)) {
        this.cache.delete(key);
      }
    }
    this.logger.debug({ templateId }, 'template-engine: cache invalidated');
  }

  /** Clear the entire cache. */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('template-engine: cache cleared');
  }
}
