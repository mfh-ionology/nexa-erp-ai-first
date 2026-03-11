// ---------------------------------------------------------------------------
// Payslip Default Template — E12-3 Task 5.1
// Full HTML document for PAYSLIP document type.
// Uses Handlebars syntax matching DocumentDataContext paths.
// Earnings shown as positive line items, deductions as negative (displayed
// as positive amounts in the deductions table).
// ---------------------------------------------------------------------------
import { COMPANY_HEADER_PARTIAL, PAGE_FOOTER_PARTIAL, } from './template-helpers.js';
export const PAYSLIP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payslip {{document.number}}</title>
  <style>
    /* Payslip-specific overrides */
    .payslip-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .payslip-header .left {
      flex: 1;
    }
    .payslip-header .right {
      flex: 0 0 auto;
    }
    .employee-details {
      margin-bottom: 16px;
      padding: 10px 12px;
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .employee-details .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 6px;
    }
    .employee-details table {
      width: 100%;
      border-collapse: collapse;
    }
    .employee-details td {
      padding: 3px 12px 3px 0;
      font-size: 11px;
      vertical-align: top;
    }
    .employee-details td:nth-child(odd) {
      font-weight: 600;
      color: #555;
      width: 130px;
    }
    .payslip-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .payslip-table thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .payslip-table thead th.text-right {
      text-align: right;
    }
    .payslip-table tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
      vertical-align: top;
    }
    .payslip-table tbody td.text-right {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .payslip-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .net-pay-box {
      margin: 0 auto 20px;
      width: 100%;
      max-width: 400px;
      border: 2px solid #333;
      border-radius: 4px;
      padding: 16px;
      text-align: center;
      page-break-inside: avoid;
    }
    .net-pay-box .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 4px;
    }
    .net-pay-box .amount {
      font-size: 22px;
      font-weight: 700;
      color: #111;
    }
    .ytd-section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .ytd-section .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 6px;
    }
    .ytd-table {
      width: 100%;
      max-width: 400px;
      border-collapse: collapse;
    }
    .ytd-table td {
      padding: 4px 8px;
      font-size: 11px;
      border-bottom: 1px solid #e5e5e5;
    }
    .ytd-table td:first-child {
      font-weight: 600;
      color: #555;
    }
    .ytd-table td:last-child {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .payslip-summary {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .payslip-summary .summary-col {
      flex: 1;
    }
    .payslip-summary .summary-col table {
      width: 100%;
      border-collapse: collapse;
    }
    .payslip-summary .summary-col td {
      padding: 4px 0;
      font-size: 11px;
    }
    .payslip-summary .summary-col td:last-child {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .payslip-summary .summary-col .total-row td {
      font-weight: 700;
      border-top: 2px solid #333;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">Payslip</div>

    <div class="payslip-header">
      <div class="left">
        <div class="address-block">
          <div class="label">Employee</div>
          <div class="name">{{counterparty.name}}</div>
          <div class="address">{{counterparty.address}}</div>
        </div>
      </div>
      <div class="right">
        <div class="document-details">
          <table>
            <tr><th>Payslip Ref.</th><td>{{document.number}}</td></tr>
            <tr><th>Pay Date</th><td>{{formatDate document.date}}</td></tr>
            {{#if document.reference}}
            <tr><th>Pay Period</th><td>{{document.reference}}</td></tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <div class="employee-details">
      <div class="section-title">Employee &amp; Tax Details</div>
      <table>
        <tr>
          <td>Employee</td>
          <td>{{counterparty.name}}</td>
          <td>Contact</td>
          <td>{{counterparty.contactEmail}}</td>
        </tr>
      </table>
      {{#if document.notes}}
      <table>
        <tr>
          <td>Tax Details</td>
          <td colspan="3">{{document.notes}}</td>
        </tr>
      </table>
      {{/if}}
    </div>

    <div class="employee-details">
      <div class="section-title">Employer Details</div>
      <table>
        <tr>
          <td>Employer</td>
          <td>{{company.name}}</td>
          {{#if company.companyNumber}}
          <td>PAYE Ref.</td>
          <td>{{company.companyNumber}}</td>
          {{/if}}
        </tr>
      </table>
    </div>

    <div class="payslip-summary">
      <div class="summary-col">
        <div class="section-title" style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:6px;">Earnings</div>
        <table class="payslip-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#each lines}}
            {{#if (gt this.lineTotal 0)}}
            <tr>
              <td>{{this.description}}</td>
              <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
            </tr>
            {{/if}}
            {{/each}}
            <tr class="line-item-row">
              <td style="font-weight:700;border-top:2px solid #333;padding-top:6px;">Gross Pay</td>
              <td class="text-right" style="font-weight:700;border-top:2px solid #333;padding-top:6px;">{{formatCurrency totals.subtotal metadata.currencyCode}}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="summary-col">
        <div class="section-title" style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:6px;">Deductions</div>
        <table class="payslip-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {{#each lines}}
            {{#if (lt this.lineTotal 0)}}
            <tr>
              <td>{{this.description}}</td>
              <td class="text-right">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
            </tr>
            {{/if}}
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>

    <div class="net-pay-box">
      <div class="label">Net Pay</div>
      <div class="amount">{{formatCurrency totals.total metadata.currencyCode}}</div>
    </div>

    <div class="ytd-section">
      <div class="section-title">Year to Date</div>
      <table class="ytd-table">
        <tr>
          <td>Gross Pay YTD</td>
          <td>{{formatCurrency metadata.grossPayYtd metadata.currencyCode}}</td>
        </tr>
        <tr>
          <td>Tax Paid YTD</td>
          <td>{{formatCurrency metadata.taxPaidYtd metadata.currencyCode}}</td>
        </tr>
        <tr>
          <td>NI Paid YTD</td>
          <td>{{formatCurrency metadata.niPaidYtd metadata.currencyCode}}</td>
        </tr>
        <tr>
          <td>Pension YTD</td>
          <td>{{formatCurrency metadata.pensionYtd metadata.currencyCode}}</td>
        </tr>
      </table>
    </div>

    <div class="notice notice-info">
      This payslip is produced for information purposes. Please retain for your records.
    </div>

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
//# sourceMappingURL=payslip.js.map