// ---------------------------------------------------------------------------
// Event Bus Types — Typed event definitions for the Nexa ERP event bus
// Source: event-catalog.md § Event Payload Reference
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BusinessEvents — All domain events emitted across the ERP
// Naming convention: entity.action (dot-separated, past tense)
// Entity segments use camelCase when multi-word (e.g. accessGroup, salesOrder).
// Three-segment names (e.g. stock.movement.posted) are acceptable for
// compound entities per Event Catalog naming convention notes.
// Enum types use `string` at this stage per catalog recommendation I-08.
// Date/time values use ISO 8601 strings for serialisation safety across
// JSON boundaries (no Date objects that silently become strings).
// Financial amounts use `string` (decimal-as-string) for serialisation safety.
// Consumers must parse to Decimal/BigNumber for arithmetic. This ensures
// events survive JSON round-trips and future migration to Redis Streams/NATS.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/naming-convention -- domain event names use dotted notation */
export interface BusinessEvents {
  // ── System (migrated from AppEventMap) ─────────────────
  'user.login': {
    userId: string;
    companyId: string;
    loginMethod: string;
    ipAddress?: string;
  };
  'user.mfa.setup': {
    userId: string;
    companyId: string;
  };
  'user.mfa.enabled': {
    userId: string;
    companyId: string;
  };
  'user.mfa.reset': {
    targetUserId: string;
    resetByUserId: string;
    companyId: string;
  };

  // ── System (placeholder — not yet emitted by any service) ─
  'settings.updated': {
    key: string;
    oldValue: string;
    newValue: string;
    updatedBy: string;
  };

  // ── Access Groups (RBAC) ────────────────────────────────
  'accessGroup.created': {
    groupId: string;
    companyId: string;
    code: string;
    name: string;
    createdBy: string;
  };
  'accessGroup.updated': {
    groupId: string;
    companyId: string;
    changedBy: string;
  };
  'accessGroup.deleted': {
    groupId: string;
    companyId: string;
    deletedBy: string;
  };
  'user.accessGroups.assigned': {
    userId: string;
    companyId: string;
    groupIds: string[];
    assignedBy: string;
  };
  'user.accessGroups.revoked': {
    userId: string;
    companyId: string;
    groupIds: string[];
    revokedBy: string;
  };
  'company.defaultData.imported': {
    companyId: string;
    importedBy: string;
    version: string;
  };

  // ── Finance / GL ────────────────────────────────────────
  'journal.posted': {
    journalEntryId: string;
    entryNumber: string;
    source: string; // JournalSource enum value
    sourceId?: string;
    sourceReference?: string;
    transactionDate: string;
    periodId: string;
    totalAmount: string;
    lineCount: number;
    createdBy: string;
  };
  'journal.reversed': {
    journalEntryId: string;
    reversalEntryId: string;
    originalSource: string;
    sourceReference?: string;
    createdBy: string;
  };
  'period.locked': {
    periodId: string;
    year: number;
    periodNumber: number;
    lockedBy: string;
  };
  'period.unlocked': {
    periodId: string;
    year: number;
    periodNumber: number;
    unlockedBy: string;
  };
  'bank.transactions.imported': {
    bankAccountId: string;
    importBatchId: string;
    importSource: string;
    transactionCount: number;
    totalAmount: string;
  };

  // ── Inventory ───────────────────────────────────────────
  'stock.movement.posted': {
    movementId: string;
    movementNumber: string;
    movementType: string; // StockMovementType enum
    itemId: string;
    warehouseId: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
    sourceType?: string;
    sourceId?: string;
  };
  'stock.movement.reversed': {
    movementId: string;
    reversalMovementId: string;
    itemId: string;
    warehouseId: string;
    quantity: string;
  };
  'stock.balance.updated': {
    itemId: string;
    warehouseId: string;
    quantityOnHand: string;
    quantityAvailable: string;
    costValue: string;
  };
  'stock.reorder.triggered': {
    itemId: string;
    itemCode: string;
    itemName: string;
    warehouseId: string;
    currentQuantity: string;
    reorderPoint: string;
    reorderQuantity: string;
  };
  'stock.valuation.changed': {
    itemId: string;
    costingMethod: string;
    previousCost: string;
    newCost: string;
    trigger: string;
  };

  // ── Accounts Receivable ─────────────────────────────────
  'invoice.created': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    amount: string;
    currencyCode: string;
    invoiceType: string;
  };
  'invoice.approved': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    totalAmount: string;
    journalEntryId?: string;
  };
  'invoice.posted': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    totalAmount: string;
    journalEntryId: string;
    periodId: string;
  };
  'invoice.voided': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    reversalJournalEntryId: string;
  };
  'invoice.overdue': {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    daysOverdue: number;
    outstandingAmount: string;
  };
  'payment.posted': {
    paymentId: string;
    paymentNumber: string;
    customerId: string;
    amount: string;
    allocations: Array<{ invoiceId: string; amount: string }>;
  };

  // ── Sales Orders ────────────────────────────────────────
  'quote.created': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
    totalAmount: string;
  };
  'quote.sent': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
  };
  'quote.accepted': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
  };
  'quote.converted': {
    quoteId: string;
    orderId: string;
    quoteNumber: string;
    orderNumber: string;
    customerId: string;
  };
  'quote.expired': {
    quoteId: string;
    quoteNumber: string;
    customerId: string;
    validUntilDate: string;
  };
  'order.confirmed': {
    orderId: string;
    orderNumber: string;
    customerId: string;
    lineItems: Array<{ itemId: string; quantity: string; warehouseId?: string }>;
    totalAmount: string;
  };
  'dispatch.shipped': {
    dispatchId: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    lines: Array<{ itemId: string; quantity: string; warehouseId: string }>;
  };
  'sales.order.invoiced': {
    orderId: string;
    orderNumber: string;
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
  };

  // ── Purchasing / AP ─────────────────────────────────────
  'purchase.order.approved': {
    orderId: string;
    orderNumber: string;
    supplierId: string;
    totalAmount: string;
  };
  'purchase.order.sent': {
    orderId: string;
    orderNumber: string;
    supplierId: string;
  };
  'goods.receipt.posted': {
    receiptId: string;
    receiptNumber: string;
    orderId: string;
    supplierId: string;
    lines: Array<{ itemId: string; quantity: string; unitCost: string; warehouseId: string }>;
  };
  'bill.posted': {
    billId: string;
    billNumber: string;
    supplierId: string;
    totalAmount: string;
    journalEntryId: string;
    periodId: string;
  };
  'bill.voided': {
    billId: string;
    billNumber: string;
    supplierId: string;
    reversalJournalEntryId: string;
  };
  'supplier.payment.posted': {
    paymentId: string;
    paymentNumber: string;
    supplierId: string;
    amount: string;
    bankAccountId: string;
    allocations: Array<{ billId: string; amount: string }>;
  };
  'bacs.run.submitted': {
    bacsRunId: string;
    fileReference: string;
    paymentCount: number;
    totalAmount: string;
  };

  // ── Fixed Assets ────────────────────────────────────────
  'asset.acquired': {
    fixedAssetId: string;
    assetCode: string;
    purchaseValue: string;
    acquiredDate: string;
    departmentCode?: string;
  };
  'depreciation.run.completed': {
    periodId: string;
    assetCount: number;
    totalAmount: string;
    journalEntryId: string;
  };
  'depreciation.entry.posted': {
    fixedAssetId: string;
    assetCode: string;
    amount: string;
    periodId: string;
    newBookValue: string;
  };
  'asset.disposed': {
    fixedAssetId: string;
    assetCode: string;
    disposalType: string;
    proceedsAmount: string;
    bookValueAtDisposal: string;
    gainOrLoss: string;
  };

  // ── CRM ─────────────────────────────────────────────────
  'lead.converted': {
    leadId: string;
    customerId: string;
    convertedBy: string;
  };
  'opportunity.won': {
    opportunityId: string;
    customerId: string;
    estimatedValue: string;
    salesPersonId?: string;
    salesQuoteId?: string;
  };
  'opportunity.lost': {
    opportunityId: string;
    customerId: string;
    lossReason: string;
    salesPersonId?: string;
  };
  'campaign.activated': {
    campaignId: string;
    campaignName: string;
    recipientCount: number;
  };
  'activity.created': {
    activityId: string;
    activityType: string;
    entityType: string;
    entityId: string;
    assignedToId: string;
    isAutoCreated: boolean;
  };

  // ── HR / Payroll ────────────────────────────────────────
  'payroll.run.completed': {
    payrollRunId: string;
    periodStart: string;
    periodEnd: string;
    employeeCount: number;
    grossTotal: string;
    netTotal: string;
    taxTotal: string;
  };
  'employee.terminated': {
    employeeId: string;
    employeeCode: string;
    terminationDate: string;
    terminationType: string;
  };
  'leave.approved': {
    leaveRequestId: string;
    employeeId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysCount: number;
  };
  'rti.submitted': {
    rtiSubmissionId: string;
    payrollRunId: string;
    submissionType: string;
    status: string;
  };

  // ── Manufacturing / MRP ─────────────────────────────────
  'production.order.created': {
    productionOrderId: string;
    orderNumber: string;
    recipeId: string;
    itemId: string;
    plannedQuantity: string;
  };
  'production.started': {
    productionId: string;
    productionOrderId: string;
    itemId: string;
  };
  'production.finished': {
    productionId: string;
    productionOrderId: string;
    itemId: string;
    outputQuantity: string;
    inputMaterials: Array<{ itemId: string; quantity: string }>;
  };
  'production.discarded': {
    productionId: string;
    productionOrderId: string;
    discardReasonCode: string;
    itemId: string;
  };
  'mrp.suggestions.generated': {
    runId: string;
    suggestedPurchaseOrders: number;
    suggestedProductionOrders: number;
    planningHorizonDays: number;
  };

  // ── POS ─────────────────────────────────────────────────
  'pos.sale.completed': {
    saleId: string;
    saleNumber: string;
    terminalId: string;
    sessionId: string;
    totalAmount: string;
    paymentMethods: Array<{ method: string; amount: string }>;
  };
  'pos.sale.transferred': {
    saleId: string;
    invoiceId: string;
    customerId: string;
  };
  'pos.session.closed': {
    sessionId: string;
    terminalId: string;
    cashierId: string;
    openedAt: string;
    closedAt: string;
    expectedCash: string;
    actualCash: string;
    variance: string;
  };

  // ── Projects / Job Costing ──────────────────────────────
  'timesheet.approved': {
    timesheetId: string;
    employeeId: string;
    projectId: string;
    totalHours: string;
    entries: Array<{ taskId: string; hours: string; billableRate?: string }>;
  };
  'project.invoice.created': {
    projectId: string;
    invoiceId: string;
    invoiceType: string;
    amount: string;
  };

  // ── Contracts / Agreements ──────────────────────────────
  'agreement.approved': { agreementId: string; customerId: string; startDate: string };
  'agreement.charged': { agreementId: string; chargeCount: number; totalAmount: string };
  'agreement.invoiced': { agreementId: string; invoiceId: string; totalAmount: string };
  'agreement.closed': { agreementId: string; customerId: string };
  'agreement.cancelled': { agreementId: string; customerId: string; cancelDate: string };
  'contract.approved': {
    contractId: string;
    customerId: string;
    startDate: string;
    endDate: string;
  };
  'contract.invoiced': { contractId: string; invoiceId: string; totalAmount: string };
  'contract.renewed': { contractId: string; newContractId: string; customerId: string };
  'contract.expired': { contractId: string; customerId: string; endDate: string };
  'contract.cancelled': { contractId: string; customerId: string };
  'loan.approved': { loanAgreementId: string; customerId: string; principalAmount: string };
  'loan.signed': { loanAgreementId: string; scheduleRowCount: number };
  'loan.activated': { loanAgreementId: string; journalEntryId: string; principalAmount: string };
  'loan.disbursed': { loanAgreementId: string; purchaseInvoiceId: string };
  'loan.invoiced': { loanAgreementId: string; scheduleRowNumber: number; invoiceId: string };
  'loan.paused': { loanAgreementId: string };
  'loan.resumed': { loanAgreementId: string };
  'loan.finished': { loanAgreementId: string };
  'loan.cancelled': { loanAgreementId: string };

  // ── Intercompany ────────────────────────────────────────
  'intercompany.transaction.created': {
    correlationId: string;
    sourceTenantId: string;
    targetTenantId: string;
    transactionType: string;
    amount: string;
  };
  'intercompany.po.created': {
    correlationId: string;
    sourceTenantId: string;
    targetTenantId: string;
    purchaseOrderId: string;
  };

  // ── Approvals (Cross-Cutting) ───────────────────────────
  'approval.requested': {
    requestId: string;
    entityType: string;
    entityId: string;
    currentAssigneeId: string;
    ruleId: string;
    levelOrder: number;
  };
  'approval.completed': {
    requestId: string;
    entityType: string;
    entityId: string;
    approvedBy: string;
  };
  'approval.rejected': {
    requestId: string;
    entityType: string;
    entityId: string;
    rejectedBy: string;
    rejectionReason: string;
  };
  'approval.escalated': {
    requestId: string;
    entityType: string;
    entityId: string;
    fromLevel: number;
    toLevel: number;
    newAssigneeId: string;
  };
  'approval.forwarded': {
    requestId: string;
    entityType: string;
    entityId: string;
    forwardedTo: string;
    forwardedBy: string;
  };
  'approval.cancelled': {
    requestId: string;
    entityType: string;
    entityId: string;
    cancelledBy: string;
  };
  'approval.autoEscalated': {
    requestId: string;
    entityType: string;
    entityId: string;
    timeoutHours: number;
  };

  // ── AI ──────────────────────────────────────────────────
  'ai.action.executed': {
    agentId: string;
    toolName: string;
    entityType: string;
    entityId: string;
    userId: string;
    confidence: string;
    companyId: string;
    conversationId: string;
    actionType: string;
  };
  'ai.degraded': {
    errorCode: string;
    errorMessage: string;
    userId: string;
    tenantId: string;
    intent: string;
  };
  'ai.memory.created': {
    memoryId: string;
    userId: string;
    companyId: string;
    category: string;
    source: string;
  };
  'ai.memory.updated': {
    memoryId: string;
    userId: string;
    companyId: string;
    category: string;
    previousSource: string;
    newSource: string;
    reason: 'CORRECTION' | 'MERGE' | 'CONFLICT_RESOLUTION';
  };
  'ai.memory.deleted': {
    memoryId: string;
    userId: string;
    companyId: string;
  };
  'ai.memory.bulk_deleted': {
    memoryIds: string[];
    userId: string;
    companyId: string;
    count: number;
  };
  'ai.conversation.summarised': {
    summaryId: string;
    conversationId: string;
    userId: string;
    companyId: string;
  };
  'ai.skill.packLoaded': {
    moduleKey: string;
    skillCount: number;
    userId: string;
    companyId: string;
  };
  'ai.skill.activated': {
    skillKey: string;
    moduleKey: string;
    userId: string;
    companyId: string;
    confidence: number;
  };
  'ai.skill.created': {
    skillId: string;
    name: string;
    moduleKey: string | null;
  };
  'ai.skill.updated': {
    skillId: string;
    name: string;
  };
  'ai.skill.deleted': {
    skillId: string;
    name: string;
  };
  'ai.knowledge.created': {
    knowledgeId: string;
    moduleKey: string;
    title: string;
  };
  'ai.knowledge.updated': {
    knowledgeId: string;
    title: string;
  };
  'ai.knowledge.deleted': {
    knowledgeId: string;
    title: string;
  };
  'ai.entityTrigger.created': {
    triggerId: string;
    moduleKey: string;
    triggerWord: string;
  };
  'ai.entityTrigger.updated': {
    triggerId: string;
    triggerWord: string;
  };
  'ai.entityTrigger.deleted': {
    triggerId: string;
    triggerWord: string;
  };
  'ai.skillOverride.upserted': {
    overrideId: string;
    skillId: string;
    companyId: string;
  };
  'ai.skillOverride.deleted': {
    skillId: string;
    companyId: string;
  };
  'ai.tool.queryExecuted': {
    toolName: string;
    moduleKey: string;
    userId: string;
    companyId: string;
    resultRowCount: number;
    latencyMs: number;
  };
  'ai.entityMention.resolved': {
    conversationId: string;
    userId: string;
    companyId: string;
    mentions: Array<{ type: string; id: string; name: string }>;
  };

  // ── Document Understanding ──────────────────────────────
  'document.processing.started': {
    ingestionId: string;
    tenantId: string;
    sourceType: string; // DocumentSourceType enum
    originalFileName: string;
    mimeType: string;
  };
  'document.extraction.completed': {
    ingestionId: string;
    tenantId: string;
    documentType: string; // DocumentType enum
    overallConfidence: number;
    fieldCount: number;
    lineItemCount: number;
  };
  'document.extraction.failed': {
    ingestionId: string;
    tenantId: string;
    errorCode: string;
    errorMessage: string;
  };
  'document.matching.completed': {
    ingestionId: string;
    tenantId: string;
    matchedSupplierId: string | null;
    matchedPoId: string | null;
    createdRecordType: string;
    createdRecordId: string;
    overallConfidence: number;
  };
  'document.review.required': {
    ingestionId: string;
    tenantId: string;
    reason: string;
    overallConfidence: number;
  };
  'document.approved': {
    ingestionId: string;
    tenantId: string;
    createdRecordType: string;
    createdRecordId: string;
    supplierId: string;
    totalAmount: string;
    correctionsApplied: boolean;
  };
  'document.rejected': {
    ingestionId: string;
    tenantId: string;
    reason: string;
  };

  // ── Communications ──────────────────────────────────────
  'notification.sent': {
    notificationId: string;
    userId: string;
    channel: string;
    templateEventName: string;
  };
  'email.sent': {
    emailMessageId: string;
    recipientEmail: string;
    subject: string;
    documentType?: string;
  };
}
/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// EventHandler type — callback signature for event subscribers
// ---------------------------------------------------------------------------

export type EventHandler<K extends keyof BusinessEvents> = (
  data: BusinessEvents[K],
) => void | Promise<void>;
