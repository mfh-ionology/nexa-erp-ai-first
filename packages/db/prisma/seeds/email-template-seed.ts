import type { PrismaClient } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Professional HTML email template layout shared by all document types
// ---------------------------------------------------------------------------

function wrapHtml(heading: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { margin:0; padding:0; font-family:Arial,Helvetica,sans-serif; background:#f7f7f7; color:#333; }
  .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#7c3aed; color:#ffffff; padding:24px 32px; }
  .header h1 { margin:0; font-size:18px; font-weight:600; }
  .content { padding:32px; line-height:1.6; }
  .content h2 { color:#7c3aed; font-size:16px; margin-top:0; }
  table.items { width:100%; border-collapse:collapse; margin:16px 0; }
  table.items th { background:#f4f2ff; text-align:left; padding:8px 12px; font-size:13px; border-bottom:2px solid #e0dce8; }
  table.items td { padding:8px 12px; font-size:13px; border-bottom:1px solid #eee; }
  .total-row { text-align:right; font-size:16px; font-weight:700; padding:16px 0; }
  .footer { background:#f4f2ff; padding:20px 32px; font-size:12px; color:#666; }
  .footer a { color:#7c3aed; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>{{companyName}}</h1></div>
  <div class="content">
    <h2>${heading}</h2>
    ${bodyContent}
  </div>
  <div class="footer">
    <p>{{companyName}}{{#if companyAddress}} &middot; {{companyAddress}}{{/if}}</p>
    <p>{{#if companyPhone}}Phone: {{companyPhone}} &middot; {{/if}}{{#if companyEmail}}Email: {{companyEmail}}{{/if}}</p>
  </div>
</div>
</body>
</html>`;
}

function lineItemsTable(): string {
  return `<table class="items">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
      <tbody>
        {{#each lineItems}}<tr><td>{{this.description}}</td><td>{{this.quantity}}</td><td>{{formatCurrency this.unitPrice ../currency}}</td><td>{{formatCurrency this.amount ../currency}}</td></tr>{{/each}}
      </tbody>
    </table>
    <div class="total-row">Total: {{formatCurrency totalAmount currency}}</div>`;
}

// ---------------------------------------------------------------------------
// 7 Default templates per Architecture §2.29
// ---------------------------------------------------------------------------

export interface TemplateData {
  code: string;
  name: string;
  description: string;
  documentType: string;
  subjectTemplate: string;
  bodyHtml: string;
  bodyText: string;
}

export const templates: TemplateData[] = [
  {
    code: 'INVOICE_SEND',
    name: 'Invoice Send',
    description: 'Default template for sending customer invoices',
    documentType: 'CustomerInvoice',
    subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
    bodyHtml: wrapHtml(
      'Invoice {{invoiceNumber}}',
      `<p>Dear {{customerName}},</p>
    <p>Please find attached invoice <strong>{{invoiceNumber}}</strong> dated {{formatDate issueDate}} for the amount of {{formatCurrency totalAmount currency}}.</p>
    <p>Payment is due by <strong>{{formatDate dueDate}}</strong>.</p>
    ${lineItemsTable()}
    <p>If you have any questions regarding this invoice, please do not hesitate to contact us.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{customerName}},

Please find attached invoice {{invoiceNumber}} dated {{formatDate issueDate}} for {{formatCurrency totalAmount currency}}.

Payment is due by {{formatDate dueDate}}.

{{#each lineItems}}
- {{this.description}}: Qty {{this.quantity}} x {{this.unitPrice}} = {{this.amount}}
{{/each}}

Total: {{formatCurrency totalAmount currency}}

Kind regards,
{{companyName}}`,
  },
  {
    code: 'STATEMENT_SEND',
    name: 'Statement Send',
    description: 'Default template for sending customer account statements',
    documentType: 'CustomerStatement',
    subjectTemplate: 'Account Statement from {{companyName}}',
    bodyHtml: wrapHtml(
      'Account Statement',
      `<p>Dear {{customerName}},</p>
    <p>Please find attached your account statement as at {{formatDate statementDate}}.</p>
    <table class="items">
      <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        {{#each transactions}}<tr><td>{{formatDate this.date}}</td><td>{{this.reference}}</td><td>{{this.description}}</td><td>{{this.amount}}</td></tr>{{/each}}
      </tbody>
    </table>
    <p><strong>Opening Balance:</strong> {{formatCurrency openingBalance currency}}<br/>
    <strong>Closing Balance:</strong> {{formatCurrency closingBalance currency}}</p>
    <p>If you have any queries, please contact us.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{customerName}},

Please find attached your account statement as at {{formatDate statementDate}}.

Opening Balance: {{formatCurrency openingBalance currency}}

{{#each transactions}}
- {{formatDate this.date}} | {{this.reference}} | {{this.description}} | {{this.amount}}
{{/each}}

Closing Balance: {{formatCurrency closingBalance currency}}

Kind regards,
{{companyName}}`,
  },
  {
    code: 'QUOTE_SEND',
    name: 'Quotation Send',
    description: 'Default template for sending sales quotations',
    documentType: 'SalesQuote',
    subjectTemplate: 'Quotation {{quoteNumber}} from {{companyName}}',
    bodyHtml: wrapHtml(
      'Quotation {{quoteNumber}}',
      `<p>Dear {{customerName}},</p>
    <p>Thank you for your enquiry. Please find below our quotation <strong>{{quoteNumber}}</strong>.</p>
    <p>This quotation is valid until <strong>{{formatDate validUntil}}</strong>.</p>
    ${lineItemsTable()}
    <p>We look forward to your response. Please do not hesitate to contact us if you have any questions.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{customerName}},

Thank you for your enquiry. Please find below our quotation {{quoteNumber}}.

This quotation is valid until {{formatDate validUntil}}.

{{#each lineItems}}
- {{this.description}}: Qty {{this.quantity}} x {{this.unitPrice}} = {{this.amount}}
{{/each}}

Total: {{formatCurrency totalAmount currency}}

Kind regards,
{{companyName}}`,
  },
  {
    code: 'ORDER_CONFIRM',
    name: 'Order Confirmation',
    description: 'Default template for sending sales order confirmations',
    documentType: 'SalesOrder',
    subjectTemplate: 'Order Confirmation {{orderNumber}} from {{companyName}}',
    bodyHtml: wrapHtml(
      'Order Confirmation {{orderNumber}}',
      `<p>Dear {{customerName}},</p>
    <p>Thank you for your order. This email confirms your order <strong>{{orderNumber}}</strong>.</p>
    <p>Expected delivery: <strong>{{formatDate expectedDeliveryDate}}</strong>.</p>
    ${lineItemsTable()}
    <p>We will notify you when your order has been dispatched.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{customerName}},

Thank you for your order. This email confirms order {{orderNumber}}.

Expected delivery: {{formatDate expectedDeliveryDate}}.

{{#each lineItems}}
- {{this.description}}: Qty {{this.quantity}} x {{this.unitPrice}} = {{this.amount}}
{{/each}}

Total: {{formatCurrency totalAmount currency}}

Kind regards,
{{companyName}}`,
  },
  {
    code: 'PO_SEND',
    name: 'Purchase Order Send',
    description: 'Default template for sending purchase orders to suppliers',
    documentType: 'PurchaseOrder',
    subjectTemplate: 'Purchase Order {{poNumber}} from {{companyName}}',
    bodyHtml: wrapHtml(
      'Purchase Order {{poNumber}}',
      `<p>Dear {{supplierName}},</p>
    <p>Please find attached purchase order <strong>{{poNumber}}</strong> from {{companyName}}.</p>
    <p>Requested delivery date: <strong>{{formatDate expectedDeliveryDate}}</strong>.</p>
    ${lineItemsTable()}
    <p>Please confirm receipt and expected delivery schedule.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{supplierName}},

Please find attached purchase order {{poNumber}} from {{companyName}}.

Requested delivery date: {{formatDate expectedDeliveryDate}}.

{{#each lineItems}}
- {{this.description}}: Qty {{this.quantity}} x {{this.unitPrice}} = {{this.amount}}
{{/each}}

Total: {{formatCurrency totalAmount currency}}

Please confirm receipt and expected delivery schedule.

Kind regards,
{{companyName}}`,
  },
  {
    code: 'CREDIT_NOTE_SEND',
    name: 'Credit Note Send',
    description: 'Default template for sending credit notes',
    documentType: 'CreditNote',
    subjectTemplate: 'Credit Note {{creditNoteNumber}} from {{companyName}}',
    bodyHtml: wrapHtml(
      'Credit Note {{creditNoteNumber}}',
      `<p>Dear {{customerName}},</p>
    <p>Please find attached credit note <strong>{{creditNoteNumber}}</strong> for {{formatCurrency totalAmount currency}}.</p>
    {{#if originalInvoiceNumber}}<p>This credit note relates to invoice <strong>{{originalInvoiceNumber}}</strong>.</p>{{/if}}
    {{#if reason}}<p><strong>Reason:</strong> {{reason}}</p>{{/if}}
    <p>This amount has been credited to your account.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{customerName}},

Please find attached credit note {{creditNoteNumber}} for {{formatCurrency totalAmount currency}}.

{{#if originalInvoiceNumber}}This credit note relates to invoice {{originalInvoiceNumber}}.{{/if}}
{{#if reason}}Reason: {{reason}}{{/if}}

This amount has been credited to your account.

Kind regards,
{{companyName}}`,
  },
  {
    code: 'PAYSLIP_SEND',
    name: 'Payslip Send',
    description: 'Default template for sending employee payslips',
    documentType: 'Payslip',
    subjectTemplate: 'Your Payslip for {{payPeriod}} — {{companyName}}',
    bodyHtml: wrapHtml(
      'Payslip — {{payPeriod}}',
      `<p>Dear {{employeeName}},</p>
    <p>Please find attached your payslip for the period <strong>{{payPeriod}}</strong>.</p>
    <table class="items">
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Gross Pay</td><td>{{formatCurrency grossPay currency}}</td></tr>
        {{#each deductions}}<tr><td>{{this.description}}</td><td>-{{formatCurrency this.amount ../currency}}</td></tr>{{/each}}
      </tbody>
    </table>
    <div class="total-row">Net Pay: {{formatCurrency netPay currency}}</div>
    <p>If you have any questions regarding your payslip, please contact HR.</p>
    <p>Kind regards,<br/>{{companyName}}</p>`,
    ),
    bodyText: `Dear {{employeeName}},

Please find attached your payslip for the period {{payPeriod}}.

Gross Pay: {{formatCurrency grossPay currency}}

{{#each deductions}}
- {{this.description}}: -{{this.amount}}
{{/each}}

Net Pay: {{formatCurrency netPay currency}}

If you have any questions, please contact HR.

Kind regards,
{{companyName}}`,
  },
];

// ---------------------------------------------------------------------------
// Seed function — idempotent via upsert on unique `code`
// ---------------------------------------------------------------------------

export async function seedEmailTemplates(prisma: PrismaClient, userId: string): Promise<void> {
  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        documentType: t.documentType,
        subjectTemplate: t.subjectTemplate,
        bodyHtmlTemplate: t.bodyHtml,
        bodyTextTemplate: t.bodyText,
        languageCode: 'en',
        attachPdf: true,
        autoSend: false,
        isActive: true,
        updatedBy: userId,
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        documentType: t.documentType,
        subjectTemplate: t.subjectTemplate,
        bodyHtmlTemplate: t.bodyHtml,
        bodyTextTemplate: t.bodyText,
        languageCode: 'en',
        attachPdf: true,
        autoSend: false,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  console.log(`Seeded ${templates.length} default email templates`);
}
