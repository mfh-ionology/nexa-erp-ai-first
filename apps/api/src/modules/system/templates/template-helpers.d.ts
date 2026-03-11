/**
 * Company header partial.
 * Renders: logo (conditional on branding.showLogo), company name, legal name,
 * address, phone, email, website, VAT number (conditional), company reg (conditional).
 *
 * Data paths: company.*, branding.showLogo, branding.logoPosition,
 * branding.showVatNumber, branding.showCompanyReg
 */
export declare const COMPANY_HEADER_PARTIAL =
  '\n<div class="header">\n  <div class="header-left">\n    {{#if branding.showLogo}}\n    {{#if company.logoUrl}}\n    <div class="logo-section">\n      <img src="{{company.logoUrl}}" alt="{{company.name}} logo" />\n    </div>\n    {{/if}}\n    {{/if}}\n    <div class="company-name">{{company.name}}</div>\n    {{#if company.legalName}}\n    <div class="company-legal-name">{{company.legalName}}</div>\n    {{/if}}\n  </div>\n  <div class="header-right">\n    <div class="company-details">\n      <p style="white-space:pre-line">{{company.address}}</p>\n      {{#if company.phone}}<p>Tel: {{company.phone}}</p>{{/if}}\n      {{#if company.email}}<p>{{company.email}}</p>{{/if}}\n      {{#if company.website}}<p>{{company.website}}</p>{{/if}}\n      {{#if branding.showVatNumber}}\n      {{#if company.vatNumber}}<p class="vat-number">VAT: {{company.vatNumber}}</p>{{/if}}\n      {{/if}}\n      {{#if branding.showCompanyReg}}\n      {{#if company.companyNumber}}<p class="company-reg">Reg: {{company.companyNumber}}</p>{{/if}}\n      {{/if}}\n    </div>\n  </div>\n</div>';
/**
 * Counterparty address block partial.
 * Renders customer/supplier/employee name and address.
 *
 * Data paths: counterparty.name, counterparty.address, counterparty.vatNumber
 */
export declare const COUNTERPARTY_BLOCK_PARTIAL =
  '\n<div class="address-block">\n  <div class="label">To</div>\n  <div class="name">{{counterparty.name}}</div>\n  <div class="address">{{counterparty.address}}</div>\n  {{#if counterparty.vatNumber}}<div class="text-sm text-muted">VAT: {{counterparty.vatNumber}}</div>{{/if}}\n</div>';
/**
 * Standard line items table partial.
 * Full pricing table with line number, item code, description, quantity,
 * unit price, discount, VAT rate, and line total.
 *
 * Data paths: lines[].lineNumber, lines[].itemCode, lines[].description,
 * lines[].quantity, lines[].unitPrice, lines[].discountPercent,
 * lines[].vatRate, lines[].lineTotal, metadata.currencyCode
 */
export declare const LINE_ITEMS_TABLE_PARTIAL =
  '\n<table class="line-items-table">\n  <thead>\n    <tr>\n      <th style="width:30px">#</th>\n      <th style="width:80px">Code</th>\n      <th>Description</th>\n      <th class="text-right" style="width:55px">Qty</th>\n      <th class="text-right" style="width:85px">Unit Price</th>\n      <th class="text-right" style="width:55px">Disc %</th>\n      <th class="text-right" style="width:55px">VAT %</th>\n      <th class="text-right" style="width:90px">Total</th>\n    </tr>\n  </thead>\n  <tbody>\n    {{#each lines}}\n    <tr class="line-item-row">\n      <td>{{this.lineNumber}}</td>\n      <td>{{this.itemCode}}</td>\n      <td>{{this.description}}</td>\n      <td class="text-right">{{formatNumber this.quantity 2}}</td>\n      <td class="text-right">{{formatCurrency this.unitPrice ../metadata.currencyCode}}</td>\n      <td class="text-right">{{#if this.discountPercent}}{{formatNumber this.discountPercent 0}}%{{/if}}</td>\n      <td class="text-right">{{formatNumber this.vatRate 0}}%</td>\n      <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>\n    </tr>\n    {{/each}}\n  </tbody>\n</table>';
/**
 * VAT breakdown partial.
 * Grouped summary showing taxable amount and VAT per rate.
 *
 * Data paths: totals.vatBreakdown[].rate, .taxableAmount, .vatAmount,
 * metadata.currencyCode
 */
export declare const VAT_BREAKDOWN_PARTIAL =
  '\n{{#if totals.vatBreakdown}}\n<div class="vat-breakdown">\n  <table>\n    <thead>\n      <tr>\n        <th>VAT Rate</th>\n        <th>Taxable Amount</th>\n        <th>VAT Amount</th>\n      </tr>\n    </thead>\n    <tbody>\n      {{#each totals.vatBreakdown}}\n      <tr>\n        <td>{{formatNumber this.rate 0}}%</td>\n        <td>{{formatCurrency this.taxableAmount ../metadata.currencyCode}}</td>\n        <td>{{formatCurrency this.vatAmount ../metadata.currencyCode}}</td>\n      </tr>\n      {{/each}}\n    </tbody>\n  </table>\n</div>\n{{/if}}';
/**
 * Totals section partial.
 * Subtotal, VAT, total, and amount due (with bold styling on final line).
 *
 * Data paths: totals.subtotal, totals.vatAmount, totals.total,
 * totals.amountDue, metadata.currencyCode
 */
export declare const TOTALS_SECTION_PARTIAL =
  '\n<div class="totals-section">\n  <table>\n    <tr>\n      <td>Subtotal</td>\n      <td>{{formatCurrency totals.subtotal metadata.currencyCode}}</td>\n    </tr>\n    {{#if totals.vatAmount}}\n    <tr>\n      <td>VAT</td>\n      <td>{{formatCurrency totals.vatAmount metadata.currencyCode}}</td>\n    </tr>\n    {{/if}}\n    <tr class="total-row">\n      <td>Total</td>\n      <td>{{formatCurrency totals.total metadata.currencyCode}}</td>\n    </tr>\n    <tr class="amount-due-row">\n      <td>Amount Due</td>\n      <td>{{formatCurrency totals.amountDue metadata.currencyCode}}</td>\n    </tr>\n  </table>\n</div>';
/**
 * Bank details partial (conditional on branding.showBankDetails).
 * Renders bank name, sort code, and account number.
 *
 * Data paths: branding.showBankDetails, company.bankName,
 * company.bankSortCode, company.bankAccountNumber
 */
export declare const BANK_DETAILS_PARTIAL =
  '\n{{#if branding.showBankDetails}}\n<div class="bank-details">\n  <div class="section-title">Bank Details</div>\n  <table>\n    {{#if company.bankName}}\n    <tr><td>Bank</td><td>{{company.bankName}}</td></tr>\n    {{/if}}\n    {{#if company.bankSortCode}}\n    <tr><td>Sort Code</td><td>{{company.bankSortCode}}</td></tr>\n    {{/if}}\n    {{#if company.bankAccountNumber}}\n    <tr><td>Account No.</td><td>{{company.bankAccountNumber}}</td></tr>\n    {{/if}}\n  </table>\n</div>\n{{/if}}';
/**
 * Page footer partial.
 * Rendered in the main HTML body (not Puppeteer's footerTemplate).
 * Company name and a "Generated by Nexa ERP" note.
 *
 * Data paths: company.name
 */
export declare const PAGE_FOOTER_PARTIAL =
  '\n<div class="page-footer">\n  {{company.name}} &mdash; Generated by Nexa ERP\n  <div class="page-numbers">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>\n</div>';
//# sourceMappingURL=template-helpers.d.ts.map
