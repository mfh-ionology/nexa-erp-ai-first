# Core SME / General Business Vertical Scenario

## Tenant
- **Code**: `NEXA_DEMO`
- **Name**: Nexa Demo Manufacturing
- **Vertical**: Manufacturing / General Business
- **Roles**: ADMIN (`admin@nexa.test`), STAFF (`staff@nexa.test`)

## Scenario: Quote → Order → Fulfilment → Invoice → Payment → Reporting

### Step 1: Create Sales Quote (ADMIN)
**Module**: Sales/CRM
**Role**: ADMIN
**Actions**:
1. Navigate to Sales → Quotes
2. Create new quote for customer "Acme Corp" (CUST-0001)
3. Add item "SKU-0001" with quantity 10, unit price £25.00
4. Add item "SKU-0002" with quantity 5, unit price £15.00
5. Set quote expiry date to 30 days from today
6. Save quote as "Draft"
7. Post message in #sales channel: "New quote created for Acme Corp - £325 total"

**Expected State**:
- Quote appears in quotes list with status "Draft"
- Quote total: £325.00 (before VAT)
- Quote number assigned (e.g., QUOTE-001)

### Step 2: Convert Quote to Order (ADMIN)
**Module**: Sales/Orders
**Role**: ADMIN
**Actions**:
1. Open the quote created in Step 1
2. Click "Convert to Order"
3. Review order details
4. Confirm order (status changes to "Confirmed")
5. Post message in #sales channel: "Order [ORDER-ID] confirmed for Acme Corp"

**Expected State**:
- Order created with status "Confirmed"
- Order number assigned (e.g., SO-001)
- Order lines match quote lines
- Original quote status updated to "Converted"

### Step 3: Fulfil Order (STAFF)
**Module**: Inventory / Fulfilment
**Role**: STAFF
**Actions**:
1. Navigate to Orders → Fulfilment
2. Find the order from Step 2
3. Create picking list
4. Mark items as picked (SKU-0001: 10 units, SKU-0002: 5 units)
5. Create shipment/packing slip
6. Mark order as "Fulfilled"
7. Post message in #inventory channel: "Order [ORDER-ID] fulfilled and ready for dispatch"

**Expected State**:
- Order status: "Fulfilled"
- Inventory on-hand reduced for SKU-0001 and SKU-0002
- Picking list created
- Shipment record created

### Step 4: Create Invoice (ADMIN)
**Module**: Finance / Accounts Receivable
**Role**: ADMIN
**Actions**:
1. Navigate to Finance → Invoices
2. Create invoice from fulfilled order (SO-001)
3. Review invoice details (should match order)
4. Post invoice (status: "Posted")
5. Post message in #finance channel: "Invoice [INV-ID] posted for Acme Corp - £390.00 (including VAT)"

**Expected State**:
- Invoice created with status "Posted"
- Invoice number assigned (e.g., INV-001)
- Invoice total: £390.00 (including 20% VAT)
- Invoice linked to order SO-001
- GL entries created (AR debit, Sales Revenue credit, VAT credit)

### Step 5: Record Payment (ADMIN)
**Module**: Finance / Payments
**Role**: ADMIN
**Actions**:
1. Navigate to Finance → Payments
2. Create payment for invoice INV-001
3. Payment method: Bank Transfer
4. Amount: £390.00
5. Payment date: Today
6. Allocate payment to invoice INV-001
7. Post message in #finance channel: "Payment received for invoice [INV-ID]"

**Expected State**:
- Payment recorded
- Invoice status: "Paid"
- Payment allocated to invoice
- GL entries updated (Cash debit, AR credit)
- Outstanding receivables reduced

### Step 6: Generate Report (ADMIN)
**Module**: Finance / Reporting
**Role**: ADMIN
**Actions**:
1. Navigate to Finance → Reports → Aged Receivables
2. Verify invoice INV-001 appears in current period (0-30 days)
3. Navigate to Sales → Reports → Sales Summary
4. Verify order SO-001 appears in sales report
5. Use AI bar to query: "What open orders exist for Acme Corp?"
6. Use AI bar to query: "What is the total outstanding receivables?"

**Expected State**:
- Invoice INV-001 appears in aged receivables report (current period, £0 outstanding)
- Order SO-001 appears in sales summary
- AI responses reflect the transaction data
- No cross-tenant data visible

## Chat Integration Points
- **#sales**: Quote creation, order confirmation
- **#inventory**: Order fulfilment, stock movements
- **#finance**: Invoice posting, payment recording

## Calls Integration Points
- **#sales**: Audio call to discuss quote terms with customer
- **#inventory**: Audio call to coordinate fulfilment

## AI Integration Points
- After Step 2: "What open orders exist for Acme Corp?"
- After Step 4: "What is the total outstanding receivables?"
- After Step 5: "Summarise recent payments in #finance"

## Expected End State
- Quote created and converted
- Order fulfilled
- Invoice posted and paid
- All transactions reflected in reports
- Chat messages posted in relevant channels
- AI queries return accurate tenant-scoped data

