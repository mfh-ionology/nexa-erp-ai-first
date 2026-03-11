// ---------------------------------------------------------------------------
// Credit Note Default Template — E12-3 Task 2.2
// Full HTML document for CREDIT_NOTE document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import {
  COMPANY_HEADER_PARTIAL,
  COUNTERPARTY_BLOCK_PARTIAL,
  LINE_ITEMS_TABLE_PARTIAL,
  VAT_BREAKDOWN_PARTIAL,
  BANK_DETAILS_PARTIAL,
  PAGE_FOOTER_PARTIAL,
} from './template-helpers.js';

export const CREDIT_NOTE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Credit Note {{document.number}}</title>
  <style>
    /* Credit note-specific overrides */
    .credit-note-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .credit-note-details .left {
      flex: 1;
    }
    .credit-note-details .right {
      flex: 0 0 auto;
    }
    .credit-total {
      margin-left: auto;
      width: 280px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .credit-total table {
      width: 100%;
      border-collapse: collapse;
    }
    .credit-total td {
      padding: 4px 0;
      font-size: 11px;
    }
    .credit-total td:last-child {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .credit-total .total-row td {
      font-weight: 700;
      font-size: 13px;
      border-top: 2px solid #333;
      padding-top: 6px;
    }
    .credit-applied {
      margin-bottom: 16px;
      padding: 8px 12px;
      border: 1px solid #93c5fd;
      background: #eff6ff;
      font-size: 11px;
      color: #1e40af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Credit Note</div>

    <div class="credit-note-details">
      <div class="left">
        ${COUNTERPARTY_BLOCK_PARTIAL}
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Credit Note No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.reference}}
            <tr><th>Original Invoice</th><td>{{document.reference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    ${LINE_ITEMS_TABLE_PARTIAL}

    ${VAT_BREAKDOWN_PARTIAL}

    <div class="credit-total">
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
          <td>Total Credit</td>
          <td>{{formatCurrency totals.total metadata.currencyCode}}</td>
        </tr>
      </table>
    </div>

    <div class="credit-applied">
      This credit note has been applied to your account.
    </div>

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
