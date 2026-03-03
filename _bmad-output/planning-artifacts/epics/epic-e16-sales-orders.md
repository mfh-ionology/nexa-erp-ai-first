# Epic E16: Sales Orders

**Tier:** 3 — Business Modules
**Dependencies:** E14 (Finance / GL), E15 (Inventory)
**FRs:** FR33–FR40
**Module Path:** `api/src/modules/sales/`

---

## Story E16.S1: Sales Quotes

**User Story:** As a sales representative, I want to create, send, and convert sales quotes with full lifecycle tracking, so that customer proposals are formally managed and seamlessly flow into orders.

**Acceptance Criteria:**
1. GIVEN a sales rep WHEN they create a SalesQuote with customerId, quote lines (item, quantity, unit price, VAT), and validUntil date THEN the quote is persisted in DRAFT status with auto-generated quoteNumber from the NumberSeries.
2. GIVEN a DRAFT quote with at least one line WHEN the rep sends it to the customer THEN the status transitions to SENT, a `quote.sent` event is emitted, and the quote can be emailed as PDF via the communications module.
3. GIVEN a SENT quote WHEN the customer accepts THEN the status transitions to ACCEPTED and a `quote.accepted` event is emitted.
4. GIVEN an ACCEPTED quote WHEN the manager converts it to an order THEN a new SalesOrder is created in DRAFT status with all lines, pricing, and customer details copied from the quote, the quote status transitions to CONVERTED, convertedToOrderId is set, a RecordLink (CREATED_FROM) is created, and a `quote.converted` event is emitted.
5. GIVEN a SENT quote WHEN the validUntil date passes THEN a scheduled job transitions the status to EXPIRED and emits `quote.expired`.
6. GIVEN a DRAFT or SENT quote WHEN the rep cancels it THEN the status transitions to CANCELLED (not available from ACCEPTED or CONVERTED).

**Key Tasks:**
- [ ] Create Prisma models for SalesQuote and SalesQuoteLine (AC: #1)
  - [ ] SalesQuote: id, quoteNumber (unique, NumberSeries), customerId FK, status SalesQuoteStatus enum (7 values), validUntil, convertedToOrderId, subtotal, vatAmount, totalAmount, currencyCode, companyId
  - [ ] SalesQuoteLine: id, quoteId FK (cascade), lineNumber, itemId, description, quantity, unitPrice, discountPercent, lineTotal, vatCodeId, vatAmount
- [ ] Implement SalesQuote state machine: DRAFT→SENT→ACCEPTED→CONVERTED, SENT→REJECTED/EXPIRED, DRAFT/SENT→CANCELLED (AC: #2–#6)
- [ ] Implement convert-to-order service copying lines and creating RecordLink (AC: #4)
- [ ] Implement BullMQ scheduled job for quote expiry (AC: #5)
- [ ] Emit events: `quote.sent`, `quote.accepted`, `quote.converted`, `quote.expired`, `quote.cancelled` (AC: #2–#6)
- [ ] Register routes: CRUD `/sales/quotes`, GET `/:id/lines`, POST `/:id/send`, POST `/:id/accept`, POST `/:id/reject`, POST `/:id/convert-to-order`, POST `/:id/revise` (AC: #1–#6)
- [ ] Write unit tests for each state transition and convert-to-order line copy logic (AC: #2–#4)

**FR/NFR:** FR33, FR34; NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | SalesQuote/Line models, conversion to order, expiry job |
| API Contracts | §2.11, §3.5 | CRUD `/sales/quotes`, POST `/:id/send`, POST `/:id/accept`, POST `/:id/convert-to-order` (SalesOrder response schema) |
| Data Models | §3.5 | SalesQuote (quoteNumber, status 7-value enum, validUntil, convertedToOrderId), SalesQuoteLine |
| State Machines | §3.1 | SalesQuote: DRAFT→SENT→ACCEPTED→CONVERTED; SENT→REJECTED/EXPIRED; DRAFT/SENT→CANCELLED |
| Event Catalog | §4 | `quote.created`, `quote.sent`, `quote.accepted`, `quote.converted` — subscribers: CRM, Communications, Notifications |
| Business Rules | §4 | REQ-OR-001 to REQ-OR-003 (customer validation applies to quotes), BR-PRC rules apply to quote line pricing |
| UX Design Spec | §T1, §T3 | T1 for quote list, T3 for quote form with header+lines |
| Project Context | §11 | NumberSeries for auto-numbering, every state change emits event |

---

## Story E16.S2: Sales Orders

**User Story:** As a sales manager, I want to create and approve sales orders with stock availability and credit limit checks, so that orders are validated before fulfilment begins.

**Acceptance Criteria:**
1. GIVEN a sales rep WHEN they create a SalesOrder with customerId and order lines THEN the order is persisted in DRAFT status with auto-generated orderNumber.
2. GIVEN a DRAFT order WHEN the manager approves it THEN: customer is validated (exists, not blocked per REQ-OR-003), credit limit is checked (outstanding + uninvoiced orders per XM-001/BR-AR-009), stock availability is checked (ATP per XM-002), StockReservation records are created per XM-003/REQ-OR-051, planned payments are created per REQ-OR-053, a CRM activity is logged per REQ-OR-052, status transitions to APPROVED, and `order.confirmed` event is emitted.
3. GIVEN a DRAFT order with shipped lines (quantityShipped > 0) WHEN any user attempts to delete it THEN the system rejects per REQ-OR-061.
4. GIVEN an approved order WHEN dispatches are created and shipped THEN the order progresses through IN_PROGRESS→PARTIALLY_SHIPPED→FULLY_SHIPPED as line quantities are fulfilled.
5. GIVEN a fully shipped order WHEN invoices are created THEN the order progresses through PARTIALLY_INVOICED→FULLY_INVOICED→CLOSED.
6. GIVEN a DRAFT or APPROVED order with no shipments WHEN the manager cancels it THEN stock reservations are released, planned payments are deleted, and status transitions to CANCELLED.

**Key Tasks:**
- [ ] Create Prisma models for SalesOrder and SalesOrderLine (AC: #1)
  - [ ] SalesOrder: id, orderNumber, customerId FK, status SalesOrderStatus enum (9 values), quoteId (nullable), subtotal, vatAmount, totalAmount, currencyCode, companyId
  - [ ] SalesOrderLine: id, orderId FK (cascade), lineNumber, itemId, quantity, unitPrice, quantityShipped, quantityInvoiced, lineStatus SalesOrderLineStatus enum (4 values)
- [ ] Implement approval service with customer validation, credit check (XM-001), stock check (XM-002), stock reservation (XM-003) (AC: #2)
- [ ] Implement deletion guard for shipped orders (AC: #3)
- [ ] Implement order status progression from line fulfilment quantities (AC: #4, #5)
- [ ] Implement cancellation with reservation release and planned payment cleanup (AC: #6)
- [ ] Emit events: `order.confirmed`, `order.cancelled`, `order.fully_shipped`, `order.fully_invoiced`, `order.closed` (AC: #2–#6)
- [ ] Register routes: CRUD `/sales/orders`, GET `/:id/lines`, POST `/:id/approve`, POST `/:id/close`, POST `/:id/cancel`, GET `/:id/stock-check`, POST `/:id/reserve-stock` (AC: #1–#6)
- [ ] Write unit tests for approval validation chain, status progression, and cancellation cleanup (AC: #2, #4, #6)

**FR/NFR:** FR35, FR38; NFR18 (ACID), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | SalesOrder/Line models, approval flow, stock reservation, credit check |
| API Contracts | §2.11, §3.5 | CRUD `/sales/orders`, POST `/:id/approve`, GET `/:id/stock-check` (StockCheckResult schema) |
| Data Models | §3.5 | SalesOrder (status 9-value enum), SalesOrderLine (quantityShipped, quantityInvoiced, lineStatus 4-value enum) |
| State Machines | §3.2, §3.3 | SalesOrder: DRAFT→APPROVED→IN_PROGRESS→...→CLOSED; SalesOrderLine: OPEN→PARTIALLY_FULFILLED→FULFILLED |
| Event Catalog | §4 | `order.confirmed`, `dispatch.shipped`, `sales.order.invoiced` — subscribers: Inventory, AR, CRM, Notifications |
| Business Rules | §4 | REQ-OR-001–003 (customer validation), REQ-OR-005–008 (credit check), REQ-OR-013–015 (shipped row guards), REQ-OR-040 (OROK permission), REQ-OR-050–053 (approval side effects), REQ-OR-061 (delete guard) |
| UX Design Spec | §T1, §T3 | T1 for order list, T3 for order form with header+lines |
| Project Context | §15 (XM rules) | XM-001 (credit limit), XM-002 (ATP), XM-003 (stock reservation) |

---

## Story E16.S3: Dispatches

**User Story:** As a warehouse operator, I want to create dispatches from sales orders with pick/pack/ship workflow and partial dispatch support, so that goods are shipped to customers with full tracking.

**Acceptance Criteria:**
1. GIVEN an APPROVED sales order WHEN the operator creates a dispatch THEN a Dispatch is created in DRAFT status with DispatchLines linked to SalesOrderLines, and the order status transitions to IN_PROGRESS.
2. GIVEN a DRAFT dispatch WHEN items are confirmed picked THEN the status transitions to PICKED (all dispatch lines must have items available).
3. GIVEN a PICKED dispatch WHEN items are packed THEN the status transitions to PACKED.
4. GIVEN a PACKED dispatch WHEN it is shipped THEN the status transitions to SHIPPED, SalesOrderLine.quantityShipped is updated, GOODS_ISSUE stock movements are created in the Inventory module, and `dispatch.shipped` event is emitted.
5. GIVEN a SHIPPED dispatch WHEN delivery is confirmed THEN the status transitions to DELIVERED and actualDelivery date is set.
6. GIVEN a DRAFT, PICKED, or PACKED dispatch WHEN cancelled THEN the status transitions to CANCELLED and any reserved quantities are released (cancellation not available after SHIPPED).

**Key Tasks:**
- [ ] Create Prisma models for Dispatch and DispatchLine (AC: #1)
  - [ ] Dispatch: id, dispatchNumber, salesOrderId FK, status DispatchStatus enum (6 values), shippingMethodId FK, trackingNumber, actualDelivery, companyId
  - [ ] DispatchLine: id, dispatchId FK (cascade), salesOrderLineId FK, itemId, quantity, serialNumbers (JSON)
- [ ] Implement dispatch state machine: DRAFT→PICKED→PACKED→SHIPPED→DELIVERED, DRAFT/PICKED/PACKED→CANCELLED (AC: #2–#6)
- [ ] Implement SHIPPED transition with SalesOrderLine.quantityShipped update and GOODS_ISSUE stock movement creation (AC: #4)
- [ ] Emit `dispatch.shipped` event for Inventory module to create stock movements (AC: #4)
- [ ] Implement partial dispatch (not all order lines need to be dispatched at once) (AC: #1)
- [ ] Register routes: CRUD `/sales/dispatches`, GET `/:id/lines`, POST `/:id/ship`, POST `/:id/cancel` (AC: #1–#6)
- [ ] Write unit tests for each status transition and stock movement integration (AC: #2–#6)

**FR/NFR:** FR36; NFR18 (ACID for stock movement creation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | Dispatch/DispatchLine models, pick/pack/ship workflow, stock movement generation |
| API Contracts | §2.11 | CRUD `/sales/dispatches`, GET `/:id/lines`, POST `/:id/ship`, POST `/:id/cancel` |
| Data Models | §3.5 | Dispatch (status 6-value enum, salesOrderId), DispatchLine (salesOrderLineId, quantity) |
| State Machines | §3.4 | Dispatch: DRAFT→PICKED→PACKED→SHIPPED→DELIVERED; DRAFT/PICKED/PACKED→CANCELLED |
| Event Catalog | §4 | `dispatch.shipped` — subscribers: Inventory (GOODS_ISSUE stock movements), Communications (shipping notification) |
| Business Rules | §4 | REQ-OR-023 (over-shipment prevention unless setting allows) |
| UX Design Spec | §T3 | T3 Header+Lines for dispatch form with pick/pack/ship actions in ActionBar |
| Project Context | §15 | XM-003 (stock reservation on approval releases on cancel) |

---

## Story E16.S4: Pricing Engine

**User Story:** As a sales manager, I want a configurable pricing engine with price lists, quantity breaks, formula pricing, and customer-specific pricing, so that correct prices are automatically resolved for each sales transaction.

**Acceptance Criteria:**
1. GIVEN a PriceList with entries and validity dates WHEN a user calls POST `/pricing/resolve` with itemId, customerId, and quantity THEN the engine resolves the price using the 5-level waterfall: Customer+Item specific → Quantity break → Generic price list → Formula-derived → Replacement chain → Last purchase → Item base price per BR-PRC-001.
2. GIVEN a PriceListEntry with noOtherPricing = true WHEN the resolver finds it THEN it returns immediately without checking further levels per BR-PRC-002.
3. GIVEN a PriceListEntry with quantity breaks WHEN the requested quantity falls within a break range THEN the break-specific price or discount applies per BR-PRC-005.
4. GIVEN a PriceListEntry with formula pricing WHEN the base source is COST_PRICE with a markup percentage THEN the resolved price equals basePrice * (1 + markupPercent/100) + additions, with rounding per BR-PRC-007.
5. GIVEN a PriceList with a replacementPriceListId WHEN no entry is found in the primary list THEN the resolver recurses into the replacement list per BR-PRC-006.
6. GIVEN price lists with start/end dates WHEN the transaction date falls outside the validity window THEN those entries are skipped per BR-PRC-003.

**Key Tasks:**
- [ ] Create Prisma models for PriceList, PriceListEntry, QuantityBreak, Rebate, RebateTier (AC: #1)
  - [ ] PriceList: id, code, name, startDate, endDate, replacementPriceListId (self-ref), noOtherPricing, isActive, companyId
  - [ ] PriceListEntry: id, priceListId FK, itemId, customerId (nullable), priceType enum, unitPrice, discountPercent, formulaBaseSource enum (7 values), markupPercent, startDate, endDate, noOtherPricing, companyId
  - [ ] QuantityBreak: id, priceListEntryId FK (cascade), fromQuantity, toQuantity, breakPrice, breakDiscountPercent
- [ ] Implement 5-level price resolution waterfall algorithm (AC: #1)
- [ ] Implement noOtherPricing short-circuit logic (AC: #2)
- [ ] Implement quantity break resolution within entries (AC: #3)
- [ ] Implement formula pricing calculation with 7 base sources (AC: #4)
- [ ] Implement replacement price list recursion with cycle detection (AC: #5)
- [ ] Implement date validity filtering on both PriceList and PriceListEntry (AC: #6)
- [ ] Register routes: CRUD `/pricing/price-lists`, CRUD entries and breaks, POST `/pricing/resolve`, CRUD `/pricing/rebates` (AC: #1–#6)
- [ ] Write unit tests for each waterfall level and edge cases (no match, expired, circular replacement) (AC: #1–#6)

**FR/NFR:** FR39; NFR38 (Decimal precision), NFR43 (test coverage)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.19 | Pricing module design, 5-level waterfall, formula sources |
| API Contracts | §2.14 | CRUD `/pricing/price-lists`, entries, breaks, POST `/pricing/resolve`, CRUD `/pricing/rebates` |
| Data Models | §3.8 | PriceList (replacementPriceListId self-ref), PriceListEntry (priceType, formulaBaseSource 7-value enum), QuantityBreak, Rebate/RebateTier |
| State Machines | N/A — pricing is reference data, no lifecycle states |
| Event Catalog | N/A — price changes do not emit events in MVP |
| Business Rules | §13 (Pricing) | BR-PRC-001 (5-level waterfall), BR-PRC-002 (noOtherPricing), BR-PRC-003 (date validity), BR-PRC-004 (unique constraint), BR-PRC-005 (quantity breaks), BR-PRC-006 (replacement chain), BR-PRC-007 (formula pricing) |
| UX Design Spec | §T7 | T7 Settings for price list configuration |
| Project Context | §1 | companyId scoping on all pricing tables |

---

## Story E16.S5: Document Flow

**User Story:** As a sales user, I want to see the complete document chain from quote to order to dispatch to invoice with record links, so that I can trace any transaction back to its origin and understand fulfilment progress.

**Acceptance Criteria:**
1. GIVEN a quote converted to an order WHEN viewing either record THEN a RecordLink of type CREATED_FROM connects the order to the quote.
2. GIVEN a dispatch created from an order WHEN viewing the dispatch THEN a RecordLink of type FULFILLS connects the dispatch to the order.
3. GIVEN an invoice created from an order WHEN viewing the invoice THEN a RecordLink connects the invoice to the order.
4. GIVEN any document in the chain WHEN the user views it THEN the EventFlowTracker component displays: [Quote] → [Order] → [Dispatch] → [Invoice] with status indicators for each step.
5. GIVEN an order with partial fulfilment WHEN the user views it THEN the status propagation shows which lines are fulfilled and which are outstanding.

**Key Tasks:**
- [ ] Implement automatic RecordLink creation on quote-to-order conversion (type: CREATED_FROM) (AC: #1)
- [ ] Implement automatic RecordLink creation on dispatch creation from order (type: FULFILLS) (AC: #2)
- [ ] Implement automatic RecordLink creation on invoice creation from order (type: CREATED_FROM) (AC: #3)
- [ ] Build EventFlowTracker component for the Quote→Order→Dispatch→Invoice chain (AC: #4)
- [ ] Implement line-level fulfilment tracking display (AC: #5)
- [ ] Write unit tests for RecordLink creation in each flow step (AC: #1–#3)

**FR/NFR:** FR35, FR36, FR37; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16, §2.20 | RecordLink model (polymorphic), document flow chain |
| API Contracts | §2.5 | Cross-cutting RecordLink endpoints |
| Data Models | §3.9 | RecordLink: entityType, entityId, RecordLinkType enum (CREATED_FROM, FULFILLS, PAYMENT_FOR, etc.) |
| State Machines | §3.1–§3.4 | Quote→Order→Dispatch lifecycle chain |
| Event Catalog | §4 | `quote.converted`, `dispatch.shipped`, `sales.order.invoiced` — flow events |
| Business Rules | §4 | REQ-OR rules governing order lifecycle drive the document flow |
| UX Design Spec | §T3, §EventFlowTracker | EventFlowTracker component at bottom of T3 forms: [Quote] → [SO] → [DN] → [INV] |
| Project Context | §11 | XM-016 (polymorphic attachments, notes, and links across all entities) |

---

## Story E16.S6: Sales Screens

**User Story:** As a sales user, I want standardised list and form screens for quotes, orders, and dispatches with status-driven action bars, so that I can manage the full sales lifecycle using consistent UX patterns.

**Acceptance Criteria:**
1. GIVEN a sales user WHEN they navigate to Quotes THEN a T1 Entity List displays quotes with columns for number, customer, date, total, valid until, and status, with filters for status and date range.
2. GIVEN a sales user WHEN they open a quote THEN a T3 Header+Lines form displays customer, dates, terms in the header and item lines with quantity/price/VAT in the lines section, with ActionBar showing Send (DRAFT), Convert to Order (ACCEPTED).
3. GIVEN a sales user WHEN they navigate to Orders THEN a T1 Entity List displays orders with columns for number, customer, date, total, status, and shipment progress.
4. GIVEN a sales user WHEN they open an order THEN a T3 form displays the order with ActionBar showing Approve (DRAFT), Create Dispatch (APPROVED), Create Invoice (FULLY_SHIPPED).
5. GIVEN a sales user WHEN they navigate to Dispatches THEN a T1 list shows dispatches with order reference, status, and shipping details.
6. GIVEN a dispatch form WHEN the ActionBar renders THEN it shows status-driven actions: Pick (DRAFT), Pack (PICKED), Ship (PACKED).

**Key Tasks:**
- [ ] Build T1 Entity List for Quotes with status/date filters (AC: #1)
- [ ] Build T3 Header+Lines form for Quotes with customer lookup, line editor (AC: #2)
- [ ] Build T1 Entity List for Orders with shipment progress indicator (AC: #3)
- [ ] Build T3 Header+Lines form for Orders with stock availability inline display (AC: #4)
- [ ] Build T1 Entity List for Dispatches (AC: #5)
- [ ] Build T3 form for Dispatches with pick/pack/ship ActionBar (AC: #6)
- [ ] Implement status-driven ActionBar for all three entity types (AC: #2, #4, #6)
- [ ] Ensure all text uses translation keys and Co-Pilot Dock integration (AC: #1–#6)

**FR/NFR:** FR33–FR40; NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.16 | All sales entities and relationships |
| API Contracts | §2.11 | All sales endpoints consumed by frontend |
| Data Models | §3.5 | All sales models for form field mapping |
| State Machines | §3.1–§3.4 | Quote, Order, OrderLine, Dispatch status for ActionBar visibility |
| Event Catalog | N/A — frontend subscribes via WebSocket |
| Business Rules | §4 | REQ-OR rules inform validation displays and ActionBar visibility |
| UX Design Spec | §T1, §T3, §Action Bar, §EventFlowTracker | T1 for lists, T3 for forms, ActionBar rules, EventFlowTracker for document chain |
| Project Context | §3 | All strings use translation keys |

---

## Story E16.S7: Mobile Adaptation

**User Story:** As a sales representative on mobile, I want to check order status and create quick quotes from my phone, so that I can respond to customer enquiries while in the field.

**Acceptance Criteria:**
1. GIVEN a mobile user WHEN they navigate to Sales THEN they see a summary showing open quotes count, pending orders count, and today's dispatches.
2. GIVEN a mobile user WHEN they view the order list THEN a read-only T1 list displays orders with number, customer, total, and status, optimised for mobile.
3. GIVEN a mobile user WHEN they tap an order THEN a read-only detail view shows the header, line summary, and current fulfilment status.
4. GIVEN a mobile user WHEN they create a quick quote THEN a simplified form allows selecting customer, adding items (with barcode scan), and saving as DRAFT.
5. GIVEN all mobile sales screens WHEN rendered THEN touch targets are minimum 44x44px and layouts are single-column.

**Key Tasks:**
- [ ] Design mobile sales summary card component (AC: #1)
- [ ] Implement responsive T1 list for orders on mobile (AC: #2)
- [ ] Implement read-only order detail view for mobile (AC: #3)
- [ ] Implement simplified quick-quote creation form with barcode scan (AC: #4)
- [ ] Ensure 44x44px touch targets and single-column layout (AC: #5)

**FR/NFR:** FR33, FR35; NFR27 (WCAG 2.1 AA)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 | Mobile scaffold (Expo/React Native) |
| API Contracts | §2.11 | Sales endpoints consumed by mobile |
| Data Models | N/A — mobile consumes API responses |
| State Machines | N/A — mobile displays status badges only |
| Event Catalog | N/A — mobile receives push notifications |
| Business Rules | N/A — validation enforced server-side |
| UX Design Spec | §Responsive | 375px+ breakpoint, 44x44px touch targets |
| Project Context | §8 | Mobile as end-of-epic story, web drives design |

---
