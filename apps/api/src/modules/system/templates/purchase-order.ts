// ---------------------------------------------------------------------------
// Purchase Order Default Template — E12-3 Task 4.1
// Full HTML document for PURCHASE_ORDER document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// ---------------------------------------------------------------------------

import {
  COMPANY_HEADER_PARTIAL,
  COUNTERPARTY_BLOCK_PARTIAL,
  LINE_ITEMS_TABLE_PARTIAL,
  VAT_BREAKDOWN_PARTIAL,
  TOTALS_SECTION_PARTIAL,
  PAGE_FOOTER_PARTIAL,
} from './template-helpers.js';

export const PURCHASE_ORDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Purchase Order {{document.number}}</title>
  <style>
    /* Purchase order-specific overrides */
    .po-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .po-details .left {
      flex: 1;
    }
    .po-details .right {
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

    <div class="document-title">Purchase Order</div>

    <div class="po-details">
      <div class="left">
        ${COUNTERPARTY_BLOCK_PARTIAL}
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>PO No.</th><td>{{document.number}}</td></tr>
            <tr><th>Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.dueDate}}
            <tr><th>Required By</th><td>{{formatDate document.dueDate}}</td></tr>
            {{/if}}
            {{#if document.reference}}
            <tr><th>Reference</th><td>{{document.reference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    {{#if metadata.deliveryAddress}}
    <div class="delivery-address">
      <div class="label">Deliver To</div>
      <div class="address">{{metadata.deliveryAddress}}</div>
    </div>
    {{/if}}

    ${LINE_ITEMS_TABLE_PARTIAL}

    ${VAT_BREAKDOWN_PARTIAL}

    ${TOTALS_SECTION_PARTIAL}

    {{#if metadata.paymentTerms}}
    <div class="terms-section">
      <div class="section-title">Payment Terms</div>
      {{metadata.paymentTerms}}
    </div>
    {{/if}}

    {{#if document.notes}}
    <div class="notes-section">
      <div class="section-title">Delivery Instructions</div>
      {{document.notes}}
    </div>
    {{/if}}

    <div class="terms-section">
      <div class="section-title">Terms &amp; Conditions</div>
      This purchase order is subject to our standard terms and conditions.
      Goods must be delivered to the address specified above by the required date.
      Any variation to this order must be confirmed in writing. Please quote our
      PO number on all correspondence and invoices.
    </div>

    <div class="signature-area">
      <div class="signature-line">
        <div class="label">Authorised by:</div>
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
