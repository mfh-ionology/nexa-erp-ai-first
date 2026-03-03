# 2. Entity Relationship Summary

## All Models by Module

| Module | Section | Models | Key Entities |
|--------|---------|--------|-------------|
| System | 2.8--2.12 | 18 | CompanyProfile, Currency, ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting, DataView, DataViewField, DateRangePreset, UserColumnPreference, SavedView, SavedViewCondition, DocumentTemplate (+Version) |
| Finance/GL | 2.13 | 12 | ChartOfAccount, AccountClassification, AccountMapping, FinancialPeriod, JournalEntry, JournalLine, BankAccount, BankTransaction, BankReconciliation, BankReconciliationLine, Budget, BudgetLine |
| Inventory | 2.14 | 7 | ItemGroup, Warehouse, InventoryItem, StockMovement, StockBalance, SerialNumber, UnitOfMeasure |
| Sales Ledger (AR) | 2.15 | 7 | Customer, CustomerAddress, CustomerContact, CustomerInvoice, CustomerInvoiceLine, CustomerPayment, PaymentAllocation |
| Sales Orders | 2.16 | 7 | SalesQuote, SalesQuoteLine, SalesOrder, SalesOrderLine, Dispatch, DispatchLine, ShippingMethod |
| Purchasing (AP) | 2.17 | 10 | Supplier, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine, SupplierBill, SupplierBillLine, SupplierPayment, SupplierPaymentAllocation, BacsRun |
| Fixed Assets | 2.18 | 8 | DepreciationMethod, AssetGroup, AssetClass, FixedAsset, DepreciationEntry, AssetDisposal, AssetTransfer, AssetTransaction |
| Pricing | 2.19 | 5 | PriceList, PriceListEntry, QuantityBreak, Rebate, RebateTier |
| Cross-Cutting | 2.20 | 7 | Attachment, Note, RecordLink, ApprovalRule, ApprovalRuleLevel, ApprovalRequest, Activity |
| CRM | 2.21 | 16 | CrmLeadStatus, CrmLeadSource, CrmIndustry, CrmMediaType, CrmOpportunityClass, CrmActivityType, CrmActivityTypeGroup, CrmLead, CrmCampaign, CrmCampaignRecipient, CrmOpportunity, CrmOpportunityStageLog, CrmPipelineView, CrmPipelineColumn, CrmActivityAutoRule, CrmModuleSetting |
| HR & Payroll | 2.22 | 36 | Employee, JobTitle, ContractClass, ContractType, ResidencyType, EmploymentContract, ContractChange, BenefitType, ContractBenefit, AppraisalCategory, PerformanceFactor, PerformanceRating, PerformanceAppraisal, AppraisalLine, Skill, SkillRating, SkillsEvaluation, SkillsEvaluationLine, Checkpoint, Checklist, ChecklistItem, JobPosition, PositionIncumbent, TrainingPlan, PaymentType, LeaveEntitlement, LeaveRequest, LeaveBalance, TaxYearConfig, PensionEnrolment, PayrollRun, PayrollLine, StatutoryPayment, HMRCSubmission, PayslipDocument, HrModuleSetting |
| Production/MRP | 2.23 | 23 | Recipe, RecipeLine, Routing, RoutingStep, StandardOperation, StandardOperationMaterial, Machine, MachineGroup, MachineShift, MachineSwitchTime, MachineItemDefault, ProductionClass, AutoProductionRule, ProductionOrder, ProductionOrderLine, Production, ProductionLine, ProductionOperation, ProductionOperationLine, ProductionPlan, ProductionPlanLine, ProductionPlanComponent, ProductionSetting |
| POS | 2.24 | 14 | POSTerminal, CashDrawer, POSSession, POSPaymentMethod, POSSale, POSSaleLine, POSPayment, POSCashMovement, POSCashup, POSCashupLine, POSJournalEntry, POSButtonLayout, POSButton, POSSerialBlock |
| Projects | 2.25 | 11 | Project, ProjectTask, Timesheet, TimesheetEntry, ProjectExpense, ProjectTransaction, ProjectBudget, ProjectBudgetLine, ProjectRateCard, ProjectRateCardEntry, ProjectInvoiceSchedule |
| Contracts & Agreements | 2.26 | 13 | AgreementType, Agreement, AgreementLine, AgreementCharge, OffHire, OffHireLine, ContractClass, Contract, ContractLine, LoanAgreementType, LoanAgreement, LoanAgreementItem, LoanScheduleRow |
| Warehouse Management | 2.27 | 9 | WarehouseGroup, WarehouseZone, WarehouseWmsConfig, BinPosition, PositionStock, PickingList, PickingLine, Forklift, ForkliftTask |
| Intercompany & Consolidation | 2.28 | 11 | IntercompanyRule, IntercompanyTransaction, ConsolidationGroup, ConsolidationMember, OwnershipPercentage, ConsolidationAccountMap, ConsolidationExchangeRate, EliminationTemplate, EliminationEntry, ConsolidationRun, SharedRegisterConfig |
| Communications | 2.29 | 15 | ChatChannel, ChatParticipant, ChatMessage, EmailMessage, EmailRecipient, EmailQueue, EmailTemplate, EmailAlias, EmailSignature, ConferenceRoom, ConferenceAccess, NotificationTemplate, NotificationPreference, Notification, MassMailCampaign |
| Service Orders & Timekeeper | 2.30 | 11 | ServiceOrder, ServiceOrderLine, WorkOrder, WorkOrderLine, WorkSheet, WorkSheetLine, KnownSerialNumber, FaultCode, FaultCodeModifier, TargetTime, TargetTimeLine |
| **Platform Admin** (separate DB) | **2.31** | **10** | **Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession** |

---
