// ---------------------------------------------------------------------------
// Sales Invoice Default Template — E12-3 Task 2.1
// Full HTML document for SALES_INVOICE document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------
import { COMPANY_HEADER_PARTIAL, COUNTERPARTY_BLOCK_PARTIAL, LINE_ITEMS_TABLE_PARTIAL, VAT_BREAKDOWN_PARTIAL, TOTALS_SECTION_PARTIAL, BANK_DETAILS_PARTIAL, PAGE_FOOTER_PARTIAL, } from './template-helpers.js';
export const SALES_INVOICE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice {{document.number}}</title>
  <style>
    /* Invoice-specific overrides */
    .invoice-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .invoice-details .left {
      flex: 1;
    }
    .invoice-details .right {
      flex: 0 0 auto;
    }
    .payment-terms {
      margin-bottom: 16px;
      font-size: 11px;
    }
    .payment-terms strong {
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Invoice</div>

    <div class="invoice-details">
      <div class="left">
        ${COUNTERPARTY_BLOCK_PARTIAL}
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Invoice No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.dueDate}}
            <tr><th>Due Date</th><td>{{formatDate document.dueDate}}</td></tr>
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

    {{#if metadata.paymentTerms}}
    <div class="payment-terms">
      <strong>Payment Terms:</strong> {{metadata.paymentTerms}}
    </div>
    {{/if}}

    ${BANK_DETAILS_PARTIAL}

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
//# sourceMappingURL=sales-invoice.js.map