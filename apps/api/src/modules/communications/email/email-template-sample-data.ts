// ---------------------------------------------------------------------------
// Email Template Sample Data — E10-2 Task 4
// Realistic sample data for each document type, used for template preview.
// ---------------------------------------------------------------------------

const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  CustomerInvoice: {
    invoiceNumber: 'INV-00042',
    customerName: 'Acme Ltd',
    customerEmail: 'accounts@acme.co.uk',
    totalAmount: '1,250.00',
    currency: 'GBP',
    dueDate: '2026-04-15',
    issueDate: '2026-03-15',
    lineItems: [
      {
        description: 'Professional Services',
        quantity: 10,
        unitPrice: '100.00',
        amount: '1,000.00',
      },
      { description: 'Expenses', quantity: 1, unitPrice: '250.00', amount: '250.00' },
    ],
    companyName: 'Sample Company Ltd',
    companyEmail: 'info@samplecompany.co.uk',
    companyPhone: '+44 20 7123 4567',
    companyAddress: '123 Business Street, London, EC1A 1BB',
  },
  CustomerStatement: {
    customerName: 'Acme Ltd',
    customerEmail: 'accounts@acme.co.uk',
    statementDate: '2026-03-01',
    openingBalance: '3,500.00',
    closingBalance: '5,200.00',
    currency: 'GBP',
    transactions: [
      {
        date: '2026-02-10',
        reference: 'INV-00038',
        description: 'Invoice',
        amount: '1,200.00',
        balance: '4,700.00',
      },
      {
        date: '2026-02-20',
        reference: 'PMT-00015',
        description: 'Payment received',
        amount: '-500.00',
        balance: '4,200.00',
      },
      {
        date: '2026-03-01',
        reference: 'INV-00042',
        description: 'Invoice',
        amount: '1,000.00',
        balance: '5,200.00',
      },
    ],
    companyName: 'Sample Company Ltd',
    companyEmail: 'info@samplecompany.co.uk',
  },
  SalesQuote: {
    quoteNumber: 'QUO-00018',
    customerName: 'Acme Ltd',
    customerEmail: 'purchasing@acme.co.uk',
    totalAmount: '2,750.00',
    currency: 'GBP',
    validUntil: '2026-04-15',
    lineItems: [
      { description: 'Consulting — Phase 1', quantity: 5, unitPrice: '350.00', amount: '1,750.00' },
      { description: 'Software Licence', quantity: 1, unitPrice: '1,000.00', amount: '1,000.00' },
    ],
    companyName: 'Sample Company Ltd',
    companyEmail: 'info@samplecompany.co.uk',
  },
  SalesOrder: {
    orderNumber: 'SO-00027',
    customerName: 'Acme Ltd',
    customerEmail: 'orders@acme.co.uk',
    totalAmount: '4,500.00',
    currency: 'GBP',
    expectedDeliveryDate: '2026-04-01',
    lineItems: [
      { description: 'Widget A', quantity: 100, unitPrice: '25.00', amount: '2,500.00' },
      { description: 'Widget B', quantity: 50, unitPrice: '40.00', amount: '2,000.00' },
    ],
    companyName: 'Sample Company Ltd',
    companyEmail: 'info@samplecompany.co.uk',
  },
  PurchaseOrder: {
    poNumber: 'PO-00012',
    supplierName: 'Global Supplies Ltd',
    supplierEmail: 'sales@globalsupplies.co.uk',
    totalAmount: '8,200.00',
    currency: 'GBP',
    expectedDeliveryDate: '2026-03-25',
    lineItems: [
      { description: 'Raw Material X', quantity: 200, unitPrice: '30.00', amount: '6,000.00' },
      { description: 'Packaging', quantity: 500, unitPrice: '4.40', amount: '2,200.00' },
    ],
    companyName: 'Sample Company Ltd',
    companyEmail: 'info@samplecompany.co.uk',
  },
  CreditNote: {
    creditNoteNumber: 'CN-00005',
    customerName: 'Acme Ltd',
    customerEmail: 'accounts@acme.co.uk',
    totalAmount: '250.00',
    currency: 'GBP',
    reason: 'Damaged goods returned',
    originalInvoiceNumber: 'INV-00038',
    companyName: 'Sample Company Ltd',
    companyEmail: 'info@samplecompany.co.uk',
  },
  Payslip: {
    employeeName: 'Jane Smith',
    employeeEmail: 'jane.smith@samplecompany.co.uk',
    payPeriod: 'March 2026',
    grossPay: '3,500.00',
    netPay: '2,650.00',
    currency: 'GBP',
    deductions: [
      { description: 'Income Tax', amount: '550.00' },
      { description: 'National Insurance', amount: '250.00' },
      { description: 'Pension', amount: '50.00' },
    ],
    companyName: 'Sample Company Ltd',
  },
};

/**
 * Returns realistic sample data for a given document type (for template preview).
 */
export function getSampleData(documentType: string): Record<string, unknown> {
  return SAMPLE_DATA[documentType] ?? {};
}
