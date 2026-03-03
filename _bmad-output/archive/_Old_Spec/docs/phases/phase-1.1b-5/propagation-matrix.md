# Phase 1.1b-5 Propagation Matrix

Producers: 338 • Consumers: 11 • Edges: 385

Each row reflects an as-built producer discovered from the codebase with its emitted events, downstream consumers, idempotency strategy, and invariants.

| id | module | entity | action | route/file | emits | consumers | idempotency | invariants | tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _TEST__POST___TEST_SET_ROLE | _test | set_role | created | POST /api/_test/set-role | _test.set_role.created |  | required=false; key=null | env-guard<br>local-host-only |  |
| ADMIN__DELETE__ADMIN_SUPPORT_SESSION | admin | session | created | DELETE /api/admin/support/session | admin.session.created<br>admin.session.deleted | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| ADMIN__PATCH__ADMIN_TENANTS_ID | admin | tenants | updated | PATCH /api/admin/tenants/[id] | admin.tenants.updated |  | required=false; key=null | input-validation<br>prisma-write<br>session-auth<br>tenant-scope |  |
| ADMIN__POST__ADMIN_ALERTS_BILLING_WARNING | admin | billing_warning | created | POST /api/admin/alerts/billing-warning | admin.billing_warning.created |  | required=false; key=null | prisma-write<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_BACKUPS_RESTORE_DRY_RUN | admin | restore_dry_run | created | POST /api/admin/backups/restore-dry-run | admin.restore_dry_run.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_BACKUPS_RUN | admin | run | created | POST /api/admin/backups/run | admin.run.created | observability.audit (direct-call) | required=true; key=backup:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_BILLING_STATE | admin | state | created | POST /api/admin/billing/state | admin.state.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rbac<br>session-auth |  |
| ADMIN__POST__ADMIN_INTEGRATIONS_SANDBOX | admin | sandbox | created | POST /api/admin/integrations/sandbox | admin.sandbox.created |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write<br>rbac |  |
| ADMIN__POST__ADMIN_INTEGRATIONS_SYNC | admin | sync | created | POST /api/admin/integrations/sync | admin.sync.created |  | required=false; key=null | input-validation<br>rbac |  |
| ADMIN__POST__ADMIN_INVITE | admin | invite | created | POST /api/admin/invite | admin.invite.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_KEYS_PROVISION | admin | provision | created | POST /api/admin/keys/provision | admin.provision.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_KEYS_ROTATE | admin | rotate | created | POST /api/admin/keys/rotate | admin.rotate.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_SETTINGS_MODULES | admin | modules | created | POST /api/admin/settings/modules | admin.modules.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_SUPPORT_SESSION | admin | session | created | POST /api/admin/support/session | admin.session.created<br>admin.session.deleted | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_USERS_ACCESS | admin | access | created | POST /api/admin/users/access | admin.access.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_USERS_CREATE | admin | create | created | POST /api/admin/users/create | admin.create.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rbac |  |
| ADMIN__POST__ADMIN_USERS_DELETE | admin | delete | created | POST /api/admin/users/delete | admin.delete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac |  |
| ADMIN__POST__ADMIN_USERS_FORCE_LOGOUT | admin | force_logout | created | POST /api/admin/users/force-logout | admin.force_logout.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac |  |
| ADMIN__POST__ADMIN_USERS_ROLE | admin | role | created | POST /api/admin/users/role | admin.role.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| ADMIN__POST__ADMIN_USERS_UPDATE | admin | update | created | POST /api/admin/users/update | admin.update.created | dashboards.tenant (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac |  |
| AI__POST__AI_AGENT | ai | agent | created | POST /api/ai/agent | ai.agent.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| AI__POST__AI_ASK | ai | ask | created | POST /api/ai/ask | ai.ask.created | observability.audit (direct-call) | required=false; key=null | ai-service<br>audit-log<br>input-validation<br>prisma-write<br>session-auth<br>tenant-scope |  |
| AI__POST__AI_EXECUTE | ai | execute | created | POST /api/ai/execute | ai.execute.created |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write |  |
| AI__POST__AI_FINANCE_INVOICES_INSIGHT | ai | invoices_insight | created | POST /api/ai/finance/invoices-insight | ai.invoices_insight.created |  | required=false; key=null | ai-service<br>session-auth |  |
| AI__POST__AI_MODULE_INSIGHT | ai | module_insight | created | POST /api/ai/module-insight | ai.module_insight.created |  | required=false; key=null | ai-service<br>session-auth |  |
| AI__POST__AI_QUERY | ai | query | created | POST /api/ai/query | ai.query.created | observability.audit (direct-call) | required=false; key=null | ai-service<br>audit-log<br>rate-limit<br>session-auth |  |
| ATTACHMENTS__DELETE__ATTACHMENTS | attachments | attachments | created | DELETE /api/attachments | attachments.attachments.created<br>attachments.attachments.deleted<br>attachments.attachments.updated |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| ATTACHMENTS__PATCH__ATTACHMENTS | attachments | attachments | created | PATCH /api/attachments | attachments.attachments.created<br>attachments.attachments.deleted<br>attachments.attachments.updated |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| ATTACHMENTS__POST__ATTACHMENTS | attachments | attachments | created | POST /api/attachments | attachments.attachments.created<br>attachments.attachments.deleted<br>attachments.attachments.updated |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| ATTACHMENTS__POST__ATTACHMENTS_UPLOAD | attachments | upload | created | POST /api/attachments/upload | attachments.upload.created |  | required=false; key=null | rate-limit<br>rbac<br>tenant-scope |  |
| AUTH__POST__AUTH_FORGOT_PASSWORD | auth | forgot_password | created | POST /api/auth/forgot-password | auth.forgot_password.created |  | required=false; key=null | prisma-write |  |
| AUTH__POST__AUTH_RESET_PASSWORD | auth | reset_password | created | POST /api/auth/reset-password | auth.reset_password.created |  | required=false; key=null | input-validation<br>prisma-write |  |
| AUTH__POST__AUTH_RESET_TEMP_PASSWORD | auth | reset_temp_password | created | POST /api/auth/reset-temp-password | auth.reset_temp_password.created |  | required=false; key=null | prisma-write<br>session-auth |  |
| BANKING__POST__BANKING_ACCOUNTS | banking | accounts | created | POST /api/banking/accounts | banking.accounts.created |  | required=false; key=null | rbac<br>tenant-scope |  |
| BANKING__POST__BANKING_RECONCILE | banking | reconcile | created | POST /api/banking/reconcile | banking.reconcile.created | observability.audit (direct-call) | required=true; key=bankrec:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| BANKING__POST__BANKING_STATEMENTS_IMPORT | banking | import | created | POST /api/banking/statements/import | banking.import.created | observability.audit (direct-call) | required=true; key=bankimp:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| BILLING__POST__BILLING_CHECKOUT | billing | checkout | created | POST /api/billing/checkout | billing.checkout.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| BILLING__POST__BILLING_PORTAL | billing | portal | created | POST /api/billing/portal | billing.portal.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rbac<br>tenant-scope |  |
| BILLING__POST__BILLING_RECONCILE | billing | reconcile | created | POST /api/billing/reconcile | billing.reconcile.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write<br>rbac |  |
| CHAT__POST__CHAT_SIGNAL | chat | signal | created | POST /api/chat/signal | chat.signal.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| COMPLIANCE__POST__COMPLIANCE_DELETE | compliance | delete | created | POST /api/compliance/delete | compliance.delete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| COMPLIANCE__POST__COMPLIANCE_EXPORT | compliance | export | created | POST /api/compliance/export | compliance.export.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_ACCOUNTS | crm | accounts | created | POST /api/crm/accounts | crm.accounts.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_ACTIVITIES | crm | activities | created | POST /api/crm/activities | crm.activities.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_LEADS_ID_CANCEL | crm | cancel | created | POST /api/crm/leads/[id]/cancel | crm.cancel.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_OPPORTUNITIES | crm | opportunities | created | POST /api/crm/opportunities | crm.opportunities.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_OPPORTUNITIES_ID_REOPEN | crm | reopen | created | POST /api/crm/opportunities/[id]/reopen | crm.reopen.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_PRICE_BOOKS | crm | price_books | created | POST /api/crm/price-books | crm.price_books.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_QUOTES | crm | quotes | created | POST /api/crm/quotes | crm.quotes.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_QUOTES_ID_APPROVE | crm | approve | created | POST /api/crm/quotes/[id]/approve | crm.approve.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_QUOTES_ID_CANCEL | crm | cancel | created | POST /api/crm/quotes/[id]/cancel | crm.cancel.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CRM__POST__CRM_QUOTES_ID_SUPERSEDE | crm | supersede | created | POST /api/crm/quotes/[id]/supersede | crm.supersede.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CUSTOM__POST__CUSTOM_FIELDS | custom | fields | created | POST /api/custom/fields | custom.fields.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| CUSTOM__POST__CUSTOM_VALUES | custom | values | created | POST /api/custom/values | custom.values.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| DEV__POST__DEV_EMAIL_SEND | dev | send | created | POST /api/dev/email/send | dev.send.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| DIAG__POST__DIAG_ADD_USER | diag | add_user | created | POST /api/diag/add-user | diag.add_user.created |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write<br>rbac |  |
| EXPORT__POST__EXPORT_CUSTOMERS | export | customers | created | POST /api/export/customers | export.customers.created |  | required=false; key=null | rbac |  |
| EXPORT__POST__EXPORT_ITEMS | export | items | created | POST /api/export/items | export.items.created |  | required=false; key=null | rbac |  |
| EXPORT__POST__EXPORT_SUPPLIERS | export | suppliers | created | POST /api/export/suppliers | export.suppliers.created |  | required=false; key=null | rbac |  |
| FINANCE__PATCH__FINANCE_AP_BILLS_UPDATE | finance | update | updated | PATCH /api/finance/ap/bills/update | finance.update.updated |  | required=true; key=ap:bill:update:${tenantId}:${idk} | idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__PATCH__FINANCE_AR_INVOICES_UPDATE | finance | update | updated | PATCH /api/finance/ar/invoices/update | finance.update.updated | observability.audit (direct-call) | required=true; key=ar:inv:update:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AP_BILL_CREATE | finance | create | created | POST /api/finance/ap/bill/create | finance.create.created | observability.audit (direct-call) | required=true; key=apbill:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AP_BILLS_BILLID_CREDIT | finance | credit | created | POST /api/finance/ap/bills/[billId]/credit | finance.credit.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AP_BILLS_CREATE | finance | create | created | POST /api/finance/ap/bills/create | finance.create.created |  | required=true; key=ap:bill:create:${tenantId}:${idk} | idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AP_PAYMENT_RECORD | finance | record | created | POST /api/finance/ap/payment/record | finance.record.created |  | required=true; key=appay:${tenantId}:${idk} | idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AP_PAYMENTS_CREATE | finance | create | created | POST /api/finance/ap/payments/create | finance.create.created |  | required=true; key=ap:pay:create:${tenantId}:${idk} | idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AP_PAYMENTS_PAYMENTID_REVERSE | finance | reverse | created | POST /api/finance/ap/payments/[paymentId]/reverse | finance.reverse.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_CREDIT_NOTE_CREATE | finance | create | created | POST /api/finance/ar/credit-note/create | finance.create.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_INVOICE_APPROVE | finance | approve | created | POST /api/finance/ar/invoice/approve | finance.approve.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_INVOICE_CREATE | finance | create | created | POST /api/finance/ar/invoice/create | finance.create.created | observability.audit (direct-call) | required=true; key=arinv:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>invoice-totals-check<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_INVOICE_PAY | finance | pay | created | POST /api/finance/ar/invoice/pay | finance.pay.created | metrics.counter (direct-call) | required=false; key=null | idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_INVOICE_WRITEOFF | finance | writeoff | created | POST /api/finance/ar/invoice/writeoff | finance.writeoff.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_INVOICES_INVOICEID_CREDIT | finance | credit | created | POST /api/finance/ar/invoices/[invoiceId]/credit | finance.credit.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_PAYMENTS_PAYMENTID_REVERSE | finance | reverse | created | POST /api/finance/ar/payments/[paymentId]/reverse | finance.reverse.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_RECEIPT_RECORD | finance | record | created | POST /api/finance/ar/receipt/record | finance.record.created |  | required=true; key=arrecv:${tenantId}:${idk} | idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_AR_RECEIPTS_CREATE | finance | create | created | POST /api/finance/ar/receipts/create | finance.create.created | observability.audit (direct-call) | required=true; key=ar:rcpt:create:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_ASSETS | finance | assets | created | POST /api/finance/assets | finance.assets.created |  | required=false; key=null | rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_ASSETS_DEPRECIATE | finance | depreciate | created | POST /api/finance/assets/depreciate | finance.depreciate.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_ASSETS_ID_DISPOSE | finance | dispose | created | POST /api/finance/assets/[id]/dispose | finance.dispose.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_CLOSE_LOCK | finance | lock | created | POST /api/finance/close/lock | finance.lock.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_CLOSE_OPEN | finance | open | created | POST /api/finance/close/open | finance.open.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_FA_ACQUIRE | finance | acquire | created | POST /api/finance/fa/acquire | finance.acquire.created | observability.audit (direct-call) | required=true; key=fa:acq:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_FA_DEPRECIATE | finance | depreciate | created | POST /api/finance/fa/depreciate | finance.depreciate.created | observability.audit (direct-call) | required=true; key=fa:dep:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_FA_DISPOSE | finance | dispose | created | POST /api/finance/fa/dispose | finance.dispose.created | observability.audit (direct-call) | required=true; key=fa:disp:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_FA_REVALUE | finance | revalue | created | POST /api/finance/fa/revalue | finance.revalue.created | observability.audit (direct-call) | required=true; key=fa:reval:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_FX_REVALUE | finance | revalue | created | POST /api/finance/fx/revalue | finance.revalue.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_GL_POST | finance | post | created | POST /api/finance/gl/post | finance.post.created | finance.gl (direct-call) | required=true; key=gl:${tenantId}:${idk} | idempotency<br>input-validation<br>journal-balanced<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_GL_REVERSE | finance | reverse | created | POST /api/finance/gl/reverse | finance.reverse.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_JOURNALS_JOURNALID_REVERSE | finance | reverse | created | POST /api/finance/journals/[journalId]/reverse | finance.reverse.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_PERIODS_CLOSE | finance | close | created | POST /api/finance/periods/close | finance.close.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_PERIODS_OPEN | finance | open | created | POST /api/finance/periods/open | finance.open.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_VAT_CODES | finance | codes | created | POST /api/finance/vat/codes | finance.codes.created |  | required=false; key=null | rbac<br>tenant-scope |  |
| FINANCE__POST__FINANCE_VAT_SUBMIT | finance | submit | created | POST /api/finance/vat/submit | finance.submit.created | observability.audit (direct-call) | required=true; key=vat:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| FINANCE__PUT__FINANCE_ASSETS_ID | finance | assets | updated | PUT /api/finance/assets/[id] | finance.assets.updated |  | required=false; key=null | rbac<br>tenant-scope |  |
| HEALTHCARE__POST__HEALTHCARE_ROTA | healthcare | rota | created | POST /api/healthcare/rota | healthcare.rota.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>session-auth<br>tenant-scope |  |
| HR__PATCH__HR_EMPLOYEES_ID | hr | employees | updated | PATCH /api/hr/employees/[id] | hr.employees.updated | observability.audit (direct-call) | required=false; key=null | audit-log<br>plan-feature<br>rbac<br>tenant-scope |  |
| HR__PATCH__HR_PAYROLL_CONFIG | hr | config | updated | PATCH /api/hr/payroll/config | hr.config.updated |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_EMPLOYEES_CREATE | hr | create | created | POST /api/hr/employees/create | hr.create.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_ENTITLEMENTS | hr | entitlements | created | POST /api/hr/leave/entitlements | hr.entitlements.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_ID_ADJUST | hr | adjust | created | POST /api/hr/leave/[id]/adjust | hr.adjust.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_ID_CANCEL | hr | cancel | created | POST /api/hr/leave/[id]/cancel | hr.cancel.created |  | required=false; key=null | plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_REQUESTS | hr | requests | created | POST /api/hr/leave/requests | hr.requests.created |  | required=false; key=null | input-validation<br>plan-feature<br>prisma-write<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_APPROVE | hr | approve | created | POST /api/hr/leave/requests/[id]/approve | hr.approve.created |  | required=false; key=null | plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_CANCEL | hr | cancel | created | POST /api/hr/leave/requests/[id]/cancel | hr.cancel.created |  | required=false; key=null | plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_REJECT | hr | reject | created | POST /api/hr/leave/requests/[id]/reject | hr.reject.created |  | required=false; key=null | plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_SUBMIT | hr | submit | created | POST /api/hr/leave/requests/[id]/submit | hr.submit.created |  | required=false; key=null | plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_REQUESTS_ID_TAKEN | hr | taken | created | POST /api/hr/leave/requests/[id]/taken | hr.taken.created |  | required=false; key=null | plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_LEAVE_TYPES | hr | types | created | POST /api/hr/leave/types | hr.types.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| HR__POST__HR_PAYROLL_RUN | hr | run | created | POST /api/hr/payroll/run | hr.run.created |  | required=false; key=null | input-validation<br>plan-feature<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| HR__POST__HR_PAYROLL_RUN_ID_ADJUST | hr | adjust | created | POST /api/hr/payroll/run/[id]/adjust | hr.adjust.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| HR__POST__HR_PAYROLL_RUN_ID_REVERSE | hr | reverse | created | POST /api/hr/payroll/run/[id]/reverse | hr.reverse.created |  | required=false; key=null | plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| IMPORT__POST__IMPORT_COMMIT | import | commit | created | POST /api/import/commit | import.commit.created | observability.audit (direct-call) | required=true; key=import:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rbac<br>tenant-scope |  |
| IMPORT__POST__IMPORT_CUSTOMERS | import | customers | created | POST /api/import/customers | import.customers.created |  | required=false; key=null | rbac |  |
| IMPORT__POST__IMPORT_CUSTOMERS_APPLY | import | apply | created | POST /api/import/customers/apply | import.apply.created |  | required=false; key=null | rbac |  |
| IMPORT__POST__IMPORT_CUSTOMERS_PREVIEW | import | preview | created | POST /api/import/customers/preview | import.preview.created |  | required=false; key=null | rbac |  |
| IMPORT__POST__IMPORT_ITEMS | import | items | created | POST /api/import/items | import.items.created |  | required=false; key=null | rbac |  |
| IMPORT__POST__IMPORT_PREVIEW | import | preview | created | POST /api/import/preview | import.preview.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| IMPORT__POST__IMPORT_SUPPLIERS | import | suppliers | created | POST /api/import/suppliers | import.suppliers.created |  | required=false; key=null | rbac |  |
| INVENTORY__POST__INVENTORY_ADJUST | inventory | adjust | created | POST /api/inventory/adjust | inventory.adjust.created | observability.audit (direct-call) | required=true; key=inv:adj:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_ADJUSTMENTS | inventory | adjustments | created | POST /api/inventory/adjustments | inventory.adjustments.created | inventory.adjustment (service-call) | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_CYCLE | inventory | cycle | created | POST /api/inventory/cycle | inventory.cycle.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_CYCLE_ID_COUNT | inventory | count | created | POST /api/inventory/cycle/[id]/count | inventory.count.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_CYCLE_ID_POST | inventory | post | created | POST /api/inventory/cycle/[id]/post | inventory.post.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_GRN | inventory | grn | created | POST /api/inventory/grn | inventory.grn.created | inventory.receipt (service-call)<br>metrics.counter (direct-call) | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_ISSUE | inventory | issue | created | POST /api/inventory/issue | inventory.issue.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_ITEMS_CREATE | inventory | create | created | POST /api/inventory/items/create | inventory.create.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>plan-feature<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_ITEMS_DELETE | inventory | delete | created | POST /api/inventory/items/delete | inventory.delete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_ITEMS_UPDATE | inventory | update | created | POST /api/inventory/items/update | inventory.update.created | events.outbox (outbox)<br>observability.audit (direct-call) | required=true; key=invitem:update:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>plan-feature<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_MOVEMENTS_MOVEMENTID_REVERSE | inventory | reverse | created | POST /api/inventory/movements/[movementId]/reverse | inventory.reverse.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_TRANSFER | inventory | transfer | created | POST /api/inventory/transfer | inventory.transfer.created | inventory.transfer (service-call) | required=true; key=inv:trans:${tenantId}:${idk} | idempotency<br>input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_WAREHOUSES_CREATE | inventory | create | created | POST /api/inventory/warehouses/create | inventory.create.created | observability.audit (direct-call) | required=true; key=wh:create:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_WAREHOUSES_UPDATE | inventory | update | created | POST /api/inventory/warehouses/update | inventory.update.created | observability.audit (direct-call) | required=true; key=wh:update:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_WMS_RECEIVING_GRN | inventory | grn | created | POST /api/inventory/wms/receiving/grn | inventory.grn.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_WMS_RECEIVING_PUTAWAY | inventory | putaway | created | POST /api/inventory/wms/receiving/putaway | inventory.putaway.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_WMS_SHIPPING_PICK | inventory | pick | created | POST /api/inventory/wms/shipping/pick | inventory.pick.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| INVENTORY__POST__INVENTORY_WMS_SHIPPING_SHIP | inventory | ship | created | POST /api/inventory/wms/shipping/ship | inventory.ship.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| INVITE__POST__INVITE_ACCEPT | invite | accept | created | POST /api/invite/accept | invite.accept.created |  | required=false; key=null | input-validation |  |
| JOBS__POST__JOBS_RETRY | jobs | retry | created | POST /api/jobs/retry | jobs.retry.created |  | required=false; key=null | input-validation<br>rbac |  |
| MANUFACTURING__DELETE__MANUFACTURING_BOMS | manufacturing | boms | created | DELETE /api/manufacturing/boms | manufacturing.boms.created<br>manufacturing.boms.deleted |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_BOM_ITEMS | manufacturing | items | created | POST /api/manufacturing/bom/items | manufacturing.items.created | observability.audit (direct-call) | required=true; key=bom:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_BOM_ITEMS_DELETE | manufacturing | delete | created | POST /api/manufacturing/bom/items/delete | manufacturing.delete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_BOMS | manufacturing | boms | created | POST /api/manufacturing/boms | manufacturing.boms.created<br>manufacturing.boms.deleted |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_COST_ROLLUP | manufacturing | rollup | created | POST /api/manufacturing/cost/rollup | manufacturing.rollup.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_MRP_FIRM | manufacturing | firm | created | POST /api/manufacturing/mrp/firm | manufacturing.firm.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_MRP_RUN | manufacturing | run | created | POST /api/manufacturing/mrp/run | manufacturing.run.created |  | required=false; key=null | input-validation<br>plan-feature<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WO_CLOSE | manufacturing | close | created | POST /api/manufacturing/wo/close | manufacturing.close.created | observability.audit (direct-call) | required=true; key=wo:close:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WO_COMPLETE | manufacturing | complete | created | POST /api/manufacturing/wo/complete | manufacturing.complete.created | observability.audit (direct-call) | required=true; key=wo:comp:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WO_CONSUME | manufacturing | consume | created | POST /api/manufacturing/wo/consume | manufacturing.consume.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WO_RELEASE | manufacturing | release | created | POST /api/manufacturing/wo/release | manufacturing.release.created | observability.audit (direct-call) | required=true; key=wo:rel:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WO_SCRAP | manufacturing | scrap | created | POST /api/manufacturing/wo/scrap | manufacturing.scrap.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS | manufacturing | work_orders | created | POST /api/manufacturing/work-orders | manufacturing.work_orders.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_COMPLETE | manufacturing | complete | created | POST /api/manufacturing/work-orders/[id]/complete | manufacturing.complete.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_CONSUME | manufacturing | consume | created | POST /api/manufacturing/work-orders/[id]/consume | manufacturing.consume.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_RELEASE | manufacturing | release | created | POST /api/manufacturing/work-orders/[id]/release | manufacturing.release.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_REVERSE_COMPLETION | manufacturing | reverse_completion | created | POST /api/manufacturing/work-orders/[id]/reverse-completion | manufacturing.reverse_completion.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_REVERSE_CONSUMPTION | manufacturing | reverse_consumption | created | POST /api/manufacturing/work-orders/[id]/reverse-consumption | manufacturing.reverse_consumption.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_SCRAP | manufacturing | scrap | created | POST /api/manufacturing/work-orders/[id]/scrap | manufacturing.scrap.created |  | required=false; key=null | input-validation<br>plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| MANUFACTURING__POST__MANUFACTURING_WORKORDER_CONSUME_BOM | manufacturing | consume_bom | created | POST /api/manufacturing/workorder/consume-bom | manufacturing.consume_bom.created | metrics.counter (direct-call) | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_JOBS_PAYROLL_RUN_TS | non_route | operation | write | apps/web/src/jobs/payroll/run.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_ACCESS_STORE_TS | non_route | operation | write | apps/web/src/lib/access/store.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_ACCESS_TENANTCONFIG_TS | non_route | operation | write | apps/web/src/lib/access/tenantConfig.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_AI_LOGGING_TS | non_route | operation | write | apps/web/src/lib/ai/logging.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_BILLING_PLANS_TS | non_route | operation | write | apps/web/src/lib/billing/plans.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_CRYPTO___TESTS___FIELD_ENCRYPTION_TEST_TS | non_route | operation | write | apps/web/src/lib/crypto/__tests__/field-encryption.test.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_CRYPTO_ENCRYPTION_TS | non_route | operation | write | apps/web/src/lib/crypto/encryption.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_EMAIL___TESTS___MAILER_TEST_TS | non_route | operation | write | apps/web/src/lib/email/__tests__/mailer.test.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_EMAIL_MAILER_TS | non_route | operation | write | apps/web/src/lib/email/mailer.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_HR_EMPLOYEES_ENCRYPTED_TS | non_route | operation | write | apps/web/src/lib/hr/employees-encrypted.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_INTEGRATIONS_SYNC_ORCHESTRATOR_TS | non_route | operation | write | apps/web/src/lib/integrations/sync-orchestrator.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_KPI_SERVICE_TS | non_route | operation | write | apps/web/src/lib/kpi/service.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_LOG_MASK_TS | non_route | operation | write | apps/web/src/lib/log/mask.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_OBSERVABILITY_AUDIT_TS | non_route | operation | write | apps/web/src/lib/observability/audit.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_OBSERVABILITY_OBSERVABILITY_AUDIT_TS | non_route | operation | write | apps/web/src/lib/observability/observability/audit.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_POS_INVENTORY_TS | non_route | operation | write | apps/web/src/lib/pos/inventory.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_PRISMA_TYPES_TS | non_route | operation | write | apps/web/src/lib/prisma-types.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_PROFILE_PREFS_TS | non_route | operation | write | apps/web/src/lib/profile/prefs.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_SUPPLY_REPLENISHMENTSTORE_TS | non_route | operation | write | apps/web/src/lib/supply/replenishmentStore.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_TENANT_WIZARD_GUARD_TS | non_route | operation | write | apps/web/src/lib/tenant/wizard-guard.ts |  |  | required=false; key=null | env-guard<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_ACCOUNTS_TS | non_route | operation | write | apps/web/src/server/_crm.before-restore/accounts.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_ACTIVITIES_TS | non_route | operation | write | apps/web/src/server/_crm.before-restore/activities.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_CONTACTS_TS | non_route | operation | write | apps/web/src/server/_crm.before-restore/contacts.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_PIPELINES_TS | non_route | operation | write | apps/web/src/server/_crm.before-restore/pipelines.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_BILLING_TS | non_route | operation | write | apps/web/src/server/_projects.before-restore/billing.ts |  | events.outbox (outbox)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotency<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_COSTS_TS | non_route | operation | write | apps/web/src/server/_projects.before-restore/costs.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROFITABILITY_TS | non_route | operation | write | apps/web/src/server/_projects.before-restore/profitability.ts |  | finance.gl (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>journal-balanced<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROJECTS_TS | non_route | operation | write | apps/web/src/server/_projects.before-restore/projects.ts |  | events.outbox (outbox)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_RETAINERS_TS | non_route | operation | write | apps/web/src/server/_projects.before-restore/retainers.ts |  | events.outbox (outbox)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_TIMESHEETS_TS | non_route | operation | write | apps/web/src/server/_projects.before-restore/timesheets.ts |  | events.outbox (outbox)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotency<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_AI_TENANT_ANALYTICS_SERVICE_TS | non_route | operation | write | apps/web/src/server/ai/tenant-analytics.service.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_AUTH_ONBOARDING_SERVICE_TS | non_route | operation | write | apps/web/src/server/auth/onboarding.service.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_BILLING_STATUS_TS | non_route | operation | write | apps/web/src/server/billing/status.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_COSTING_COST_TS | non_route | operation | write | apps/web/src/server/costing/cost.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_ACCOUNTS_TS | non_route | operation | write | apps/web/src/server/crm/accounts.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_ACTIVITIES_TS | non_route | operation | write | apps/web/src/server/crm/activities.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_CONTACTS_TS | non_route | operation | write | apps/web/src/server/crm/contacts.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_PIPELINES_TS | non_route | operation | write | apps/web/src/server/crm/pipelines.ts |  | events.outbox (outbox)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EMAIL_EMAIL_LOG_SERVICE_TS | non_route | operation | write | apps/web/src/server/email/email-log.service.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_FINANCEINVOICES_TS | non_route | operation | write | apps/web/src/server/erp/financeInvoices.ts |  | dashboards.super-admin (direct-call)<br>dashboards.tenant (direct-call)<br>events.outbox (outbox)<br>observability.audit (direct-call) | required=true; key=ar:inv:create:${ctx.tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>invoice-totals-check<br>prisma-write<br>rate-limit |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_INVENTORYITEMS_TS | non_route | operation | write | apps/web/src/server/erp/inventoryItems.ts |  | observability.audit (direct-call) | required=true; key=invitem:create:${ctx.tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_PROFILEAI_TS | non_route | operation | write | apps/web/src/server/erp/profileAi.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>input-validation<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_PURCHASINGPO_TS | non_route | operation | write | apps/web/src/server/erp/purchasingPo.ts |  | observability.audit (direct-call) | required=true; key=po:create:${ctx.tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_SALESORDERS_TS | non_route | operation | write | apps/web/src/server/erp/salesOrders.ts |  | dashboards.super-admin (direct-call)<br>dashboards.tenant (direct-call)<br>observability.audit (direct-call) | required=true; key=so:create:${ctx.tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EVENTS_OUTBOXREPOSITORY_TS | non_route | operation | write | apps/web/src/server/events/outboxRepository.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EVENTS_SUBSCRIBERS_INDEX_TS | non_route | operation | write | apps/web/src/server/events/subscribers/index.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_AP_TS | non_route | operation | write | apps/web/src/server/finance/ap.ts |  | finance.gl (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_ASSETS_TS | non_route | operation | write | apps/web/src/server/finance/assets.ts |  | finance.gl (direct-call) | required=false; key=null | input-validation<br>journal-balanced<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_BANKING_TS | non_route | operation | write | apps/web/src/server/finance/banking.ts |  |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_GL_TS | non_route | operation | write | apps/web/src/server/finance/gl.ts |  | finance.gl (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_LIFECYCLE_TS | non_route | operation | write | apps/web/src/server/finance/lifecycle.ts |  | finance.gl (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_PERIODCLOSE_TS | non_route | operation | write | apps/web/src/server/finance/periodClose.ts |  |  | required=false; key=null | idempotent-upsert<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_VAT_TS | non_route | operation | write | apps/web/src/server/finance/vat.ts |  |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_EMPLOYEES_SERVICE_TS | non_route | operation | write | apps/web/src/server/hr/employees.service.ts |  |  | required=false; key=null | idempotent-upsert<br>plan-feature<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_LEAVE_SERVICE_TS | non_route | operation | write | apps/web/src/server/hr/leave.service.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_LEAVECONFIG_SERVICE_TS | non_route | operation | write | apps/web/src/server/hr/leaveConfig.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLCONFIG_SERVICE_TS | non_route | operation | write | apps/web/src/server/hr/payrollConfig.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLRUN_SERVICE_TS | non_route | operation | write | apps/web/src/server/hr/payrollRun.service.ts |  | finance.gl (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORT_EXPORT_MASTERDATA_TS | non_route | operation | write | apps/web/src/server/import-export/masterData.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORTS_MASTERDATA_TS | non_route | operation | write | apps/web/src/server/imports/masterData.ts |  | events.outbox (outbox)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_CORRECTIONS_SERVICE_TS | non_route | operation | write | apps/web/src/server/inventory/corrections.service.ts |  | finance.gl (direct-call)<br>inventory.adjustment (service-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>inventory-costing<br>inventory-non-negative<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_COSTING_SERVICE_TS | non_route | operation | write | apps/web/src/server/inventory/costing.service.ts |  |  | required=false; key=null | idempotent-upsert<br>inventory-costing<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_GRN_TS | non_route | operation | write | apps/web/src/server/inventory/grn.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_ITEMS_SERVICE_TS | non_route | operation | write | apps/web/src/server/inventory/items.service.ts |  | metrics.dimension (direct-call) | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_MOVEMENTS_SERVICE_TS | non_route | operation | write | apps/web/src/server/inventory/movements.service.ts |  | finance.gl (direct-call)<br>inventory.receipt (service-call)<br>inventory.transfer (service-call)<br>metrics.dimension (direct-call) | required=false; key=null | inventory-costing<br>inventory-non-negative<br>journal-balanced<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSRECEIVING_SERVICE_TS | non_route | operation | write | apps/web/src/server/inventory/wmsReceiving.service.ts |  | inventory.receipt (service-call)<br>inventory.transfer (service-call) | required=false; key=null | idempotent-upsert<br>plan-feature<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSSHIPPING_SERVICE_TS | non_route | operation | write | apps/web/src/server/inventory/wmsShipping.service.ts |  |  | required=false; key=null | idempotent-upsert<br>plan-feature<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_CORE_SERVICE_TS | non_route | operation | write | apps/web/src/server/manufacturing/core.service.ts |  | finance.gl (direct-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>inventory-non-negative<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_WORKORDER_TS | non_route | operation | write | apps/web/src/server/manufacturing/workorder.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_METRICS_STORE_TS | non_route | operation | write | apps/web/src/server/metrics/store.ts |  | metrics.dimension (direct-call) | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_NOTIFICATIONS_CHAT_NOTIFICATIONS_TS | non_route | operation | write | apps/web/src/server/notifications/chat-notifications.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_NOTIFICATIONS_CONFIG_TS | non_route | operation | write | apps/web/src/server/notifications/config.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SALES_TS | non_route | operation | write | apps/web/src/server/pos/sales.ts |  | finance.gl (direct-call)<br>inventory.receipt (service-call)<br>observability.audit (direct-call) | required=false; key=null | audit-log<br>inventory-costing<br>journal-balanced<br>period-open<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SESSIONS_SERVICE_TS | non_route | operation | write | apps/web/src/server/pos/sessions.service.ts |  | finance.gl (direct-call) | required=false; key=null | journal-balanced<br>plan-feature<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_PRESETS_REPOSITORY_TS | non_route | operation | write | apps/web/src/server/presets/repository.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_PROJECTS_COSTS_TS | non_route | operation | write | apps/web/src/server/projects/costs.ts |  | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_AI_CONFIG_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/ai-config.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_COMPLIANCE_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/compliance.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_INTEGRATIONS_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/integrations.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_OPS_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/ops.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_SECURITY_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/security.service.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_TENANTS_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/tenants.service.ts |  | dashboards.super-admin (direct-call)<br>dashboards.tenant (direct-call) | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_USERS_SERVICE_TS | non_route | operation | write | apps/web/src/server/super-admin/users.service.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__APPS_WEB_SRC_TESTS_SEED_SEED_ALIGNMENT_TEST_TS | non_route | operation | write | apps/web/src/tests/seed/seed-alignment.test.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_E2E_CREATE_USER_TS | non_route | operation | write | scripts/e2e-create-user.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEED_DEMO_TENANT_TS | non_route | operation | write | scripts/seed_demo_tenant.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEED_KPI_JS | non_route | operation | write | scripts/seed-kpi.js |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEED_KPI_TS | non_route | operation | write | scripts/seed-kpi.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEED_USERS_TABLE_TS | non_route | operation | write | scripts/seed_users_table.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE4_TS | non_route | operation | write | scripts/seeds/seed-phase4.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE5_TS | non_route | operation | write | scripts/seeds/seed-phase5.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE7_TS | non_route | operation | write | scripts/seeds/seed-phase7.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASEA_TS | non_route | operation | write | scripts/seeds/seed-phaseA.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_SET_DEMO_PASSWORD_TS | non_route | operation | write | scripts/set_demo_password.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_TENANCY_BACKFILL_MASTER_TENANT_TS | non_route | operation | write | scripts/tenancy/backfill-master-tenant.ts |  |  | required=false; key=null | prisma-write |  |
| NON_ROUTE__WRITE__SCRIPTS_TENANCY_CREATE_DEMO_TENANT_TS | non_route | operation | write | scripts/tenancy/create-demo-tenant.ts |  |  | required=false; key=null | idempotent-upsert<br>prisma-write |  |
| PLANNING__POST__PLANNING_BUDGETS | planning | budgets | created | POST /api/planning/budgets | planning.budgets.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PLANNING__POST__PLANNING_FORECAST | planning | forecast | created | POST /api/planning/forecast | planning.forecast.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_REFUND_CREATE | pos | create | created | POST /api/pos/refund/create | pos.create.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_REFUND_FINALISE | pos | finalise | created | POST /api/pos/refund/finalise | pos.finalise.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SALE_CREATE | pos | create | created | POST /api/pos/sale/create | pos.create.created |  | required=false; key=null | plan-feature<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SALE_FINALISE | pos | finalise | created | POST /api/pos/sale/finalise | pos.finalise.created | metrics.counter (direct-call) | required=false; key=null | idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SALE_SALEID_VOID | pos | void | created | POST /api/pos/sale/[saleId]/void | pos.void.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SALE_UPDATE | pos | update | created | POST /api/pos/sale/update | pos.update.created |  | required=false; key=null | rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SALES | pos | sales | created | POST /api/pos/sales | pos.sales.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SESSIONS_CLOSE | pos | close | created | POST /api/pos/sessions/close | pos.close.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SESSIONS_OPEN | pos | open | created | POST /api/pos/sessions/open | pos.open.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SHIFTS | pos | shifts | created | POST /api/pos/shifts | pos.shifts.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SHIFTS_CLOSE | pos | close | created | POST /api/pos/shifts/close | pos.close.created | observability.audit (direct-call) | required=true; key=pos:shift:close:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| POS__POST__POS_SHIFTS_OPEN | pos | open | created | POST /api/pos/shifts/open | pos.open.created | observability.audit (direct-call) | required=true; key=pos:shift:open:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| PRESETS__POST__PRESETS | presets | presets | created | POST /api/presets | presets.presets.created |  | required=false; key=null | rbac<br>tenant-scope |  |
| PROFILE__POST__PROFILE_PREFERENCES | profile | preferences | created | POST /api/profile/preferences | profile.preferences.created |  | required=false; key=null | input-validation<br>session-auth |  |
| PROFILE__POST__PROFILE_THEME_GENERATE | profile | generate | created | POST /api/profile/theme/generate | profile.generate.created |  | required=false; key=null | input-validation<br>session-auth |  |
| PROJECTS__POST__PROJECTS_BILLING_EXPORT | projects | export | created | POST /api/projects/billing/export | projects.export.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PROJECTS__POST__PROJECTS_TIMESHEETS | projects | timesheets | created | POST /api/projects/timesheets | projects.timesheets.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PROJECTS__POST__PROJECTS_TIMESHEETS_APPROVE | projects | approve | created | POST /api/projects/timesheets/approve | projects.approve.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PROJECTS__POST__PROJECTS_TIMESHEETS_ROLLUP | projects | rollup | created | POST /api/projects/timesheets/rollup | projects.rollup.created | metrics.counter (direct-call) | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_BILL_FROM_PO | purchasing | from_po | created | POST /api/purchasing/bill/from-po | purchasing.from_po.created | observability.audit (direct-call) | required=true; key=bill:po:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_CONTRACTS | purchasing | contracts | created | POST /api/purchasing/contracts | purchasing.contracts.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_GRN_POST | purchasing | post | created | POST /api/purchasing/grn/post | purchasing.post.created | observability.audit (direct-call) | required=true; key=grn:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_PO_APPROVE | purchasing | approve | created | POST /api/purchasing/po/approve | purchasing.approve.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_RFQ | purchasing | rfq | created | POST /api/purchasing/rfq | purchasing.rfq.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_RFQ_ID_AWARD | purchasing | award | created | POST /api/purchasing/rfq/[id]/award | purchasing.award.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_RFQ_ID_RESPOND | purchasing | respond | created | POST /api/purchasing/rfq/[id]/respond | purchasing.respond.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_SUPPLIERS_CREATE | purchasing | create | created | POST /api/purchasing/suppliers/create | purchasing.create.created | observability.audit (direct-call) | required=true; key=supplier:create:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_SUPPLIERS_DELETE | purchasing | delete | created | POST /api/purchasing/suppliers/delete | purchasing.delete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| PURCHASING__POST__PURCHASING_SUPPLIERS_UPDATE | purchasing | update | created | POST /api/purchasing/suppliers/update | purchasing.update.created | observability.audit (direct-call) | required=true; key=supplier:update:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| QUALITY__POST__QUALITY_HOLDS | quality | holds | created | POST /api/quality/holds | quality.holds.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| QUALITY__POST__QUALITY_HOLDS_ID_RELEASE | quality | release | created | POST /api/quality/holds/[id]/release | quality.release.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| QUALITY__POST__QUALITY_INSPECTIONS | quality | inspections | created | POST /api/quality/inspections | quality.inspections.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| QUALITY__POST__QUALITY_INSPECTIONS_ID_UPDATE | quality | update | created | POST /api/quality/inspections/[id]/update | quality.update.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| REPORTS__DELETE__REPORTS_SCHEDULE | reports | schedule | created | DELETE /api/reports/schedule | reports.schedule.created<br>reports.schedule.deleted | observability.audit (direct-call) | required=true; key=sched:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| REPORTS__POST__REPORTS_SCHEDULE | reports | schedule | created | POST /api/reports/schedule | reports.schedule.created<br>reports.schedule.deleted | observability.audit (direct-call) | required=true; key=sched:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| REPORTS__POST__REPORTS_SEND_NOW | reports | send_now | created | POST /api/reports/send-now | reports.send_now.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rbac<br>tenant-scope |  |
| SALES__POST__SALES_CREDIT_CREATE | sales | create | created | POST /api/sales/credit/create | sales.create.created | observability.audit (direct-call) | required=true; key=so:credit:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| SALES__POST__SALES_INVOICE_FROM_ORDER | sales | from_order | created | POST /api/sales/invoice/from-order | sales.from_order.created | observability.audit (direct-call) | required=true; key=so:invoice:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| SALES__POST__SALES_ORDER_CREATE | sales | create | created | POST /api/sales/order/create | sales.create.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| SALES__POST__SALES_ORDER_DELIVER | sales | deliver | created | POST /api/sales/order/deliver | sales.deliver.created | observability.audit (direct-call) | required=true; key=so:deliver:${tenantId}:${idk} | audit-log<br>idempotency<br>idempotent-upsert<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| STRIPE__POST__STRIPE_WEBHOOK | stripe | webhook | created | POST /api/stripe/webhook | stripe.webhook.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>prisma-write |  |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_INTEGRATIONS_ID | super-admin | integrations | deleted | DELETE /api/super-admin/integrations/[id] | super-admin.integrations.deleted<br>super-admin.integrations.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_TENANTS_TENANTID | super-admin | tenants | deleted | DELETE /api/super-admin/tenants/[tenantId] | super-admin.tenants.deleted<br>super-admin.tenants.updated |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write |  |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_USERS_USERID | super-admin | users | deleted | DELETE /api/super-admin/users/[userId] | super-admin.users.deleted<br>super-admin.users.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_AI_CONFIG | super-admin | config | updated | PATCH /api/super-admin/ai/config | super-admin.config.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_BILLING_PLAN_TEMPLATES_ID | super-admin | plan_templates | updated | PATCH /api/super-admin/billing/plan-templates/[id] | super-admin.plan_templates.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_COMPLIANCE_CONFIG | super-admin | config | updated | PATCH /api/super-admin/compliance/config | super-admin.config.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_INTEGRATIONS_ID | super-admin | integrations | deleted | PATCH /api/super-admin/integrations/[id] | super-admin.integrations.deleted<br>super-admin.integrations.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_OPS_RUNBOOKS_ID | super-admin | runbooks | updated | PATCH /api/super-admin/ops/runbooks/[id] | super-admin.runbooks.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_SECURITY_POLICIES | super-admin | policies | updated | PATCH /api/super-admin/security/policies | super-admin.policies.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID | super-admin | tenants | deleted | PATCH /api/super-admin/tenants/[tenantId] | super-admin.tenants.deleted<br>super-admin.tenants.updated |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID_BILLING | super-admin | billing | updated | PATCH /api/super-admin/tenants/[tenantId]/billing | super-admin.billing.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_USERS_USERID | super-admin | users | deleted | PATCH /api/super-admin/users/[userId] | super-admin.users.deleted<br>super-admin.users.updated |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING | super-admin | billing | created | POST /api/super-admin/billing | super-admin.billing.created |  | required=false; key=null | idempotent-upsert<br>input-validation<br>prisma-write |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING_PLAN_TEMPLATES | super-admin | plan_templates | created | POST /api/super-admin/billing/plan-templates | super-admin.plan_templates.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING_PLANS | super-admin | plans | created | POST /api/super-admin/billing/plans | super-admin.plans.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_COMPLIANCE_EXPORT_SNAPSHOT | super-admin | export_snapshot | created | POST /api/super-admin/compliance/export-snapshot | super-admin.export_snapshot.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_COMPLIANCE_RUN_CHECK | super-admin | run_check | created | POST /api/super-admin/compliance/run-check | super-admin.run_check.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_INTEGRATIONS | super-admin | integrations | created | POST /api/super-admin/integrations | super-admin.integrations.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_NOTIFICATIONS_CONFIG | super-admin | config | created | POST /api/super-admin/notifications/config | super-admin.config.created |  | required=false; key=null | input-validation<br>rbac<br>tenant-scope |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_OPS_RUNBOOKS | super-admin | runbooks | created | POST /api/super-admin/ops/runbooks | super-admin.runbooks.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_TENANTS | super-admin | tenants | created | POST /api/super-admin/tenants | super-admin.tenants.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_TENANTS_CREATE | super-admin | create | created | POST /api/super-admin/tenants/create | super-admin.create.created |  | required=false; key=null | input-validation |  |
| SUPER-ADMIN__POST__SUPER_ADMIN_USERS | super-admin | users | created | POST /api/super-admin/users | super-admin.users.created |  | required=false; key=null | input-validation |  |
| SUPPLY__POST__SUPPLY_PACK_WAVEID | supply | pack | created | POST /api/supply/pack/[waveId] | supply.pack.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_PICK_CREATE_WAVE | supply | create_wave | created | POST /api/supply/pick/create-wave | supply.create_wave.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_PICK_TASKID_COMPLETE | supply | complete | created | POST /api/supply/pick/[taskId]/complete | supply.complete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_PICK_WAVES_WAVEID_ASSIGN_TASK | supply | assign_task | created | POST /api/supply/pick/waves/[waveId]/assign-task | supply.assign_task.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_REPLENISHMENT_APPLY | supply | apply | created | POST /api/supply/replenishment/apply | supply.apply.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_REPLENISHMENT_RULES | supply | rules | created | POST /api/supply/replenishment/rules | supply.rules.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_RMA | supply | rma | created | POST /api/supply/rma | supply.rma.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_RMA_ID_PROCESS | supply | process | created | POST /api/supply/rma/[id]/process | supply.process.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_RMA_ID_UPDATE | supply | update | created | POST /api/supply/rma/[id]/update | supply.update.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| SUPPLY__POST__SUPPLY_SHIP_WAVEID | supply | ship | created | POST /api/supply/ship/[waveId] | supply.ship.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| TENANT__POST__TENANT_DELETE | tenant | delete | created | POST /api/tenant/delete | tenant.delete.created | observability.audit (direct-call) | required=true; key=tenant:delete:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| TENANT__POST__TENANT_EXPORT | tenant | export | created | POST /api/tenant/export | tenant.export.created | observability.audit (direct-call) | required=true; key=tenant:export:${tenantId}:${idk} | audit-log<br>idempotency<br>input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| TENANT__POST__TENANT_SETUP_COMPLETE | tenant | complete | created | POST /api/tenant/setup/complete | tenant.complete.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>tenant-scope |  |
| TENANT__POST__TENANT_USERS_UPDATE | tenant | update | created | POST /api/tenant/users/update | tenant.update.created | observability.audit (direct-call) | required=false; key=null | audit-log<br>input-validation<br>prisma-write<br>rate-limit<br>rbac<br>tenant-scope |  |
| TEST__POST__TEST_SET_ROLE | test | set_role | created | POST /api/test/set-role | test.set_role.created |  | required=false; key=null | env-guard<br>local-host-only |  |
| WORKFLOW__POST__WORKFLOW_DEFINITIONS | workflow | definitions | created | POST /api/workflow/definitions | workflow.definitions.created |  | required=false; key=null | input-validation<br>rate-limit<br>rbac<br>tenant-scope |  |
| WORKFLOW__POST__WORKFLOW_INSTANCES_ID_APPROVE | workflow | approve | created | POST /api/workflow/instances/[id]/approve | workflow.approve.created |  | required=false; key=null | rate-limit<br>rbac<br>tenant-scope |  |
| WORKFLOW__POST__WORKFLOW_INSTANCES_ID_REJECT | workflow | reject | created | POST /api/workflow/instances/[id]/reject | workflow.reject.created |  | required=false; key=null | rate-limit<br>rbac<br>tenant-scope |  |

## Edge List

| producerId | event | consumer | trigger |
| --- | --- | --- | --- |
| _TEST__POST___TEST_SET_ROLE | _test.set_role.created | none | none |
| ADMIN__DELETE__ADMIN_SUPPORT_SESSION | admin.session.created | observability.audit | direct-call |
| ADMIN__DELETE__ADMIN_SUPPORT_SESSION | admin.session.deleted | observability.audit | direct-call |
| ADMIN__PATCH__ADMIN_TENANTS_ID | admin.tenants.updated | none | none |
| ADMIN__POST__ADMIN_ALERTS_BILLING_WARNING | admin.billing_warning.created | none | none |
| ADMIN__POST__ADMIN_BACKUPS_RESTORE_DRY_RUN | admin.restore_dry_run.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_BACKUPS_RUN | admin.run.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_BILLING_STATE | admin.state.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_INTEGRATIONS_SANDBOX | admin.sandbox.created | none | none |
| ADMIN__POST__ADMIN_INTEGRATIONS_SYNC | admin.sync.created | none | none |
| ADMIN__POST__ADMIN_INVITE | admin.invite.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_KEYS_PROVISION | admin.provision.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_KEYS_ROTATE | admin.rotate.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_SETTINGS_MODULES | admin.modules.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_SUPPORT_SESSION | admin.session.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_SUPPORT_SESSION | admin.session.deleted | observability.audit | direct-call |
| ADMIN__POST__ADMIN_USERS_ACCESS | admin.access.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_USERS_CREATE | admin.create.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_USERS_DELETE | admin.delete.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_USERS_FORCE_LOGOUT | admin.force_logout.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_USERS_ROLE | admin.role.created | observability.audit | direct-call |
| ADMIN__POST__ADMIN_USERS_UPDATE | admin.update.created | dashboards.tenant | direct-call |
| ADMIN__POST__ADMIN_USERS_UPDATE | admin.update.created | observability.audit | direct-call |
| AI__POST__AI_AGENT | ai.agent.created | none | none |
| AI__POST__AI_ASK | ai.ask.created | observability.audit | direct-call |
| AI__POST__AI_EXECUTE | ai.execute.created | none | none |
| AI__POST__AI_FINANCE_INVOICES_INSIGHT | ai.invoices_insight.created | none | none |
| AI__POST__AI_MODULE_INSIGHT | ai.module_insight.created | none | none |
| AI__POST__AI_QUERY | ai.query.created | observability.audit | direct-call |
| ATTACHMENTS__DELETE__ATTACHMENTS | attachments.attachments.created | none | none |
| ATTACHMENTS__DELETE__ATTACHMENTS | attachments.attachments.deleted | none | none |
| ATTACHMENTS__DELETE__ATTACHMENTS | attachments.attachments.updated | none | none |
| ATTACHMENTS__PATCH__ATTACHMENTS | attachments.attachments.created | none | none |
| ATTACHMENTS__PATCH__ATTACHMENTS | attachments.attachments.deleted | none | none |
| ATTACHMENTS__PATCH__ATTACHMENTS | attachments.attachments.updated | none | none |
| ATTACHMENTS__POST__ATTACHMENTS | attachments.attachments.created | none | none |
| ATTACHMENTS__POST__ATTACHMENTS | attachments.attachments.deleted | none | none |
| ATTACHMENTS__POST__ATTACHMENTS | attachments.attachments.updated | none | none |
| ATTACHMENTS__POST__ATTACHMENTS_UPLOAD | attachments.upload.created | none | none |
| AUTH__POST__AUTH_FORGOT_PASSWORD | auth.forgot_password.created | none | none |
| AUTH__POST__AUTH_RESET_PASSWORD | auth.reset_password.created | none | none |
| AUTH__POST__AUTH_RESET_TEMP_PASSWORD | auth.reset_temp_password.created | none | none |
| BANKING__POST__BANKING_ACCOUNTS | banking.accounts.created | none | none |
| BANKING__POST__BANKING_RECONCILE | banking.reconcile.created | observability.audit | direct-call |
| BANKING__POST__BANKING_STATEMENTS_IMPORT | banking.import.created | observability.audit | direct-call |
| BILLING__POST__BILLING_CHECKOUT | billing.checkout.created | observability.audit | direct-call |
| BILLING__POST__BILLING_PORTAL | billing.portal.created | observability.audit | direct-call |
| BILLING__POST__BILLING_RECONCILE | billing.reconcile.created | observability.audit | direct-call |
| CHAT__POST__CHAT_SIGNAL | chat.signal.created | observability.audit | direct-call |
| COMPLIANCE__POST__COMPLIANCE_DELETE | compliance.delete.created | observability.audit | direct-call |
| COMPLIANCE__POST__COMPLIANCE_EXPORT | compliance.export.created | observability.audit | direct-call |
| CRM__POST__CRM_ACCOUNTS | crm.accounts.created | none | none |
| CRM__POST__CRM_ACTIVITIES | crm.activities.created | none | none |
| CRM__POST__CRM_LEADS_ID_CANCEL | crm.cancel.created | none | none |
| CRM__POST__CRM_OPPORTUNITIES | crm.opportunities.created | none | none |
| CRM__POST__CRM_OPPORTUNITIES_ID_REOPEN | crm.reopen.created | none | none |
| CRM__POST__CRM_PRICE_BOOKS | crm.price_books.created | none | none |
| CRM__POST__CRM_QUOTES | crm.quotes.created | none | none |
| CRM__POST__CRM_QUOTES_ID_APPROVE | crm.approve.created | observability.audit | direct-call |
| CRM__POST__CRM_QUOTES_ID_CANCEL | crm.cancel.created | none | none |
| CRM__POST__CRM_QUOTES_ID_SUPERSEDE | crm.supersede.created | none | none |
| CUSTOM__POST__CUSTOM_FIELDS | custom.fields.created | none | none |
| CUSTOM__POST__CUSTOM_VALUES | custom.values.created | none | none |
| DEV__POST__DEV_EMAIL_SEND | dev.send.created | none | none |
| DIAG__POST__DIAG_ADD_USER | diag.add_user.created | none | none |
| EXPORT__POST__EXPORT_CUSTOMERS | export.customers.created | none | none |
| EXPORT__POST__EXPORT_ITEMS | export.items.created | none | none |
| EXPORT__POST__EXPORT_SUPPLIERS | export.suppliers.created | none | none |
| FINANCE__PATCH__FINANCE_AP_BILLS_UPDATE | finance.update.updated | none | none |
| FINANCE__PATCH__FINANCE_AR_INVOICES_UPDATE | finance.update.updated | observability.audit | direct-call |
| FINANCE__POST__FINANCE_AP_BILL_CREATE | finance.create.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_AP_BILLS_BILLID_CREDIT | finance.credit.created | none | none |
| FINANCE__POST__FINANCE_AP_BILLS_CREATE | finance.create.created | none | none |
| FINANCE__POST__FINANCE_AP_PAYMENT_RECORD | finance.record.created | none | none |
| FINANCE__POST__FINANCE_AP_PAYMENTS_CREATE | finance.create.created | none | none |
| FINANCE__POST__FINANCE_AP_PAYMENTS_PAYMENTID_REVERSE | finance.reverse.created | none | none |
| FINANCE__POST__FINANCE_AR_CREDIT_NOTE_CREATE | finance.create.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_AR_INVOICE_APPROVE | finance.approve.created | none | none |
| FINANCE__POST__FINANCE_AR_INVOICE_CREATE | finance.create.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_AR_INVOICE_PAY | finance.pay.created | metrics.counter | direct-call |
| FINANCE__POST__FINANCE_AR_INVOICE_WRITEOFF | finance.writeoff.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_AR_INVOICES_INVOICEID_CREDIT | finance.credit.created | none | none |
| FINANCE__POST__FINANCE_AR_PAYMENTS_PAYMENTID_REVERSE | finance.reverse.created | none | none |
| FINANCE__POST__FINANCE_AR_RECEIPT_RECORD | finance.record.created | none | none |
| FINANCE__POST__FINANCE_AR_RECEIPTS_CREATE | finance.create.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_ASSETS | finance.assets.created | none | none |
| FINANCE__POST__FINANCE_ASSETS_DEPRECIATE | finance.depreciate.created | none | none |
| FINANCE__POST__FINANCE_ASSETS_ID_DISPOSE | finance.dispose.created | none | none |
| FINANCE__POST__FINANCE_CLOSE_LOCK | finance.lock.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_CLOSE_OPEN | finance.open.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_FA_ACQUIRE | finance.acquire.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_FA_DEPRECIATE | finance.depreciate.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_FA_DISPOSE | finance.dispose.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_FA_REVALUE | finance.revalue.created | observability.audit | direct-call |
| FINANCE__POST__FINANCE_FX_REVALUE | finance.revalue.created | none | none |
| FINANCE__POST__FINANCE_GL_POST | finance.post.created | finance.gl | direct-call |
| FINANCE__POST__FINANCE_GL_REVERSE | finance.reverse.created | none | none |
| FINANCE__POST__FINANCE_JOURNALS_JOURNALID_REVERSE | finance.reverse.created | none | none |
| FINANCE__POST__FINANCE_PERIODS_CLOSE | finance.close.created | none | none |
| FINANCE__POST__FINANCE_PERIODS_OPEN | finance.open.created | none | none |
| FINANCE__POST__FINANCE_VAT_CODES | finance.codes.created | none | none |
| FINANCE__POST__FINANCE_VAT_SUBMIT | finance.submit.created | observability.audit | direct-call |
| FINANCE__PUT__FINANCE_ASSETS_ID | finance.assets.updated | none | none |
| HEALTHCARE__POST__HEALTHCARE_ROTA | healthcare.rota.created | none | none |
| HR__PATCH__HR_EMPLOYEES_ID | hr.employees.updated | observability.audit | direct-call |
| HR__PATCH__HR_PAYROLL_CONFIG | hr.config.updated | none | none |
| HR__POST__HR_EMPLOYEES_CREATE | hr.create.created | observability.audit | direct-call |
| HR__POST__HR_LEAVE_ENTITLEMENTS | hr.entitlements.created | none | none |
| HR__POST__HR_LEAVE_ID_ADJUST | hr.adjust.created | none | none |
| HR__POST__HR_LEAVE_ID_CANCEL | hr.cancel.created | none | none |
| HR__POST__HR_LEAVE_REQUESTS | hr.requests.created | none | none |
| HR__POST__HR_LEAVE_REQUESTS_ID_APPROVE | hr.approve.created | none | none |
| HR__POST__HR_LEAVE_REQUESTS_ID_CANCEL | hr.cancel.created | none | none |
| HR__POST__HR_LEAVE_REQUESTS_ID_REJECT | hr.reject.created | none | none |
| HR__POST__HR_LEAVE_REQUESTS_ID_SUBMIT | hr.submit.created | none | none |
| HR__POST__HR_LEAVE_REQUESTS_ID_TAKEN | hr.taken.created | none | none |
| HR__POST__HR_LEAVE_TYPES | hr.types.created | none | none |
| HR__POST__HR_PAYROLL_RUN | hr.run.created | none | none |
| HR__POST__HR_PAYROLL_RUN_ID_ADJUST | hr.adjust.created | none | none |
| HR__POST__HR_PAYROLL_RUN_ID_REVERSE | hr.reverse.created | none | none |
| IMPORT__POST__IMPORT_COMMIT | import.commit.created | observability.audit | direct-call |
| IMPORT__POST__IMPORT_CUSTOMERS | import.customers.created | none | none |
| IMPORT__POST__IMPORT_CUSTOMERS_APPLY | import.apply.created | none | none |
| IMPORT__POST__IMPORT_CUSTOMERS_PREVIEW | import.preview.created | none | none |
| IMPORT__POST__IMPORT_ITEMS | import.items.created | none | none |
| IMPORT__POST__IMPORT_PREVIEW | import.preview.created | none | none |
| IMPORT__POST__IMPORT_SUPPLIERS | import.suppliers.created | none | none |
| INVENTORY__POST__INVENTORY_ADJUST | inventory.adjust.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_ADJUSTMENTS | inventory.adjustments.created | inventory.adjustment | service-call |
| INVENTORY__POST__INVENTORY_CYCLE | inventory.cycle.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_CYCLE_ID_COUNT | inventory.count.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_CYCLE_ID_POST | inventory.post.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_GRN | inventory.grn.created | inventory.receipt | service-call |
| INVENTORY__POST__INVENTORY_GRN | inventory.grn.created | metrics.counter | direct-call |
| INVENTORY__POST__INVENTORY_ISSUE | inventory.issue.created | none | none |
| INVENTORY__POST__INVENTORY_ITEMS_CREATE | inventory.create.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_ITEMS_DELETE | inventory.delete.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_ITEMS_UPDATE | inventory.update.created | events.outbox | outbox |
| INVENTORY__POST__INVENTORY_ITEMS_UPDATE | inventory.update.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_MOVEMENTS_MOVEMENTID_REVERSE | inventory.reverse.created | none | none |
| INVENTORY__POST__INVENTORY_TRANSFER | inventory.transfer.created | inventory.transfer | service-call |
| INVENTORY__POST__INVENTORY_WAREHOUSES_CREATE | inventory.create.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_WAREHOUSES_UPDATE | inventory.update.created | observability.audit | direct-call |
| INVENTORY__POST__INVENTORY_WMS_RECEIVING_GRN | inventory.grn.created | none | none |
| INVENTORY__POST__INVENTORY_WMS_RECEIVING_PUTAWAY | inventory.putaway.created | none | none |
| INVENTORY__POST__INVENTORY_WMS_SHIPPING_PICK | inventory.pick.created | none | none |
| INVENTORY__POST__INVENTORY_WMS_SHIPPING_SHIP | inventory.ship.created | none | none |
| INVITE__POST__INVITE_ACCEPT | invite.accept.created | none | none |
| JOBS__POST__JOBS_RETRY | jobs.retry.created | none | none |
| MANUFACTURING__DELETE__MANUFACTURING_BOMS | manufacturing.boms.created | none | none |
| MANUFACTURING__DELETE__MANUFACTURING_BOMS | manufacturing.boms.deleted | none | none |
| MANUFACTURING__POST__MANUFACTURING_BOM_ITEMS | manufacturing.items.created | observability.audit | direct-call |
| MANUFACTURING__POST__MANUFACTURING_BOM_ITEMS_DELETE | manufacturing.delete.created | observability.audit | direct-call |
| MANUFACTURING__POST__MANUFACTURING_BOMS | manufacturing.boms.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_BOMS | manufacturing.boms.deleted | none | none |
| MANUFACTURING__POST__MANUFACTURING_COST_ROLLUP | manufacturing.rollup.created | observability.audit | direct-call |
| MANUFACTURING__POST__MANUFACTURING_MRP_FIRM | manufacturing.firm.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_MRP_RUN | manufacturing.run.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WO_CLOSE | manufacturing.close.created | observability.audit | direct-call |
| MANUFACTURING__POST__MANUFACTURING_WO_COMPLETE | manufacturing.complete.created | observability.audit | direct-call |
| MANUFACTURING__POST__MANUFACTURING_WO_CONSUME | manufacturing.consume.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WO_RELEASE | manufacturing.release.created | observability.audit | direct-call |
| MANUFACTURING__POST__MANUFACTURING_WO_SCRAP | manufacturing.scrap.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS | manufacturing.work_orders.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_COMPLETE | manufacturing.complete.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_CONSUME | manufacturing.consume.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_RELEASE | manufacturing.release.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_REVERSE_COMPLETION | manufacturing.reverse_completion.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_REVERSE_CONSUMPTION | manufacturing.reverse_consumption.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORK_ORDERS_ID_SCRAP | manufacturing.scrap.created | none | none |
| MANUFACTURING__POST__MANUFACTURING_WORKORDER_CONSUME_BOM | manufacturing.consume_bom.created | metrics.counter | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_JOBS_PAYROLL_RUN_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_ACCESS_STORE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_ACCESS_TENANTCONFIG_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_AI_LOGGING_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_BILLING_PLANS_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_CRYPTO___TESTS___FIELD_ENCRYPTION_TEST_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_CRYPTO_ENCRYPTION_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_EMAIL___TESTS___MAILER_TEST_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_EMAIL_MAILER_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_HR_EMPLOYEES_ENCRYPTED_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_INTEGRATIONS_SYNC_ORCHESTRATOR_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_KPI_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_LOG_MASK_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_OBSERVABILITY_AUDIT_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_OBSERVABILITY_OBSERVABILITY_AUDIT_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_POS_INVENTORY_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_PRISMA_TYPES_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_PROFILE_PREFS_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_SUPPLY_REPLENISHMENTSTORE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_LIB_TENANT_WIZARD_GUARD_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_ACCOUNTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_ACTIVITIES_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_CONTACTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__CRM_BEFORE_RESTORE_PIPELINES_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_BILLING_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_BILLING_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_COSTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROFITABILITY_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROFITABILITY_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROJECTS_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_PROJECTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_RETAINERS_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_RETAINERS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_TIMESHEETS_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER__PROJECTS_BEFORE_RESTORE_TIMESHEETS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_AI_TENANT_ANALYTICS_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_AUTH_ONBOARDING_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_BILLING_STATUS_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_COSTING_COST_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_ACCOUNTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_ACTIVITIES_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_CONTACTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_PIPELINES_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_CRM_PIPELINES_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EMAIL_EMAIL_LOG_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_FINANCEINVOICES_TS | synthetic.non_route.operation.write | dashboards.super-admin | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_FINANCEINVOICES_TS | synthetic.non_route.operation.write | dashboards.tenant | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_FINANCEINVOICES_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_FINANCEINVOICES_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_INVENTORYITEMS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_PROFILEAI_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_PURCHASINGPO_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_SALESORDERS_TS | synthetic.non_route.operation.write | dashboards.super-admin | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_SALESORDERS_TS | synthetic.non_route.operation.write | dashboards.tenant | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_ERP_SALESORDERS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EVENTS_OUTBOXREPOSITORY_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_EVENTS_SUBSCRIBERS_INDEX_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_AP_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_AP_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_ASSETS_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_BANKING_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_GL_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_GL_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_LIFECYCLE_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_LIFECYCLE_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_PERIODCLOSE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_FINANCE_VAT_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_EMPLOYEES_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_LEAVE_SERVICE_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_LEAVECONFIG_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLCONFIG_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLRUN_SERVICE_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_HR_PAYROLLRUN_SERVICE_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORT_EXPORT_MASTERDATA_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORTS_MASTERDATA_TS | synthetic.non_route.operation.write | events.outbox | outbox |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_IMPORTS_MASTERDATA_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_CORRECTIONS_SERVICE_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_CORRECTIONS_SERVICE_TS | synthetic.non_route.operation.write | inventory.adjustment | service-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_CORRECTIONS_SERVICE_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_COSTING_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_GRN_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_ITEMS_SERVICE_TS | synthetic.non_route.operation.write | metrics.dimension | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_MOVEMENTS_SERVICE_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_MOVEMENTS_SERVICE_TS | synthetic.non_route.operation.write | inventory.receipt | service-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_MOVEMENTS_SERVICE_TS | synthetic.non_route.operation.write | inventory.transfer | service-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_MOVEMENTS_SERVICE_TS | synthetic.non_route.operation.write | metrics.dimension | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSRECEIVING_SERVICE_TS | synthetic.non_route.operation.write | inventory.receipt | service-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSRECEIVING_SERVICE_TS | synthetic.non_route.operation.write | inventory.transfer | service-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_INVENTORY_WMSSHIPPING_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_CORE_SERVICE_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_CORE_SERVICE_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_MANUFACTURING_WORKORDER_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_METRICS_STORE_TS | synthetic.non_route.operation.write | metrics.dimension | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_NOTIFICATIONS_CHAT_NOTIFICATIONS_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_NOTIFICATIONS_CONFIG_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SALES_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SALES_TS | synthetic.non_route.operation.write | inventory.receipt | service-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SALES_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_POS_SESSIONS_SERVICE_TS | synthetic.non_route.operation.write | finance.gl | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_PRESETS_REPOSITORY_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_PROJECTS_COSTS_TS | synthetic.non_route.operation.write | observability.audit | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_AI_CONFIG_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_COMPLIANCE_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_INTEGRATIONS_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_OPS_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_SECURITY_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_TENANTS_SERVICE_TS | synthetic.non_route.operation.write | dashboards.super-admin | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_TENANTS_SERVICE_TS | synthetic.non_route.operation.write | dashboards.tenant | direct-call |
| NON_ROUTE__WRITE__APPS_WEB_SRC_SERVER_SUPER_ADMIN_USERS_SERVICE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__APPS_WEB_SRC_TESTS_SEED_SEED_ALIGNMENT_TEST_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_E2E_CREATE_USER_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEED_DEMO_TENANT_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEED_KPI_JS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEED_KPI_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEED_USERS_TABLE_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE4_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE5_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASE7_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SEEDS_SEED_PHASEA_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_SET_DEMO_PASSWORD_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_TENANCY_BACKFILL_MASTER_TENANT_TS | synthetic.non_route.operation.write | none | none |
| NON_ROUTE__WRITE__SCRIPTS_TENANCY_CREATE_DEMO_TENANT_TS | synthetic.non_route.operation.write | none | none |
| PLANNING__POST__PLANNING_BUDGETS | planning.budgets.created | none | none |
| PLANNING__POST__PLANNING_FORECAST | planning.forecast.created | none | none |
| POS__POST__POS_REFUND_CREATE | pos.create.created | none | none |
| POS__POST__POS_REFUND_FINALISE | pos.finalise.created | none | none |
| POS__POST__POS_SALE_CREATE | pos.create.created | none | none |
| POS__POST__POS_SALE_FINALISE | pos.finalise.created | metrics.counter | direct-call |
| POS__POST__POS_SALE_SALEID_VOID | pos.void.created | none | none |
| POS__POST__POS_SALE_UPDATE | pos.update.created | none | none |
| POS__POST__POS_SALES | pos.sales.created | none | none |
| POS__POST__POS_SESSIONS_CLOSE | pos.close.created | none | none |
| POS__POST__POS_SESSIONS_OPEN | pos.open.created | none | none |
| POS__POST__POS_SHIFTS | pos.shifts.created | none | none |
| POS__POST__POS_SHIFTS_CLOSE | pos.close.created | observability.audit | direct-call |
| POS__POST__POS_SHIFTS_OPEN | pos.open.created | observability.audit | direct-call |
| PRESETS__POST__PRESETS | presets.presets.created | none | none |
| PROFILE__POST__PROFILE_PREFERENCES | profile.preferences.created | none | none |
| PROFILE__POST__PROFILE_THEME_GENERATE | profile.generate.created | none | none |
| PROJECTS__POST__PROJECTS_BILLING_EXPORT | projects.export.created | none | none |
| PROJECTS__POST__PROJECTS_TIMESHEETS | projects.timesheets.created | none | none |
| PROJECTS__POST__PROJECTS_TIMESHEETS_APPROVE | projects.approve.created | none | none |
| PROJECTS__POST__PROJECTS_TIMESHEETS_ROLLUP | projects.rollup.created | metrics.counter | direct-call |
| PURCHASING__POST__PURCHASING_BILL_FROM_PO | purchasing.from_po.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_CONTRACTS | purchasing.contracts.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_GRN_POST | purchasing.post.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_PO_APPROVE | purchasing.approve.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_RFQ | purchasing.rfq.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_RFQ_ID_AWARD | purchasing.award.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_RFQ_ID_RESPOND | purchasing.respond.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_SUPPLIERS_CREATE | purchasing.create.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_SUPPLIERS_DELETE | purchasing.delete.created | observability.audit | direct-call |
| PURCHASING__POST__PURCHASING_SUPPLIERS_UPDATE | purchasing.update.created | observability.audit | direct-call |
| QUALITY__POST__QUALITY_HOLDS | quality.holds.created | observability.audit | direct-call |
| QUALITY__POST__QUALITY_HOLDS_ID_RELEASE | quality.release.created | observability.audit | direct-call |
| QUALITY__POST__QUALITY_INSPECTIONS | quality.inspections.created | observability.audit | direct-call |
| QUALITY__POST__QUALITY_INSPECTIONS_ID_UPDATE | quality.update.created | observability.audit | direct-call |
| REPORTS__DELETE__REPORTS_SCHEDULE | reports.schedule.created | observability.audit | direct-call |
| REPORTS__DELETE__REPORTS_SCHEDULE | reports.schedule.deleted | observability.audit | direct-call |
| REPORTS__POST__REPORTS_SCHEDULE | reports.schedule.created | observability.audit | direct-call |
| REPORTS__POST__REPORTS_SCHEDULE | reports.schedule.deleted | observability.audit | direct-call |
| REPORTS__POST__REPORTS_SEND_NOW | reports.send_now.created | observability.audit | direct-call |
| SALES__POST__SALES_CREDIT_CREATE | sales.create.created | observability.audit | direct-call |
| SALES__POST__SALES_INVOICE_FROM_ORDER | sales.from_order.created | observability.audit | direct-call |
| SALES__POST__SALES_ORDER_CREATE | sales.create.created | observability.audit | direct-call |
| SALES__POST__SALES_ORDER_DELIVER | sales.deliver.created | observability.audit | direct-call |
| STRIPE__POST__STRIPE_WEBHOOK | stripe.webhook.created | observability.audit | direct-call |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_INTEGRATIONS_ID | super-admin.integrations.deleted | none | none |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_INTEGRATIONS_ID | super-admin.integrations.updated | none | none |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_TENANTS_TENANTID | super-admin.tenants.deleted | none | none |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_TENANTS_TENANTID | super-admin.tenants.updated | none | none |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_USERS_USERID | super-admin.users.deleted | none | none |
| SUPER-ADMIN__DELETE__SUPER_ADMIN_USERS_USERID | super-admin.users.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_AI_CONFIG | super-admin.config.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_BILLING_PLAN_TEMPLATES_ID | super-admin.plan_templates.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_COMPLIANCE_CONFIG | super-admin.config.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_INTEGRATIONS_ID | super-admin.integrations.deleted | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_INTEGRATIONS_ID | super-admin.integrations.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_OPS_RUNBOOKS_ID | super-admin.runbooks.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_SECURITY_POLICIES | super-admin.policies.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID | super-admin.tenants.deleted | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID | super-admin.tenants.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_TENANTS_TENANTID_BILLING | super-admin.billing.updated | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_USERS_USERID | super-admin.users.deleted | none | none |
| SUPER-ADMIN__PATCH__SUPER_ADMIN_USERS_USERID | super-admin.users.updated | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING | super-admin.billing.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING_PLAN_TEMPLATES | super-admin.plan_templates.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_BILLING_PLANS | super-admin.plans.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_COMPLIANCE_EXPORT_SNAPSHOT | super-admin.export_snapshot.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_COMPLIANCE_RUN_CHECK | super-admin.run_check.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_INTEGRATIONS | super-admin.integrations.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_NOTIFICATIONS_CONFIG | super-admin.config.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_OPS_RUNBOOKS | super-admin.runbooks.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_TENANTS | super-admin.tenants.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_TENANTS_CREATE | super-admin.create.created | none | none |
| SUPER-ADMIN__POST__SUPER_ADMIN_USERS | super-admin.users.created | none | none |
| SUPPLY__POST__SUPPLY_PACK_WAVEID | supply.pack.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_PICK_CREATE_WAVE | supply.create_wave.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_PICK_TASKID_COMPLETE | supply.complete.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_PICK_WAVES_WAVEID_ASSIGN_TASK | supply.assign_task.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_REPLENISHMENT_APPLY | supply.apply.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_REPLENISHMENT_RULES | supply.rules.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_RMA | supply.rma.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_RMA_ID_PROCESS | supply.process.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_RMA_ID_UPDATE | supply.update.created | observability.audit | direct-call |
| SUPPLY__POST__SUPPLY_SHIP_WAVEID | supply.ship.created | observability.audit | direct-call |
| TENANT__POST__TENANT_DELETE | tenant.delete.created | observability.audit | direct-call |
| TENANT__POST__TENANT_EXPORT | tenant.export.created | observability.audit | direct-call |
| TENANT__POST__TENANT_SETUP_COMPLETE | tenant.complete.created | observability.audit | direct-call |
| TENANT__POST__TENANT_USERS_UPDATE | tenant.update.created | observability.audit | direct-call |
| TEST__POST__TEST_SET_ROLE | test.set_role.created | none | none |
| WORKFLOW__POST__WORKFLOW_DEFINITIONS | workflow.definitions.created | none | none |
| WORKFLOW__POST__WORKFLOW_INSTANCES_ID_APPROVE | workflow.approve.created | none | none |
| WORKFLOW__POST__WORKFLOW_INSTANCES_ID_REJECT | workflow.reject.created | none | none |
