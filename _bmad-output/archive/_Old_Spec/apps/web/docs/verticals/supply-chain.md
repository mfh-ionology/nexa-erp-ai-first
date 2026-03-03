# Supply Chain / Logistics Vertical Scenario

## Tenant
- **Code**: `DEMO_SUPPLY_CHAIN` (from demo-tenants.ts) or `NEXA_SUPPLYCHAIN_DEMO` (from demo-data.ts)
- **Name**: Global Logistics Co / Nexa Supply Chain Demo
- **Vertical**: Supply Chain / Logistics
- **Roles**: ADMIN (`admin@global-logistics.demo` or `admin+supply_chain@nexa.demo`), STAFF (`staff+supply_chain1@nexa.demo`)

## Scenario: Purchase Order → Receipt → Inventory → Fulfilment → Shipment

### Step 1: Create Purchase Order (ADMIN)
**Module**: Purchasing
**Role**: ADMIN
**Actions**:
1. Navigate to Purchasing → Purchase Orders
2. Create new PO for supplier "Raw Materials Co" (SUPP-0001)
3. Add item "RM-STEEL-001" with quantity 100, unit price £50.00
4. Add item "RM-PLASTIC-001" with quantity 200, unit price £25.00
5. Set delivery date to 7 days from today
6. Approve PO (status: "Approved")
7. Post message in #purchasing channel: "PO [PO-ID] approved for Raw Materials Co - £10,000 total"

**Expected State**:
- PO created with status "Approved"
- PO number assigned (e.g., PO-001)
- PO total: £10,000.00
- Commitment recorded in purchasing system

### Step 2: Receive Goods (STAFF)
**Module**: Inventory / Receiving
**Role**: STAFF
**Actions**:
1. Navigate to Inventory → Receiving
2. Find PO-001
3. Create GRN (Goods Received Note)
4. Receive items: RM-STEEL-001 (100 units), RM-PLASTIC-001 (200 units)
5. Verify quantities match PO
6. Post GRN (status: "Posted")
7. Post message in #inventory channel: "GRN [GRN-ID] posted - received 100 units RM-STEEL-001, 200 units RM-PLASTIC-001"

**Expected State**:
- GRN created and posted
- Inventory on-hand increased for RM-STEEL-001 and RM-PLASTIC-001
- PO status updated to "Partially Received" or "Received"
- Inventory valuation updated

### Step 3: Create Replenishment Suggestion (System)
**Module**: Supply Chain / Replenishment
**Role**: ADMIN (to review)
**Actions**:
1. Navigate to Supply Chain → Replenishment
2. Review automatic replenishment suggestions
3. Verify suggestions are based on stock levels and demand
4. Post message in #supply channel: "Reviewing replenishment suggestions for next week"

**Expected State**:
- Replenishment suggestions generated
- Suggestions consider current stock levels
- Suggestions consider lead times

### Step 4: Create Sales Order and Fulfil (ADMIN → STAFF)
**Module**: Sales / Fulfilment
**Role**: ADMIN (create), STAFF (fulfil)
**Actions**:
1. ADMIN: Create sales order for customer "Tech Solutions Ltd" (CUST-0002)
2. ADMIN: Add finished goods item "FG-PUMP-001" with quantity 10
3. ADMIN: Confirm order
4. STAFF: Navigate to Fulfilment → Pick Tasks
5. STAFF: Create picking wave for order
6. STAFF: Assign picking tasks
7. STAFF: Complete picking (pick FG-PUMP-001: 10 units)
8. STAFF: Create packing slip
9. STAFF: Create shipment
10. Post message in #fulfilment channel: "Order [SO-ID] picked and packed, ready for shipment"

**Expected State**:
- Sales order created and confirmed
- Picking wave created
- Picking tasks assigned and completed
- Packing slip created
- Shipment created
- Inventory reduced for FG-PUMP-001

### Step 5: Ship Order (STAFF)
**Module**: Logistics / Shipping
**Role**: STAFF
**Actions**:
1. Navigate to Logistics → Shipments
2. Find shipment from Step 4
3. Assign carrier: "Royal Mail"
4. Add tracking number: "RM123456789"
5. Mark shipment as "Shipped"
6. Post message in #logistics channel: "Shipment [SHIP-ID] dispatched via Royal Mail, tracking: RM123456789"

**Expected State**:
- Shipment status: "Shipped"
- Tracking number recorded
- Carrier information recorded
- Order status updated to "Shipped"

### Step 6: Generate Reports and AI Queries (ADMIN)
**Module**: Supply Chain / Reporting
**Role**: ADMIN
**Actions**:
1. Navigate to Supply Chain → Dashboard
2. Review stock-out risks
3. Review replenishment suggestions
4. Use AI bar to query: "What are the stock-out risks?"
5. Use AI bar to query: "Show me replenishment suggestions"
6. Navigate to Inventory → Reports → Stock Levels
7. Verify inventory levels reflect receipts and shipments

**Expected State**:
- Stock-out risks displayed (if any)
- Replenishment suggestions displayed
- AI responses reflect supply chain data
- Inventory reports show correct stock levels
- No cross-tenant data visible

## Chat Integration Points
- **#purchasing**: PO creation and approval
- **#inventory**: GRN posting, stock movements
- **#supply**: Replenishment suggestions
- **#fulfilment**: Picking and packing
- **#logistics**: Shipment dispatch

## Calls Integration Points
- **#purchasing**: Audio call to supplier to confirm PO
- **#fulfilment**: Audio call to coordinate picking priorities

## AI Integration Points
- After Step 3: "What are the stock-out risks?"
- After Step 3: "Show me replenishment suggestions"
- After Step 6: "Summarise recent shipments in #logistics"

## Expected End State
- PO created and goods received
- Inventory levels updated
- Sales order fulfilled and shipped
- All transactions reflected in supply chain reports
- Chat messages posted in relevant channels
- AI queries return accurate tenant-scoped data

