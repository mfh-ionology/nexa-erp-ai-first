// ---------------------------------------------------------------------------
// Shared CSS Styles — E12-3 Task 1.2
// Base stylesheet for all default document templates. Injected via
// TemplateCompilerService.compile(html, data, css) as a separate <style> block.
// ---------------------------------------------------------------------------

/**
 * Shared CSS base for all 14 default document templates.
 *
 * Design goals (AC #7):
 * - Clean, professional typography (system fonts: Arial, Helvetica, sans-serif)
 * - Consistent table styling with bordered rows and alternating backgrounds
 * - A4 page layout (210mm × 297mm) with 20mm top/bottom, 15mm left/right margins
 * - Print-friendly rules: page-break-inside: avoid on key sections
 * - Inline CSS only (no external resources) for Puppeteer compatibility
 */
export const SHARED_CSS = `
/* ── Page Size & Margins (A4) ────────────────────────────────────────── */
@page {
  size: A4;
  margin: 20mm 15mm;
}

/* ── Base Reset & Typography ──────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
  background: #fff;
}

/* ── Page Layout (A4 content area) ────────────────────────────────────── */
.page {
  max-width: 210mm;
  margin: 0 auto;
  padding: 0;
}

/* ── Document Title ───────────────────────────────────────────────────── */
.document-title {
  font-size: 20px;
  font-weight: 700;
  text-transform: uppercase;
  color: #333;
  margin-bottom: 4px;
}

.document-subtitle {
  font-size: 11px;
  color: #666;
  margin-bottom: 16px;
}

/* ── Header Section ───────────────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #333;
}

.header-left {
  flex: 1;
}

.header-right {
  text-align: right;
  flex: 1;
}

.company-name {
  font-size: 18px;
  font-weight: 700;
  color: #333;
  margin-bottom: 2px;
}

.company-legal-name {
  font-size: 10px;
  color: #666;
  margin-bottom: 6px;
}

.company-details {
  font-size: 10px;
  color: #555;
  line-height: 1.5;
}

.company-details p {
  margin: 0;
}

/* ── Logo Section ─────────────────────────────────────────────────────── */
.logo-section {
  margin-bottom: 8px;
}

.logo-section img {
  max-height: 60px;
  max-width: 200px;
}

.logo-top-left .logo-section {
  text-align: left;
}

.logo-top-center .logo-section {
  text-align: center;
}

.logo-top-right .logo-section {
  text-align: right;
}

/* ── Address Blocks ───────────────────────────────────────────────────── */
.address-block {
  margin-bottom: 16px;
}

.address-block .label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 4px;
}

.address-block .name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.address-block .address {
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-line;
}

/* ── Document Details Grid ────────────────────────────────────────────── */
.document-details {
  margin-bottom: 16px;
}

.document-details table {
  border-collapse: collapse;
}

.document-details th {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  text-align: left;
  padding: 2px 12px 2px 0;
}

.document-details td {
  font-size: 11px;
  padding: 2px 12px 2px 0;
}

/* ── Line Items Table ─────────────────────────────────────────────────── */
.line-items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.line-items-table thead th {
  background: #f0f0f0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #555;
  padding: 8px 6px;
  border-bottom: 2px solid #ccc;
  text-align: left;
}

.line-items-table thead th.text-right {
  text-align: right;
}

.line-items-table thead th.text-center {
  text-align: center;
}

.line-items-table tbody td {
  padding: 6px;
  border-bottom: 1px solid #e5e5e5;
  font-size: 11px;
  vertical-align: top;
}

.line-items-table tbody td.text-right {
  text-align: right;
}

.line-items-table tbody td.text-center {
  text-align: center;
}

.line-items-table tbody tr:nth-child(even) {
  background: #f9f9f9;
}

.line-item-row {
  page-break-inside: avoid;
}

/* ── VAT Breakdown Table ──────────────────────────────────────────────── */
.vat-breakdown {
  margin-bottom: 12px;
}

.vat-breakdown table {
  width: auto;
  min-width: 300px;
  margin-left: auto;
  border-collapse: collapse;
}

.vat-breakdown th {
  background: #f0f0f0;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: #555;
  padding: 6px 10px;
  border-bottom: 1px solid #ccc;
  text-align: right;
}

.vat-breakdown th:first-child {
  text-align: left;
}

.vat-breakdown td {
  padding: 4px 10px;
  font-size: 11px;
  text-align: right;
  border-bottom: 1px solid #e5e5e5;
}

.vat-breakdown td:first-child {
  text-align: left;
}

/* ── Totals Section ───────────────────────────────────────────────────── */
.totals-section {
  margin-left: auto;
  width: 280px;
  margin-bottom: 20px;
  page-break-inside: avoid;
}

.totals-section table {
  width: 100%;
  border-collapse: collapse;
}

.totals-section td {
  padding: 4px 0;
  font-size: 11px;
}

.totals-section td:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.totals-section .total-row {
  font-weight: 700;
  font-size: 13px;
  border-top: 2px solid #333;
  padding-top: 6px;
}

.totals-section .amount-due-row {
  font-weight: 700;
  font-size: 14px;
  border-top: 2px solid #333;
  padding-top: 8px;
  color: #111;
}

/* ── Bank Details Section ─────────────────────────────────────────────── */
.bank-details {
  margin-bottom: 16px;
  padding: 10px 12px;
  background: #f9f9f9;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  page-break-inside: avoid;
}

.bank-details .section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 6px;
}

.bank-details table {
  border-collapse: collapse;
}

.bank-details td {
  padding: 2px 12px 2px 0;
  font-size: 11px;
}

.bank-details td:first-child {
  font-weight: 600;
  color: #555;
  width: 120px;
}

/* ── VAT / Company Reg Display ────────────────────────────────────────── */
.vat-number,
.company-reg {
  font-size: 10px;
  color: #555;
}

/* ── Notes Section ────────────────────────────────────────────────────── */
.notes-section {
  margin-bottom: 16px;
  padding: 10px 12px;
  background: #fafafa;
  border-left: 3px solid #ddd;
  font-size: 11px;
  line-height: 1.5;
}

.notes-section .section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 4px;
}

/* ── Terms & Conditions ───────────────────────────────────────────────── */
.terms-section {
  margin-bottom: 16px;
  font-size: 10px;
  color: #666;
  line-height: 1.5;
}

.terms-section .section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 4px;
}

/* ── Signature Area ───────────────────────────────────────────────────── */
.signature-area {
  margin-top: 30px;
  margin-bottom: 16px;
  page-break-inside: avoid;
}

.signature-line {
  display: flex;
  align-items: flex-end;
  margin-bottom: 12px;
}

.signature-line .label {
  font-size: 10px;
  font-weight: 600;
  color: #555;
  width: 120px;
}

.signature-line .line {
  flex: 1;
  border-bottom: 1px solid #999;
  min-width: 200px;
  height: 24px;
}

/* ── Notice / Disclaimer Boxes ────────────────────────────────────────── */
.notice {
  margin-bottom: 16px;
  padding: 8px 12px;
  border: 1px solid #e0c050;
  background: #fefce8;
  font-size: 10px;
  font-weight: 600;
  color: #92400e;
  text-align: center;
}

.notice-info {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #1e40af;
}

/* ── Summary Block (for payslips, statements) ─────────────────────────── */
.summary-block {
  margin-bottom: 16px;
  padding: 12px;
  border: 2px solid #333;
  border-radius: 4px;
  page-break-inside: avoid;
}

.summary-block .summary-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
}

.summary-block .summary-value {
  font-size: 18px;
  font-weight: 700;
  color: #111;
}

/* ── Aging Bands (for statements) ─────────────────────────────────────── */
.aging-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.aging-table th {
  background: #f0f0f0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #555;
  padding: 6px 10px;
  border-bottom: 2px solid #ccc;
  text-align: right;
}

.aging-table th:first-child {
  text-align: left;
}

.aging-table td {
  padding: 6px 10px;
  font-size: 11px;
  text-align: right;
  border-bottom: 1px solid #e5e5e5;
}

.aging-table td:first-child {
  text-align: left;
  font-weight: 600;
}

/* ── Footer ───────────────────────────────────────────────────────────── */
.page-footer {
  font-size: 9px;
  color: #666;
  text-align: center;
  border-top: 1px solid #ddd;
  padding-top: 8px;
  margin-top: 20px;
}

/* ── Utility Classes ──────────────────────────────────────────────────── */
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.text-sm { font-size: 10px; }
.text-xs { font-size: 9px; }
.text-muted { color: #666; }
.mt-4 { margin-top: 16px; }
.mb-4 { margin-bottom: 16px; }
.mb-2 { margin-bottom: 8px; }
`;
