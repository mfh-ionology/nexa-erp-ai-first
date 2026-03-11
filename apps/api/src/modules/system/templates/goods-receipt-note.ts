// ---------------------------------------------------------------------------
// Goods Receipt Note Default Template — E12-3 Task 4.2
// Full HTML document for GOODS_RECEIPT_NOTE document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import { COMPANY_HEADER_PARTIAL, PAGE_FOOTER_PARTIAL } from './template-helpers.js';

export const GOODS_RECEIPT_NOTE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Goods Received Note {{document.number}}</title>
  <style>
    /* GRN-specific overrides */
    .grn-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .grn-details .left {
      flex: 1;
    }
    .grn-details .right {
      flex: 0 0 auto;
    }
    .grn-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .grn-items-table thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .grn-items-table thead th.text-right {
      text-align: right;
    }
    .grn-items-table thead th.text-center {
      text-align: center;
    }
    .grn-items-table tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
      vertical-align: top;
    }
    .grn-items-table tbody td.text-right {
      text-align: right;
    }
    .grn-items-table tbody td.text-center {
      text-align: center;
    }
    .grn-items-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .variance-positive {
      color: #b91c1c;
      font-weight: 600;
    }
    .variance-zero {
      color: #15803d;
    }
    .inspection-notes {
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      min-height: 60px;
    }
    .inspection-notes .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
    }
    .condition-notes {
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      min-height: 60px;
    }
    .condition-notes .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Goods Received Note</div>

    <div class="grn-details">
      <div class="left">
        <div class="address-block">
          <div class="label">Supplier</div>
          <div class="name">{{counterparty.name}}</div>
          <div class="address">{{counterparty.address}}</div>
        </div>
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>GRN No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.reference}}
            <tr><th>PO Reference</th><td>{{document.reference}}</td></tr>
            {{/if}}
            {{#if metadata.supplierReference}}
            <tr><th>Supplier Del. Note</th><td>{{metadata.supplierReference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <table class="grn-items-table">
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th style="width:100px">Item Code</th>
          <th>Description</th>
          <th class="text-right" style="width:80px">Ordered</th>
          <th class="text-right" style="width:80px">Received</th>
          <th class="text-right" style="width:80px">Variance</th>
        </tr>
      </thead>
      <tbody>
        {{#each lines}}
        <tr class="line-item-row">
          <td>{{this.lineNumber}}</td>
          <td>{{this.itemCode}}</td>
          <td>{{this.description}}</td>
          <td class="text-right">{{formatNumber this.quantity 0}}</td>
          <td class="text-right">{{formatNumber this.receivedQty 0}}</td>
          <td class="text-right">{{formatNumber this.variance 0}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="inspection-notes">
      <div class="section-title">Inspection Notes</div>
      {{#if document.notes}}
      {{document.notes}}
      {{/if}}
    </div>

    <div class="condition-notes">
      <div class="section-title">Damage / Discrepancy Notes</div>
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

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
