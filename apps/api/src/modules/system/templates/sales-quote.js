// ---------------------------------------------------------------------------
// Sales Quote Default Template — E12-3 Task 3.3
// Full HTML document for SALES_QUOTE document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------
import { COMPANY_HEADER_PARTIAL, COUNTERPARTY_BLOCK_PARTIAL, LINE_ITEMS_TABLE_PARTIAL, VAT_BREAKDOWN_PARTIAL, TOTALS_SECTION_PARTIAL, PAGE_FOOTER_PARTIAL, } from './template-helpers.js';
export const SALES_QUOTE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation {{document.number}}</title>
  <style>
    /* Quote-specific overrides */
    .quote-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .quote-details .left {
      flex: 1;
    }
    .quote-details .right {
      flex: 0 0 auto;
    }
    .validity-notice {
      margin-bottom: 16px;
      padding: 8px 12px;
      border: 1px solid #93c5fd;
      background: #eff6ff;
      font-size: 11px;
      color: #1e40af;
      text-align: center;
      font-weight: 600;
    }
    .disclaimer {
      margin-bottom: 16px;
      padding: 8px 12px;
      border: 1px solid #e0c050;
      background: #fefce8;
      font-size: 10px;
      font-weight: 600;
      color: #92400e;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Quotation</div>

    <div class="quote-details">
      <div class="left">
        ${COUNTERPARTY_BLOCK_PARTIAL}
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Quote No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.dueDate}}
            <tr><th>Valid Until</th><td>{{formatDate document.dueDate}}</td></tr>
            {{/if}}
            {{#if document.reference}}
            <tr><th>Reference</th><td>{{document.reference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    ${LINE_ITEMS_TABLE_PARTIAL}

    ${VAT_BREAKDOWN_PARTIAL}

    ${TOTALS_SECTION_PARTIAL}

    {{#if document.dueDate}}
    <div class="validity-notice">
      This quotation is valid until {{formatDate document.dueDate}}.
    </div>
    {{/if}}

    <div class="disclaimer">
      This quotation is not a binding contract. Prices and availability are subject to confirmation at the time of order.
    </div>

    {{#if metadata.paymentTerms}}
    <div class="terms-section">
      <div class="section-title">Payment Terms</div>
      {{metadata.paymentTerms}}
    </div>
    {{/if}}

    {{#if document.notes}}
    <div class="notes-section">
      <div class="section-title">Notes</div>
      {{document.notes}}
    </div>
    {{/if}}

    <div class="terms-section">
      <div class="section-title">Terms &amp; Conditions</div>
      All quotations are subject to our standard terms and conditions of sale.
      Quoted prices are exclusive of delivery unless otherwise stated.
      {{company.name}} reserves the right to amend prices if the order is not placed within the validity period.
    </div>

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
//# sourceMappingURL=sales-quote.js.map