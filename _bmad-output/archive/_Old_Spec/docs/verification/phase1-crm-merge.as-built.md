# Phase1 CRM Merge — As-Built Inventory

## UI routes (apps/web/app)
- (app)/crm/accounts/page.tsx
- (app)/crm/accounts/[id]/page.tsx
- (app)/crm/contacts/page.tsx
- (app)/crm/contacts/[id]/page.tsx
- (app)/crm/leads/page.tsx
- (app)/crm/leads/[id]/page.tsx
- (app)/crm/opportunities/page.tsx
- (app)/crm/opportunities/[id]/page.tsx
- (app)/crm/quotes/page.tsx
- (app)/crm/quotes/[id]/page.tsx
- (app)/crm/activities/page.tsx
- (app)/crm/price-books/page.tsx
- (app)/crm/price-books/[id]/page.tsx
- (app)/sales/page.tsx
- (app)/sales/customers/page.tsx
- (app)/sales/leads/page.tsx
- (app)/sales/opportunities/page.tsx
- (app)/sales/quotes/page.tsx
- (app)/sales/orders/page.tsx
- (app)/sales/orders/OrdersList.tsx

## API routes (apps/web/app/api)
- crm/accounts/route.ts
- crm/activities/route.ts
- crm/leads/[id]/cancel/route.ts
- crm/opportunities/route.ts
- crm/opportunities/[id]/reopen/route.ts
- crm/price-books/route.ts
- crm/quotes/route.ts
- crm/quotes/[id]/approve/route.ts
- crm/quotes/[id]/cancel/route.ts
- crm/quotes/[id]/supersede/route.ts
- sales/order/create/route.ts
- sales/order/deliver/route.ts
- sales/orders/route.ts
- sales/credit/create/route.ts
- sales/reports/margin/route.ts
- sales/invoice/from-order/route.ts
- integrations/crm/status/route.ts (integration status)
- pos/sales/route.ts (POS sales endpoint)

## Server modules (apps/web/src/server)
- crm/accounts.ts
- crm/activities.ts
- crm/contacts.ts
- crm/pipelines.ts
- crm/__tests__/scaffold.spec.ts
- erp/crmContacts.ts
- erp/crmLeads.ts
- erp/salesOrders.ts
- pos/sales.ts (POS sales)
- ai/context/crmContext.ts (context helper)
