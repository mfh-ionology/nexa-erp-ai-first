// ---------------------------------------------------------------------------
// Customer Statement Default Template — E12-3 Task 3.1
// Full HTML document for CUSTOMER_STATEMENT document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import {
  COMPANY_HEADER_PARTIAL,
  BANK_DETAILS_PARTIAL,
  PAGE_FOOTER_PARTIAL,
} from './template-helpers.js';

export const CUSTOMER_STATEMENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Customer Statement {{document.number}}</title>
  <style>
    /* Statement-specific overrides */
    .statement-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .statement-details .left {
      flex: 1;
    }
    .statement-details .right {
      flex: 0 0 auto;
    }
    .statement-period {
      margin-bottom: 16px;
      padding: 8px 12px;
      background: #f0f0f0;
      border-radius: 4px;
      font-size: 11px;
      color: #555;
      text-align: center;
    }
    .transaction-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .transaction-table thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .transaction-table thead th.text-right {
      text-align: right;
    }
    .transaction-table tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
      vertical-align: top;
    }
    .transaction-table tbody td.text-right {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .transaction-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .transaction-table .opening-balance td,
    .transaction-table .closing-balance td {
      font-weight: 700;
      border-top: 2px solid #333;
      padding-top: 8px;
    }
    .transaction-table .closing-balance td {
      font-size: 12px;
      color: #111;
    }
    .overdue-notice {
      margin-bottom: 16px;
      padding: 10px 12px;
      border: 1px solid #e0c050;
      background: #fefce8;
      font-size: 11px;
      font-weight: 600;
      color: #92400e;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Customer Statement</div>

    <div class="statement-period">
      Statement period: {{formatDate document.date}} to {{formatDate document.dueDate}}
    </div>

    <div class="statement-details">
      <div class="left">
        <div class="address-block">
          <div class="label">To</div>
          <div class="name">{{counterparty.name}}</div>
          <div class="address">{{counterparty.address}}</div>
        </div>
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Statement No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if metadata.paymentTerms}}
            <tr><th>Payment Terms</th><td>{{metadata.paymentTerms}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <table class="transaction-table">
      <thead>
        <tr>
          <th style="width:80px">Date</th>
          <th style="width:90px">Reference</th>
          <th style="width:80px">Type</th>
          <th>Description</th>
          <th class="text-right" style="width:100px">Debit</th>
          <th class="text-right" style="width:100px">Credit</th>
          <th class="text-right" style="width:100px">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr class="opening-balance">
          <td></td>
          <td></td>
          <td></td>
          <td>Opening Balance</td>
          <td class="text-right"></td>
          <td class="text-right"></td>
          <td class="text-right">{{formatCurrency totals.subtotal metadata.currencyCode}}</td>
        </tr>
        {{#each lines}}
        <tr class="line-item-row">
          <td>{{formatDate this.date}}</td>
          <td>{{this.itemCode}}</td>
          <td>{{this.transactionType}}</td>
          <td>{{this.description}}</td>
          {{#if (gt this.lineTotal 0)}}
          <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
          <td class="text-right">&mdash;</td>
          {{else}}
          <td class="text-right">&mdash;</td>
          <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
          {{/if}}
          <td class="text-right">{{formatCurrency this.runningBalance ../metadata.currencyCode}}</td>
        </tr>
        {{/each}}
        <tr class="closing-balance">
          <td colspan="4">Closing Balance</td>
          <td class="text-right"></td>
          <td class="text-right"></td>
          <td class="text-right">{{formatCurrency totals.amountDue metadata.currencyCode}}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-block">
      <table class="aging-table">
        <thead>
          <tr>
            <th>Aging</th>
            <th>Current</th>
            <th>30 Days</th>
            <th>60 Days</th>
            <th>90+ Days</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Amount</td>
            <td>{{formatCurrency metadata.agingCurrent metadata.currencyCode}}</td>
            <td>{{formatCurrency metadata.aging30 metadata.currencyCode}}</td>
            <td>{{formatCurrency metadata.aging60 metadata.currencyCode}}</td>
            <td>{{formatCurrency metadata.aging90Plus metadata.currencyCode}}</td>
            <td>{{formatCurrency totals.amountDue metadata.currencyCode}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="overdue-notice">
      Please remit payment for any overdue amounts at your earliest convenience.
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
