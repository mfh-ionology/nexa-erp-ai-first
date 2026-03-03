# ERP Manifest (Plan-driven)

## Finance (finance)
- Entities: 10
- Flows: 10
- Invariants: 8
- Propagation: 6
- Flows:
  - finance.invoice_create_draft (planned) → docs/nexa/ERP-GAP-CLOSURE-PLAN-2025-11.md#classification-from-erp-inventory-2025-11md
  - finance.invoice_approve_post (planned) → docs/modules/finance.md#finance-module
  - finance.invoice_cancel_void (planned) → docs/modules/finance.md#finance-module
  - finance.credit_note_issue_apply (planned) → docs/modules/finance.md#finance-module
  - finance.payment_record (planned) → docs/modules/finance.md#finance-module
  - finance.payment_allocate (planned) → docs/modules/finance.md#finance-module
  - finance.ar_statement_generate (planned) → docs/modules/finance.md#finance-module
  - finance.ar_aging_generate (planned) → docs/modules/finance.md#finance-module
  - finance.vat_calculate_on_invoice (planned) → docs/nexa/ERP-GAP-CLOSURE-PLAN-2025-11.md#classification-from-erp-inventory-2025-11md
  - finance.vat_return_prepare_submit (planned) → docs/modules/finance.md#finance-module

## Inventory & WMS (inventory)
- Entities: 10
- Flows: 10
- Invariants: 8
- Propagation: 6
- Flows:
  - inventory.item_create_update (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.receive_grn (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.putaway_location_assign (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.issue_or_ship (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.transfer_between_locations (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.adjustment_with_reason (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.stock_take_cycle_count (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.valuation_recalc (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.idempotent_receipt_no_double_post (planned) → docs/modules/inventory-wms.md#inventory-wms-module
  - inventory.prevent_negative_stock_policy (planned) → docs/modules/inventory-wms.md#inventory-wms-module

## manufacturing (manufacturing)
- Entities: 10
- Flows: 11
- Invariants: 8
- Propagation: 6
- Flows:
  - manufacturing.bom_create_update (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.bom_versioning (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.work_order_create (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.work_order_release (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.component_consume (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.record_scrap (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.work_order_complete (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.receive_finished_goods (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.idempotent_wo_complete (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.idempotent_wo_complete_no_double_post (planned) → docs/modules/manufacturing.md#manufacturing-module
  - manufacturing.availability_updates_planning (planned) → docs/modules/manufacturing.md#manufacturing-module

## sales_crm (sales_crm)
- Entities: 10
- Flows: 12
- Invariants: 8
- Propagation: 6
- Flows:
  - sales_crm.lead_capture_create (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.lead_qualify_convert_to_opportunity (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.contact_create_update (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.account_create_update (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.opportunity_stage_update (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.activity_log_create (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.quote_create_send (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.quote_accept_reject (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.opportunity_close_win_loss (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.sales_order_create_or_handoff_to_o2c (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.pipeline_report_view (planned) → docs/modules/sales-crm.md#sales-crm-module
  - sales_crm.duplicate_lead_merge (planned) → docs/modules/sales-crm.md#sales-crm-module

## projects (projects)
- Entities: 10
- Flows: 12
- Invariants: 8
- Propagation: 6
- Flows:
  - projects.project_create (planned) → docs/modules/projects.md#projects-module
  - projects.task_or_milestone_create_update (planned) → docs/modules/projects.md#projects-module
  - projects.project_member_add_remove (planned) → docs/modules/projects.md#projects-module
  - projects.task_status_update (planned) → docs/modules/projects.md#projects-module
  - projects.timesheet_submit (planned) → docs/modules/projects.md#projects-module
  - projects.timesheet_edit_resubmit (planned) → docs/modules/projects.md#projects-module
  - projects.timesheet_approve_reject (planned) → docs/modules/projects.md#projects-module
  - projects.project_cost_rollup_update (planned) → docs/modules/projects.md#projects-module
  - projects.expense_or_cost_entry_add (planned) → docs/modules/projects.md#projects-module
  - projects.utilisation_report_view (planned) → docs/modules/projects.md#projects-module
  - projects.project_billing_generate_invoice_or_handoff (planned) → docs/modules/projects.md#projects-module
  - projects.project_close (planned) → docs/modules/projects.md#projects-module