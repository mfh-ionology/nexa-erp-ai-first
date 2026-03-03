# Nexa ERP — Full Enterprise Build Migration Blueprint (2025-11-XX)

Scope: Define the additive Prisma schema and migration approach to move file-backed subsystems to fully DB-backed models. Do not run migrations in this task. This blueprint is for the next (separate) migration+deploy step.

## Global Rules
- No destructive changes. All new tables are additive.
- All tables include `tenantId` with index.
- Use stable ULIDs/UUIDs, keep existing string ids if appropriate (prefixes like `ld_`, `rt_` allowed initially).
- All writes audited; keep existing audit events.
- Keep RBAC and module toggles unchanged.

## Prisma Schema Blocks (proposed)

```prisma
// Supply Chain
model RFQ {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  title     String
  status    String   @default("open") // open|awarded|closed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  responses RFQResponse[]
  awards    RFQAward[]
}

model RFQResponse {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  rfqId     String   @index
  supplierId String
  sku       String
  priceMinor Int
  leadDays  Int?
  createdAt DateTime @default(now())
}

model RFQAward {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  rfqId     String   @index
  supplierId String
  createdAt DateTime @default(now())
}

model SupplierContract {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  supplierId String
  sku       String
  currency  String   @default("GBP")
  tiers     ContractTier[]
  validFrom DateTime?
  validTo   DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ContractTier {
  id         String   @id
  contractId String   @index
  minQty     Int
  priceMinor Int
}

model SupplierScorecard {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  supplierId String  @index
  onTimePct Float
  defectRatePct Float
  rmaRatePct Float
  updatedAt DateTime @updatedAt
}

model CycleCountPlan {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  status    String   @default("open") // open|counting|posted
  createdAt DateTime @default(now())
  lines     CycleCountLine[]
}
model CycleCountLine {
  id        String   @id
  planId    String   @index
  sku       String
  expectedQty Int
  countedQty  Int?
  variance    Int?
}

model RMAHeader {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  soId      String?
  reason    String
  status    String   @default("open") // open|processing|resolved
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lines     RMALine[]
}
model RMALine {
  id        String   @id
  headerId  String   @index
  sku       String
  quantity  Int
  disposition String? // restock|scrap|refund
}

model PickWave {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  status    String   @default("open") // open|packed|shipped|closed
  createdAt DateTime @default(now())
  tasks     PickTask[]
  packs     Pack[]
  shipments Shipment[]
}
model PickTask {
  id        String   @id
  waveId    String   @index
  sku       String
  qty       Int
  assignedTo String?
  status    String   @default("open") // open|done
}
model Pack {
  id        String   @id
  waveId    String   @index
  cartonNo  Int
  createdAt DateTime @default(now())
}
model Shipment {
  id        String   @id
  waveId    String   @index
  carrier   String?
  tracking  String?
  createdAt DateTime @default(now())
}

// CRM
model Lead {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  title     String
  status    String   @default("new") // new|qualified|converted|lost
  score     Int      @default(0)
  ownerId   String?
  source    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model Account {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  name      String
  parentId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model Contact {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  accountId String?
  name      String
  email     String?
  phone     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model Opportunity {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  accountId String?
  name      String
  stage     String
  amountMinor Int?
  expectedClose DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model Activity {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  type      String
  subject   String
  targetType String?
  targetId  String?
  at        DateTime
  notes     String?
}
model Quote {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  accountId String?
  status    String   @default("draft") // draft|accepted|rejected
  totalMinor Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model PriceBook {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  name      String
  currency  String
  entries   PriceBookEntry[]
}
model PriceBookEntry {
  id         String  @id
  priceBookId String @index
  sku        String
  priceMinor Int
}

// Planning
model BudgetHeader {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  period    String   @index // YYYY-MM
  costCenter String?
  createdAt DateTime @default(now())
  lines     BudgetLine[]
}
model BudgetLine {
  id         String  @id
  headerId   String  @index
  accountCode String
  amountMinor Int
}
model ForecastHeader {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  period    String   @index
  costCenter String?
  createdAt DateTime @default(now())
  lines     ForecastLine[]
}
model ForecastLine {
  id        String   @id
  headerId  String   @index
  metric    String
  valueMinor Int
}

// Workflow
model WorkflowDefinition {
  id         String   @id
  tenantId   String   @db.VarChar(50) @index
  name       String
  module     String
  targetType String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  steps      WorkflowStep[]
}
model WorkflowStep {
  id        String @id
  definitionId String @index
  name      String
  role      String?
  thresholdMinor Int?
}
model WorkflowInstance {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  definitionId String @index
  targetId  String
  targetType String
  state     String   @default("pending") // pending|approved|rejected
  currentStepIndex Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  approvals WorkflowApproval[]
}
model WorkflowApproval {
  id         String @id
  instanceId String @index
  userId     String
  decision   String // approved|rejected
  at         DateTime
}

// Custom Fields
model CustomFieldDefinition {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  module    String
  entity    String
  name      String
  type      String   // text|number|date|select|boolean
  required  Boolean  @default(false)
  options   Json?
}
model CustomFieldValue {
  id           String   @id
  tenantId     String   @db.VarChar(50) @index
  definitionId String   @index
  recordId     String   @index
  value        Json
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// Healthcare
model HealthcareRotaShift {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  userId    String
  role      String?
  site      String?
  start     DateTime
  end       DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Integrations
model ExternalSystemConnection {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  system    String   // ehr|lab|scheduling|ecommerce|payroll|logistics|other
  name      String
  config    Json
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Access (additive)
model UserModuleAccess {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  userId    String   @index
  moduleKey String
  enabled   Boolean  @default(true)
}
model UserDimensionAccess {
  id        String   @id
  tenantId  String   @db.VarChar(50) @index
  userId    String   @index
  dimension String   // warehouse|site|department|cost_center
  values    Json     // array of ids
}

// Finance — Multi-Entity, FX, AP/AR depth, Rev-Rec, Dimensions
model LegalEntity {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String   @unique
  name          String
  functionalCurrency String @default("GBP")
  jurisdiction  String?
  status        String   @default("active") // active|inactive
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
model IntercompanyAccount {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  fromEntityId  String   @index
  toEntityId    String   @index
  arAccountCode String
  apAccountCode String
}
model GroupConsolidationConfig {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  groupCode     String   @unique
  entityIds     Json     // array of LegalEntity ids
  eliminationAccounts Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
model FxRate {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  pair          String   @index // e.g. GBPUSD
  effectiveDate DateTime @index
  rateType      String   @default("spot") // spot|avg|month_end
  rate          Decimal  @db.Decimal(18,8)
  createdAt     DateTime @default(now())
}
model FxRevaluationRun {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  at            DateTime @default(now())
  entityId      String?
  lines         FxRevaluationLine[]
}
model FxRevaluationLine {
  id            String   @id
  runId         String   @index
  accountCode   String
  currency      String
  balanceMinor  Int
  rateApplied   Decimal  @db.Decimal(18,8)
  deltaMinor    Int
}
model PaymentTerm {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String   @unique
  description   String?
  netDays       Int      @default(30)
  installments  Json?    // optional structured instalments
}
model CreditNote {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  invoiceId     String   @index
  reason        String?
  amountMinor   Int
  createdAt     DateTime @default(now())
}
model WriteOffAdjustment {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  invoiceId     String   @index
  amountMinor   Int
  reason        String?
  createdAt     DateTime @default(now())
}
model DunningConfig {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  levels        DunningLevel[]
  active        Boolean  @default(true)
}
model DunningLevel {
  id            String   @id
  configId      String   @index
  name          String
  daysOverdue   Int
  action        String   // email|call|legal
}
model DunningRun {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  at            DateTime @default(now())
  actions       DunningAction[]
}
model DunningAction {
  id            String   @id
  runId         String   @index
  customerId    String
  invoiceId     String
  levelName     String
  outcome       String?
}
model DeferredRevenueSchedule {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  contractId    String?
  totalMinor    Int
  startPeriod   String   // YYYY-MM
  endPeriod     String   // YYYY-MM
  lines         DeferredRevenueLine[]
}
model DeferredRevenueLine {
  id            String   @id
  scheduleId    String   @index
  period        String
  amountMinor   Int
  posted        Boolean  @default(false)
}
model CostCentre {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String   @unique
  name          String
  parentId      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Banking & Cash
model BankAccount {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  entityId      String?
  name          String
  currency      String   @default("GBP")
  iban          String?
  sortCode      String?
  accountNo     String?
  createdAt     DateTime @default(now())
}
model BankStatement {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  accountId     String   @index
  periodStart   DateTime
  periodEnd     DateTime
  createdAt     DateTime @default(now())
  lines         BankStatementLine[]
}
model BankStatementLine {
  id            String   @id
  statementId   String   @index
  postedAt      DateTime
  description   String
  amountMinor   Int
  reference     String?
  matched       Boolean  @default(false)
}
model BankReconciliation {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  accountId     String
  statementId   String
  status        String   @default("in_progress") // in_progress|reconciled
  createdAt     DateTime @default(now())
  matches       ReconciliationMatch[]
}
model ReconciliationMatch {
  id            String   @id
  reconciliationId String @index
  lineId        String
  journalId     String?
  amountMinor   Int
  method        String   // auto|manual
}

// HR & Payroll (DB-backed, additive)
model Employee {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  entityId      String?
  userId        String?
  firstName     String
  lastName      String
  email         String?
  departmentId  String?
  positionId    String?
  status        String   @default("active") // active|leave|terminated
  costCenterId  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
model Department {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  name          String
  costCenterId  String?
}
model Position {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  title         String
  grade         String?
}
model EmploymentContract {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  employeeId    String   @index
  type          String   @default("salary") // salary|hourly
  baseMinor     Int
  startDate     DateTime
  endDate       DateTime?
}
model HrTimesheet {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  employeeId    String   @index
  projectId     String?
  taskId        String?
  date          DateTime
  hours         Decimal  @db.Decimal(10,2)
  status        String   @default("submitted") // submitted|approved|rejected
}
model PayrollRunDB {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  entityId      String?
  period        String   @index // YYYY-MM
  createdAt     DateTime @default(now())
  lines         PayrollLine[]
}
model PayrollLine {
  id            String   @id
  runId         String   @index
  employeeId    String
  grossMinor    Int
  netMinor      Int
  employerCostsMinor Int
  liabilityMinor Int
}

// Inventory & WMS (bins)
model BinLocation {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  warehouseId   String   @index
  code          String
  createdAt     DateTime @default(now())
}
model StockPerBin {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  sku           String   @index
  warehouseId   String   @index
  binId         String   @index
  qtyOnHand     Int      @default(0)
  updatedAt     DateTime @updatedAt
}
model BinTransfer {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  sku           String
  fromBinId     String
  toBinId       String
  qty           Int
  createdAt     DateTime @default(now())
}
model AdjustmentReason {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String
  description   String?
}

// Manufacturing deep
model BomHeader {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  sku           String   @index
  phantom       Boolean  @default(false)
  lines         BomLine[]
}
model BomLine {
  id            String   @id
  headerId      String   @index
  childSku      String
  qtyPer        Decimal  @db.Decimal(16,6)
}
model WorkCentre {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String   @unique
  name          String
  rateMinor     Int
}
model Operation {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String
  description   String?
}
model Routing {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  sku           String
  steps         Json     // array of { opCode, wcCode, stdMins }
}
model WoRoutingStep {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  woId          String   @index
  opCode        String
  wcCode        String
  status        String   @default("open") // open|done
}
model WoVariance {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  woId          String   @index
  type          String   // material|labour
  amountMinor   Int
}
model MRPPlan {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  at            DateTime @default(now())
  params        Json?
  results       MRPResult[]
}
model MRPResult {
  id            String   @id
  planId        String   @index
  sku           String
  suggestedQty  Int
  dueDate       DateTime?
}

// Projects PSA
model ProjectPhase {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  projectId     String   @index
  name          String
  budgetMinor   Int?
}
model ProjectTask {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  projectId     String   @index
  phaseId       String?
  name          String
  billable      Boolean  @default(true)
}
model ProjectBudgetLine {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  projectId     String   @index
  costCenterId  String?
  accountCode   String
  amountMinor   Int
}
model ProjectBillingProfile {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  projectId     String   @index
  model         String   // tm|fixed|milestone|retainer
  config        Json
}
model ProjectWipRule {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  projectId     String   @index
  method        String   // percent_complete|effort_expended
  params        Json?
}

// Sales & CRM (completed set)
model CrmPipelineStage {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  name          String
  probabilityPct Int
  orderIndex    Int
}

// POS retail-grade
model POSSession {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  openedAt      DateTime
  closedAt      DateTime?
  openedBy      String
  closedBy      String?
  cashOpenMinor Int      @default(0)
  cashCloseMinor Int?
}
model POSPayment {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  sessionId     String   @index
  saleId        String
  method        String   // cash|card|on_account|voucher
  amountMinor   Int
}
model Promotion {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  name          String
  type          String   // line|order
  config        Json     // e.g., { percent:10, sku:"A" }
  active        Boolean  @default(true)
}
model TillClose {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  sessionId     String   @index
  notes         String?
  overShortMinor Int     @default(0)
}

// Compliance & Tax
model TaxRegime {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String   @unique
  name          String
}
model TaxPeriod {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  regimeId      String   @index
  periodStart   DateTime
  periodEnd     DateTime
  status        String   @default("open") // open|closed|submitted
}
model VatReturn {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  periodId      String   @index
  createdAt     DateTime @default(now())
  lines         VatReturnLine[]
}
model VatReturnLine {
  id            String   @id
  returnId      String   @index
  box           String
  amountMinor   Int
}
model EInvoicingDocument {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  invoiceId     String   @index
  standard      String   @default("ubl")
  metadata      Json
  qrHash        String?
  createdAt     DateTime @default(now())
}
model ComplianceAuditPack {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  periodId      String?
  createdAt     DateTime @default(now())
  items         ComplianceAuditItem[]
}
model ComplianceAuditItem {
  id            String   @id
  packId        String   @index
  type          String
  reference     String?
  path          String?
}

// Analytics & KPIs
model MetricDefinition {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String   @unique
  name          String
  dimensions    Json?    // array of dimension keys
}
model MetricSnapshot {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  metricId      String   @index
  period        String   @index // YYYY-MM or YYYY-MM-DD
  dims          Json?    // { entity: "...", costCenter: "...", ... }
  valueMinor    Int?
  value         Decimal? @db.Decimal(18,6)
  createdAt     DateTime @default(now())
}
model MetricDimension {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String
  name          String
}

// Admin/Partner/Localisation
model CoATemplate {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  name          String
  accounts      CoATemplateAccount[]
}
model CoATemplateAccount {
  id            String   @id
  templateId    String   @index
  code          String
  name          String
  type          String
}
model LocalisationConfig {
  id            String   @id
  tenantId      String   @db.VarChar(50) @unique
  jurisdiction  String
  settings      Json
}
model Partner {
  id            String   @id
  name          String
  email         String?
  createdAt     DateTime @default(now())
}
model PartnerTenant {
  id            String   @id
  partnerId     String   @index
  tenantId      String   @index
  assignedAt    DateTime @default(now())
}
model PartnerShare {
  id            String   @id
  partnerId     String   @index
  tenantId      String   @index
  period        String   @index // YYYY-MM
  amountMinor   Int
}
model IndustryPack {
  id            String   @id
  code          String   @unique
  name          String
  config        Json
}
model IndustryPackAssignment {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  packId        String   @index
  assignedAt    DateTime @default(now())
}

// Healthcare PCN/GP
model Practice {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  name          String
  code          String?
}
model Pcn {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  name          String
}
model ArrsRole {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  code          String
  name          String
}
model ArrsAssignment {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  practiceId    String
  employeeId    String
  roleId        String
  startDate     DateTime
  endDate       DateTime?
}
model LocumAssignment {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  practiceId    String
  contractor    String
  startDate     DateTime
  endDate       DateTime
  amountMinor   Int
}
model ArrsClaim {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  practiceId    String
  roleId        String
  period        String   @index // YYYY-MM
  amountMinor   Int
  status        String   @default("draft") // draft|submitted|paid|rejected
}
model ArrsReimbursement {
  id            String   @id
  tenantId      String   @db.VarChar(50) @index
  claimId       String   @index
  paidAt        DateTime?
  amountMinor   Int
}
```

## Table Relationships & Indexes (high level)
- Every table: `tenantId` indexed.
- Foreign keys: RFQResponse.rfqId → RFQ.id; RFQAward.rfqId → RFQ.id; ContractTier.contractId → SupplierContract.id; CycleCountLine.planId → CycleCountPlan.id; RMALine.headerId → RMAHeader.id; PickTask.waveId → PickWave.id; Pack.waveId, Shipment.waveId → PickWave.id; PriceBookEntry.priceBookId → PriceBook.id; BudgetLine.headerId → BudgetHeader.id; ForecastLine.headerId → ForecastHeader.id; WorkflowStep.definitionId → WorkflowDefinition.id; WorkflowInstance.definitionId → WorkflowDefinition.id; WorkflowApproval.instanceId → WorkflowInstance.id; CustomFieldValue.definitionId → CustomFieldDefinition.id.
- Suggested composite indexes for frequent queries:
  - (tenantId, status) on RFQ, RMAHeader, PickWave, Quote, WorkflowInstance
  - (tenantId, period, costCenter) on BudgetHeader, ForecastHeader
  - (tenantId, module, entity) on CustomFieldDefinition
  - (tenantId, recordId) on CustomFieldValue

## Mapping from File-backed JSON → DB
- Each store file under `apps/web/.data/**` maps to the corresponding model above.
- IDs (e.g., `ld_`, `rt_`) migrate 1:1 into String primary keys initially.
- For collections stored in maps, explode into rows; preserve timestamps when available, else default to `now()`.
- Custom fields: `customFieldStore` value records map to `CustomFieldValue` with `definitionId` and `recordId`.

## Idempotent Loader Design
1. For each subsystem, implement a loader script:
   - Read JSON file for a tenant.
   - Upsert into DB by id (idempotent).
   - Record progress in a per-tenant checkpoint table or Redis key `migrate:<subsystem>:<tenantId>`.
2. Run loaders in dependency order:
   - CustomFieldDefinition → CustomFieldValue
   - RFQ → Responses → Awards
   - SupplierContract → ContractTier
   - CycleCountPlan → CycleCountLine
   - RMAHeader → RMALine
   - PickWave → PickTask → Pack/Shipment
   - CRM entities (Lead/Account/Contact/Opportunity/Activity/Quote)
   - Planning (BudgetHeader/Line, ForecastHeader/Line)
   - Workflow (Definitions → Instances → Approvals)
   - HealthcareRotaShift
3. Use `--dry-run` and `--tenant <id>` flags; write a JSON report (counts, samples).

## Code-switch Plan (post-migration)
1. Introduce repository interfaces per module (e.g., `LeadsRepo` with `getById`, `list`, `upsert`).
2. Provide DB-backed implementations alongside file-backed.
3. Feature-flag per tenant: `tenant.migrationMode = "db"` toggles repositories in DI container.
4. Roll out by module (lowest risk first: custom fields, planning, workflow; then CRM; then supply subsystems).
5. Keep file-backed writes disabled (read-only) once tenant is switched to DB.

## Rollback Strategy
- Keep file-backed JSONs intact (no deletion).
- Revert `tenant.migrationMode` to `file` to switch repositories back.
- Re-run verification to ensure parity metrics match pre-migration snapshot.

## Verification Steps Post-migration
- Record counts match (± acceptable drift for computed aggregates).
- Sample record parity (random 5–10 per entity).
- E2E suites:
  - Supply: pick/pack/ship, RMA, replenishment, dashboard.
  - CRM: lead conversion, quote→SO→invoice.
  - Planning: budget report.
  - Workflow: approvals gating.
  - Custom Fields: define+render+persist.
  - Healthcare: rota + cost-of-care.
- Route checks: `pnpm -w run check:routes`
- Placeholder check: `pnpm -w run check:placeholders`

## Neon/Staging Apply (Next Task)
- Bump Prisma schema with the above models.
- `pnpm -w prisma generate`
- `pnpm -w prisma migrate dev --name enterprise_final_additive` (dev)
- `pnpm -w prisma migrate deploy` (staging/prod)
- Run loader with `--dry-run`, then `--apply` per tenant.
- Switch `migrationMode` for pilot tenant; observe metrics and E2E.

All steps are additive and respect the hardened baseline (CSP, RBAC, tenancy, rate limits). No secrets or PII are logged. No destructive operations included.


