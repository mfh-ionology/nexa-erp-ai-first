// ---------------------------------------------------------------------------
// Proforma Invoice Default Template — E12-3 Task 2.4
// Full HTML document for PROFORMA_INVOICE document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------
import { COMPANY_HEADER_PARTIAL, COUNTERPARTY_BLOCK_PARTIAL, LINE_ITEMS_TABLE_PARTIAL, VAT_BREAKDOWN_PARTIAL, TOTALS_SECTION_PARTIAL, PAGE_FOOTER_PARTIAL, } from './template-helpers.js';
export const PROFORMA_INVOICE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Proforma Invoice {{document.number}}</title>
  <style>
    /* Proforma-specific overrides */
    .proforma-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .proforma-details .left {
      flex: 1;
    }
    .proforma-details .right {
      flex: 0 0 auto;
    }
    .proforma-notice {
      margin-bottom: 16px;
      padding: 10px 12px;
      border: 2px solid #e0c050;
      background: #fefce8;
      font-size: 11px;
      font-weight: 700;
      color: #92400e;
      text-align: center;
      text-transform: uppercase;
    }
    .validity-notice {
      margin-bottom: 16px;
      font-size: 11px;
      color: #555;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Proforma Invoice</div>

    <div class="proforma-notice">
      This is not a VAT invoice &mdash; for quotation purposes only
    </div>

    <div class="proforma-details">
      <div class="left">
        ${COUNTERPARTY_BLOCK_PARTIAL}
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Proforma No.</th><td>{{document.number}}</td></tr>
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
      This proforma invoice is valid until {{formatDate document.dueDate}}.
    </div>
    {{/if}}

    {{#if document.notes}}
    <div class="notes-section">
      <div class="section-title">Notes</div>
      {{document.notes}}
    </div>
    {{/if}}

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
//# sourceMappingURL=proforma-invoice.js.map