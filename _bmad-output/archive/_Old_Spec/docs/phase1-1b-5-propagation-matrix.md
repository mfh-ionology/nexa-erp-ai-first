# Propagation Matrix (Phase 1.1b-5)

Propagation represents the explicit event contracts emitted by mutating API routes. Each rule ties a route to the events it emits, along with consistency and idempotency expectations.

| ruleId | module | route | writes | requiredEmits | consistency | idempotency | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _TEST__POST___TEST_SET_ROLE | _test | POST /api/_test/set-role |  | _test.set_role.created | eventual | required=false; key=null |  |
| ADMIN__DELETE__ADMIN_SUPPORT_SESSION | admin | DELETE /api/admin/support/session |  | admin.session.deleted | eventual | required=false; key=null |  |
| ADMIN__PATCH__ADMIN_TENANTS_ID | admin | PATCH /api/admin/tenants/[id] |  | admin.tenants.updated | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_ALERTS_BILLING_WARNING | admin | POST /api/admin/alerts/billing-warning |  | admin.billing_warning.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_BACKUPS_RESTORE_DRY_RUN | admin | POST /api/admin/backups/restore-dry-run |  | admin.restore_dry_run.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_BACKUPS_RUN | admin | POST /api/admin/backups/run |  | admin.run.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_BILLING_STATE | admin | POST /api/admin/billing/state |  | admin.state.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_INTEGRATIONS_SANDBOX | admin | POST /api/admin/integrations/sandbox |  | admin.sandbox.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_INTEGRATIONS_SYNC | admin | POST /api/admin/integrations/sync |  | admin.sync.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_INVITE | admin | POST /api/admin/invite |  | admin.invite.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_KEYS_PROVISION | admin | POST /api/admin/keys/provision |  | admin.provision.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_KEYS_ROTATE | admin | POST /api/admin/keys/rotate |  | admin.rotate.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_SETTINGS_MODULES | admin | POST /api/admin/settings/modules |  | admin.modules.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_SUPPORT_SESSION | admin | POST /api/admin/support/session |  | admin.session.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_USERS_ACCESS | admin | POST /api/admin/users/access |  | admin.access.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_USERS_CREATE | admin | POST /api/admin/users/create |  | admin.create.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_USERS_DELETE | admin | POST /api/admin/users/delete |  | admin.delete.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_USERS_FORCE_LOGOUT | admin | POST /api/admin/users/force-logout |  | admin.force_logout.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_USERS_ROLE | admin | POST /api/admin/users/role |  | admin.role.created | eventual | required=false; key=null |  |
| ADMIN__POST__ADMIN_USERS_UPDATE | admin | POST /api/admin/users/update |  | admin.update.created | eventual | required=false; key=null |  |
| AI__POST__AI_AGENT | ai | POST /api/ai/agent |  | ai.agent.created | eventual | required=false; key=null |  |
| AI__POST__AI_ASK | ai | POST /api/ai/ask |  | ai.ask.created | eventual | required=false; key=null |  |
| AI__POST__AI_EXECUTE | ai | POST /api/ai/execute |  | ai.execute.created | eventual | required=false; key=null |  |
| AI__POST__AI_FINANCE_INVOICES_INSIGHT | ai | POST /api/ai/finance/invoices-insight |  | ai.invoices_insight.created | eventual | required=false; key=null |  |
| AI__POST__AI_MODULE_INSIGHT | ai | POST /api/ai/module-insight |  | ai.module_insight.created | eventual | required=false; key=null |  |
| AI__POST__AI_QUERY | ai | POST /api/ai/query |  | ai.query.created | eventual | required=false; key=null |  |
| ATTACHMENTS__DELETE__ATTACHMENTS | attachments | DELETE /api/attachments |  | attachments.attachments.deleted | eventual | required=false; key=null |  |
| ATTACHMENTS__PATCH__ATTACHMENTS | attachments | PATCH /api/attachments |  | attachments.attachments.updated | eventual | required=false; key=null |  |
| ATTACHMENTS__POST__ATTACHMENTS | attachments | POST /api/attachments |  | attachments.attachments.created | eventual | required=false; key=null |  |
| ATTACHMENTS__POST__ATTACHMENTS_UPLOAD | attachments | POST /api/attachments/upload |  | attachments.upload.created | eventual | required=false; key=null |  |
| AUTH__POST__AUTH_FORGOT_PASSWORD | auth | POST /api/auth/forgot-password |  | auth.forgot_password.created | eventual | required=false; key=null |  |
| AUTH__POST__AUTH_RESET_PASSWORD | auth | POST /api/auth/reset-password |  | auth.reset_password.created | eventual | required=false; key=null |  |
| AUTH__POST__AUTH_RESET_TEMP_PASSWORD | auth | POST /api/auth/reset-temp-password |  | auth.reset_temp_password.created | eventual | required=false; key=null |  |
| BANKING__POST__BANKING_ACCOUNTS | banking | POST /api/banking/accounts |  | banking.accounts.created | eventual | required=false; key=null |  |
| BANKING__POST__BANKING_RECONCILE | banking | POST /api/banking/reconcile |  | banking.reconcile.created | eventual | required=false; key=null |  |
| BANKING__POST__BANKING_STATEMENTS_IMPORT | banking | POST /api/banking/statements/import |  | banking.import.created | eventual | required=false; key=null |  |
| BILLING__POST__BILLING_CHECKOUT | billing | POST /api/billing/checkout |  | billing.checkout.created | eventual | required=false; key=null |  |
| BILLING__POST__BILLING_PORTAL | billing | POST /api/billing/portal |  | billing.portal.created | eventual | required=false; key=null |  |
| BILLING__POST__BILLING_RECONCILE | billing | POST /api/billing/reconcile |  | billing.reconcile.created | eventual | required=false; key=null |  |
| CHAT__POST__CHAT_SIGNAL | chat | POST /api/chat/signal |  | chat.signal.created | eventual | required=false; key=null |  |
| COMPLIANCE__POST__COMPLIANCE_DELETE | compliance | POST /api/compliance/delete |  | compliance.delete.created | eventual | required=false; key=null |  |
| COMPLIANCE__POST__COMPLIANCE_EXPORT | compliance | POST /api/compliance/export |  | compliance.export.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_ACCOUNTS | crm | POST /api/crm/accounts |  | crm.accounts.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_ACTIVITIES | crm | POST /api/crm/activities |  | crm.activities.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_LEADS_ID_CANCEL | crm | POST /api/crm/leads/[id]/cancel |  | crm.cancel.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_OPPORTUNITIES | crm | POST /api/crm/opportunities |  | crm.opportunities.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_OPPORTUNITIES_ID_REOPEN | crm | POST /api/crm/opportunities/[id]/reopen |  | crm.reopen.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_PRICE_BOOKS | crm | POST /api/crm/price-books |  | crm.price_books.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_QUOTES | crm | POST /api/crm/quotes |  | crm.quotes.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_QUOTES_ID_APPROVE | crm | POST /api/crm/quotes/[id]/approve |  | crm.approve.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_QUOTES_ID_CANCEL | crm | POST /api/crm/quotes/[id]/cancel |  | crm.cancel.created | eventual | required=false; key=null |  |
| CRM__POST__CRM_QUOTES_ID_SUPERSEDE | crm | POST /api/crm/quotes/[id]/supersede |  | crm.supersede.created | eventual | required=false; key=null |  |
| CUSTOM__POST__CUSTOM_FIELDS | custom | POST /api/custom/fields |  | custom.fields.created | eventual | required=false; key=null |  |
| CUSTOM__POST__CUSTOM_VALUES | custom | POST /api/custom/values |  | custom.values.created | eventual | required=false; key=null |  |
| DEV__POST__DEV_EMAIL_SEND | dev | POST /api/dev/email/send |  | dev.send.created | eventual | required=false; key=null |  |
| DIAG__POST__DIAG_ADD_USER | diag | POST /api/diag/add-user |  | diag.add_user.created | eventual | required=false; key=null |  |
| EXPORT__POST__EXPORT_CUSTOMERS | export | POST /api/export/customers |  | export.customers.created | eventual | required=false; key=null |  |
| EXPORT__POST__EXPORT_ITEMS | export | POST /api/export/items |  | export.items.created | eventual | required=false; key=null |  |
| EXPORT__POST__EXPORT_SUPPLIERS | export | POST /api/export/suppliers |  | export.suppliers.created | eventual | required=false; key=null |  |
| FINANCE__PATCH__FINANCE_AP_BILLS_UPDATE | finance | PATCH /api/finance/ap/bills/update |  | finance.update.updated | eventual | required=false; key=null |  |
| FINANCE__PATCH__FINANCE_AR_INVOICES_UPDATE | finance | PATCH /api/finance/ar/invoices/update |  | finance.update.updated | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AP_BILL_CREATE | finance | POST /api/finance/ap/bill/create |  | finance.create.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AP_BILLS_BILLID_CREDIT | finance | POST /api/finance/ap/bills/[billId]/credit |  | finance.credit.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AP_BILLS_CREATE | finance | POST /api/finance/ap/bills/create |  | finance.create.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AP_PAYMENT_RECORD | finance | POST /api/finance/ap/payment/record |  | finance.record.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AP_PAYMENTS_CREATE | finance | POST /api/finance/ap/payments/create |  | finance.create.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AP_PAYMENTS_PAYMENTID_REVERSE | finance | POST /api/finance/ap/payments/[paymentId]/reverse |  | finance.reverse.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_CREDIT_NOTE_CREATE | finance | POST /api/finance/ar/credit-note/create |  | finance.create.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_INVOICE_APPROVE | finance | POST /api/finance/ar/invoice/approve |  | finance.approve.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_INVOICE_CREATE | finance | POST /api/finance/ar/invoice/create |  | finance.create.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_INVOICE_PAY | finance | POST /api/finance/ar/invoice/pay |  | finance.pay.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_INVOICE_WRITEOFF | finance | POST /api/finance/ar/invoice/writeoff |  | finance.writeoff.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_INVOICES_INVOICEID_CREDIT | finance | POST /api/finance/ar/invoices/[invoiceId]/credit |  | finance.credit.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_PAYMENTS_PAYMENTID_REVERSE | finance | POST /api/finance/ar/payments/[paymentId]/reverse |  | finance.reverse.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_RECEIPT_RECORD | finance | POST /api/finance/ar/receipt/record |  | finance.record.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_AR_RECEIPTS_CREATE | finance | POST /api/finance/ar/receipts/create |  | finance.create.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_ASSETS | finance | POST /api/finance/assets |  | finance.assets.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_ASSETS_DEPRECIATE | finance | POST /api/finance/assets/depreciate |  | finance.depreciate.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_ASSETS_ID_DISPOSE | finance | POST /api/finance/assets/[id]/dispose |  | finance.dispose.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_CLOSE_LOCK | finance | POST /api/finance/close/lock |  | finance.lock.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_CLOSE_OPEN | finance | POST /api/finance/close/open |  | finance.open.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_FA_ACQUIRE | finance | POST /api/finance/fa/acquire |  | finance.acquire.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_FA_DEPRECIATE | finance | POST /api/finance/fa/depreciate |  | finance.depreciate.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_FA_DISPOSE | finance | POST /api/finance/fa/dispose |  | finance.dispose.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_FA_REVALUE | finance | POST /api/finance/fa/revalue |  | finance.revalue.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_FX_REVALUE | finance | POST /api/finance/fx/revalue |  | finance.revalue.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_GL_POST | finance | POST /api/finance/gl/post |  | finance.post.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_GL_REVERSE | finance | POST /api/finance/gl/reverse |  | finance.reverse.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_JOURNALS_JOURNALID_REVERSE | finance | POST /api/finance/journals/[journalId]/reverse |  | finance.reverse.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_PERIODS_CLOSE | finance | POST /api/finance/periods/close |  | finance.close.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_PERIODS_OPEN | finance | POST /api/finance/periods/open |  | finance.open.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_VAT_CODES | finance | POST /api/finance/vat/codes |  | finance.codes.created | eventual | required=false; key=null |  |
| FINANCE__POST__FINANCE_VAT_SUBMIT | finance | POST /api/finance/vat/submit |  | finance.submit.created | eventual | required=false; key=null |  |
| FINANCE__PUT__FINANCE_ASSETS_ID | finance | PUT /api/finance/assets/[id] |  | finance.assets.updated | eventual | required=false; key=null |  |
| HEALTHCARE__POST__HEALTHCARE_ROTA | healthcare | POST /api/healthcare/rota |  | healthcare.rota.created | eventual | required=false; key=null |  |
| HR__PATCH__HR_EMPLOYEES_ID | hr | PATCH /api/hr/employees/[id] |  | hr.employees.updated | eventual | required=false; key=null |  |
| HR__PATCH__HR_PAYROLL_CONFIG | hr | PATCH /api/hr/payroll/config |  | hr.config.updated | eventual | required=false; key=null |  |
| HR__POST__HR_EMPLOYEES_CREATE | hr | POST /api/hr/employees/create |  | hr.create.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_ENTITLEMENTS | hr | POST /api/hr/leave/entitlements |  | hr.entitlements.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_ID_ADJUST | hr | POST /api/hr/leave/[id]/adjust |  | hr.adjust.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_ID_CANCEL | hr | POST /api/hr/leave/[id]/cancel |  | hr.cancel.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_REQUESTS | hr | POST /api/hr/leave/requests |  | hr.requests.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_APPROVE | hr | POST /api/hr/leave/requests/[id]/approve |  | hr.approve.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_CANCEL | hr | POST /api/hr/leave/requests/[id]/cancel |  | hr.cancel.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_REJECT | hr | POST /api/hr/leave/requests/[id]/reject |  | hr.reject.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_SUBMIT | hr | POST /api/hr/leave/requests/[id]/submit |  | hr.submit.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_TAKEN | hr | POST /api/hr/leave/requests/[id]/taken |  | hr.taken.created | eventual | required=false; key=null |  |
| HR__POST__HR_LEAVE_TYPES | hr | POST /api/hr/leave/types |  | hr.types.created | eventual | required=false; key=null |  |
| HR__POST__HR_PAYROLL_RUN | hr | POST /api/hr/payroll/run |  | hr.run.created | eventual | required=false; key=null |  |
| HR__POST__HR_PAYROLL_RUN_ID_ADJUST | hr | POST /api/hr/payroll/run/[id]/adjust |  | hr.adjust.created | eventual | required=false; key=null |  |
| HR__POST__HR_PAYROLL_RUN_ID_REVERSE | hr | POST /api/hr/payroll/run/[id]/reverse |  | hr.reverse.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_COMMIT | import | POST /api/import/commit |  | import.commit.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_CUSTOMERS | import | POST /api/import/customers |  | import.customers.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_CUSTOMERS_APPLY | import | POST /api/import/customers/apply |  | import.apply.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_CUSTOMERS_PREVIEW | import | POST /api/import/customers/preview |  | import.preview.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_ITEMS | import | POST /api/import/items |  | import.items.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_PREVIEW | import | POST /api/import/preview |  | import.preview.created | eventual | required=false; key=null |  |
| IMPORT__POST__IMPORT_SUPPLIERS | import | POST /api/import/suppliers |  | import.suppliers.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_ADJUST | inventory | POST /api/inventory/adjust |  | inventory.adjust.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_ADJUSTMENTS | inventory | POST /api/inventory/adjustments |  | inventory.adjustments.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_CYCLE | inventory | POST /api/inventory/cycle |  | inventory.cycle.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_CYCLE_ID_COUNT | inventory | POST /api/inventory/cycle/[id]/count |  | inventory.count.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_CYCLE_ID_POST | inventory | POST /api/inventory/cycle/[id]/post |  | inventory.post.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_GRN | inventory | POST /api/inventory/grn |  | inventory.grn.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_ISSUE | inventory | POST /api/inventory/issue |  | inventory.issue.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_ITEMS_CREATE | inventory | POST /api/inventory/items/create |  | inventory.create.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_ITEMS_DELETE | inventory | POST /api/inventory/items/delete |  | inventory.delete.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_ITEMS_UPDATE | inventory | POST /api/inventory/items/update |  | inventory.update.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_MOVEMENTS_MOVEMENTID_REVERSE | inventory | POST /api/inventory/movements/[movementId]/reverse |  | inventory.reverse.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_TRANSFER | inventory | POST /api/inventory/transfer |  | inventory.transfer.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_WAREHOUSES_CREATE | inventory | POST /api/inventory/warehouses/create |  | inventory.create.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_WAREHOUSES_UPDATE | inventory | POST /api/inventory/warehouses/update |  | inventory.update.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_WMS_RECEIVING_GRN | inventory | POST /api/inventory/wms/receiving/grn |  | inventory.grn.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_WMS_RECEIVING_PUTAWAY | inventory | POST /api/inventory/wms/receiving/putaway |  | inventory.putaway.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_WMS_SHIPPING_PICK | inventory | POST /api/inventory/wms/shipping/pick |  | inventory.pick.created | eventual | required=false; key=null |  |
| INVENTORY__POST__INVENTORY_WMS_SHIPPING_SHIP | inventory | POST /api/inventory/wms/shipping/ship |  | inventory.ship.created | eventual | required=false; key=null |  |
| INVITE__POST__INVITE_ACCEPT | invite | POST /api/invite/accept |  | invite.accept.created | eventual | required=false; key=null |  |
| JOBS__POST__JOBS_RETRY | jobs | POST /api/jobs/retry |  | jobs.retry.created | eventual | required=false; key=null |  |
| MANUFACTURING__DELETE__MANUFACTURING_BOMS | manufacturing | DELETE /api/manufacturing/boms |  | manufacturing.boms.deleted | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_BOM_ITEMS | manufacturing | POST /api/manufacturing/bom/items |  | manufacturing.items.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_BOM_ITEMS_DELETE | manufacturing | POST /api/manufacturing/bom/items/delete |  | manufacturing.delete.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_BOMS | manufacturing | POST /api/manufacturing/boms |  | manufacturing.boms.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_COST_ROLLUP | manufacturing | POST /api/manufacturing/cost/rollup |  | manufacturing.rollup.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_MRP_FIRM | manufacturing | POST /api/manufacturing/mrp/firm |  | manufacturing.firm.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_MRP_RUN | manufacturing | POST /api/manufacturing/mrp/run |  | manufacturing.run.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WO_CLOSE | manufacturing | POST /api/manufacturing/wo/close |  | manufacturing.close.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WO_COMPLETE | manufacturing | POST /api/manufacturing/wo/complete |  | manufacturing.complete.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WO_CONSUME | manufacturing | POST /api/manufacturing/wo/consume |  | manufacturing.consume.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WO_RELEASE | manufacturing | POST /api/manufacturing/wo/release |  | manufacturing.release.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WO_SCRAP | manufacturing | POST /api/manufacturing/wo/scrap |  | manufacturing.scrap.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS | manufacturing | POST /api/manufacturing/work-orders |  | manufacturing.work_orders.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_COMPLETE | manufacturing | POST /api/manufacturing/work-orders/[id]/complete |  | manufacturing.complete.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_CONSUME | manufacturing | POST /api/manufacturing/work-orders/[id]/consume |  | manufacturing.consume.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_RELEASE | manufacturing | POST /api/manufacturing/work-orders/[id]/release |  | manufacturing.release.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_REVERSE_COMPLETION | manufacturing | POST /api/manufacturing/work-orders/[id]/reverse-completion |  | manufacturing.reverse_completion.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_REVERSE_CONSUMPTION | manufacturing | POST /api/manufacturing/work-orders/[id]/reverse-consumption |  | manufacturing.reverse_consumption.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_SCRAP | manufacturing | POST /api/manufacturing/work-orders/[id]/scrap |  | manufacturing.scrap.created | eventual | required=false; key=null |  |
| MANUFACTURING__POST__MANUFACTURING_WORKORDER_CONSUME_BOM | manufacturing | POST /api/manufacturing/workorder/consume-bom |  | manufacturing.consume_bom.created | eventual | required=false; key=null |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_JOBS_PAYROLL_RUN_TS | core | NON_ROUTE apps/web/src/jobs/payroll/run.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_ACCESS_STORE_TS | core | NON_ROUTE apps/web/src/lib/access/store.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_ACCESS_TENANTCONFIG_TS | core | NON_ROUTE apps/web/src/lib/access/tenantConfig.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_AI_LOGGING_TS | core | NON_ROUTE apps/web/src/lib/ai/logging.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_BILLING_PLANS_TS | core | NON_ROUTE apps/web/src/lib/billing/plans.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_CRYPTO___TESTS___FIELD_ENCRYPTION_TEST_TS | core | NON_ROUTE apps/web/src/lib/crypto/__tests__/field-encryption.test.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_CRYPTO_ENCRYPTION_TS | core | NON_ROUTE apps/web/src/lib/crypto/encryption.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_EMAIL___TESTS___MAILER_TEST_TS | core | NON_ROUTE apps/web/src/lib/email/__tests__/mailer.test.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_EMAIL_MAILER_TS | core | NON_ROUTE apps/web/src/lib/email/mailer.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_HR_EMPLOYEES_ENCRYPTED_TS | core | NON_ROUTE apps/web/src/lib/hr/employees-encrypted.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_INTEGRATIONS_SYNC_ORCHESTRATOR_TS | core | NON_ROUTE apps/web/src/lib/integrations/sync-orchestrator.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_KPI_SERVICE_TS | core | NON_ROUTE apps/web/src/lib/kpi/service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_LOG_MASK_TS | core | NON_ROUTE apps/web/src/lib/log/mask.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_OBSERVABILITY_AUDIT_TS | core | NON_ROUTE apps/web/src/lib/observability/audit.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_OBSERVABILITY_OBSERVABILITY_AUDIT_TS | core | NON_ROUTE apps/web/src/lib/observability/observability/audit.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_POS_INVENTORY_TS | core | NON_ROUTE apps/web/src/lib/pos/inventory.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_PRISMA_TYPES_TS | core | NON_ROUTE apps/web/src/lib/prisma-types.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_PROFILE_PREFS_TS | core | NON_ROUTE apps/web/src/lib/profile/prefs.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_SUPPLY_REPLENISHMENTSTORE_TS | core | NON_ROUTE apps/web/src/lib/supply/replenishmentStore.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_TENANT_WIZARD_GUARD_TS | core | NON_ROUTE apps/web/src/lib/tenant/wizard-guard.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_ACCOUNTS_TS | core | NON_ROUTE apps/web/src/server/_crm.before-restore/accounts.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_ACTIVITIES_TS | core | NON_ROUTE apps/web/src/server/_crm.before-restore/activities.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_CONTACTS_TS | core | NON_ROUTE apps/web/src/server/_crm.before-restore/contacts.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_PIPELINES_TS | core | NON_ROUTE apps/web/src/server/_crm.before-restore/pipelines.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_BILLING_TS | core | NON_ROUTE apps/web/src/server/_projects.before-restore/billing.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_COSTS_TS | core | NON_ROUTE apps/web/src/server/_projects.before-restore/costs.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROFITABILITY_TS | core | NON_ROUTE apps/web/src/server/_projects.before-restore/profitability.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROJECTS_TS | core | NON_ROUTE apps/web/src/server/_projects.before-restore/projects.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_RETAINERS_TS | core | NON_ROUTE apps/web/src/server/_projects.before-restore/retainers.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_TIMESHEETS_TS | core | NON_ROUTE apps/web/src/server/_projects.before-restore/timesheets.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_AI_TENANT_ANALYTICS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/ai/tenant-analytics.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_AUTH_ONBOARDING_SERVICE_TS | core | NON_ROUTE apps/web/src/server/auth/onboarding.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_BILLING_STATUS_TS | core | NON_ROUTE apps/web/src/server/billing/status.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_COSTING_COST_TS | core | NON_ROUTE apps/web/src/server/costing/cost.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_ACCOUNTS_TS | core | NON_ROUTE apps/web/src/server/crm/accounts.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_ACTIVITIES_TS | core | NON_ROUTE apps/web/src/server/crm/activities.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_CONTACTS_TS | core | NON_ROUTE apps/web/src/server/crm/contacts.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_PIPELINES_TS | core | NON_ROUTE apps/web/src/server/crm/pipelines.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EMAIL_EMAIL_LOG_SERVICE_TS | core | NON_ROUTE apps/web/src/server/email/email-log.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_FINANCEINVOICES_TS | core | NON_ROUTE apps/web/src/server/erp/financeInvoices.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_INVENTORYITEMS_TS | core | NON_ROUTE apps/web/src/server/erp/inventoryItems.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_PROFILEAI_TS | core | NON_ROUTE apps/web/src/server/erp/profileAi.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_PURCHASINGPO_TS | core | NON_ROUTE apps/web/src/server/erp/purchasingPo.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_SALESORDERS_TS | core | NON_ROUTE apps/web/src/server/erp/salesOrders.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EVENTS_OUTBOXREPOSITORY_TS | core | NON_ROUTE apps/web/src/server/events/outboxRepository.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EVENTS_SUBSCRIBERS_INDEX_TS | core | NON_ROUTE apps/web/src/server/events/subscribers/index.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_AP_TS | core | NON_ROUTE apps/web/src/server/finance/ap.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_ASSETS_TS | core | NON_ROUTE apps/web/src/server/finance/assets.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_BANKING_TS | core | NON_ROUTE apps/web/src/server/finance/banking.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_GL_TS | core | NON_ROUTE apps/web/src/server/finance/gl.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_LIFECYCLE_TS | core | NON_ROUTE apps/web/src/server/finance/lifecycle.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_PERIODCLOSE_TS | core | NON_ROUTE apps/web/src/server/finance/periodClose.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_VAT_TS | core | NON_ROUTE apps/web/src/server/finance/vat.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_EMPLOYEES_SERVICE_TS | core | NON_ROUTE apps/web/src/server/hr/employees.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_LEAVE_SERVICE_TS | core | NON_ROUTE apps/web/src/server/hr/leave.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_LEAVECONFIG_SERVICE_TS | core | NON_ROUTE apps/web/src/server/hr/leaveConfig.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLCONFIG_SERVICE_TS | core | NON_ROUTE apps/web/src/server/hr/payrollConfig.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLRUN_SERVICE_TS | core | NON_ROUTE apps/web/src/server/hr/payrollRun.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORT_EXPORT_MASTERDATA_TS | core | NON_ROUTE apps/web/src/server/import-export/masterData.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORTS_MASTERDATA_TS | core | NON_ROUTE apps/web/src/server/imports/masterData.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_CORRECTIONS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/inventory/corrections.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_COSTING_SERVICE_TS | core | NON_ROUTE apps/web/src/server/inventory/costing.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_GRN_TS | core | NON_ROUTE apps/web/src/server/inventory/grn.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_ITEMS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/inventory/items.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_MOVEMENTS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/inventory/movements.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSRECEIVING_SERVICE_TS | core | NON_ROUTE apps/web/src/server/inventory/wmsReceiving.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSSHIPPING_SERVICE_TS | core | NON_ROUTE apps/web/src/server/inventory/wmsShipping.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_CORE_SERVICE_TS | core | NON_ROUTE apps/web/src/server/manufacturing/core.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_WORKORDER_TS | core | NON_ROUTE apps/web/src/server/manufacturing/workorder.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_METRICS_STORE_TS | core | NON_ROUTE apps/web/src/server/metrics/store.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_NOTIFICATIONS_CHAT_NOTIFICATIONS_TS | core | NON_ROUTE apps/web/src/server/notifications/chat-notifications.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_NOTIFICATIONS_CONFIG_TS | core | NON_ROUTE apps/web/src/server/notifications/config.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SALES_TS | core | NON_ROUTE apps/web/src/server/pos/sales.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SESSIONS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/pos/sessions.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_PRESETS_REPOSITORY_TS | core | NON_ROUTE apps/web/src/server/presets/repository.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_PROJECTS_COSTS_TS | core | NON_ROUTE apps/web/src/server/projects/costs.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_AI_CONFIG_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/ai-config.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_COMPLIANCE_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/compliance.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_INTEGRATIONS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/integrations.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_OPS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/ops.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_SECURITY_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/security.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_TENANTS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/tenants.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_USERS_SERVICE_TS | core | NON_ROUTE apps/web/src/server/super-admin/users.service.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__APPS_WEB_SRC_TESTS_SEED_SEED_ALIGNMENT_TEST_TS | core | NON_ROUTE apps/web/src/tests/seed/seed-alignment.test.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__PACKAGES_JOBS_SRC_INDEX_TS | core | NON_ROUTE packages/jobs/src/index.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_E2E_CREATE_USER_TS | core | NON_ROUTE scripts/e2e-create-user.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_ENSURE_ADMIN_CJS | core | NON_ROUTE scripts/ensure-admin.cjs |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEED_DEMO_TENANT_TS | core | NON_ROUTE scripts/seed_demo_tenant.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEED_KPI_JS | core | NON_ROUTE scripts/seed-kpi.js |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEED_KPI_TS | core | NON_ROUTE scripts/seed-kpi.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEED_USERS_CJS | core | NON_ROUTE scripts/seed-users.cjs |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEED_USERS_TABLE_TS | core | NON_ROUTE scripts/seed_users_table.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE4_TS | core | NON_ROUTE scripts/seeds/seed-phase4.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE5_TS | core | NON_ROUTE scripts/seeds/seed-phase5.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE7_TS | core | NON_ROUTE scripts/seeds/seed-phase7.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASEA_TS | core | NON_ROUTE scripts/seeds/seed-phaseA.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_SET_DEMO_PASSWORD_TS | core | NON_ROUTE scripts/set_demo_password.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_TENANCY_BACKFILL_MASTER_TENANT_TS | core | NON_ROUTE scripts/tenancy/backfill-master-tenant.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| NON_ROUTE__WRITE__SCRIPTS_TENANCY_CREATE_DEMO_TENANT_TS | core | NON_ROUTE scripts/tenancy/create-demo-tenant.ts |  | core.write.updated | strong | required=false; key=null | Prisma write entrypoint not reachable from API routes |
| PLANNING__POST__PLANNING_BUDGETS | planning | POST /api/planning/budgets |  | planning.budgets.created | eventual | required=false; key=null |  |
| PLANNING__POST__PLANNING_FORECAST | planning | POST /api/planning/forecast |  | planning.forecast.created | eventual | required=false; key=null |  |
| POS__POST__POS_REFUND_CREATE | pos | POST /api/pos/refund/create |  | pos.create.created | eventual | required=false; key=null |  |
| POS__POST__POS_REFUND_FINALISE | pos | POST /api/pos/refund/finalise |  | pos.finalise.created | eventual | required=false; key=null |  |
| POS__POST__POS_SALE_CREATE | pos | POST /api/pos/sale/create |  | pos.create.created | eventual | required=false; key=null |  |
| POS__POST__POS_SALE_FINALISE | pos | POST /api/pos/sale/finalise |  | pos.finalise.created | eventual | required=false; key=null |  |
| POS__POST__POS_SALE_SALEID_VOID | pos | POST /api/pos/sale/[saleId]/void |  | pos.void.created | eventual | required=false; key=null |  |
| POS__POST__POS_SALE_UPDATE | pos | POST /api/pos/sale/update |  | pos.update.created | eventual | required=false; key=null |  |
| POS__POST__POS_SALES | pos | POST /api/pos/sales |  | pos.sales.created | eventual | required=false; key=null |  |
| POS__POST__POS_SESSIONS_CLOSE | pos | POST /api/pos/sessions/close |  | pos.close.created | eventual | required=false; key=null |  |
| POS__POST__POS_SESSIONS_OPEN | pos | POST /api/pos/sessions/open |  | pos.open.created | eventual | required=false; key=null |  |
| POS__POST__POS_SHIFTS | pos | POST /api/pos/shifts |  | pos.shifts.created | eventual | required=false; key=null |  |
| POS__POST__POS_SHIFTS_CLOSE | pos | POST /api/pos/shifts/close |  | pos.close.created | eventual | required=false; key=null |  |
| POS__POST__POS_SHIFTS_OPEN | pos | POST /api/pos/shifts/open |  | pos.open.created | eventual | required=false; key=null |  |
| PRESETS__POST__PRESETS | presets | POST /api/presets |  | presets.presets.created | eventual | required=false; key=null |  |
| PROFILE__POST__PROFILE_PREFERENCES | profile | POST /api/profile/preferences |  | profile.preferences.created | eventual | required=false; key=null |  |
| PROFILE__POST__PROFILE_THEME_GENERATE | profile | POST /api/profile/theme/generate |  | profile.generate.created | eventual | required=false; key=null |  |
| PROJECTS__POST__PROJECTS_BILLING_EXPORT | projects | POST /api/projects/billing/export |  | projects.export.created | eventual | required=false; key=null |  |
| PROJECTS__POST__PROJECTS_TIMESHEETS | projects | POST /api/projects/timesheets |  | projects.timesheets.created | eventual | required=false; key=null |  |
| PROJECTS__POST__PROJECTS_TIMESHEETS_APPROVE | projects | POST /api/projects/timesheets/approve |  | projects.approve.created | eventual | required=false; key=null |  |
| PROJECTS__POST__PROJECTS_TIMESHEETS_ROLLUP | projects | POST /api/projects/timesheets/rollup |  | projects.rollup.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_BILL_FROM_PO | purchasing | POST /api/purchasing/bill/from-po |  | purchasing.from_po.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_CONTRACTS | purchasing | POST /api/purchasing/contracts |  | purchasing.contracts.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_GRN_POST | purchasing | POST /api/purchasing/grn/post |  | purchasing.post.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_PO_APPROVE | purchasing | POST /api/purchasing/po/approve |  | purchasing.approve.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_RFQ | purchasing | POST /api/purchasing/rfq |  | purchasing.rfq.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_RFQ_ID_AWARD | purchasing | POST /api/purchasing/rfq/[id]/award |  | purchasing.award.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_RFQ_ID_RESPOND | purchasing | POST /api/purchasing/rfq/[id]/respond |  | purchasing.respond.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_SUPPLIERS_CREATE | purchasing | POST /api/purchasing/suppliers/create |  | purchasing.create.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_SUPPLIERS_DELETE | purchasing | POST /api/purchasing/suppliers/delete |  | purchasing.delete.created | eventual | required=false; key=null |  |
| PURCHASING__POST__PURCHASING_SUPPLIERS_UPDATE | purchasing | POST /api/purchasing/suppliers/update |  | purchasing.update.created | eventual | required=false; key=null |  |
| QUALITY__POST__QUALITY_HOLDS | quality | POST /api/quality/holds |  | quality.holds.created | eventual | required=false; key=null |  |
| QUALITY__POST__QUALITY_HOLDS_ID_RELEASE | quality | POST /api/quality/holds/[id]/release |  | quality.release.created | eventual | required=false; key=null |  |
| QUALITY__POST__QUALITY_INSPECTIONS | quality | POST /api/quality/inspections |  | quality.inspections.created | eventual | required=false; key=null |  |
| QUALITY__POST__QUALITY_INSPECTIONS_ID_UPDATE | quality | POST /api/quality/inspections/[id]/update |  | quality.update.created | eventual | required=false; key=null |  |
| REPORTS__DELETE__REPORTS_SCHEDULE | reports | DELETE /api/reports/schedule |  | reports.schedule.deleted | eventual | required=false; key=null |  |
| REPORTS__POST__REPORTS_SCHEDULE | reports | POST /api/reports/schedule |  | reports.schedule.created | eventual | required=false; key=null |  |
| REPORTS__POST__REPORTS_SEND_NOW | reports | POST /api/reports/send-now |  | reports.send_now.created | eventual | required=false; key=null |  |
| SALES__POST__SALES_CREDIT_CREATE | sales | POST /api/sales/credit/create |  | sales.create.created | eventual | required=false; key=null |  |
| SALES__POST__SALES_INVOICE_FROM_ORDER | sales | POST /api/sales/invoice/from-order |  | sales.from_order.created | eventual | required=false; key=null |  |
| SALES__POST__SALES_ORDER_CREATE | sales | POST /api/sales/order/create |  | sales.create.created | eventual | required=false; key=null |  |
| SALES__POST__SALES_ORDER_DELIVER | sales | POST /api/sales/order/deliver |  | sales.deliver.created | eventual | required=false; key=null |  |
| STRIPE__POST__STRIPE_WEBHOOK | stripe | POST /api/stripe/webhook |  | stripe.webhook.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_INTEGRATIONS_ID | super-admin | DELETE /api/super-admin/integrations/[id] |  | super-admin.integrations.deleted | eventual | required=false; key=null |  |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_TENANTS_TENANTID | super-admin | DELETE /api/super-admin/tenants/[tenantId] |  | super-admin.tenants.deleted | eventual | required=false; key=null |  |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_USERS_USERID | super-admin | DELETE /api/super-admin/users/[userId] |  | super-admin.users.deleted | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_AI_CONFIG | super-admin | PATCH /api/super-admin/ai/config |  | super-admin.config.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_BILLING_PLAN_TEMPLATES_ID | super-admin | PATCH /api/super-admin/billing/plan-templates/[id] |  | super-admin.plan_templates.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_COMPLIANCE_CONFIG | super-admin | PATCH /api/super-admin/compliance/config |  | super-admin.config.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_INTEGRATIONS_ID | super-admin | PATCH /api/super-admin/integrations/[id] |  | super-admin.integrations.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_OPS_RUNBOOKS_ID | super-admin | PATCH /api/super-admin/ops/runbooks/[id] |  | super-admin.runbooks.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_SECURITY_POLICIES | super-admin | PATCH /api/super-admin/security/policies |  | super-admin.policies.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID | super-admin | PATCH /api/super-admin/tenants/[tenantId] |  | super-admin.tenants.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID_BILLING | super-admin | PATCH /api/super-admin/tenants/[tenantId]/billing |  | super-admin.billing.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_USERS_USERID | super-admin | PATCH /api/super-admin/users/[userId] |  | super-admin.users.updated | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING | super-admin | POST /api/super-admin/billing |  | super-admin.billing.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING_PLAN_TEMPLATES | super-admin | POST /api/super-admin/billing/plan-templates |  | super-admin.plan_templates.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING_PLANS | super-admin | POST /api/super-admin/billing/plans |  | super-admin.plans.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_COMPLIANCE_EXPORT_SNAPSHOT | super-admin | POST /api/super-admin/compliance/export-snapshot |  | super-admin.export_snapshot.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_COMPLIANCE_RUN_CHECK | super-admin | POST /api/super-admin/compliance/run-check |  | super-admin.run_check.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_INTEGRATIONS | super-admin | POST /api/super-admin/integrations |  | super-admin.integrations.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_NOTIFICATIONS_CONFIG | super-admin | POST /api/super-admin/notifications/config |  | super-admin.config.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_OPS_RUNBOOKS | super-admin | POST /api/super-admin/ops/runbooks |  | super-admin.runbooks.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_TENANTS | super-admin | POST /api/super-admin/tenants |  | super-admin.tenants.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_TENANTS_CREATE | super-admin | POST /api/super-admin/tenants/create |  | super-admin.create.created | eventual | required=false; key=null |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_USERS | super-admin | POST /api/super-admin/users |  | super-admin.users.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_PACK_WAVEID | supply | POST /api/supply/pack/[waveId] |  | supply.pack.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_PICK_CREATE_WAVE | supply | POST /api/supply/pick/create-wave |  | supply.create_wave.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_PICK_TASKID_COMPLETE | supply | POST /api/supply/pick/[taskId]/complete |  | supply.complete.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_PICK_WAVES_WAVEID_ASSIGN_TASK | supply | POST /api/supply/pick/waves/[waveId]/assign-task |  | supply.assign_task.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_REPLENISHMENT_APPLY | supply | POST /api/supply/replenishment/apply |  | supply.apply.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_REPLENISHMENT_RULES | supply | POST /api/supply/replenishment/rules |  | supply.rules.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_RMA | supply | POST /api/supply/rma |  | supply.rma.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_RMA_ID_PROCESS | supply | POST /api/supply/rma/[id]/process |  | supply.process.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_RMA_ID_UPDATE | supply | POST /api/supply/rma/[id]/update |  | supply.update.created | eventual | required=false; key=null |  |
| SUPPLY__POST__SUPPLY_SHIP_WAVEID | supply | POST /api/supply/ship/[waveId] |  | supply.ship.created | eventual | required=false; key=null |  |
| TENANT__POST__TENANT_DELETE | tenant | POST /api/tenant/delete |  | tenant.delete.created | eventual | required=false; key=null |  |
| TENANT__POST__TENANT_EXPORT | tenant | POST /api/tenant/export |  | tenant.export.created | eventual | required=false; key=null |  |
| TENANT__POST__TENANT_SETUP_COMPLETE | tenant | POST /api/tenant/setup/complete |  | tenant.complete.created | eventual | required=false; key=null |  |
| TENANT__POST__TENANT_USERS_UPDATE | tenant | POST /api/tenant/users/update |  | tenant.update.created | eventual | required=false; key=null |  |
| TEST__POST__TEST_SET_ROLE | test | POST /api/test/set-role |  | test.set_role.created | eventual | required=false; key=null |  |
| WORKFLOW__POST__WORKFLOW_DEFINITIONS | workflow | POST /api/workflow/definitions |  | workflow.definitions.created | eventual | required=false; key=null |  |
| WORKFLOW__POST__WORKFLOW_INSTANCES_ID_APPROVE | workflow | POST /api/workflow/instances/[id]/approve |  | workflow.approve.created | eventual | required=false; key=null |  |
| WORKFLOW__POST__WORKFLOW_INSTANCES_ID_REJECT | workflow | POST /api/workflow/instances/[id]/reject |  | workflow.reject.created | eventual | required=false; key=null |  |

