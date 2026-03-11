// ---------------------------------------------------------------------------
// Template Helpers — E12-3 Task 1.3
// Reusable Handlebars partial snippets (string constants) shared across
// all 14 default document templates. Each constant is a self-contained
// HTML fragment using Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

/**
 * Company header partial.
 * Renders: logo (conditional on branding.showLogo), company name, legal name,
 * address, phone, email, website, VAT number (conditional), company reg (conditional).
 *
 * Data paths: company.*, branding.showLogo, branding.logoPosition,
 * branding.showVatNumber, branding.showCompanyReg
 */
export const COMPANY_HEADER_PARTIAL = `
<div class="header">
  <div class="header-left">
    {{#if branding.showLogo}}
    {{#if company.logoUrl}}
    <div class="logo-section">
      <img src="{{company.logoUrl}}" alt="{{company.name}} logo" />
    </div>
    {{/if}}
    {{/if}}
    <div class="company-name">{{company.name}}</div>
    {{#if company.legalName}}
    <div class="company-legal-name">{{company.legalName}}</div>
    {{/if}}
  </div>
  <div class="header-right">
    <div class="company-details">
      <p style="white-space:pre-line">{{company.address}}</p>
      {{#if company.phone}}<p>Tel: {{company.phone}}</p>{{/if}}
      {{#if company.email}}<p>{{company.email}}</p>{{/if}}
      {{#if company.website}}<p>{{company.website}}</p>{{/if}}
      {{#if branding.showVatNumber}}
      {{#if company.vatNumber}}<p class="vat-number">VAT: {{company.vatNumber}}</p>{{/if}}
      {{/if}}
      {{#if branding.showCompanyReg}}
      {{#if company.companyNumber}}<p class="company-reg">Reg: {{company.companyNumber}}</p>{{/if}}
      {{/if}}
    </div>
  </div>
</div>`;

/**
 * Counterparty address block partial.
 * Renders customer/supplier/employee name and address.
 *
 * Data paths: counterparty.name, counterparty.address, counterparty.vatNumber
 */
export const COUNTERPARTY_BLOCK_PARTIAL = `
<div class="address-block">
  <div class="label">To</div>
  <div class="name">{{counterparty.name}}</div>
  <div class="address">{{counterparty.address}}</div>
  {{#if counterparty.vatNumber}}<div class="text-sm text-muted">VAT: {{counterparty.vatNumber}}</div>{{/if}}
</div>`;

/**
 * Standard line items table partial.
 * Full pricing table with line number, item code, description, quantity,
 * unit price, discount, VAT rate, and line total.
 *
 * Data paths: lines[].lineNumber, lines[].itemCode, lines[].description,
 * lines[].quantity, lines[].unitPrice, lines[].discountPercent,
 * lines[].vatRate, lines[].lineTotal, metadata.currencyCode
 */
export const LINE_ITEMS_TABLE_PARTIAL = `
<table class="line-items-table">
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th style="width:80px">Code</th>
      <th>Description</th>
      <th class="text-right" style="width:55px">Qty</th>
      <th class="text-right" style="width:85px">Unit Price</th>
      <th class="text-right" style="width:55px">Disc %</th>
      <th class="text-right" style="width:55px">VAT %</th>
      <th class="text-right" style="width:90px">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each lines}}
    <tr class="line-item-row">
      <td>{{this.lineNumber}}</td>
      <td>{{this.itemCode}}</td>
      <td>{{this.description}}</td>
      <td class="text-right">{{formatNumber this.quantity 2}}</td>
      <td class="text-right">{{formatCurrency this.unitPrice ../metadata.currencyCode}}</td>
      <td class="text-right">{{#if this.discountPercent}}{{formatNumber this.discountPercent 0}}%{{/if}}</td>
      <td class="text-right">{{formatNumber this.vatRate 0}}%</td>
      <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`;

/**
 * VAT breakdown partial.
 * Grouped summary showing taxable amount and VAT per rate.
 *
 * Data paths: totals.vatBreakdown[].rate, .taxableAmount, .vatAmount,
 * metadata.currencyCode
 */
export const VAT_BREAKDOWN_PARTIAL = `
{{#if totals.vatBreakdown}}
<div class="vat-breakdown">
  <table>
    <thead>
      <tr>
        <th>VAT Rate</th>
        <th>Taxable Amount</th>
        <th>VAT Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each totals.vatBreakdown}}
      <tr>
        <td>{{formatNumber this.rate 0}}%</td>
        <td>{{formatCurrency this.taxableAmount ../metadata.currencyCode}}</td>
        <td>{{formatCurrency this.vatAmount ../metadata.currencyCode}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
</div>
{{/if}}`;

/**
 * Totals section partial.
 * Subtotal, VAT, total, and amount due (with bold styling on final line).
 *
 * Data paths: totals.subtotal, totals.vatAmount, totals.total,
 * totals.amountDue, metadata.currencyCode
 */
export const TOTALS_SECTION_PARTIAL = `
<div class="totals-section">
  <table>
    <tr>
      <td>Subtotal</td>
      <td>{{formatCurrency totals.subtotal metadata.currencyCode}}</td>
    </tr>
    {{#if totals.vatAmount}}
    <tr>
      <td>VAT</td>
      <td>{{formatCurrency totals.vatAmount metadata.currencyCode}}</td>
    </tr>
    {{/if}}
    <tr class="total-row">
      <td>Total</td>
      <td>{{formatCurrency totals.total metadata.currencyCode}}</td>
    </tr>
    <tr class="amount-due-row">
      <td>Amount Due</td>
      <td>{{formatCurrency totals.amountDue metadata.currencyCode}}</td>
    </tr>
  </table>
</div>`;

/**
 * Bank details partial (conditional on branding.showBankDetails).
 * Renders bank name, sort code, and account number.
 *
 * Data paths: branding.showBankDetails, company.bankName,
 * company.bankSortCode, company.bankAccountNumber
 */
export const BANK_DETAILS_PARTIAL = `
{{#if branding.showBankDetails}}
<div class="bank-details">
  <div class="section-title">Bank Details</div>
  <table>
    {{#if company.bankName}}
    <tr><td>Bank</td><td>{{company.bankName}}</td></tr>
    {{/if}}
    {{#if company.bankSortCode}}
    <tr><td>Sort Code</td><td>{{company.bankSortCode}}</td></tr>
    {{/if}}
    {{#if company.bankAccountNumber}}
    <tr><td>Account No.</td><td>{{company.bankAccountNumber}}</td></tr>
    {{/if}}
  </table>
</div>
{{/if}}`;

/**
 * Page footer partial.
 * Rendered in the main HTML body (not Puppeteer's footerTemplate).
 * Company name and a "Generated by Nexa ERP" note.
 *
 * Data paths: company.name
 */
export const PAGE_FOOTER_PARTIAL = `
<div class="page-footer">
  {{company.name}} &mdash; Generated by Nexa ERP
  <div class="page-numbers">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
</div>`;
