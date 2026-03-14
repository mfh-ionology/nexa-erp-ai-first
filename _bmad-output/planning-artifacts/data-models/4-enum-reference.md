# 4. Enum Reference

## 4.1 System Module

| Enum | Values | @@map |
|------|--------|-------|
| VatType | STANDARD, REDUCED, ZERO, EXEMPT, OUTSIDE_SCOPE, REVERSE_CHARGE, SECOND_HAND | vat_type |
| VatScheme | STANDARD, FLAT_RATE, CASH | vat_scheme |
| ViewScope | PERSONAL, ROLE, GLOBAL | view_scope |
| FieldDataType | STRING, NUMBER, DATE, BOOLEAN, ENUM, CURRENCY | field_data_type |
| LovType | NONE, STATIC, GLOBAL, VIEW_SPECIFIC | lov_type |
| PinPosition | NONE, LEFT, RIGHT | pin_position |
| FilterOperator | EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY | filter_operator |
| ExchangeRateSource | BOE, ECB, MANUAL | exchange_rate_source |
| TagType | CUSTOMER, ITEM, ORDER, GENERAL | tag_type |
| HolidayType | PUBLIC, COMPANY, SPECIAL | holiday_type |
| SettingCategory | GENERAL, FINANCE, AR, AP, SALES, PURCHASING, INVENTORY, CRM, HR, MANUFACTURING, REPORTING | setting_category |
| SettingValueType | STRING, NUMBER, BOOLEAN, JSON | setting_value_type |
| SharingMode | NONE, ALL_COMPANIES, SELECTED | sharing_mode |
| UserRole | SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER | user_role |
| DocumentType | SALES_INVOICE, CREDIT_NOTE, CASH_RECEIPT, PROFORMA_INVOICE, CUSTOMER_STATEMENT, SALES_ORDER, SALES_QUOTE, DELIVERY_NOTE, PURCHASE_ORDER, GOODS_RECEIPT_NOTE, SUPPLIER_REMITTANCE, PAYSLIP, P45, P60 | (none) |
| ResourceType | PAGE, REPORT, SETTING, MAINTENANCE | resource_type |
| FieldVisibility | VISIBLE, READ_ONLY, HIDDEN | field_visibility |
| MobileNavStyle | CLASSIC_TABS, MINIMAL, MY_SHORTCUTS | mobile_nav_style |

## 4.2 Finance / GL

| Enum | Values | @@map |
|------|--------|-------|
| AccountType | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE | (none) |
| NormalBalance | DEBIT, CREDIT | (none) |
| AccountMappingType | AR_CONTROL, AP_CONTROL, STOCK, STOCK_COST, STOCK_VARIANCE, SALES_REVENUE, PURCHASE_EXPENSE, VAT_OUTPUT, VAT_INPUT, EXCHANGE_GAIN, EXCHANGE_LOSS, ROUNDING, BANK_CHARGES, DISCOUNT_GIVEN, DISCOUNT_RECEIVED, INTEREST_INCOME, INTEREST_EXPENSE, DEPRECIATION_EXPENSE, ACCUMULATED_DEPRECIATION, ASSET_DISPOSAL_GAIN, ASSET_DISPOSAL_LOSS, WIP, PRODUCTION_OVERHEAD, PAYROLL_EXPENSE, PAYROLL_LIABILITY, RETENTION, CASH_IN_TRANSIT, POS_CLEARING | (none) |
| JournalSource | MANUAL, AR_INVOICE, AR_CREDIT_NOTE, AR_PAYMENT, AP_BILL, AP_CREDIT_NOTE, AP_PAYMENT, BANK_PAYMENT, BANK_RECEIPT, BANK_TRANSFER, STOCK_MOVEMENT, STOCK_REVALUATION, GOODS_RECEIPT, SHIPMENT, DEPRECIATION, PAYROLL, PRODUCTION, VAT_ADJUSTMENT, YEAR_END, OPENING_BALANCE, POS_CASHUP | (none) |
| JournalStatus | DRAFT, POSTED, REVERSED | (none) |
| PeriodStatus | OPEN, CLOSED, LOCKED | (none) |
| BankImportSource | CSV, OFX, QIF, OPEN_BANKING, MANUAL | (none) |
| ReconciliationMatchStatus | UNMATCHED, MATCHED, RECONCILED | (none) |
| ReconciliationStatus | IN_PROGRESS, COMPLETED | (none) |
| BudgetStatus | DRAFT, APPROVED, LOCKED | (none) |
| BudgetType | REVENUE, EXPENSE, CAPITAL, FULL | (none) |

## 4.3 Inventory

| Enum | Values | @@map |
|------|--------|-------|
| ItemType | STOCK, SERVICE, NON_STOCK, KIT | `item_type` |
| CostingMethod | FIFO, WEIGHTED_AVERAGE, STANDARD, LAST_PURCHASE | `costing_method` |
| StockMovementType | GOODS_RECEIPT, GOODS_ISSUE, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, RETURN_OUT, PRODUCTION_IN, PRODUCTION_OUT, OPENING_BALANCE, SCRAP | `stock_movement_type` |
| StockMovementStatus | DRAFT, POSTED, REVERSED | `stock_movement_status` |
| StockMovementSourceType | PURCHASE_ORDER, SALES_ORDER, MANUAL, PRODUCTION, TRANSFER, RETURN | `stock_movement_source_type` |
| SerialNumberStatus | AVAILABLE, RESERVED, SOLD, RETURNED, QUARANTINE | `serial_number_status` |

## 4.4 Sales Ledger (AR)

| Enum | Values | @@map |
|------|--------|-------|
| CustomerType | COMPANY, INDIVIDUAL | `customer_type` |
| AddressType | BILLING, SHIPPING, REGISTERED, OTHER | `address_type` |
| InvoiceType | STANDARD, CASH, CREDIT_NOTE, DEBIT_NOTE, PROFORMA | `invoice_type` |
| InvoiceStatus | DRAFT, APPROVED, POSTED, CANCELLED, VOID | `invoice_status` |
| PaymentMethod | BANK_TRANSFER, CARD, CASH, CHEQUE, DIRECT_DEBIT | `payment_method` |
| PaymentStatus | DRAFT, POSTED, CANCELLED | `payment_status` |

## 4.5 Sales Orders

| Enum | Values | @@map |
|------|--------|-------|
| SalesQuoteStatus | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED, CANCELLED | `sales_quote_status` |
| SalesOrderStatus | DRAFT, APPROVED, IN_PROGRESS, PARTIALLY_SHIPPED, FULLY_SHIPPED, PARTIALLY_INVOICED, FULLY_INVOICED, CLOSED, CANCELLED | `sales_order_status` |
| SalesOrderLineStatus | OPEN, PARTIALLY_FULFILLED, FULFILLED, CANCELLED | `sales_order_line_status` |
| DispatchStatus | DRAFT, PICKED, PACKED, SHIPPED, DELIVERED, CANCELLED | `dispatch_status` |

## 4.6 Purchasing (AP)

| Enum | Values | @@map |
|------|--------|-------|
| SupplierType | COMPANY, INDIVIDUAL | (none) |
| SupplierStatus | ACTIVE, ON_HOLD, BLOCKED, TERMINATED | (none) |
| PurchaseOrderStatus | DRAFT, APPROVED, SENT, PARTIALLY_RECEIVED, FULLY_RECEIVED, PARTIALLY_INVOICED, FULLY_INVOICED, CLOSED, CANCELLED | (none) |
| PurchaseOrderLineStatus | OPEN, PARTIALLY_RECEIVED, RECEIVED, CANCELLED | (none) |
| GoodsReceiptStatus | DRAFT, POSTED, CANCELLED | (none) |
| SupplierBillStatus | DRAFT, APPROVED, POSTED, PARTIALLY_PAID, PAID, CANCELLED | (none) |
| MatchStatus | UNMATCHED, PARTIALLY_MATCHED, FULLY_MATCHED | (none) |
| SupplierPaymentStatus | DRAFT, APPROVED, SENT, COMPLETED, CANCELLED | (none) |
| PaymentMethod (AP) | BACS, BANK_TRANSFER, CHEQUE, DIRECT_DEBIT, CARD | (none) |
| BacsRunStatus | DRAFT, APPROVED, SUBMITTED, COMPLETED, FAILED | (none) |

## 4.7 Fixed Assets

| Enum | Values | @@map |
|------|--------|-------|
| DepreciationMethodType | STRAIGHT_LINE, DECLINING_BALANCE, UNITS_OF_PRODUCTION, SUM_OF_YEARS_DIGITS | `depreciation_method_type` |
| FixedAssetStatus | ACTIVE, FULLY_DEPRECIATED, DISPOSED, WRITTEN_OFF, UNDER_CONSTRUCTION | `fixed_asset_status` |
| DisposalType | SALE, SCRAP, WRITE_OFF, TRADE_IN | `disposal_type` |
| AssetTransactionType | ACQUISITION, DEPRECIATION, TRANSFER, REVALUATION, DISPOSAL, ADJUSTMENT | `asset_transaction_type` |
| DepreciationEntryStatus | DRAFT, POSTED | `depreciation_entry_status` |
| AssetDisposalStatus | DRAFT, APPROVED, POSTED, CANCELLED | `asset_disposal_status` |
| AssetTransferStatus | DRAFT, APPROVED, POSTED, CANCELLED | `asset_transfer_status` |

## 4.8 Pricing

| Enum | Values | @@map |
|------|--------|-------|
| PriceType | FIXED, QUANTITY_BREAK, CUSTOMER_SPECIFIC | `price_type` |
| FormulaBaseSource | COST_PRICE, SALES_PRICE_1, SALES_PRICE_2, SALES_PRICE_3, LAST_PURCHASE_PRICE, WEIGHTED_AVERAGE, BASE_PRICE_LIST | `formula_base_source` |
| RebateType | PERCENTAGE, FIXED_AMOUNT, TIERED | `rebate_type` |

## 4.9 Cross-Cutting

| Enum | Values | @@map |
|------|--------|-------|
| NoteType | GENERAL, INTERNAL, CUSTOMER_VISIBLE, SYSTEM | `note_type` |
| RecordLinkType | CREATED_FROM, FULFILLS, PAYMENT_FOR, CREDIT_FOR, RELATES_TO, PARENT_CHILD | `record_link_type` |
| ApprovalScopeType | PER_RECORD, PER_LINE | `approval_scope_type` |
| ApproverType | SPECIFIC_USER, ROLE, DEPARTMENT_MANAGER, CUSTOM | `approver_type` |
| ApprovalStatus | PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED, FORWARDED | `approval_status` |
| ActivityType | MEETING, CALL, EMAIL, TODO, NOTE, FOLLOW_UP, WORK_HOURS | `activity_type` |
| ActivityStatus | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED | `activity_status` |
| ActivityPriority | LOW, NORMAL, HIGH, URGENT | `activity_priority` |

## 4.10 CRM

| Enum | Values | @@map |
|------|--------|-------|
| CrmLeadRating | NONE, COLD, WARM, HOT | `crm_lead_rating` |
| CrmLeadLifecycle | NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED, LOST | `crm_lead_lifecycle` |
| CrmCampaignStatus | DRAFT, ACTIVE, COMPLETED, CANCELLED | `crm_campaign_status` |
| CrmCampaignRecipientType | LEAD, CUSTOMER | `crm_campaign_recipient_type` |
| CrmOpportunityStatus | OPEN, WON, LOST, CANCELLED | `crm_opportunity_status` |
| CrmPipelineEntityType | LEAD, OPPORTUNITY, ACTIVITY, SALES_QUOTE, SALES_ORDER | `crm_pipeline_entity_type` |
| CrmActivityAutoTrigger | SALES_ORDER_CREATED, SALES_ORDER_APPROVED, INVOICE_POSTED, PAYMENT_RECEIVED, OPPORTUNITY_WON, OPPORTUNITY_LOST, LEAD_CONVERTED, EMAIL_SENT, EMAIL_RECEIVED | `crm_activity_auto_trigger` |

## 4.11 HR & Payroll

| Enum | Values | @@map |
|------|--------|-------|
| EmployeeStatus | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RETIRED | `employee_status` |
| Gender | MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY | `gender` |
| MaritalStatus | SINGLE, MARRIED, CIVIL_PARTNERSHIP, DIVORCED, WIDOWED, SEPARATED, OTHER | `marital_status` |
| SalaryFrequency | MONTHLY, YEARLY, WEEKLY, FORTNIGHTLY, HOURLY | `salary_frequency` |
| ContractStatus | DRAFT, APPROVED, TERMINATED | `contract_status` |
| TerminationReason | RESIGNATION, NON_RENEWAL, DISMISSAL_OPERATIONAL, DISMISSAL_MISCONDUCT, DISMISSAL_INCAPACITY, DISMISSAL_RETIREMENT, DEATH, TRANSFER_DEPARTMENT, TRANSFER_COUNTRY, END_OF_INTERNSHIP, TRIAL_PERIOD_FAILED, DISMISSAL_NON_PERFORMANCE, REDUNDANCY, MUTUAL_AGREEMENT | `termination_reason` |
| ContractChangeReason | NEW, PROMOTION, TRANSFER, DEMOTION, SALARY_REVIEW, ROLE_CHANGE, DEPARTMENT_CHANGE, OTHER | `contract_change_reason` |
| BenefitFrequency | ONE_OFF, WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, YEARLY | `benefit_frequency` |
| JobPositionStatus | OPENING, VACANT, FILLED, CANCELLED | `job_position_status` |
| ChecklistType | ONBOARDING, OFFBOARDING, OTHER | `checklist_type` |
| ChecklistItemStatus | PENDING, IN_PROGRESS, COMPLETED, NOT_APPLICABLE | `checklist_item_status` |
| AppraisalStatus | DRAFT, APPROVED | `appraisal_status` |
| SkillsEvalStatus | DRAFT, APPROVED, TERMINATED | `skills_eval_status` |
| TrainingStatus | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, CLOSED | `training_status` |
| LeaveType | ANNUAL, SICK, MATERNITY, PATERNITY, SHARED_PARENTAL, ADOPTION, BEREAVEMENT, COMPASSIONATE, JURY_SERVICE, UNPAID, STUDY, OTHER | `leave_type` |
| LeaveRequestStatus | PENDING, APPROVED, REJECTED, CANCELLED, TAKEN | `leave_request_status` |
| LeaveCalculationBase | CALENDAR_DAYS, WORKING_HOURS | `leave_calculation_base` |
| TaxBasis | CUMULATIVE, WEEK1_MONTH1, EMERGENCY | `tax_basis` |
| NICategory | A, B, C, F, H, I, J, L, M, S, V, Z | `ni_category` |
| StudentLoanPlan | PLAN_1, PLAN_2, PLAN_4, PLAN_5, POSTGRADUATE | `student_loan_plan` |
| StatutoryPayType | SSP, SMP, SPP, ShPP, SAP, SPBP | `statutory_pay_type` |
| PensionSchemeType | DEFINED_CONTRIBUTION, DEFINED_BENEFIT, NEST, SMART_PENSION, OTHER | `pension_scheme_type` |
| PensionEnrolmentStatus | ELIGIBLE_JOBHOLDER, NON_ELIGIBLE_JOBHOLDER, ENTITLED_WORKER, ENROLLED, OPTED_IN, OPTED_OUT, CEASED_MEMBERSHIP | `pension_enrolment_status` |
| PensionContributionMethod | RELIEF_AT_SOURCE, NET_PAY | `pension_contribution_method` |
| PayrollRunStatus | DRAFT, CALCULATED, REVIEWED, APPROVED, PAID, POSTED, CANCELLED | `payroll_run_status` |
| PayrollFrequency | WEEKLY, FORTNIGHTLY, FOUR_WEEKLY, MONTHLY | `payroll_frequency` |
| PayrollLineType | GROSS_PAY, OVERTIME, BONUS, COMMISSION, ALLOWANCE, BENEFIT_IN_KIND, SALARY_SACRIFICE, PAYE_TAX, EMPLOYEE_NI, EMPLOYER_NI, STUDENT_LOAN, POSTGRAD_LOAN, EMPLOYEE_PENSION, EMPLOYER_PENSION, SSP, SMP, SPP, ShPP, SAP, SPBP, ATTACHMENT_OF_EARNINGS, COURT_ORDER, OTHER_DEDUCTION, OTHER_ADDITION, NET_PAY | `payroll_line_type` |
| HMRCSubmissionType | FPS, EPS, EARLIER_YEAR_UPDATE, P45, P46 | `hmrc_submission_type` |
| HMRCSubmissionStatus | DRAFT, GENERATED, SUBMITTED, ACCEPTED, REJECTED, ERROR | `hmrc_submission_status` |

## 4.12 Production / MRP

| Enum | Values | @@map |
|------|--------|-------|
| ProductionOrderStatus | CREATED, RELEASED, STARTED, FINISHED, CANCELLED | `production_order_status` |
| ProductionStatus | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED | `production_status` |
| ProductionOperationStatus | CREATED, STARTED, FINISHED, CANCELLED, FINISHED_DISCARDED | `production_operation_status` |
| ProductionPlanStatus | DRAFT, APPROVED, CLOSED | `production_plan_status` |
| ProductionPlanPeriodType | MONTHLY, WEEKLY | `production_plan_period_type` |
| ProductionPlanLineType | NORMAL, SUBRECIPE | `production_plan_line_type` |
| RecipeLineDirection | INPUT, OUTPUT | `recipe_line_direction` |
| ProductionGlMode | FROM_PRODUCTION, FROM_OPERATIONS | `production_gl_mode` |
| QuantityMode | PER_UNIT, ABSOLUTE | `quantity_mode` |
| ProductionPlanGenerationMode | DIRECT_PRODUCTION, VIA_PRODUCTION_ORDER | `production_plan_generation_mode` |

## 4.13 POS

| Enum | Values | @@map |
|------|--------|-------|
| POSTerminalStatus | ACTIVE, INACTIVE, MAINTENANCE | `pos_terminal_status` |
| POSSessionStatus | OPEN, CLOSED | `pos_session_status` |
| POSSaleStatus | IN_PROGRESS, SUSPENDED, COMPLETED, VOIDED | `pos_sale_status` |
| POSSaleType | SALE, RETURN | `pos_sale_type` |
| POSSaleLineStatus | ACTIVE, VOIDED | `pos_sale_line_status` |
| POSPaymentMethodType | CASH, CREDIT_CARD, DEBIT_CARD, GIFT_VOUCHER, CHEQUE, ON_ACCOUNT, LOYALTY_POINTS, MOBILE_PAYMENT, QR_PAYMENT, OTHER | `pos_payment_method_type` |
| POSCashMovementType | CASH_IN, CASH_OUT, WRITE_OFF | `pos_cash_movement_type` |
| POSCashupStatus | DRAFT, COMPLETED, POSTED | `pos_cashup_status` |
| POSJournalAction | ADD_ITEM, VOID_ITEM, DELETE_ITEM, CHANGE_PRICE, CHANGE_QUANTITY, APPLY_DISCOUNT, PAYMENT_CASH, PAYMENT_CARD, PAYMENT_OTHER, FINISH_SALE, VOID_SALE, PRINT_RECEIPT, PRINT_RECEIPT_COPY, PRINT_X_REPORT, PRINT_Z_REPORT, OPEN_DRAWER, OPEN_SESSION, CLOSE_SESSION, LOGIN, LOGOUT, RETURN_ITEM, RETURN_SALE, SUSPEND_SALE, RESUME_SALE, TRANSFER_TO_INVOICE, CASH_IN, CASH_OUT, PRICE_LOOKUP, STARTUP, SHUTDOWN | `pos_journal_action` |
| POSButtonActionType | (40+ values covering item selection, payment, transaction control, navigation, modifiers, session/cash, reports, customer, transfers, printing) | `pos_button_action_type` |

## 4.14 Projects & Job Costing

| Enum | Values | @@map |
|------|--------|-------|
| ProjectStatus | DRAFT, ACTIVE, ON_HOLD, COMPLETED, CANCELLED, ARCHIVED | `project_status` |
| ProjectBillingMethod | TIME_AND_MATERIALS, FIXED_PRICE, NON_BILLABLE | `project_billing_method` |
| ProjectTaskStatus | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED | `project_task_status` |
| TimesheetStatus | DRAFT, SUBMITTED, APPROVED, REJECTED | `timesheet_status` |
| ProjectExpenseStatus | DRAFT, SUBMITTED, APPROVED, REJECTED, INVOICED | `project_expense_status` |
| ProjectTransactionSourceType | TIMESHEET, VENDOR_INVOICE, EXPENSE, GOODS_RECEIPT, ACTIVITY, PURCHASE_ORDER, MANUAL | `project_transaction_source_type` |
| ProjectTransactionStatus | PENDING, APPROVED, INVOICED, WRITTEN_OFF | `project_transaction_status` |
| ProjectRateType | ROLE, EMPLOYEE, ITEM, TASK | `project_rate_type` |
| ProjectInvoiceScheduleStatus | PENDING, INVOICED, CANCELLED | `project_invoice_schedule_status` |

## 4.15 Contracts & Agreements

| Enum | Values | @@map |
|------|--------|-------|
| AgreementStatus | DRAFT, ACTIVE, CLOSED, CANCELLED | `agreement_status` |
| AgreementInvoiceBase | PER_CHARGE, PER_LINE, PER_AGREEMENT | `agreement_invoice_base` |
| AgreementInvoiceGrouping | PER_AGREEMENT, PER_CUSTOMER, SPLIT_BY_SITE | `agreement_invoice_grouping` |
| ChargePeriodType | DAYS, MONTHS, FIXED | `charge_period_type` |
| BankHolidayHandling | IGNORE, EXCLUDE_GLOBAL, EXCLUDE_BY_COUNTRY | `bank_holiday_handling` |
| AgreementChargeCategory | RENTAL, CONSUMABLE | `agreement_charge_category` |
| AgreementChargeStatus | UNINVOICED, INVOICED | `agreement_charge_status` |
| OffHireStatus | DRAFT, CONFIRMED, CANCELLED | `off_hire_status` |
| ContractStatus (Agreements) | DRAFT, ACTIVE, RENEWED, CANCELLED, EXPIRED | `contract_status` |
| ContractPeriodType | DAYS, MONTHS | `contract_period_type` |
| LoanAgreementStatus | NEW, APPROVED, SIGNED, ACTIVE, DISBURSED, PAUSED, CANCELLED, FINISHED | `loan_agreement_status` |
| LoanScheduleType | ANNUITY, LINEAR, LINEAR_EQUAL, BULLET | `loan_schedule_type` |
| LoanInterestRateMethod | MONTHLY, ANNUAL | `loan_interest_rate_method` |
| LoanDayCountConvention | THIRTY_360, ACTUAL | `loan_day_count_convention` |
| LoanScheduleRowType | INVOICE, CREDIT_INVOICE, BUYOUT, DISBURSEMENT | `loan_schedule_row_type` |

## 4.16 Warehouse Management

| Enum | Values | @@map |
|------|--------|-------|
| BinPositionStatus | FREE, OCCUPIED, RESERVED, ERROR | `bin_position_status` |
| ForkliftSystemMode | NONE, SEMI_AUTOMATED, FULL_CONFIRMATION | `forklift_system_mode` |
| ForkliftTaskType | MANUAL_PICK, DELIVERY, STOCK_MOVEMENT | `forklift_task_type` |
| ForkliftTaskStatus | PENDING, SENT, IN_PROGRESS, COMPLETED, ERROR, WAITING_CONVEYOR | `forklift_task_status` |
| ForkliftTaskPriority | DEFAULT, EXPRESS, EXPRESS_DELIVERY | `forklift_task_priority` |
| PickingListStatus | DRAFT, IN_PROGRESS, COMPLETED, CANCELLED | `picking_list_status` |
| PickingLineStatus | PENDING, PICKED, SHORT_PICKED, CANCELLED | `picking_line_status` |

## 4.17 Intercompany & Consolidation

| Enum | Values | @@map |
|------|--------|-------|
| IntercompanyRuleDirection | DEBIT, CREDIT | `intercompany_rule_direction` |
| IntercompanyTransactionStatus | INITIATED, TARGET_PENDING, TARGET_POSTED, COMPLETED, FAILED, COMPENSATED, CANCELLED | `intercompany_transaction_status` |
| IntercompanyTransactionType | NL_MIRROR, PO_TO_SO, INVOICE_MIRROR | `intercompany_transaction_type` |
| ConsolidationMemberStatus | ACTIVE, SUSPENDED, REMOVED | `consolidation_member_status` |
| EliminationOutputType | JOURNAL, SIMULATION | `elimination_output_type` |
| ConsolidationRunStatus | IN_PROGRESS, COMPLETED, FAILED | `consolidation_run_status` |
| SharedRegisterType | CUSTOMER, SUPPLIER, ITEM, CHART_OF_ACCOUNT | `shared_register_type` |
| IntercompanySupplierMode | NONE, DEFAULT, INTERNAL | `intercompany_supplier_mode` |

## 4.18 Communications

| Enum | Values | @@map |
|------|--------|-------|
| ChatChannelType | DIRECT, GROUP, AI_ASSISTANT | `chat_channel_type` |
| EmailMessageStatus | DRAFT, SENT, QUEUED, FAILED, BOUNCED | `email_message_status` |
| EmailRecipientType | FROM, TO, CC, BCC | `email_recipient_type` |
| EmailRecipientStatus | UNREAD, READ, DELETED, ARCHIVED | `email_recipient_status` |
| EmailQueueStatus | PENDING, PROCESSING, SENT, FAILED, RETRYING | `email_queue_status` |
| EmailDirection | INBOUND, OUTBOUND | `email_direction` |
| ConferenceRoomType | DISCUSSION, ANNOUNCEMENTS, KNOWLEDGE_BASE | `conference_room_type` |
| ConferenceAccessLevel | FULL, READ_WRITE, READ_ONLY, NONE | `conference_access_level` |
| NotificationChannel | IN_APP, EMAIL, PUSH | `notification_channel` |
| NotificationPriority | LOW, NORMAL, HIGH, URGENT | `notification_priority` |
| NotificationStatus | PENDING, DELIVERED, READ, DISMISSED, FAILED | `notification_status` |

## 4.19 Service Orders & Timekeeper

| Enum | Values | @@map |
|------|--------|-------|
| ServiceOrderStatus | DRAFT, OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, INVOICED, CANCELLED | `service_order_status` |
| ServiceLineItemType | PLAIN, INVOICEABLE, WARRANTY, CONTRACT | `service_line_item_type` |
| ServiceLineItemKind | MAIN_ITEM, SUB_ITEM | `service_line_item_kind` |
| WorkOrderStatus | OPEN, IN_PROGRESS, CLOSED | `work_order_status` |
| WorkSheetStatus | DRAFT, SUBMITTED, APPROVED, INVOICED, REJECTED | `work_sheet_status` |
| WarrantyStatus | UNKNOWN, UNDER_WARRANTY, OUT_OF_WARRANTY, EXPIRED, CONTRACT_COVERED | `warranty_status` |

---
