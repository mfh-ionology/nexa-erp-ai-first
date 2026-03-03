# User Journeys

## Journey 1: Sarah — The Business Owner

**Situation:** Sarah runs a 45-person UK manufacturing company. She juggles finance, sales oversight, and strategic decisions. Her current ERP requires navigating 15+ screens to understand her business position each morning.

**Opening Scene:** Monday 8:15 AM. Sarah opens Nexa on her phone. Her personalised daily briefing: 3 overdue invoices totalling £47,200, cash position £128K projected to £89K in 3 weeks, 2 completed work orders ready for dispatch, 1 pending leave request.

**Rising Action:** Sarah speaks: "Chase Acme Corp on that £31K." AI drafts payment reminder email with invoice references, shows draft. She taps "Approve & Send" — 30 seconds. Asks: "How did January compare to December?" AI generates plain-English comparison with chart — revenue up 12%, material costs up 18%, flags margin pressure from steel prices.

**Climax:** "Show me cash flow forecast for next 8 weeks." Projection based on real AR, AP, committed POs — not a manual spreadsheet. AI highlights: "Week 6 tight. Options: accelerate £62K collection or delay Supplier B payment 7 days (no penalty per terms)."

**Resolution:** By 8:30 AM — chased payments, reviewed performance, approved leave, understood 2-month cash position. Zero menus navigated. Previous ERP: 2 hours.

**Requirements:** Daily briefing engine, role-based personalisation, AI email drafting, NL reporting, cash flow forecasting, approval workflows, mobile-first.

---

## Journey 2: David — The Finance Manager

**Situation:** Manages AR, AP, VAT, month-end close. ~200 invoices/month, 3 bank accounts, quarterly VAT returns. Currently 3 days for month-end close.

**Opening Scene:** Briefing: 12 supplier bills via email overnight, 4 customer payments in bank feed, 3 invoices due for posting, VAT deadline in 9 days.

**Rising Action:** "Process the bank feed." AI matched 4 payments to invoices (amount + reference). 3 exact matches, 1 partial (£4,200 against £5,600 — £1,400 remaining). David approves all 4 with one tap. For 12 supplier bills — AI OCR-scanned email attachments, matched 10 to POs, flagged 2 new suppliers. 45 minutes of data entry becomes 3 minutes of review.

**Climax:** Month-end: "Run month-end close for January." AI presents checklist — bank reconciliations (2/3 done, alerts to third), unposted invoices, accruals (estimated from patterns), depreciation. David validates and approves each item.

**Resolution:** Month-end drops from 3 days to half a day. VAT pre-calculated, one-click HMRC MTD submission.

**Requirements:** Bank feed integration, AI payment matching, document understanding (AI extraction of invoices/receipts → draft records), PO matching, month-end automation, MTD VAT, bank reconciliation, depreciation runs.

---

## Journey 3: Priya — The Sales & CRM Manager (Edge Case & Recovery)

**Situation:** Manages 6-person sales team. Needs pipeline visibility, quote-to-invoice lifecycle. Frustrated by CRM disconnected from Sales Orders.

**Opening Scene:** Briefing: 3 quotes expiring (£78K), pipeline £340K/62% weighted, top deal MegaCorp £120K — no activity 14 days, 2 orders ready for dispatch.

**Rising Action:** "Create quote for BlueStar — 500 Widget-A, 200 Widget-B, standard terms." AI applies negotiated discount from CRM, calculates VAT. Priya updates shipping address. "Convert MegaCorp quote QT-2024-0089 to sales order." AI converts, checks stock — flags Widget-C 30 units short.

**Edge Case:** Stock conflict. AI offers: (1) Partial ship 70 now, backorder 30. (2) Delay entire order. (3) Suggest alternative Widget-C-Plus (compatible, in stock). Priya selects partial — AI creates shipment and backorder PO in one flow.

**Resolution:** Full pipeline visibility without module switching. Quote→Order→Delivery→Invoice as single journey. Stock conflicts handled proactively.

**Requirements:** Quote-to-order conversion, stock availability checks, partial shipment/backorder, address management, pipeline reporting, CRM-Sales integration, discount management.

---

## Journey 4: Marcus — The Warehouse & Production Manager

**Situation:** Manages warehouse and production floor. Needs real-time stock visibility and production scheduling.

**Opening Scene:** Tablet briefing: 5 WOs in progress, WO-0034 completed (200 Widget-A ready for QC), raw material delivery arriving (PO-0078), 3 items below reorder point, 2 dispatch notes for picking.

**Rising Action:** Delivery arrives. "Receive PO-0078." Scans barcodes — AI matches to PO lines, flags 95 vs 100 received. "Accept partial and note 5 missing?" Confirmed. Stock updates instantly. "Schedule work orders for this week by sales order priority." AI checks materials, capacity, proposes schedule.

**Climax:** Rush order from Sales — 150 Widget-B by Friday. Current stock: 40, need 110 produced. AI: "Insert WO-0038 today, push WO-0037 to Thursday. Materials available." Marcus approves — work order created with automatic material reservations.

**Resolution:** Runs receiving, production, dispatch from tablet. AI handles scheduling conflicts and cross-module coordination that used to require 4 phone calls and 3 spreadsheets.

**Requirements:** Goods receipt with barcode scanning, PO matching, partial receipt, production scheduling, BOM explosion, rush order handling, material reservation, dispatch management.

---

## Journey 5: Fatima — The HR Manager

**Situation:** 45 employees — onboarding, leave, payroll, compliance. Monthly payroll, HMRC RTI, auto-enrolment pension.

**Opening Scene:** Briefing: Payroll due in 5 days, 2 new starters for onboarding, 1 probation review due, 3 leave requests pending, auto-enrolment assessment for 2 employees.

**Rising Action:** "Onboard Ahmed Khan — starts Monday, Software Developer, £45K, Engineering." AI creates record, populates statutory fields (NI category, tax code), sets leave entitlement (28 days), flags: "Need bank details, NI number, emergency contact — send self-service form?" "Prepare payroll for February." AI calculates PAYE, NI, student loan, pension. Flags exceptions: James 2 days unpaid leave, Sarah 8 hours overtime at 1.5x, Ahmed pro-rata.

**Climax:** AI submits FPS to HMRC via RTI, generates payslips, triggers BACS payment file. Flags: "2 employees now meet auto-enrolment criteria — letters needed within 6 weeks."

**Resolution:** Payroll drops from 2 days to half a day. Compliance is proactive — AI tracks deadlines and eligibility automatically.

**Requirements:** Employee onboarding, self-service forms, payroll engine, PAYE/NI/pension calculations, RTI, BACS, auto-enrolment tracking, leave management, payslip generation.

---

## Journey 6: Tom — The System Administrator

**Situation:** IT manager responsible for Nexa config, user management, integrations. 15 users.

**Opening Scene:** Dashboard: all healthy, 15 active users, 3 integration syncs pending, last backup 6 hours ago. Alert: failed bank feed sync — auth expired.

**Rising Action:** Re-authenticates bank feed (OAuth). Creates user account for Ahmed — assigns the "Warehouse Staff" access group for Manufacturing + Inventory access, plus a custom "Production Reporting" access group for read-only production reports. No need to toggle individual modules — Ahmed's navigation automatically shows only the pages his access groups permit. Reviews audit log, checks AI action logs. Adjusts reorder threshold after reviewing a rejected AI suggestion.

**Climax:** Company adding new warehouse. Creates location, configures bins, assigns team, sets transfer rules, tests barcode scanning integration. Clones the "Warehouse Staff" access group to create "Warehouse Supervisor" with delete permissions and cost price visibility, assigns it to the warehouse lead.

**Resolution:** Entire system managed from single admin console. Access groups make permission management intuitive — clone a pre-built group, tweak permissions, assign to users. 30 minutes/week administration.

**Requirements:** Access group management (create, clone, assign), per-resource permission matrix, field-level visibility control, integration management, audit/AI logging, system monitoring, multi-warehouse config, backup management.

---

## Journey 7: Claire — The External Accountant (Phase 2 Preview)

**Situation:** External accountancy firm handling year-end accounts and tax advisory. Needs read access to financials plus journal posting.

**Opening Scene:** Logs into accountant portal — her "External Accountant" access group gives her access to GL, AR, AP, bank reconciliation, and financial reports only. Cannot see HR, CRM, Manufacturing, or operations pages — they simply don't appear in her navigation because her access group grants no permissions for those resources.

**Rising Action:** Year-end. Reviews trial balance, posts 3 adjustments (prepayment, accrual, depreciation correction). Journals require internal approval — David reviews and approves. Claire's access group has `canNew` and `canEdit` on journal entries but not `canDelete`, and salary-related GL accounts are hidden via field overrides.

**Resolution:** Year-end adjustments without VPN or physical access. Audit trail distinguishes external from internal actions. Claire generates reports independently. Tom can adjust Claire's access group at any time — for example, temporarily granting bank reconciliation edit access during audit season and revoking it after.

**Requirements:** Scoped access groups for external users, per-resource action control (canNew/canEdit without canDelete), field-level visibility overrides, journal approval workflow, audit trail by user type, report export.

---

## Journey 8: New User Onboarding — The 5-Minute Magic Moment

**Situation:** A new Nexa ERP customer has just signed up. The admin (or owner) logs in for the first time. They need to experience the AI-first value proposition within 5 minutes — connecting a data source and seeing the AI proactively organise, categorise, and recommend actions.

**Opening Scene:** First login. Guided setup wizard: company name, industry, employee count. AI selects a UK GAAP (FRS 102) chart of accounts template based on industry. One click to confirm.

**Rising Action:** "Connect your bank." OAuth flow to bank feed provider — 30 seconds. AI ingests last 30 days of transactions. Within 90 seconds: transactions categorised (rent, utilities, supplier payments, customer receipts), unmatched items flagged, and a summary presented: "I found 47 transactions. 38 auto-categorised, 6 need your review, 3 are potential duplicates."

**Climax:** User reviews 6 flagged items — AI suggests categories with confidence scores. User approves 5 with one tap each, corrects 1. AI learns the correction. Total elapsed: 4 minutes. AI presents: "Your opening cash position is £128,400. You have £31,200 in unmatched receipts that may be customer payments — shall I create customer records?"

**Resolution:** Under 5 minutes from first login to a working, AI-organised financial picture. The user has experienced AI categorisation, contextual recommendations, and the "told, shown, approve, done" pattern — the magic moment that proves the system understands their business.

**Requirements:** Guided setup wizard, chart of accounts templates, bank feed OAuth connection, AI transaction categorisation, confidence scoring, one-tap approval, AI learning from corrections, opening balance detection.

---

## Journey Requirements Summary

| Journey | User Type | Key Capability Areas |
|---------|-----------|---------------------|
| Sarah (Owner) | Business Owner | Daily briefings, NL reporting, cash flow forecasting, mobile-first, approvals |
| David (Finance) | Finance Manager | Bank feeds, AI matching, document understanding, month-end automation, MTD VAT, bank rec |
| Priya (Sales) | Sales/CRM Manager | Quote→Order→Invoice, stock checks, pipeline, CRM integration, partial shipments |
| Marcus (Warehouse) | Warehouse/Production | Goods receipt, barcode scanning, production scheduling, BOM, rush orders |
| Fatima (HR) | HR Manager | Onboarding, payroll, RTI, BACS, auto-enrolment, leave management |
| Tom (Admin) | System Admin | Access group management, per-resource permissions, field visibility control, integrations, audit logs, config, monitoring |
| Claire (Accountant) | External Accountant | Scoped access groups, per-action permissions, field-level overrides, journals, financial reporting, approval workflows |
| New User (Onboarding) | Any First-Time User | Guided setup, bank feed connection, AI categorisation, magic moment <5min |

**Cross-Journey Patterns:**
- Every journey starts with a **role-based daily briefing**
- Every journey follows **"AI prepares, human approves"** — told, shown, approve, done
- Every journey requires **cross-module awareness**
- Every journey has **fallback to traditional forms** for complex operations
