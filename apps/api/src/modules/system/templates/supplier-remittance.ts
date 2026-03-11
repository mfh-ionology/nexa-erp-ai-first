// ---------------------------------------------------------------------------
// Supplier Remittance Default Template — E12-3 Task 4.3
// Full HTML document for SUPPLIER_REMITTANCE document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import {
  COMPANY_HEADER_PARTIAL,
  BANK_DETAILS_PARTIAL,
  PAGE_FOOTER_PARTIAL,
} from './template-helpers.js';

export const SUPPLIER_REMITTANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Remittance Advice {{document.number}}</title>
  <style>
    /* Remittance-specific overrides */
    .remittance-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .remittance-details .left {
      flex: 1;
    }
    .remittance-details .right {
      flex: 0 0 auto;
    }
    .allocations-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .allocations-table thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .allocations-table thead th.text-right {
      text-align: right;
    }
    .allocations-table tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
      vertical-align: top;
    }
    .allocations-table tbody td.text-right {
      text-align: right;
    }
    .allocations-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .total-paid {
      margin-left: auto;
      width: 280px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .total-paid table {
      width: 100%;
      border-collapse: collapse;
    }
    .total-paid td {
      padding: 4px 0;
      font-size: 11px;
    }
    .total-paid td:last-child {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .total-paid .total-row {
      font-weight: 700;
      font-size: 14px;
      border-top: 2px solid #333;
      padding-top: 8px;
      color: #111;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Remittance Advice</div>

    <div class="remittance-details">
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
            <tr><th>Remittance No.</th><td>{{document.number}}</td></tr>
            <tr><th>Payment Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.reference}}
            <tr><th>Payment Ref.</th><td>{{document.reference}}</td></tr>
            {{/if}}
            {{#if metadata.paymentMethod}}
            <tr><th>Payment Method</th><td>{{metadata.paymentMethod}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <table class="allocations-table">
      <thead>
        <tr>
          <th style="width:120px">Invoice No.</th>
          <th style="width:100px">Invoice Date</th>
          <th>Description</th>
          <th class="text-right" style="width:110px">Invoice Amount</th>
          <th class="text-right" style="width:110px">Amount Paid</th>
        </tr>
      </thead>
      <tbody>
        {{#each lines}}
        <tr class="line-item-row">
          <td>{{this.itemCode}}</td>
          <td>{{formatDate this.date}}</td>
          <td>{{this.description}}</td>
          <td class="text-right">{{formatCurrency this.unitPrice ../metadata.currencyCode}}</td>
          <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="total-paid">
      <table>
        <tr class="total-row">
          <td>Total Paid</td>
          <td>{{formatCurrency totals.total metadata.currencyCode}}</td>
        </tr>
      </table>
    </div>

    ${BANK_DETAILS_PARTIAL}

    <div class="notice notice-info">
      If you have any queries regarding this payment, please contact our accounts
      department at {{#if company.email}}{{company.email}}{{else}}the details shown above{{/if}}.
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
