// ---------------------------------------------------------------------------
// Cash Receipt Default Template — E12-3 Task 2.3
// Compact receipt format for CASH_RECEIPT document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import { COMPANY_HEADER_PARTIAL, PAGE_FOOTER_PARTIAL } from './template-helpers.js';

export const CASH_RECEIPT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt {{document.number}}</title>
  <style>
    /* Receipt-specific overrides — compact format */
    .receipt-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .receipt-details .left {
      flex: 1;
    }
    .receipt-details .right {
      flex: 0 0 auto;
    }
    .receipt-customer {
      margin-bottom: 16px;
    }
    .receipt-customer .label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 4px;
    }
    .receipt-customer .name {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .payment-summary {
      margin: 0 auto 20px;
      width: 100%;
      max-width: 400px;
      border: 2px solid #333;
      border-radius: 4px;
      padding: 16px;
      page-break-inside: avoid;
    }
    .payment-summary table {
      width: 100%;
      border-collapse: collapse;
    }
    .payment-summary td {
      padding: 6px 0;
      font-size: 12px;
    }
    .payment-summary td:first-child {
      font-weight: 600;
      color: #555;
      width: 140px;
    }
    .payment-summary .amount-row td {
      font-size: 16px;
      font-weight: 700;
      border-top: 2px solid #333;
      padding-top: 10px;
      color: #111;
    }
    .invoices-paid {
      margin-bottom: 16px;
    }
    .invoices-paid .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 6px;
    }
    .invoices-paid table {
      width: 100%;
      border-collapse: collapse;
    }
    .invoices-paid thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .invoices-paid thead th.text-right {
      text-align: right;
    }
    .invoices-paid tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
    }
    .invoices-paid tbody td.text-right {
      text-align: right;
    }
    .thank-you {
      margin: 20px 0 16px;
      padding: 12px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 4px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: #166534;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Receipt</div>

    <div class="receipt-details">
      <div class="left">
        <div class="receipt-customer">
          <div class="label">Received From</div>
          <div class="name">{{counterparty.name}}</div>
        </div>
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Receipt No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.reference}}
            <tr><th>Reference</th><td>{{document.reference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <div class="payment-summary">
      <table>
        <tr>
          <td>Payment Date</td>
          <td>{{formatDate document.date}}</td>
        </tr>
        {{#if document.reference}}
        <tr>
          <td>Payment Reference</td>
          <td>{{document.reference}}</td>
        </tr>
        {{/if}}
        <tr class="amount-row">
          <td>Amount Received</td>
          <td>{{formatCurrency totals.total metadata.currencyCode}}</td>
        </tr>
      </table>
    </div>

    {{#if lines}}
    <div class="invoices-paid">
      <div class="section-title">Invoices Paid</div>
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Description</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#each lines}}
          <tr>
            <td>{{this.itemCode}}</td>
            <td>{{this.description}}</td>
            <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
    {{/if}}

    <div class="thank-you">
      Thank you for your payment.
    </div>

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
