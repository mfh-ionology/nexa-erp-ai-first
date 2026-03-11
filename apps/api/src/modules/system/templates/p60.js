// ---------------------------------------------------------------------------
// P60 Default Template — E12-3 Task 5.3
// HMRC P60 format approximation for P60 document type.
// "End of Year Certificate" — shows total pay, tax, and NI for the tax year.
// Uses stub data context since full payroll models don't exist yet.
// ---------------------------------------------------------------------------
import { COMPANY_HEADER_PARTIAL, PAGE_FOOTER_PARTIAL, } from './template-helpers.js';
export const P60_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>P60 {{document.number}}</title>
  <style>
    /* P60-specific overrides — HMRC-style formal layout */
    .p60-subtitle {
      font-size: 12px;
      color: #555;
      margin-bottom: 4px;
    }
    .p60-tax-year {
      font-size: 14px;
      font-weight: 700;
      color: #333;
      margin-bottom: 16px;
    }
    .p60-section {
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .p60-section .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e5e5;
    }
    .p60-section table {
      width: 100%;
      border-collapse: collapse;
    }
    .p60-section td {
      padding: 4px 12px 4px 0;
      font-size: 11px;
      vertical-align: top;
    }
    .p60-section td:nth-child(odd) {
      font-weight: 600;
      color: #555;
      width: 180px;
    }
    .p60-figures {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .p60-figures .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
    }
    .p60-figures table {
      width: 100%;
      max-width: 500px;
      border-collapse: collapse;
    }
    .p60-figures thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .p60-figures thead th.text-right {
      text-align: right;
    }
    .p60-figures tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
    }
    .p60-figures tbody td.text-right {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .p60-figures tbody td.figure {
      font-weight: 700;
      font-size: 13px;
    }
    .p60-certificate {
      margin: 16px 0;
      padding: 12px 14px;
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.6;
      color: #333;
    }
    .p60-keep-safe {
      margin: 16px 0;
      padding: 10px 14px;
      border: 2px solid #b45309;
      background: #fffbeb;
      color: #92400e;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">P60</div>
    <div class="p60-subtitle">End of Year Certificate</div>
    {{#if document.reference}}
    <div class="p60-tax-year">{{document.reference}}</div>
    {{/if}}

    <div class="p60-section">
      <div class="section-title">Employee Details</div>
      <table>
        <tr>
          <td>Full Name</td>
          <td>{{counterparty.name}}</td>
        </tr>
        <tr>
          <td>Address</td>
          <td>{{counterparty.address}}</td>
        </tr>
        {{#if document.notes}}
        <tr>
          <td>NI Number / Tax Code</td>
          <td>{{document.notes}}</td>
        </tr>
        {{/if}}
      </table>
    </div>

    <div class="p60-section">
      <div class="section-title">Employer Details</div>
      <table>
        <tr>
          <td>Employer Name</td>
          <td>{{company.name}}</td>
        </tr>
        {{#if company.companyNumber}}
        <tr>
          <td>Employer PAYE Reference</td>
          <td>{{company.companyNumber}}</td>
        </tr>
        {{/if}}
        <tr>
          <td>Employer Address</td>
          <td>{{company.address}}</td>
        </tr>
      </table>
    </div>

    <div class="p60-figures">
      <div class="section-title">Pay and Tax Summary</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {{#each lines}}
          <tr class="line-item-row">
            <td>{{this.description}}</td>
            <td class="text-right figure">{{formatCurrency this.lineTotal ../metadata.currencyCode}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <div class="p60-figures">
      <div class="section-title">National Insurance Contributions</div>
      <table>
        <thead>
          <tr>
            <th>NI Letter</th>
            <th class="text-right">Earnings at LEL</th>
            <th class="text-right">Earnings at PT</th>
            <th class="text-right">Earnings at UEL</th>
            <th class="text-right">Employee NI</th>
            <th class="text-right">Employer NI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{metadata.niLetter}}</td>
            <td class="text-right figure">{{formatCurrency metadata.earningsLEL metadata.currencyCode}}</td>
            <td class="text-right figure">{{formatCurrency metadata.earningsPT metadata.currencyCode}}</td>
            <td class="text-right figure">{{formatCurrency metadata.earningsUEL metadata.currencyCode}}</td>
            <td class="text-right figure">{{formatCurrency metadata.employeeNI metadata.currencyCode}}</td>
            <td class="text-right figure">{{formatCurrency metadata.employerNI metadata.currencyCode}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="p60-certificate">
      This form shows your total pay for income tax purposes in this employment for the year shown above.
      You should keep it in a safe place as you may need it if you have to fill in a tax return.
      If you do not understand any entry, ask your employer.
    </div>

    <div class="p60-keep-safe">
      Please keep this certificate safe — you may need it for your tax return.
    </div>

    <div class="notice notice-info">
      This document is an approximation of the HMRC P60 format produced by the payroll system for information purposes.
      Date issued: {{formatDate document.date}}
    </div>

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
//# sourceMappingURL=p60.js.map