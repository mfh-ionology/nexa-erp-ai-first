// ---------------------------------------------------------------------------
// P45 Default Template — E12-3 Task 5.2
// HMRC P45 format approximation for P45 document type.
// "Details of employee leaving work" — Part 1A (Employee's copy).
// Uses stub data context since full payroll models don't exist yet.
// ---------------------------------------------------------------------------

import { COMPANY_HEADER_PARTIAL, PAGE_FOOTER_PARTIAL } from './template-helpers.js';

export const P45_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>P45 {{document.number}}</title>
  <style>
    /* P45-specific overrides — HMRC-style formal layout */
    .p45-subtitle {
      font-size: 12px;
      color: #555;
      margin-bottom: 16px;
    }
    .p45-section {
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .p45-section .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e5e5;
    }
    .p45-section table {
      width: 100%;
      border-collapse: collapse;
    }
    .p45-section td {
      padding: 4px 12px 4px 0;
      font-size: 11px;
      vertical-align: top;
    }
    .p45-section td:nth-child(odd) {
      font-weight: 600;
      color: #555;
      width: 180px;
    }
    .p45-figures {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .p45-figures table {
      width: 100%;
      max-width: 500px;
      border-collapse: collapse;
    }
    .p45-figures thead th {
      background: #f0f0f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      padding: 8px 6px;
      border-bottom: 2px solid #ccc;
      text-align: left;
    }
    .p45-figures thead th.text-right {
      text-align: right;
    }
    .p45-figures tbody td {
      padding: 6px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 11px;
    }
    .p45-figures tbody td.text-right {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .p45-figures tbody td.figure {
      font-weight: 700;
      font-size: 13px;
    }
    .p45-important {
      margin: 16px 0;
      padding: 10px 14px;
      border: 2px solid #b91c1c;
      background: #fef2f2;
      color: #991b1b;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      border-radius: 4px;
    }
    .p45-part-label {
      display: inline-block;
      background: #333;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 2px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="page">

    ${COMPANY_HEADER_PARTIAL}

    <div class="document-title">P45</div>
    <div class="p45-subtitle">Details of employee leaving work</div>

    <div class="p45-part-label">Part 1A — Employee's Copy</div>

    <div class="p45-section">
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

    <div class="p45-section">
      <div class="section-title">Leaving Details</div>
      <table>
        <tr>
          <td>P45 Reference</td>
          <td>{{document.number}}</td>
        </tr>
        <tr>
          <td>Leaving Date</td>
          <td>{{formatDate document.date}}</td>
        </tr>
        {{#if document.reference}}
        <tr>
          <td>Details</td>
          <td>{{document.reference}}</td>
        </tr>
        {{/if}}
      </table>
    </div>

    <div class="p45-section">
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

    <div class="p45-figures">
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

    <div class="p45-important">
      IMPORTANT — Please give Parts 2 and 3 to your new employer.<br/>
      If you do not have a new employer, keep this form safe. You may need it to claim benefits or for your tax return.
    </div>

    <div class="notice notice-info">
      This document is an approximation of the HMRC P45 format produced by the payroll system for information purposes.
    </div>

    ${PAGE_FOOTER_PARTIAL}

  </div>
</body>
</html>`;
