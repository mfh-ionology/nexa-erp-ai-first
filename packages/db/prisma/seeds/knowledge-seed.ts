/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E5d — Knowledge Management Seed Data
//
// Seeds:
//   1. Knowledge articles (mix of sources and confirmed/unconfirmed)
//   2. Correction logs (various types and skills)
//   3. Training examples (admin-curated and correction-derived)
//   4. Learning signals (daily aggregates)
//
// All upserts are idempotent — safe to re-run.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Well-known UUIDs (deterministic — safe for idempotent upserts)
// ---------------------------------------------------------------------------

const KA_PREFIX = '00000000-0000-4000-b000-00000000'; // knowledge articles
const CL_PREFIX = '00000000-0000-4000-b100-00000000'; // correction logs
const TE_PREFIX = '00000000-0000-4000-b200-00000000'; // training examples
const LS_PREFIX = '00000000-0000-4000-b300-00000000'; // learning signals

// ---------------------------------------------------------------------------
// Knowledge Articles
// ---------------------------------------------------------------------------

const KNOWLEDGE_ARTICLES = [
  // ── Admin-uploaded, confirmed ──
  {
    id: `${KA_PREFIX}0001`,
    title: 'UK VAT Return Filing Process',
    content:
      'UK businesses registered for VAT must submit quarterly returns to HMRC. The standard VAT rate is 20%. Returns must be filed within one month and seven days of the end of each VAT period. Making Tax Digital (MTD) requires digital record-keeping and submission via compatible software. Key steps: 1) Record all sales and purchases with correct VAT codes. 2) Calculate output tax (on sales) and input tax (on purchases). 3) Submit the return electronically via MTD-compatible software. 4) Pay any VAT owed by the deadline.',
    category: 'BUSINESS_PROCESS',
    source: 'ADMIN_UPLOADED',
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 15,
  },
  {
    id: `${KA_PREFIX}0002`,
    title: 'Credit Note Issuance Rules',
    content:
      'Credit notes must reference the original invoice number and clearly state the reason for the credit. Valid reasons include: goods returned, pricing error, duplicate billing, agreed discount, or cancelled service. The credit note must include the same VAT treatment as the original invoice. For partial credits, itemise which lines are being credited. Credit notes reduce the VAT liability in the period they are issued.',
    category: 'BUSINESS_PROCESS',
    source: 'ADMIN_UPLOADED',
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 8,
  },
  {
    id: `${KA_PREFIX}0003`,
    title: 'Aged Debt Collection Workflow',
    content:
      'The standard collection process follows these stages: 1) 30 days overdue — automated reminder email. 2) 45 days — phone call from AR team. 3) 60 days — formal demand letter. 4) 90 days — escalate to management for write-off decision or referral to collection agency. Key fields: invoice amount, days overdue, customer credit limit, payment history score. Always check if a payment plan has been agreed before escalating.',
    category: 'BUSINESS_PROCESS',
    source: 'ADMIN_UPLOADED',
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 22,
  },
  // ── AI-generated, unconfirmed (for "Needs Review" testing) ──
  {
    id: `${KA_PREFIX}0004`,
    title: 'Automatic Payment Matching Heuristics',
    content:
      'When a bank payment is received, the system uses these heuristics to auto-match: 1) Exact amount match to a single open invoice. 2) Reference field contains an invoice number. 3) Customer name on the bank statement matches a customer with one open invoice of the same amount. 4) Round-number allocation across multiple invoices (e.g. £5,000 split across oldest invoices first). Auto-matched payments should be flagged with confidence scores for human review.',
    category: 'BUSINESS_PROCESS',
    source: 'AI_GENERATED',
    confidenceScore: 0.72,
    isConfirmed: false,
    usageCount: 3,
  },
  {
    id: `${KA_PREFIX}0005`,
    title: 'Stock Reorder Point Calculation',
    content:
      'Reorder point = (Average daily usage × Lead time in days) + Safety stock. Safety stock = Z-score × Standard deviation of daily usage × √(Lead time). For most items, use a Z-score of 1.65 (95% service level). Review reorder points quarterly to account for seasonal demand changes. Items with erratic demand patterns should use higher safety stock multipliers.',
    category: 'INDUSTRY_RULES',
    source: 'AI_GENERATED',
    confidenceScore: 0.68,
    isConfirmed: false,
    usageCount: 1,
  },
  {
    id: `${KA_PREFIX}0006`,
    title: 'Employee Holiday Entitlement UK Rules',
    content:
      'UK statutory minimum is 28 days (5.6 weeks) for full-time employees, including bank holidays. Part-time employees receive a pro-rata entitlement. Holiday accrues from the first day of employment at a rate of 1/12th of annual entitlement per month. Unused holiday cannot be carried forward unless contractually agreed or the employee was unable to take it due to sickness. Employers must provide at least 2 days notice for each day of compulsory holiday.',
    category: 'INDUSTRY_RULES',
    source: 'AI_GENERATED',
    confidenceScore: 0.55,
    isConfirmed: false,
    usageCount: 0,
  },
  // ── Correction-derived, confirmed ──
  {
    id: `${KA_PREFIX}0007`,
    title: 'Reverse Charge VAT for Construction Services',
    content:
      'From March 2021, the domestic reverse charge applies to supplies of construction services between VAT-registered businesses. The recipient, not the supplier, accounts for the VAT. This applies to services reported under CIS (Construction Industry Scheme). End users and intermediary suppliers connected to end users are excluded. Use VAT code "RC" on invoices and clearly state "Reverse charge: Customer to account for VAT to HMRC".',
    category: 'TERMINOLOGY',
    source: 'CORRECTION_DERIVED',
    sourceRef: `${CL_PREFIX}0001`,
    confidenceScore: 0.95,
    isConfirmed: true,
    usageCount: 7,
  },
  // ── Admin-uploaded, additional categories ──
  {
    id: `${KA_PREFIX}0008`,
    title: 'Custom Field Naming Conventions',
    content:
      'Custom fields must follow the naming pattern: module_entityType_fieldName (e.g. sales_invoice_deliveryInstructions). Use camelCase for the field name portion. Maximum 50 characters. Reserved prefixes: sys_, nexa_, ai_. Custom fields support types: text, number, date, boolean, select, multi-select. Select options should use UPPER_SNAKE_CASE keys with human-readable labels.',
    category: 'CUSTOM_FIELDS',
    source: 'ADMIN_UPLOADED',
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 4,
  },
  {
    id: `${KA_PREFIX}0009`,
    title: 'Historical AR Ageing Pattern Q3 2025',
    content:
      'Analysis of Q3 2025 AR data shows: Average DSO was 42 days (up from 38 in Q2). 12% of invoices exceeded 90 days. Top 3 late-paying sectors: Construction (avg 58 days), Hospitality (avg 51 days), Retail (avg 45 days). Recommendation: Tighten credit limits for construction sector customers and implement proactive 15-day reminder for hospitality sector.',
    category: 'HISTORICAL_PATTERN',
    source: 'ADMIN_UPLOADED',
    confidenceScore: 1.0,
    isConfirmed: true,
    usageCount: 11,
  },
  // ── AI-generated, confirmed (high confidence) ──
  {
    id: `${KA_PREFIX}0010`,
    title: 'Multi-Currency Invoice Rounding Rules',
    content:
      'When converting invoice amounts between currencies: 1) Use the exchange rate effective on the invoice date. 2) Calculate line totals in the foreign currency first, then convert. 3) Round to the minor unit of the target currency (2 decimal places for GBP, EUR, USD). 4) Any rounding difference should be posted to the exchange rate rounding account (code 7900). 5) For VAT calculations, compute VAT on the rounded GBP amount, not the converted amount.',
    category: 'BUSINESS_PROCESS',
    source: 'AI_GENERATED',
    confidenceScore: 0.91,
    isConfirmed: true,
    usageCount: 6,
  },
  // ── Two more unconfirmed for variety ──
  {
    id: `${KA_PREFIX}0011`,
    title: 'Purchase Order Three-Way Matching',
    content:
      'Three-way matching compares: 1) Purchase order (what was ordered). 2) Goods receipt note (what was received). 3) Supplier invoice (what was billed). Discrepancies beyond tolerance thresholds trigger manual review. Typical tolerances: quantity ±2%, price ±1%, total ±£50. Matched invoices can be auto-approved for payment. Unmatched invoices require AP supervisor approval.',
    category: 'BUSINESS_PROCESS',
    source: 'AI_GENERATED',
    confidenceScore: 0.76,
    isConfirmed: false,
    usageCount: 2,
  },
  {
    id: `${KA_PREFIX}0012`,
    title: 'CIS Deduction Rates for Subcontractors',
    content:
      'Construction Industry Scheme (CIS) deduction rates: Registered subcontractors — 20% of labour portion. Unregistered subcontractors — 30% of labour portion. Gross payment status holders — 0% deduction. Materials costs are excluded from CIS deductions. Monthly CIS returns must be filed with HMRC by the 19th of each month.',
    category: 'INDUSTRY_RULES',
    source: 'AI_GENERATED',
    confidenceScore: 0.63,
    isConfirmed: false,
    usageCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Correction Logs
// ---------------------------------------------------------------------------

const CORRECTION_LOGS = [
  {
    id: `${CL_PREFIX}0001`,
    skillKey: 'invoice-vat-advisor',
    originalResponse: 'For construction services, apply standard 20% VAT rate.',
    correctedResponse:
      'For construction services between VAT-registered businesses, the domestic reverse charge applies. The customer accounts for the VAT, not the supplier. Use VAT code RC.',
    correctionType: 'TERMINOLOGY',
    wasAutoResolved: false,
  },
  {
    id: `${CL_PREFIX}0002`,
    skillKey: 'ar-collection-advisor',
    originalResponse: 'Send a final demand after 30 days overdue.',
    correctedResponse:
      'At 30 days overdue, send an automated reminder email first. Escalate to a formal demand letter at 60 days overdue, following the standard collection workflow.',
    correctionType: 'PROCESS',
    wasAutoResolved: false,
  },
  {
    id: `${CL_PREFIX}0003`,
    skillKey: 'chat-router',
    originalResponse: 'I can create that invoice for you right away.',
    correctedResponse:
      "I'll prepare the invoice details for your review. Please confirm the line items and amounts before I create it.",
    correctionType: 'PREFERENCE',
    wasAutoResolved: true,
  },
  {
    id: `${CL_PREFIX}0004`,
    skillKey: 'stock-advisor',
    originalResponse: 'Your current stock level for SKU-1234 is 150 units.',
    correctedResponse:
      'Your current available stock for SKU-1234 is 120 units (150 total minus 30 allocated to open sales orders).',
    correctionType: 'DATA',
    wasAutoResolved: false,
  },
  {
    id: `${CL_PREFIX}0005`,
    skillKey: 'invoice-vat-advisor',
    originalResponse:
      'The reduced VAT rate of 5% applies to domestic energy supplies for all businesses.',
    correctedResponse:
      'The reduced VAT rate of 5% applies to domestic energy supplies for qualifying residential properties and charities. Most business energy supplies are subject to the standard 20% rate unless a qualifying de minimis declaration is in place.',
    correctionType: 'TERMINOLOGY',
    wasAutoResolved: false,
  },
  {
    id: `${CL_PREFIX}0006`,
    skillKey: 'ar-collection-advisor',
    originalResponse: 'Write off the debt immediately if it exceeds 90 days.',
    correctedResponse:
      'At 90 days overdue, escalate to management for a write-off decision. Do not auto-write-off. Check if a payment plan exists and review the customer credit history before recommending any action.',
    correctionType: 'PROCESS',
    wasAutoResolved: false,
  },
  {
    id: `${CL_PREFIX}0007`,
    skillKey: null,
    originalResponse: 'Your profit margin this quarter is 23%.',
    correctedResponse:
      'Your gross profit margin this quarter is 23%. Net profit margin (after overheads) is 14%. Always specify gross vs net when discussing margins.',
    correctionType: 'DATA',
    wasAutoResolved: true,
  },
  {
    id: `${CL_PREFIX}0008`,
    skillKey: 'chat-router',
    originalResponse: "Sure, I'll delete those 15 invoices now.",
    correctedResponse:
      "I cannot bulk-delete invoices directly. I can help you void or credit individual invoices. Please confirm which invoices you'd like to process and I'll prepare the credit notes for your approval.",
    correctionType: 'OTHER',
    wasAutoResolved: false,
  },
];

// ---------------------------------------------------------------------------
// Training Examples
// ---------------------------------------------------------------------------

const TRAINING_EXAMPLES = [
  {
    id: `${TE_PREFIX}0001`,
    skillKey: 'invoice-vat-advisor',
    inputText: 'What VAT rate should I use for construction services to a VAT-registered builder?',
    outputText:
      'For construction services supplied to a VAT-registered business, apply the domestic reverse charge (VAT code RC). The customer accounts for the VAT. State on the invoice: "Reverse charge: Customer to account for VAT to HMRC".',
    category: 'INDUSTRY_RULES',
    source: 'CORRECTION_DERIVED',
  },
  {
    id: `${TE_PREFIX}0002`,
    skillKey: 'ar-collection-advisor',
    inputText: 'Customer ABC Ltd has an invoice 45 days overdue. What should I do?',
    outputText:
      'At 45 days overdue, the standard workflow is to make a phone call from the AR team. Check if a payment plan has already been agreed. If not, call the customer to discuss payment and document the outcome. The next escalation step at 60 days would be a formal demand letter.',
    category: 'BUSINESS_PROCESS',
    source: 'ADMIN_CURATED',
  },
  {
    id: `${TE_PREFIX}0003`,
    skillKey: 'chat-router',
    inputText: 'Create an invoice for £5,000 to customer Acme Corp',
    outputText:
      "I'll prepare an invoice for Acme Corp for £5,000. Before I create it, could you confirm: 1) Which product/service lines should be included? 2) What VAT treatment applies? 3) Should I use the default payment terms (Net 30)? I'll show you the full details for approval before creating the invoice.",
    category: 'BUSINESS_PROCESS',
    source: 'ADMIN_CURATED',
  },
  {
    id: `${TE_PREFIX}0004`,
    skillKey: 'stock-advisor',
    inputText: 'How many units of SKU-5678 do we have available?',
    outputText:
      'SKU-5678 current inventory: Total on hand: 250 units. Less allocated to open orders: 80 units. Available for new orders: 170 units. Reorder point: 100 units. You have sufficient stock above the reorder threshold.',
    category: 'TERMINOLOGY',
    source: 'ADMIN_CURATED',
  },
  {
    id: `${TE_PREFIX}0005`,
    skillKey: 'invoice-vat-advisor',
    inputText: 'Is the 5% reduced rate applicable to our office electricity bill?',
    outputText:
      'No, the 5% reduced rate for energy supplies applies to qualifying residential properties and charities only. Your office electricity bill is subject to the standard 20% VAT rate. A reduced rate may apply if you have a valid de minimis declaration (usage below 1,000 kWh/month or 4,397 kWh/month for gas), but this is uncommon for business premises.',
    category: 'INDUSTRY_RULES',
    source: 'CORRECTION_DERIVED',
  },
  {
    id: `${TE_PREFIX}0006`,
    skillKey: null,
    inputText: 'What is our profit margin this quarter?',
    outputText:
      'When discussing profit margins, I always clarify which type. Your gross profit margin (revenue minus COGS) this quarter is 23%. Your net profit margin (after all operating expenses, interest, and tax) is 14%. The 9% difference is accounted for by: staff costs (5%), rent and utilities (2%), other overheads (2%).',
    category: 'HISTORICAL_PATTERN',
    source: 'CORRECTION_DERIVED',
  },
];

// ---------------------------------------------------------------------------
// Learning Signals
// ---------------------------------------------------------------------------

function generateLearningSignals(companyId: string) {
  const skills = ['chat-router', 'invoice-vat-advisor', 'ar-collection-advisor', 'stock-advisor'];
  const signals: Array<{
    id: string;
    companyId: string;
    skillKey: string;
    signalDate: Date;
    totalQueries: number;
    successCount: number;
    correctionCount: number;
    avgConfidence: number;
  }> = [];

  let idx = 1;
  for (const skill of skills) {
    // Generate 7 days of signals
    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);

      const totalQueries = 10 + Math.floor(Math.random() * 30);
      const correctionCount = Math.floor(Math.random() * 4);
      const successCount = totalQueries - correctionCount;

      signals.push({
        id: `${LS_PREFIX}${String(idx).padStart(4, '0')}`,
        companyId,
        skillKey: skill,
        signalDate: date,
        totalQueries,
        successCount,
        correctionCount,
        avgConfidence: 0.7 + Math.random() * 0.25,
      });
      idx++;
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export async function seedKnowledgeData(prisma: PrismaClient, companyId: string, userId: string) {
  console.log('Seeding knowledge management data (E5d)...');

  // ── Knowledge Articles ──
  for (const article of KNOWLEDGE_ARTICLES) {
    await prisma.aiKnowledgeArticle.upsert({
      where: { id: article.id },
      update: {
        title: article.title,
        content: article.content,
        category: article.category,
        source: article.source,
        sourceRef: article.sourceRef ?? null,
        confidenceScore: article.confidenceScore,
        isConfirmed: article.isConfirmed,
        usageCount: article.usageCount,
        lastUsedAt: article.usageCount > 0 ? new Date() : null,
        isActive: true,
      },
      create: {
        id: article.id,
        companyId,
        title: article.title,
        content: article.content,
        category: article.category,
        source: article.source,
        sourceRef: article.sourceRef ?? null,
        confidenceScore: article.confidenceScore,
        isConfirmed: article.isConfirmed,
        usageCount: article.usageCount,
        lastUsedAt: article.usageCount > 0 ? new Date() : null,
        isActive: true,
        createdById: userId,
      },
    });
  }
  const confirmed = KNOWLEDGE_ARTICLES.filter((a) => a.isConfirmed).length;
  const unconfirmed = KNOWLEDGE_ARTICLES.length - confirmed;
  console.log(
    `  Seeded ${KNOWLEDGE_ARTICLES.length} knowledge articles (${confirmed} confirmed, ${unconfirmed} needs review)`,
  );

  // ── Correction Logs ──
  // Delete and recreate to ensure correct types (correction logs are append-only, no update)
  for (const correction of CORRECTION_LOGS) {
    await prisma.aiCorrectionLog.deleteMany({ where: { id: correction.id } });
    await prisma.aiCorrectionLog.create({
      data: {
        id: correction.id,
        companyId,
        userId,
        conversationId: null,
        messageId: null,
        skillKey: correction.skillKey,
        originalResponse: correction.originalResponse,
        correctedResponse: correction.correctedResponse,
        correctionType: correction.correctionType,
        wasAutoResolved: correction.wasAutoResolved,
      },
    });
  }
  console.log(`  Seeded ${CORRECTION_LOGS.length} correction logs`);

  // ── Training Examples ──
  for (const example of TRAINING_EXAMPLES) {
    await prisma.aiTrainingExample.upsert({
      where: { id: example.id },
      update: {
        skillKey: example.skillKey,
        inputText: example.inputText,
        outputText: example.outputText,
        category: example.category,
        source: example.source,
        isActive: true,
      },
      create: {
        id: example.id,
        companyId,
        skillKey: example.skillKey,
        inputText: example.inputText,
        outputText: example.outputText,
        category: example.category,
        source: example.source,
        isActive: true,
        createdById: userId,
      },
    });
  }
  console.log(`  Seeded ${TRAINING_EXAMPLES.length} training examples`);

  // ── Learning Signals ──
  const signals = generateLearningSignals(companyId);
  for (const signal of signals) {
    await prisma.aiLearningSignal.upsert({
      where: { id: signal.id },
      update: {
        totalQueries: signal.totalQueries,
        successCount: signal.successCount,
        correctionCount: signal.correctionCount,
        avgConfidence: signal.avgConfidence,
      },
      create: {
        id: signal.id,
        companyId: signal.companyId,
        skillKey: signal.skillKey,
        signalDate: signal.signalDate,
        totalQueries: signal.totalQueries,
        successCount: signal.successCount,
        correctionCount: signal.correctionCount,
        avgConfidence: signal.avgConfidence,
      },
    });
  }
  console.log(`  Seeded ${signals.length} learning signals`);

  console.log('Knowledge management seed data complete.');
}
