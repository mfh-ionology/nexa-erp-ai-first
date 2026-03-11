// ---------------------------------------------------------------------------
// Sales Order Default Template — E12-3 Task 3.2
// Full HTML document for SALES_ORDER document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------
import { COMPANY_HEADER_PARTIAL, COUNTERPARTY_BLOCK_PARTIAL, LINE_ITEMS_TABLE_PARTIAL, VAT_BREAKDOWN_PARTIAL, TOTALS_SECTION_PARTIAL, BANK_DETAILS_PARTIAL, PAGE_FOOTER_PARTIAL, } from './template-helpers.js';
export const SALES_ORDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Sales Order {{document.number}}</title>
  <style>
    /* Sales order-specific overrides */
    .order-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .order-details .left {
      flex: 1;
    }
    .order-details .right {
      flex: 0 0 auto;
    }
    .delivery-address {
      margin-bottom: 16px;
    }
    .delivery-address .label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 4px;
    }
    .delivery-address .address {
      font-size: 11px;
      line-height: 1.5;
      white-space: pre-line;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Sales Order</div>

    <div class="order-details">
      <div class="left">
        ${COUNTERPARTY_BLOCK_PARTIAL}
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Order No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.dueDate}}
            <tr><th>Delivery Date</th><td>{{formatDate document.dueDate}}</td></tr>
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
    <div class="terms-section">
      <div class="section-title">Payment Terms</div>
      {{metadata.paymentTerms}}
    </div>
    {{/if}}

    ${BANK_DETAILS_PARTIAL}

    {{#if document.notes}}
    <div class="notes-section">
      <div class="section-title">Notes</div>
      {{document.notes}}
    </div>
    {{/if}}

    <div class="terms-section">
      <div class="section-title">Terms &amp; Conditions</div>
      All goods remain the property of {{company.name}} until paid for in full.
      Delivery dates are estimates and not guaranteed. Please inspect goods upon receipt
      and report any discrepancies within 48 hours.
    </div>

    <div class="signature-area">
      <div class="signature-line">
        <div class="label">Authorised by:</div>
        <div class="line"></div>
      </div>
      <div class="signature-line">
        <div class="label">Date:</div>
        <div class="line"></div>
      </div>
    </div>

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
//# sourceMappingURL=sales-order.js.map