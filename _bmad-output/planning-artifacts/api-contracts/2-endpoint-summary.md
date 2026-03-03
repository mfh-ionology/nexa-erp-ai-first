# 2. Endpoint Summary

## 2.1 Auth & Session

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `POST` | `/auth/login` | Authenticate user | Public | FR80 |
| `POST` | `/auth/refresh` | Refresh JWT | Authenticated | FR80 |
| `POST` | `/auth/logout` | Invalidate session | Authenticated | FR80 |
| `POST` | `/auth/mfa/setup` | Configure TOTP MFA | Authenticated | FR80 |
| `POST` | `/auth/mfa/verify` | Verify MFA token | Authenticated | FR80 |
| `POST` | `/auth/password/change` | Change password | Authenticated | FR80 |
| `POST` | `/auth/password/reset-request` | Request password reset | Public | FR80 |
| `POST` | `/auth/password/reset` | Reset password with token | Public | FR80 |

## 2.2 System Module

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET/POST/PATCH` | `/system/company-profile` | Company profile (singleton) | ADMIN | FR83 |
| CRUD | `/system/currencies` | Currency reference data | ADMIN | FR15 |
| CRUD | `/system/exchange-rates` | Exchange rate management | ADMIN | FR15 |
| `GET` | `/system/exchange-rates/latest` | Get latest rate for currency pair | VIEWER | FR15 |
| CRUD | `/system/countries` | Country reference data | ADMIN | FR83 |
| CRUD | `/system/departments` | Department reference data | ADMIN | FR83 |
| CRUD | `/system/payment-terms` | Payment terms reference | ADMIN | FR83 |
| CRUD | `/system/vat-codes` | VAT code reference data | ADMIN | FR89 |
| CRUD | `/system/tags` | Tag/dimension reference data | ADMIN | FR83 |
| CRUD | `/system/bank-holidays` | UK bank holidays | ADMIN | FR83 |
| CRUD | `/system/number-series` | Number series configuration | ADMIN | FR86 |
| CRUD | `/system/system-settings` | System-level configuration | ADMIN | FR83 |
| CRUD | `/system/users` | User management | ADMIN | FR80 |
| `PATCH` | `/system/users/:id/role` | Update user role | ADMIN | FR81 |
| `PATCH` | `/system/users/:id/modules` | ~~Update enabled modules~~ (deprecated — use access groups) | ADMIN | FR82 |
| `GET` | `/system/resources` | List all resources (for admin UI) | ADMIN | FR81 |
| `GET` | `/system/access-groups` | List access groups for current company | ADMIN | FR81 |
| `GET` | `/system/access-groups/:id` | Get access group with permissions | ADMIN | FR81 |
| `POST` | `/system/access-groups` | Create access group | ADMIN | FR81 |
| `PATCH` | `/system/access-groups/:id` | Update access group | ADMIN | FR81 |
| `DELETE` | `/system/access-groups/:id` | Deactivate access group | ADMIN | FR81 |
| `PUT` | `/system/access-groups/:id/permissions` | Set permissions for an access group | ADMIN | FR81 |
| `PUT` | `/system/access-groups/:id/field-overrides` | Set field-level visibility overrides | ADMIN | FR81 |
| `GET` | `/system/users/:id/access-groups` | Get user's access groups | ADMIN | FR81 |
| `PUT` | `/system/users/:id/access-groups` | Assign access groups to user | ADMIN | FR81 |
| `GET` | `/system/company-profile/export-defaults` | Export default data JSON | ADMIN | FR83 |
| `POST` | `/system/company-profile/import-defaults` | Import default data JSON | ADMIN | FR83 |
| `GET` | `/system/my-permissions` | Get current user's resolved permissions | Authenticated | FR81 |
| `GET` | `/system/audit-log` | Query audit trail | ADMIN | FR85 |
| `GET` | `/system/audit-log/:entityType/:entityId` | Audit trail for specific entity | MANAGER | FR85 |
| `POST` | `/system/backups` | Create system backup | ADMIN | FR88 |
| `GET` | `/system/backups` | List available backups | ADMIN | FR88 |
| `POST` | `/system/backups/:id/restore` | Restore from backup | SUPER_ADMIN | FR88 |

## 2.3 Views, Filters & Columns (Cross-cutting)

### Data View Metadata
| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET` | `/views/init` | Bundled init: data_view + fields + date_presets + user's saved views (query: `viewKey`) | VIEWER | FR86 |
| `GET` | `/views/data-views` | List all data views | VIEWER | FR86 |
| `GET` | `/views/data-views/:viewKey/fields` | Get field metadata for a data view | VIEWER | FR86 |
| `GET` | `/views/date-presets` | List date range presets | VIEWER | FR86 |

### Saved Views
| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET` | `/views/saved` | List saved views for current user (query: `viewKey`, returns personal + role + global) | VIEWER | FR86 |
| `POST` | `/views/saved` | Create saved view (with conditions, sort, column config) | STAFF | FR86 |
| `PATCH` | `/views/saved/:id` | Update saved view | STAFF | FR86 |
| `DELETE` | `/views/saved/:id` | Delete saved view (owner or ADMIN only) | STAFF | FR86 |
| `GET` | `/views/favourites` | List favourite views (all scopes, grouped by groupName) | VIEWER | FR86 |
| `POST` | `/views/saved/:id/set-default` | Set view as default for user + data_view | STAFF | FR86 |
| `POST` | `/views/saved/:id/toggle-favourite` | Toggle favourite status | STAFF | FR86 |

### Column Preferences
| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET` | `/views/columns/:viewKey` | Get user's column preferences for a data view | VIEWER | FR86 |
| `PUT` | `/views/columns/:viewKey` | Save user's column preferences (bulk upsert) | STAFF | FR86 |
| `PATCH` | `/views/columns/:viewKey/:fieldId/width` | Update single column width (drag-resize) | STAFF | FR86 |

### LOV (List of Values)
| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `POST` | `/views/lov/batch` | Batch fetch LOV data for multiple fields | VIEWER | FR86 |
| `GET` | `/views/lov/:lovScope` | Fetch LOV data for a single field (query: `search`, `limit`) | VIEWER | FR86 |

## 2.4 Document Templates (Cross-cutting)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/document-templates` | Manage document templates | ADMIN | FR78 |
| `POST` | `/documents/generate` | Generate PDF from template | STAFF | FR78 |
| `POST` | `/documents/email` | Generate and email document | STAFF | FR78 |
| `POST` | `/documents/batch-generate` | Batch PDF generation | MANAGER | FR78 |

## 2.5 Cross-cutting Infrastructure

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `POST` | `/attachments/presign` | Get pre-signed upload URL | STAFF | FR148 |
| `POST` | `/attachments/confirm` | Confirm upload completion | STAFF | FR148 |
| `GET` | `/attachments/:id/download` | Get pre-signed download URL | VIEWER | FR148 |
| `DELETE` | `/attachments/:id` | Delete attachment | MANAGER | FR148 |
| `GET` | `/attachments` | List attachments for entity | VIEWER | FR148 |
| CRUD | `/notes` | Polymorphic notes | STAFF | FR55 |
| `PATCH` | `/notes/:id/pin` | Pin/unpin note | STAFF | FR55 |
| `GET` | `/record-links` | Bidirectional record links | VIEWER | FR58 |
| `POST` | `/record-links` | Create manual record link | STAFF | FR58 |
| `DELETE` | `/record-links/:id` | Delete record link | MANAGER | FR58 |
| CRUD | `/approval-rules` | Approval workflow rules | ADMIN | FR6 |
| `GET` | `/approval-requests` | List pending approvals | STAFF | FR6 |
| `PATCH` | `/approval-requests/:id` | Approve/reject/forward | MANAGER | FR6 |
| CRUD | `/activities` | Cross-cutting activities | STAFF | FR55 |

## 2.6 AI & Chat

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `WS` | `/ai/chat` | WebSocket AI conversation | STAFF | FR1, FR4, FR7 |
| `POST` | `/ai/chat/message` | Send message (HTTP fallback) | STAFF | FR1, FR4 |
| `GET` | `/ai/chat/history` | Get conversation history | STAFF | FR7 |
| `POST` | `/ai/chat/sessions` | Create new AI session | STAFF | FR7 |
| `GET` | `/ai/briefing` | Get daily briefing | VIEWER | FR3 |
| `POST` | `/ai/suggestions` | Get AI suggestions for entity | STAFF | FR2, FR5 |
| `GET` | `/ai/confidence/:entityType/:entityId` | Get confidence score | VIEWER | FR10 |
| `POST` | `/ai/explain` | Explain AI decision | VIEWER | FR10 |
| `POST` | `/ai/predict/cash-flow` | Cash flow forecast | MANAGER | FR153 |
| `POST` | `/ai/detect/anomalies` | Fraud/anomaly detection | MANAGER | FR156 |
| `POST` | `/ai/detect/duplicates` | Duplicate detection | STAFF | FR155 |

## 2.7 Finance & GL

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/finance/chart-of-accounts` | Chart of accounts | MANAGER | FR11 |
| `GET` | `/finance/chart-of-accounts/tree` | Hierarchical account tree | VIEWER | FR11 |
| CRUD | `/finance/account-classifications` | Account classifications | ADMIN | FR11 |
| CRUD | `/finance/account-mappings` | GL account mappings | ADMIN | FR11 |
| CRUD | `/finance/financial-periods` | Financial period management | ADMIN | FR14 |
| `POST` | `/finance/financial-periods/:id/lock` | Lock period | ADMIN | FR14, FR94 |
| `POST` | `/finance/financial-periods/:id/unlock` | Unlock period | ADMIN | FR14 |
| `POST` | `/finance/financial-periods/generate` | Auto-generate periods for year | ADMIN | FR14 |
| CRUD | `/finance/journal-entries` | Manual journal entries | MANAGER | FR12 |
| `POST` | `/finance/journal-entries/:id/post` | Post journal entry | MANAGER | FR12 |
| `POST` | `/finance/journal-entries/:id/reverse` | Reverse posted entry | MANAGER | FR12 |
| `GET` | `/finance/journal-entries/:id/lines` | Get journal lines | VIEWER | FR12 |
| CRUD | `/finance/bank-accounts` | Bank account management | ADMIN | FR16 |
| `GET` | `/finance/bank-accounts/:id/transactions` | List bank transactions | VIEWER | FR16 |
| `POST` | `/finance/bank-accounts/:id/import` | Import bank statement (CSV/OFX) | MANAGER | FR17 |
| `POST` | `/finance/bank-accounts/:id/feed/sync` | Trigger Open Banking sync | MANAGER | FR84 |
| `GET` | `/finance/bank-accounts/:id/reconciliations` | List reconciliations | VIEWER | FR16 |
| `POST` | `/finance/bank-reconciliations` | Create reconciliation | MANAGER | FR16 |
| `PATCH` | `/finance/bank-reconciliations/:id` | Update reconciliation | MANAGER | FR16 |
| `POST` | `/finance/bank-reconciliations/:id/complete` | Complete reconciliation | MANAGER | FR16 |
| `POST` | `/finance/bank-reconciliations/:id/auto-match` | AI auto-match | MANAGER | FR18 |
| `POST` | `/finance/bank-transactions/:id/match` | Manual match to GL | MANAGER | FR16 |
| `POST` | `/finance/bank-transactions/:id/unmatch` | Undo match | MANAGER | FR16 |
| CRUD | `/finance/budgets` | Budget management | MANAGER | FR13 |
| `POST` | `/finance/budgets/:id/approve` | Approve budget | ADMIN | FR13 |
| `GET` | `/finance/budgets/:id/lines` | Get budget lines | VIEWER | FR13 |
| `POST` | `/finance/budgets/:id/lines/batch` | Batch upsert budget lines | MANAGER | FR13 |
| `GET` | `/finance/reports/trial-balance` | Trial balance report | VIEWER | FR13, FR74 |
| `GET` | `/finance/reports/balance-sheet` | Balance sheet | VIEWER | FR13, FR74 |
| `GET` | `/finance/reports/profit-and-loss` | P&L report | VIEWER | FR13, FR74 |
| `GET` | `/finance/reports/budget-vs-actual` | Budget variance report | VIEWER | FR13 |
| `GET` | `/finance/reports/general-ledger` | GL listing | VIEWER | FR13 |
| `GET` | `/finance/reports/cash-flow` | Cash flow statement | VIEWER | FR74 |
| `GET` | `/finance/reports/account-balance/:code` | Account balance for period | VIEWER | FR13 |

## 2.8 VAT & Compliance

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET` | `/compliance/vat/returns` | List VAT returns | VIEWER | FR91 |
| `POST` | `/compliance/vat/returns/calculate` | Calculate VAT return | MANAGER | FR89, FR91 |
| `GET` | `/compliance/vat/returns/:id` | Get VAT return detail | VIEWER | FR91 |
| `POST` | `/compliance/vat/returns/:id/approve` | Approve VAT return | ADMIN | FR91 |
| `POST` | `/compliance/vat/returns/:id/submit` | Submit to HMRC MTD | ADMIN | FR91 |
| `GET` | `/compliance/vat/returns/:id/status` | Check HMRC submission status | VIEWER | FR91 |
| `GET` | `/compliance/vat/obligations` | Get VAT obligations from HMRC | VIEWER | FR91 |
| `GET` | `/compliance/mtd/status` | MTD connection status | ADMIN | FR84 |
| `POST` | `/compliance/mtd/authorize` | OAuth flow for HMRC | ADMIN | FR84 |
| `GET` | `/compliance/reports/ec-sales-list` | EC sales list | VIEWER | FR75 |
| `GET` | `/compliance/reports/vat-audit-trail` | VAT audit trail | VIEWER | FR92 |
| `GET` | `/compliance/reports/intrastat` | Intrastat report | VIEWER | FR75 |

## 2.9 Accounts Receivable (AR)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/ar/customers` | Customer management | STAFF | FR19 |
| `GET` | `/ar/customers/:id/addresses` | Customer addresses | VIEWER | FR25 |
| `POST` | `/ar/customers/:id/addresses` | Add customer address | STAFF | FR25 |
| `PATCH` | `/ar/customers/:id/addresses/:addrId` | Update address | STAFF | FR25 |
| `GET` | `/ar/customers/:id/contacts` | Customer contacts | VIEWER | FR19 |
| `POST` | `/ar/customers/:id/contacts` | Add customer contact | STAFF | FR19 |
| `GET` | `/ar/customers/:id/balance` | Customer balance summary | VIEWER | FR24 |
| `GET` | `/ar/customers/:id/statement` | Customer statement | VIEWER | FR22 |
| `GET` | `/ar/customers/:id/credit-check` | Credit exposure check | VIEWER | FR19 |
| `GET` | `/ar/customers/:id/transaction-history` | Transaction history | VIEWER | FR24 |
| CRUD | `/ar/invoices` | Customer invoice management | STAFF | FR20 |
| `GET` | `/ar/invoices/:id/lines` | Invoice line items | VIEWER | FR20 |
| `POST` | `/ar/invoices/:id/approve` | Approve invoice | MANAGER | FR20 |
| `POST` | `/ar/invoices/:id/post` | Post invoice (creates GL) | MANAGER | FR20 |
| `POST` | `/ar/invoices/:id/void` | Void posted invoice | MANAGER | FR20 |
| `POST` | `/ar/invoices/:id/credit` | Create credit note from invoice | MANAGER | FR23 |
| `POST` | `/ar/invoices/:id/email` | Email invoice to customer | STAFF | FR22 |
| CRUD | `/ar/payments` | Customer payment management | STAFF | FR21 |
| `POST` | `/ar/payments/:id/post` | Post payment | MANAGER | FR21 |
| `POST` | `/ar/payments/:id/allocate` | Allocate payment to invoices | STAFF | FR21 |
| `POST` | `/ar/payments/:id/void` | Void payment | MANAGER | FR21 |
| `GET` | `/ar/reports/aging` | AR aging report | VIEWER | FR24 |
| `GET` | `/ar/reports/overdue` | Overdue invoices | VIEWER | FR24 |
| `POST` | `/ar/reports/statements/batch` | Batch generate statements | MANAGER | FR22 |
| `GET` | `/ar/reports/cash-receipts` | Cash receipts journal | VIEWER | FR24 |
| `GET` | `/ar/reports/sales-by-customer` | Sales by customer summary | VIEWER | FR75 |

## 2.10 Accounts Payable (AP)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/ap/suppliers` | Supplier management | STAFF | FR26 |
| `GET` | `/ap/suppliers/:id/purchase-history` | Supplier purchase history | VIEWER | FR26 |
| `GET` | `/ap/suppliers/:id/balance` | Supplier balance | VIEWER | FR30 |
| CRUD | `/ap/purchase-orders` | Purchase order management | STAFF | FR41 |
| `GET` | `/ap/purchase-orders/:id/lines` | PO line items | VIEWER | FR41 |
| `POST` | `/ap/purchase-orders/:id/approve` | Approve PO | MANAGER | FR42 |
| `POST` | `/ap/purchase-orders/:id/send` | Send PO to supplier | STAFF | FR45 |
| `POST` | `/ap/purchase-orders/:id/close` | Close PO | MANAGER | FR45 |
| `POST` | `/ap/purchase-orders/:id/cancel` | Cancel PO | MANAGER | FR45 |
| CRUD | `/ap/goods-receipts` | Goods receipt notes | STAFF | FR43 |
| `GET` | `/ap/goods-receipts/:id/lines` | GRN line items | VIEWER | FR43 |
| `POST` | `/ap/goods-receipts/:id/post` | Post GRN | MANAGER | FR43 |
| `POST` | `/ap/goods-receipts/:id/cancel` | Cancel GRN | MANAGER | FR43 |
| CRUD | `/ap/supplier-bills` | Supplier bill management | STAFF | FR27 |
| `GET` | `/ap/supplier-bills/:id/lines` | Bill line items | VIEWER | FR27 |
| `POST` | `/ap/supplier-bills/:id/approve` | Approve bill | MANAGER | FR27 |
| `POST` | `/ap/supplier-bills/:id/post` | Post bill (creates GL) | MANAGER | FR27 |
| `POST` | `/ap/supplier-bills/:id/void` | Void bill | MANAGER | FR27 |
| `GET` | `/ap/supplier-bills/:id/matching` | Three-way match result | VIEWER | FR31 |
| CRUD | `/ap/supplier-payments` | Supplier payment management | STAFF | FR28 |
| `POST` | `/ap/supplier-payments/:id/approve` | Approve payment | MANAGER | FR28 |
| `POST` | `/ap/supplier-payments/:id/post` | Post payment | MANAGER | FR28 |
| `POST` | `/ap/supplier-payments/:id/allocate` | Allocate to bills | STAFF | FR28 |
| `POST` | `/ap/supplier-payments/:id/void` | Void payment | MANAGER | FR28 |
| CRUD | `/ap/bacs-runs` | BACS payment run management | MANAGER | FR29 |
| `POST` | `/ap/bacs-runs/:id/approve` | Approve BACS run | ADMIN | FR29 |
| `POST` | `/ap/bacs-runs/:id/generate-file` | Generate BACS file | MANAGER | FR29 |
| `POST` | `/ap/bacs-runs/:id/submit` | Mark as submitted | MANAGER | FR29 |
| `POST` | `/ap/bacs-runs/:id/complete` | Mark as completed | MANAGER | FR29 |
| `POST` | `/ap/supplier-bills/import-ocr` | Legacy OCR import (redirects to document understanding pipeline) | STAFF | FR32, FR164 |
| `GET` | `/ap/reports/aging` | AP aging report | VIEWER | FR30 |
| `GET` | `/ap/reports/overdue` | Overdue bills | VIEWER | FR30 |
| `GET` | `/ap/reports/purchase-journal` | Purchase day book | VIEWER | FR30 |
| `GET` | `/ap/reports/payment-forecast` | Payment forecast | VIEWER | FR30 |

## 2.11 Sales Management

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/sales/quotes` | Sales quotation management | STAFF | FR33 |
| `GET` | `/sales/quotes/:id/lines` | Quote line items | VIEWER | FR33 |
| `POST` | `/sales/quotes/:id/send` | Send quote to customer | STAFF | FR33 |
| `POST` | `/sales/quotes/:id/accept` | Mark quote as accepted | MANAGER | FR33 |
| `POST` | `/sales/quotes/:id/reject` | Mark quote as rejected | MANAGER | FR33 |
| `POST` | `/sales/quotes/:id/convert-to-order` | Convert quote to sales order | MANAGER | FR34 |
| `POST` | `/sales/quotes/:id/convert-to-invoice` | Convert quote to invoice | MANAGER | FR37 |
| `POST` | `/sales/quotes/:id/revise` | Create revised version | STAFF | FR33 |
| CRUD | `/sales/orders` | Sales order management | STAFF | FR35 |
| `GET` | `/sales/orders/:id/lines` | Order line items | VIEWER | FR35 |
| `POST` | `/sales/orders/:id/approve` | Approve sales order | MANAGER | FR35 |
| `POST` | `/sales/orders/:id/close` | Close sales order | MANAGER | FR35 |
| `POST` | `/sales/orders/:id/cancel` | Cancel sales order | MANAGER | FR35 |
| `GET` | `/sales/orders/:id/stock-check` | Check stock availability | VIEWER | FR38 |
| `POST` | `/sales/orders/:id/reserve-stock` | Reserve stock for order | MANAGER | FR38 |
| `POST` | `/sales/orders/:id/create-dispatch` | Create dispatch from order | STAFF | FR36 |
| `POST` | `/sales/orders/:id/create-invoice` | Create invoice from order | MANAGER | FR37 |
| `POST` | `/sales/orders/:id/create-backorder` | Create backorder for unfulfilled | STAFF | FR38 |
| CRUD | `/sales/dispatches` | Dispatch/shipment management | STAFF | FR36 |
| `GET` | `/sales/dispatches/:id/lines` | Dispatch line items | VIEWER | FR36 |
| `POST` | `/sales/dispatches/:id/ship` | Mark as shipped | STAFF | FR36 |
| `POST` | `/sales/dispatches/:id/cancel` | Cancel dispatch | MANAGER | FR36 |
| CRUD | `/sales/shipping-methods` | Shipping method reference | ADMIN | FR36 |
| `GET` | `/sales/reports/order-book` | Open orders report | VIEWER | FR35 |
| `GET` | `/sales/reports/backorders` | Backorder report | VIEWER | FR35 |
| `GET` | `/sales/reports/dispatch-list` | Dispatch list | VIEWER | FR36 |
| `GET` | `/sales/reports/sales-analysis` | Sales analysis | VIEWER | FR40 |

## 2.12 Purchasing

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `POST` | `/purchasing/reorder-check` | Check items below reorder point | MANAGER | FR44 |
| `POST` | `/purchasing/auto-generate-pos` | Generate POs from reorder suggestions | MANAGER | FR44 |
| `GET` | `/purchasing/reports/purchase-analysis` | Purchase analysis | VIEWER | FR75 |
| `GET` | `/purchasing/reports/supplier-performance` | Supplier performance | VIEWER | FR75 |
| `GET` | `/purchasing/reports/price-comparison` | Price comparison across suppliers | VIEWER | FR75 |
| `POST` | `/purchasing/import` | Import supplier catalogue | MANAGER | FR87 |

## 2.13 Inventory & Stock

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/inventory/items` | Inventory item management | STAFF | FR46 |
| `GET` | `/inventory/items/:id/stock` | Stock by warehouse | VIEWER | FR52 |
| `GET` | `/inventory/items/:id/movements` | Stock movement history | VIEWER | FR48 |
| `GET` | `/inventory/items/:id/availability` | ATP calculation | VIEWER | FR52 |
| `POST` | `/inventory/items/batch` | Batch create/update items | MANAGER | FR46 |
| `POST` | `/inventory/items/import` | Import items from CSV | MANAGER | FR87 |
| `POST` | `/inventory/items/:id/barcode-scan` | Look up item by barcode | STAFF | FR46 |
| `GET` | `/inventory/items/barcode/:code` | Get item by barcode | VIEWER | FR46 |
| CRUD | `/inventory/item-groups` | Item group management | ADMIN | FR47 |
| CRUD | `/inventory/warehouses` | Warehouse management | ADMIN | FR49 |
| CRUD | `/inventory/stock-movements` | Stock movement management | STAFF | FR48 |
| `POST` | `/inventory/stock-movements/:id/post` | Post stock movement | MANAGER | FR48 |
| `POST` | `/inventory/stock-movements/:id/reverse` | Reverse stock movement | MANAGER | FR48 |
| `POST` | `/inventory/stock-movements/batch` | Batch stock movements | MANAGER | FR48 |
| `GET` | `/inventory/stock-balances` | Current stock balances | VIEWER | FR52 |
| `GET` | `/inventory/stock-balances/:itemId/:warehouseId` | Specific balance | VIEWER | FR52 |
| CRUD | `/inventory/serial-numbers` | Serial number tracking | STAFF | FR51 |
| CRUD | `/inventory/units-of-measure` | Unit of measure reference | ADMIN | FR46 |
| `GET` | `/inventory/reports/stock-valuation` | Stock valuation report | VIEWER | FR75 |
| `GET` | `/inventory/reports/reorder-report` | Items below reorder point | VIEWER | FR53 |
| `GET` | `/inventory/reports/movement-summary` | Stock movement summary | VIEWER | FR75 |
| `GET` | `/inventory/reports/slow-moving` | Slow-moving stock report | VIEWER | FR75 |
| `POST` | `/inventory/stock-take` | Initiate stock take | MANAGER | FR50 |
| `PATCH` | `/inventory/stock-take/:id` | Record stock take counts | STAFF | FR50 |
| `POST` | `/inventory/stock-take/:id/post` | Post stock take adjustments | MANAGER | FR50 |

## 2.14 Pricing

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/pricing/price-lists` | Price list management | MANAGER | FR39 |
| `GET` | `/pricing/price-lists/:id/entries` | Price list entries | VIEWER | FR39 |
| `POST` | `/pricing/price-lists/:id/entries` | Add entry to price list | MANAGER | FR39 |
| `PATCH` | `/pricing/price-lists/:id/entries/:entryId` | Update price list entry | MANAGER | FR39 |
| `DELETE` | `/pricing/price-lists/:id/entries/:entryId` | Remove entry | MANAGER | FR39 |
| `GET` | `/pricing/price-lists/:id/entries/:entryId/breaks` | Quantity breaks | VIEWER | FR39 |
| `POST` | `/pricing/price-lists/:id/entries/:entryId/breaks` | Add quantity break | MANAGER | FR39 |
| `POST` | `/pricing/resolve` | Resolve price for item/customer/qty | STAFF | FR39 |
| CRUD | `/pricing/rebates` | Rebate management | MANAGER | FR39 |
| `GET` | `/pricing/rebates/:id/tiers` | Rebate tiers | VIEWER | FR39 |

## 2.15 CRM

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/crm/leads` | Lead management | STAFF | FR56 |
| `POST` | `/crm/leads/:id/convert` | Convert lead to customer | MANAGER | FR56 |
| `PATCH` | `/crm/leads/:id/qualify` | Set qualification/rating | STAFF | FR99 |
| `GET` | `/crm/leads/:id/activities` | Lead activity timeline | VIEWER | FR55 |
| `POST` | `/crm/leads/import` | Bulk import leads | MANAGER | FR87 |
| CRUD | `/crm/opportunities` | Opportunity management | STAFF | FR96 |
| `POST` | `/crm/opportunities/:id/win` | Mark as won | MANAGER | FR96 |
| `POST` | `/crm/opportunities/:id/lose` | Mark as lost | MANAGER | FR96 |
| `POST` | `/crm/opportunities/:id/create-quote` | Create quote from opportunity | STAFF | FR96 |
| `GET` | `/crm/opportunities/:id/stage-history` | Stage change log | VIEWER | FR96 |
| CRUD | `/crm/campaigns` | Campaign management | MANAGER | FR95 |
| `POST` | `/crm/campaigns/:id/activate` | Activate campaign | MANAGER | FR95 |
| `POST` | `/crm/campaigns/:id/complete` | Complete campaign | MANAGER | FR95 |
| `POST` | `/crm/campaigns/:id/cancel` | Cancel campaign | MANAGER | FR95 |
| `GET` | `/crm/campaigns/:id/metrics` | Campaign performance metrics | VIEWER | FR95 |
| `GET` | `/crm/campaigns/:id/recipients` | Campaign recipients | VIEWER | FR95 |
| `POST` | `/crm/campaigns/:id/recipients` | Add recipients | STAFF | FR95 |
| `DELETE` | `/crm/campaigns/:id/recipients/:recipientId` | Remove recipient | STAFF | FR95 |
| `PATCH` | `/crm/campaigns/:id/recipients/:recipientId` | Track response | STAFF | FR95 |
| CRUD | `/crm/pipeline-views` | Pipeline Kanban configuration | MANAGER | FR97 |
| `GET` | `/crm/pipeline-views/:id/data` | Pipeline Kanban data | VIEWER | FR97 |
| `POST` | `/crm/pipeline/drag` | Drag-and-drop state change | STAFF | FR97 |
| `GET` | `/crm/reports/lead-list` | Lead listing report | VIEWER | FR56 |
| `GET` | `/crm/reports/lead-conversion` | Lead conversion report | VIEWER | FR56 |
| `GET` | `/crm/reports/pipeline-forecast` | Pipeline forecast | VIEWER | FR57 |
| `GET` | `/crm/reports/campaign-performance` | Campaign metrics report | VIEWER | FR95 |
| `GET` | `/crm/reports/salesperson-activity` | Salesperson activity report | VIEWER | FR55 |
| CRUD | `/crm/lead-statuses` | Lead status reference | ADMIN | FR56 |
| CRUD | `/crm/lead-sources` | Lead source reference | ADMIN | FR56 |
| CRUD | `/crm/industries` | Industry reference | ADMIN | FR54 |
| CRUD | `/crm/media-types` | Media type reference | ADMIN | FR95 |
| CRUD | `/crm/opportunity-classes` | Opportunity class reference | ADMIN | FR96 |
| CRUD | `/crm/activity-types` | CRM activity type reference | ADMIN | FR100 |
| CRUD | `/crm/activity-auto-rules` | Auto-activity rules | ADMIN | FR98 |
| CRUD | `/crm/module-settings` | CRM module settings | ADMIN | FR83 |

## 2.16 HR & Payroll

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/hr/employees` | Employee management | STAFF | FR59 |
| `GET` | `/hr/employees/:id/contracts` | Employee contracts | VIEWER | FR101 |
| `GET` | `/hr/employees/:id/leave-balances` | Leave balances | VIEWER | FR61 |
| `GET` | `/hr/employees/:id/payslips` | Employee payslips | VIEWER | FR66 |
| `GET` | `/hr/employees/:id/pension` | Pension enrolment | VIEWER | FR65 |
| `GET` | `/hr/employees/:id/statutory-payments` | Statutory payment history | VIEWER | FR67 |
| `POST` | `/hr/employees/import` | Bulk import employees | MANAGER | FR87 |
| CRUD | `/hr/contracts` | Employment contract management | MANAGER | FR101 |
| `POST` | `/hr/contracts/:id/approve` | Approve contract | MANAGER | FR101 |
| `POST` | `/hr/contracts/:id/terminate` | Terminate contract | MANAGER | FR101 |
| `POST` | `/hr/contracts/:id/changes` | Record contract change | MANAGER | FR102 |
| `GET` | `/hr/contracts/:id/changes` | Contract change history | VIEWER | FR102 |
| `GET` | `/hr/contracts/:id/benefits` | Contract benefits | VIEWER | FR107 |
| `POST` | `/hr/contracts/:id/benefits` | Add contract benefit | MANAGER | FR107 |
| CRUD | `/hr/leave-entitlements` | Leave entitlement management | MANAGER | FR61 |
| CRUD | `/hr/leave-requests` | Leave request management | STAFF | FR61 |
| `POST` | `/hr/leave-requests/:id/approve` | Approve leave request | MANAGER | FR61 |
| `POST` | `/hr/leave-requests/:id/reject` | Reject leave request | MANAGER | FR61 |
| `POST` | `/hr/leave-requests/:id/cancel` | Cancel leave request | STAFF | FR61 |
| `GET` | `/hr/leave/calendar` | Team leave calendar | VIEWER | FR61 |
| CRUD | `/hr/checklists` | Onboarding/offboarding checklists | MANAGER | FR108 |
| `PATCH` | `/hr/checklists/:id/items/:itemId` | Update checklist item status | STAFF | FR108 |
| CRUD | `/hr/appraisals` | Performance appraisals | MANAGER | FR103 |
| `POST` | `/hr/appraisals/:id/approve` | Approve appraisal | MANAGER | FR103 |
| CRUD | `/hr/skills-evaluations` | Skills evaluations | MANAGER | FR104 |
| CRUD | `/hr/training-plans` | Training plan management | MANAGER | FR105 |
| CRUD | `/hr/job-positions` | Job position management | ADMIN | FR106 |
| CRUD | `/hr/payroll-runs` | Payroll run management | MANAGER | FR62 |
| `POST` | `/hr/payroll-runs/:id/calculate` | Run payroll calculation | MANAGER | FR62 |
| `POST` | `/hr/payroll-runs/:id/approve` | Approve payroll | ADMIN | FR62 |
| `POST` | `/hr/payroll-runs/:id/post` | Post payroll to GL | ADMIN | FR62 |
| `GET` | `/hr/payroll-runs/:id/lines` | Payroll run lines | VIEWER | FR62 |
| `GET` | `/hr/payroll-runs/:id/summary` | Payroll summary | VIEWER | FR62 |
| `POST` | `/hr/payroll-runs/:id/generate-payslips` | Generate payslip PDFs | MANAGER | FR66 |
| `POST` | `/hr/payroll-runs/:id/generate-bacs` | Generate BACS payment file | MANAGER | FR64 |
| CRUD | `/hr/tax-year-configs` | Tax year HMRC thresholds | ADMIN | FR62 |
| CRUD | `/hr/pension-enrolments` | Pension auto-enrolment | MANAGER | FR65 |
| `POST` | `/hr/pension/assess` | Assess auto-enrolment eligibility | MANAGER | FR65 |
| `POST` | `/hr/hmrc/fps` | Generate and submit FPS | ADMIN | FR63 |
| `POST` | `/hr/hmrc/eps` | Generate and submit EPS | ADMIN | FR63 |
| `GET` | `/hr/hmrc/submissions` | HMRC submission history | VIEWER | FR63 |
| `GET` | `/hr/hmrc/submissions/:id` | Submission detail | VIEWER | FR63 |
| `GET` | `/hr/reports/headcount` | Headcount report | VIEWER | FR76 |
| `GET` | `/hr/reports/payroll-summary` | Payroll summary report | VIEWER | FR76 |
| `GET` | `/hr/reports/leave-summary` | Leave summary report | VIEWER | FR76 |
| `GET` | `/hr/reports/starters-leavers` | Starters/leavers report | VIEWER | FR76 |
| CRUD | `/hr/job-titles` | Job title reference data | ADMIN | FR59 |
| CRUD | `/hr/contract-types` | Contract type reference | ADMIN | FR101 |
| CRUD | `/hr/contract-classes` | Contract class reference | ADMIN | FR101 |
| CRUD | `/hr/benefit-types` | Benefit type reference | ADMIN | FR107 |
| CRUD | `/hr/residency-types` | Residency type reference | ADMIN | FR59 |
| CRUD | `/hr/payment-types` | Payment type reference | ADMIN | FR62 |
| CRUD | `/hr/performance-factors` | Performance factor reference | ADMIN | FR103 |
| CRUD | `/hr/performance-ratings` | Performance rating reference | ADMIN | FR103 |
| CRUD | `/hr/skills` | Skill reference | ADMIN | FR104 |
| CRUD | `/hr/skill-ratings` | Skill rating reference | ADMIN | FR104 |
| CRUD | `/hr/checkpoints` | Checklist checkpoint reference | ADMIN | FR108 |
| CRUD | `/hr/appraisal-categories` | Appraisal category reference | ADMIN | FR103 |

## 2.17 Manufacturing & Production

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/production/recipes` | Recipe/BOM management | MANAGER | FR68 |
| `GET` | `/production/recipes/:id/lines` | Recipe line items | VIEWER | FR68 |
| `POST` | `/production/recipes/:id/lines` | Add recipe line | MANAGER | FR68 |
| `POST` | `/production/recipes/:id/explode` | Explode BOM | VIEWER | FR109 |
| CRUD | `/production/routings` | Routing management | MANAGER | FR69 |
| `GET` | `/production/routings/:id/steps` | Routing steps | VIEWER | FR69 |
| CRUD | `/production/standard-operations` | Standard operation templates | MANAGER | FR69 |
| CRUD | `/production/machines` | Machine register | ADMIN | FR114 |
| `GET` | `/production/machines/:id/shifts` | Machine shifts | VIEWER | FR110 |
| `POST` | `/production/machines/:id/shifts` | Set machine shifts | ADMIN | FR110 |
| CRUD | `/production/machine-groups` | Machine group reference | ADMIN | FR114 |
| CRUD | `/production/production-orders` | Work order management | STAFF | FR69 |
| `GET` | `/production/production-orders/:id/lines` | Work order lines | VIEWER | FR69 |
| `POST` | `/production/production-orders/:id/release` | Release work order | MANAGER | FR69 |
| `POST` | `/production/production-orders/:id/start` | Start production | STAFF | FR69 |
| `POST` | `/production/production-orders/:id/finish` | Finish production | STAFF | FR72 |
| `POST` | `/production/production-orders/:id/cancel` | Cancel work order | MANAGER | FR69 |
| CRUD | `/production/productions` | Production execution records | STAFF | FR71 |
| `POST` | `/production/productions/:id/start` | Start production | STAFF | FR71 |
| `POST` | `/production/productions/:id/finish` | Finish production (post stock) | MANAGER | FR72 |
| `POST` | `/production/productions/:id/cancel` | Cancel production | MANAGER | FR71 |
| CRUD | `/production/production-operations` | Production operations (routed) | STAFF | FR111 |
| `POST` | `/production/production-operations/:id/start` | Start operation | STAFF | FR111 |
| `POST` | `/production/production-operations/:id/finish` | Finish operation | STAFF | FR111 |
| CRUD | `/production/production-plans` | MRP production plans | MANAGER | FR70 |
| `POST` | `/production/production-plans/:id/approve` | Approve plan | ADMIN | FR70 |
| `POST` | `/production/production-plans/:id/generate-orders` | Generate orders from plan | MANAGER | FR70 |
| `GET` | `/production/production-plans/:id/components` | Plan component requirements | VIEWER | FR73 |
| `POST` | `/production/mrp/run` | Run MRP engine | MANAGER | FR113 |
| `GET` | `/production/mrp/suggestions` | Get MRP suggestions | VIEWER | FR113 |
| `GET` | `/production/reports/wip` | Work-in-progress report | VIEWER | FR112 |
| `GET` | `/production/reports/production-journal` | Production journal | VIEWER | FR75 |
| `GET` | `/production/reports/material-usage` | Material usage report | VIEWER | FR71 |
| `GET` | `/production/reports/machine-utilisation` | Machine utilisation | VIEWER | FR114 |
| `GET` | `/production/reports/production-cost` | Production cost analysis | VIEWER | FR112 |
| `GET` | `/production/reports/capacity` | Capacity planning report | VIEWER | FR114 |
| CRUD | `/production/production-classes` | Production class reference | ADMIN | FR68 |

## 2.18 Reporting

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET` | `/reports/definitions` | List available reports | VIEWER | FR74 |
| `POST` | `/reports/generate` | Generate report (async) | VIEWER | FR74 |
| `GET` | `/reports/jobs/:jobId` | Check report job status | VIEWER | FR74 |
| `GET` | `/reports/jobs/:jobId/download` | Download report output | VIEWER | FR74 |
| `GET` | `/reports/dashboard/:dashboardId` | Get dashboard data | VIEWER | FR74 |
| `POST` | `/reports/dashboards` | Create custom dashboard | MANAGER | FR74 |
| `PATCH` | `/reports/dashboards/:id` | Update dashboard | MANAGER | FR74 |
| `POST` | `/reports/schedule` | Schedule recurring report | MANAGER | FR74 |
| `GET` | `/reports/schedules` | List scheduled reports | VIEWER | FR74 |
| `DELETE` | `/reports/schedules/:id` | Cancel scheduled report | MANAGER | FR74 |
| `POST` | `/reports/export` | Export report data | VIEWER | FR78 |
| `GET` | `/reports/kpis` | Get KPI summary | VIEWER | FR74 |
| `GET` | `/reports/kpis/:metric` | Get specific KPI | VIEWER | FR74 |
| `POST` | `/reports/custom-query` | Run custom report query | MANAGER | FR79 |

## 2.19 Fixed Assets (P1)

> **Note:** Fixed asset management is defined in Architecture Section 2.18 but has no dedicated PRD FRs. These endpoints are architecture-driven and will receive FR numbers when the PRD is updated to include fixed asset requirements.

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/assets/groups` | Asset group management | ADMIN | — |
| CRUD | `/assets/classes` | Asset class management | ADMIN | — |
| CRUD | `/assets/depreciation-methods` | Depreciation method reference | ADMIN | — |
| CRUD | `/assets/fixed-assets` | Fixed asset register | STAFF | — |
| `POST` | `/assets/fixed-assets/:id/acquire` | Record asset acquisition | MANAGER | — |
| `POST` | `/assets/depreciation/run` | Run depreciation batch | ADMIN | — |
| `GET` | `/assets/depreciation/:assetId/entries` | Depreciation entries | VIEWER | — |
| `POST` | `/assets/disposals` | Record asset disposal | MANAGER | — |
| `GET` | `/assets/disposals/:id` | Disposal detail | VIEWER | — |
| `POST` | `/assets/transfers` | Transfer asset between departments | MANAGER | — |
| `GET` | `/assets/reports/register` | Asset register report | VIEWER | — |
| `GET` | `/assets/reports/depreciation-schedule` | Depreciation schedule | VIEWER | — |
| `GET` | `/assets/reports/disposal-log` | Disposal log | VIEWER | — |

## 2.20 POS (P2)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/pos/terminals` | Terminal management | ADMIN | FR116 |
| CRUD | `/pos/cash-drawers` | Cash drawer management | ADMIN | FR122 |
| CRUD | `/pos/payment-methods` | Payment method configuration | ADMIN | FR118 |
| CRUD | `/pos/button-layouts` | Button layout configuration | ADMIN | FR120 |
| `POST` | `/pos/sessions/open` | Open POS session | STAFF | FR116 |
| `POST` | `/pos/sessions/:id/close` | Close POS session | STAFF | FR116 |
| `GET` | `/pos/sessions/:id` | Session detail | VIEWER | FR116 |
| `GET` | `/pos/sessions/current` | Get current open session | STAFF | FR116 |
| `POST` | `/pos/sales` | Create new sale | STAFF | FR118 |
| `PATCH` | `/pos/sales/:id` | Update sale (add/remove items) | STAFF | FR118 |
| `POST` | `/pos/sales/:id/add-item` | Add item to sale | STAFF | FR117 |
| `POST` | `/pos/sales/:id/void-item/:lineId` | Void line item | MANAGER | FR118 |
| `POST` | `/pos/sales/:id/payment` | Add payment tender | STAFF | FR118 |
| `POST` | `/pos/sales/:id/complete` | Complete sale | STAFF | FR118 |
| `POST` | `/pos/sales/:id/void` | Void entire sale | MANAGER | FR118 |
| `POST` | `/pos/sales/:id/suspend` | Suspend sale | STAFF | FR118 |
| `POST` | `/pos/sales/:id/resume` | Resume suspended sale | STAFF | FR118 |
| `POST` | `/pos/sales/:id/return` | Process return | MANAGER | FR118 |
| `POST` | `/pos/sales/:id/transfer-to-invoice` | Transfer to AR invoice | MANAGER | FR118 |
| `POST` | `/pos/sales/:id/receipt` | Print/email receipt | STAFF | FR119 |
| `POST` | `/pos/cash-movements` | Record cash in/out | MANAGER | FR122 |
| `POST` | `/pos/cashups` | Create cashup | MANAGER | FR122 |
| `PATCH` | `/pos/cashups/:id` | Update cashup counts | MANAGER | FR122 |
| `POST` | `/pos/cashups/:id/complete` | Complete cashup | MANAGER | FR122 |
| `POST` | `/pos/cashups/:id/post` | Post cashup to GL | MANAGER | FR122 |
| `POST` | `/pos/sync` | Sync queued offline POS transactions | STAFF | FR121 |
| `GET` | `/pos/reports/x-report/:sessionId` | X-report (interim) | STAFF | FR116 |
| `GET` | `/pos/reports/z-report/:sessionId` | Z-report (end-of-day) | MANAGER | FR116 |
| `GET` | `/pos/reports/sales-summary` | POS sales summary | VIEWER | FR75 |

## 2.21 Projects & Job Costing (P2)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/projects/projects` | Project management | MANAGER | FR123 |
| `POST` | `/projects/projects/:id/activate` | Activate project | MANAGER | FR123 |
| `POST` | `/projects/projects/:id/complete` | Complete project | MANAGER | FR123 |
| `POST` | `/projects/projects/:id/hold` | Put on hold | MANAGER | FR123 |
| `GET` | `/projects/projects/:id/profitability` | Project profitability | VIEWER | FR128 |
| CRUD | `/projects/projects/:id/tasks` | Project task management | STAFF | FR123 |
| `GET` | `/projects/projects/:id/transactions` | Project transactions | VIEWER | FR126 |
| CRUD | `/projects/projects/:id/budgets` | Project budget management | MANAGER | FR123 |
| CRUD | `/projects/projects/:id/rate-cards` | Project rate cards | MANAGER | FR127 |
| CRUD | `/projects/timesheets` | Timesheet management | STAFF | FR124 |
| `POST` | `/projects/timesheets/:id/submit` | Submit timesheet | STAFF | FR124 |
| `POST` | `/projects/timesheets/:id/approve` | Approve timesheet | MANAGER | FR124 |
| `POST` | `/projects/timesheets/:id/reject` | Reject timesheet | MANAGER | FR124 |
| `GET` | `/projects/timesheets/:id/entries` | Timesheet entries | VIEWER | FR124 |
| `POST` | `/projects/timesheets/:id/entries` | Add timesheet entry | STAFF | FR124 |
| CRUD | `/projects/expenses` | Project expense management | STAFF | FR125 |
| `POST` | `/projects/expenses/:id/submit` | Submit expense | STAFF | FR125 |
| `POST` | `/projects/expenses/:id/approve` | Approve expense | MANAGER | FR125 |
| `POST` | `/projects/projects/:id/create-invoice` | Generate project invoice | MANAGER | FR127 |
| `GET` | `/projects/reports/project-list` | Project listing | VIEWER | FR123 |
| `GET` | `/projects/reports/time-analysis` | Time analysis report | VIEWER | FR124 |
| `GET` | `/projects/reports/profitability` | Profitability report | VIEWER | FR128 |
| `GET` | `/projects/reports/utilisation` | Resource utilisation | VIEWER | FR129 |

## 2.22 Contracts & Agreements (P2)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/contracts/agreements` | Rental agreement management | MANAGER | FR130 |
| `GET` | `/contracts/agreements/:id/lines` | Agreement line items | VIEWER | FR130 |
| `POST` | `/contracts/agreements/:id/activate` | Activate agreement | MANAGER | FR130 |
| `POST` | `/contracts/agreements/:id/close` | Close agreement | MANAGER | FR130 |
| `POST` | `/contracts/agreements/:id/generate-charges` | Generate period charges | MANAGER | FR131 |
| `POST` | `/contracts/agreements/:id/generate-invoice` | Generate invoice from charges | MANAGER | FR131 |
| `GET` | `/contracts/agreements/:id/charges` | List charges | VIEWER | FR131 |
| CRUD | `/contracts/agreements/types` | Agreement type reference | ADMIN | FR130 |
| CRUD | `/contracts/off-hires` | Off-hire (return) management | STAFF | FR130 |
| `POST` | `/contracts/off-hires/:id/confirm` | Confirm off-hire | MANAGER | FR130 |
| CRUD | `/contracts/contracts` | Standard contract management | MANAGER | FR130 |
| `GET` | `/contracts/contracts/:id/lines` | Contract line items | VIEWER | FR130 |
| `POST` | `/contracts/contracts/:id/activate` | Activate contract | MANAGER | FR130 |
| `POST` | `/contracts/contracts/:id/renew` | Renew contract | MANAGER | FR132 |
| `POST` | `/contracts/contracts/:id/cancel` | Cancel contract | MANAGER | FR132 |
| `POST` | `/contracts/contracts/batch-invoice` | Batch invoice due contracts | MANAGER | FR131 |
| `POST` | `/contracts/contracts/batch-renew` | Batch renew expiring contracts | MANAGER | FR132 |
| CRUD | `/contracts/contract-classes` | Contract class reference | ADMIN | FR130 |
| CRUD | `/contracts/loans` | Loan agreement management | MANAGER | FR133 |
| `GET` | `/contracts/loans/:id/schedule` | Loan repayment schedule | VIEWER | FR133 |
| `POST` | `/contracts/loans/:id/approve` | Approve loan | ADMIN | FR133 |
| `POST` | `/contracts/loans/:id/sign` | Mark as signed (generate schedule) | MANAGER | FR133 |
| `POST` | `/contracts/loans/:id/activate` | Activate loan | MANAGER | FR133 |
| `POST` | `/contracts/loans/:id/disburse` | Record disbursement | MANAGER | FR133 |
| CRUD | `/contracts/loan-types` | Loan type reference | ADMIN | FR133 |

## 2.23 Warehouse Management (P2)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/warehouse/wms-configs` | WMS configuration per warehouse | ADMIN | FR135 |
| CRUD | `/warehouse/zones` | Warehouse zone management | ADMIN | FR135 |
| CRUD | `/warehouse/groups` | Warehouse group reference | ADMIN | FR135 |
| CRUD | `/warehouse/bin-positions` | Bin/shelf position management | MANAGER | FR135 |
| `GET` | `/warehouse/bin-positions/:id/stock` | Stock at position | VIEWER | FR135 |
| `GET` | `/warehouse/position-stock` | Position stock ledger | VIEWER | FR135 |
| `GET` | `/warehouse/position-stock/:itemId` | Item positions | VIEWER | FR135 |
| CRUD | `/warehouse/picking-lists` | Picking list management | STAFF | FR136 |
| `POST` | `/warehouse/picking-lists/:id/start` | Start picking | STAFF | FR136 |
| `POST` | `/warehouse/picking-lists/:id/complete` | Complete picking | STAFF | FR136 |
| `PATCH` | `/warehouse/picking-lists/:id/lines/:lineId` | Record pick | STAFF | FR136 |
| CRUD | `/warehouse/forklifts` | Forklift register | ADMIN | FR138 |
| CRUD | `/warehouse/forklift-tasks` | Forklift task queue | STAFF | FR138 |
| `POST` | `/warehouse/forklift-tasks/:id/assign` | Assign to forklift | MANAGER | FR138 |
| `POST` | `/warehouse/forklift-tasks/:id/complete` | Complete task | STAFF | FR138 |
| `GET` | `/warehouse/reports/position-stock-report` | Position stock report | VIEWER | FR139 |
| `GET` | `/warehouse/reports/picking-performance` | Picking performance | VIEWER | FR140 |

## 2.24 Intercompany & Consolidation (P2/P3)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/intercompany/rules` | Intercompany transaction rules | ADMIN | FR141 |
| `GET` | `/intercompany/transactions` | List intercompany transactions | VIEWER | FR141 |
| `GET` | `/intercompany/transactions/:id` | Transaction detail (saga state) | VIEWER | FR141 |
| `POST` | `/intercompany/transactions/:id/retry` | Retry failed transaction | ADMIN | FR141 |
| `POST` | `/intercompany/transactions/:id/compensate` | Compensate (reverse) | ADMIN | FR141 |
| CRUD | `/consolidation/groups` | Consolidation group management | ADMIN | FR143 |
| CRUD | `/consolidation/groups/:id/members` | Group member management | ADMIN | FR143 |
| CRUD | `/consolidation/groups/:id/exchange-rates` | Consolidation FX rates | ADMIN | FR144 |
| CRUD | `/consolidation/account-maps` | Account mapping for consolidation | ADMIN | FR143 |
| `POST` | `/consolidation/runs` | Execute consolidation run | ADMIN | FR143 |
| `GET` | `/consolidation/runs/:id` | Consolidation run status | VIEWER | FR143 |
| `GET` | `/consolidation/reports/balance-sheet` | Consolidated balance sheet | VIEWER | FR143 |
| `GET` | `/consolidation/reports/profit-and-loss` | Consolidated P&L | VIEWER | FR143 |
| CRUD | `/consolidation/elimination-templates` | Elimination templates | ADMIN | FR142 |
| `POST` | `/consolidation/elimination-templates/:id/execute` | Execute elimination | ADMIN | FR142 |

## 2.25 Communications

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `GET` | `/chat/channels` | List chat channels | STAFF | FR145 |
| `POST` | `/chat/channels` | Create group channel | STAFF | FR145 |
| `GET` | `/chat/channels/:id/messages` | Get channel messages | STAFF | FR145 |
| `POST` | `/chat/channels/:id/messages` | Send message | STAFF | FR145 |
| `PATCH` | `/chat/channels/:id/messages/:msgId` | Edit message | STAFF | FR145 |
| `DELETE` | `/chat/channels/:id/messages/:msgId` | Soft-delete message | STAFF | FR145 |
| `POST` | `/chat/channels/:id/read` | Mark as read | STAFF | FR145 |
| `WS` | `/chat/ws` | WebSocket for real-time chat | STAFF | FR145 |
| `GET` | `/chat/channels/:id/participants` | Channel participants | STAFF | FR145 |
| `POST` | `/chat/channels/:id/participants` | Add participant | STAFF | FR145 |
| CRUD | `/email/messages` | Email message management | STAFF | FR146 |
| `POST` | `/email/messages/:id/send` | Send email | STAFF | FR146 |
| `GET` | `/email/inbox` | User inbox | STAFF | FR146 |
| `PATCH` | `/email/messages/:id/read` | Mark as read/unread | STAFF | FR146 |
| `DELETE` | `/email/messages/:id` | Archive/delete email | STAFF | FR146 |
| CRUD | `/email/templates` | Email template management | ADMIN | FR146 |
| CRUD | `/email/aliases` | Email alias management | ADMIN | FR146 |
| `GET` | `/email/signatures` | Get user email signature | STAFF | FR146 |
| `PUT` | `/email/signatures` | Set user email signature | STAFF | FR146 |
| CRUD | `/conference/rooms` | Conference room management | MANAGER | FR145 |
| `GET` | `/conference/rooms/:id/messages` | Conference messages | VIEWER | FR145 |
| `POST` | `/conference/rooms/:id/messages` | Post to conference | STAFF | FR145 |
| `GET` | `/conference/rooms/:id/access` | Room access rules | MANAGER | FR145 |
| `POST` | `/conference/rooms/:id/access` | Grant access | MANAGER | FR145 |
| `GET` | `/notifications` | List notifications | STAFF | FR145 |
| `PATCH` | `/notifications/:id/read` | Mark notification as read | STAFF | FR145 |
| `POST` | `/notifications/:id/dismiss` | Dismiss notification | STAFF | FR145 |
| `GET` | `/notifications/preferences` | Get notification prefs | STAFF | FR145 |
| `PUT` | `/notifications/preferences` | Update notification prefs | STAFF | FR145 |

## 2.26 Service Orders & Timekeeper

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| CRUD | `/service/orders` | Service order management | STAFF | FR149 |
| `GET` | `/service/orders/:id/lines` | Service order lines | VIEWER | FR149 |
| `POST` | `/service/orders/:id/open` | Open service order | MANAGER | FR149 |
| `POST` | `/service/orders/:id/complete` | Complete service order | MANAGER | FR149 |
| `POST` | `/service/orders/:id/invoice` | Generate invoice from SVO | MANAGER | FR152 |
| `POST` | `/service/orders/:id/cancel` | Cancel service order | MANAGER | FR149 |
| CRUD | `/service/work-orders` | Work order management | STAFF | FR149 |
| `POST` | `/service/work-orders/:id/start` | Start work order | STAFF | FR149 |
| `POST` | `/service/work-orders/:id/close` | Close work order | STAFF | FR149 |
| CRUD | `/service/work-sheets` | Work sheet management | STAFF | FR149 |
| `POST` | `/service/work-sheets/:id/submit` | Submit work sheet | STAFF | FR149 |
| `POST` | `/service/work-sheets/:id/approve` | Approve work sheet | MANAGER | FR149 |
| `POST` | `/service/work-sheets/:id/invoice` | Invoice from work sheet | MANAGER | FR152 |
| CRUD | `/service/known-serial-numbers` | Known serial number registry | STAFF | FR150 |
| `GET` | `/service/known-serial-numbers/lookup` | Lookup by serial number | VIEWER | FR150 |
| `GET` | `/service/known-serial-numbers/:id/warranty-check` | Check warranty status | VIEWER | FR150 |
| CRUD | `/service/fault-codes` | Fault code reference | ADMIN | FR149 |
| CRUD | `/service/fault-code-modifiers` | Fault code modifier reference | ADMIN | FR149 |
| CRUD | `/timekeeper/target-times` | Target time management | MANAGER | FR151 |
| `POST` | `/timekeeper/clock-in` | Clock in (create activity) | STAFF | FR151 |
| `POST` | `/timekeeper/clock-out` | Clock out (close activity) | STAFF | FR151 |
| `GET` | `/timekeeper/status` | Current clock status | STAFF | FR151 |
| `GET` | `/timekeeper/reports/attendance` | Attendance report | MANAGER | FR151 |
| `GET` | `/timekeeper/reports/variance` | Hours variance report | MANAGER | FR151 |

## 2.27 Document Understanding (MVP)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `POST` | `/documents/ingest` | Upload a financial document for AI extraction | STAFF | FR164 |
| `POST` | `/documents/ingest/email` | Webhook for email-forwarded documents | STAFF | FR164 |
| `GET` | `/documents/ingestions` | List document ingestions with status | VIEWER | FR164 |
| `GET` | `/documents/ingestions/:id` | Get ingestion details with extraction result | VIEWER | FR165 |
| `POST` | `/documents/ingestions/:id/reprocess` | Re-run extraction on a document | STAFF | FR165 |
| `POST` | `/documents/ingestions/:id/approve` | Approve extracted record and post | MANAGER | FR167 |
| `POST` | `/documents/ingestions/:id/reject` | Reject an extraction | STAFF | FR167 |
| `PATCH` | `/documents/ingestions/:id/corrections` | Submit field corrections before approval | STAFF | FR167 |
| `GET` | `/documents/ingestions/:id/preview` | Get original document preview (presigned URL) | VIEWER | FR168 |
| `GET` | `/documents/supplier-profiles` | List supplier extraction profiles | VIEWER | FR167 |
| `GET` | `/documents/supplier-profiles/:supplierId` | Get extraction profile for a supplier | VIEWER | FR167 |

## 2.28 Document Knowledge Base (Phase 2)

| Method | Path | Description | Min Role | FR |
|--------|------|-------------|----------|-----|
| `POST` | `/knowledge/documents` | Upload a company document for indexing | ADMIN | FR169 |
| `GET` | `/knowledge/documents` | List indexed company documents | VIEWER | FR169 |
| `DELETE` | `/knowledge/documents/:id` | Remove a document from knowledge base | ADMIN | FR169 |
| `POST` | `/knowledge/query` | Ask a question about company policies/procedures | STAFF | FR170 |

---
