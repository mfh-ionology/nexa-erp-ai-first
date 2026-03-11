// ---------------------------------------------------------------------------
// Delivery Note Default Template — E12-3 Task 3.4
// Full HTML document for DELIVERY_NOTE document type.
// Line items show quantities only — NO pricing columns.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import { COMPANY_HEADER_PARTIAL, PAGE_FOOTER_PARTIAL } from './template-helpers.js';

export const DELIVERY_NOTE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Delivery Note {{document.number}}</title>
  <style>
    /* Delivery note-specific overrides */
    .delivery-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .delivery-details .left {
      flex: 1;
    }
    .delivery-details .right {
      flex: 0 0 auto;
    }
    .addresses {
      display: flex;
      gap: 30px;
      margin-bottom: 20px;
    }
    .addresses .address-block {
      flex: 1;
    }
    .delivery-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .delivery-items-table thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .delivery-items-table thead th.text-right {
      text-align: right;
    }
    .delivery-items-table thead th.text-center {
      text-align: center;
    }
    .delivery-items-table tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
      vertical-align: top;
    }
    .delivery-items-table tbody td.text-right {
      text-align: right;
    }
    .delivery-items-table tbody td.text-center {
      text-align: center;
    }
    .delivery-items-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .special-instructions {
      margin-bottom: 16px;
      padding: 10px 12px;
      background: #fafafa;
      border-left: 3px solid #ddd;
      font-size: 11px;
      line-height: 1.5;
    }
    .special-instructions .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 4px;
    }
    .received-section {
      margin-top: 30px;
      padding: 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .received-section .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 12px;
    }
    .received-section .confirmation {
      font-size: 11px;
      color: #555;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Delivery Note</div>

    <div class="delivery-details">
      <div class="left">
        <div class="document-details">
          <table>
            <tr><th>Delivery Note No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.reference}}
            <tr><th>Order Reference</th><td>{{document.reference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <div class="label">Customer</div>
        <div class="name">{{counterparty.name}}</div>
        <div class="address">{{counterparty.address}}</div>
      </div>
      <div class="address-block">
        <div class="label">Deliver To</div>
        <div class="name">{{#if metadata.deliveryName}}{{metadata.deliveryName}}{{else}}{{counterparty.name}}{{/if}}</div>
        <div class="address">{{#if metadata.deliveryAddress}}{{metadata.deliveryAddress}}{{else}}{{counterparty.address}}{{/if}}</div>
      </div>
    </div>

    <table class="delivery-items-table">
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th style="width:100px">Item Code</th>
          <th>Description</th>
          <th class="text-right" style="width:80px">Quantity</th>
        </tr>
      </thead>
      <tbody>
        {{#each lines}}
        <tr class="line-item-row">
          <td>{{this.lineNumber}}</td>
          <td>{{this.itemCode}}</td>
          <td>{{this.description}}</td>
          <td class="text-right">{{formatNumber this.quantity 0}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    {{#if document.notes}}
    <div class="special-instructions">
      <div class="section-title">Special Instructions</div>
      {{document.notes}}
    </div>
    {{/if}}

    <div class="received-section">
      <div class="section-title">Goods Received Confirmation</div>
      <div class="confirmation">
        I confirm that the goods listed above have been received in good condition.
      </div>
      <div class="signature-area">
        <div class="signature-line">
          <div class="label">Received by:</div>
          <div class="line"></div>
        </div>
        <div class="signature-line">
          <div class="label">Print name:</div>
          <div class="line"></div>
        </div>
        <div class="signature-line">
          <div class="label">Date:</div>
          <div class="line"></div>
        </div>
      </div>
    </div>

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
