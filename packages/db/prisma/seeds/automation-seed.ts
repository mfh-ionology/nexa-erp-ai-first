/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E5c.1 Task 12 — Automation Engine Seed Data
//
// Seeds:
//   1. Two example AI agents (AR aging analyser + summary writer)
//   2. Prompts for those agents with system prompt variables
//   3. Example "Daily AR Aging Summary" automation (2 steps, scheduled weekdays 7AM)
//   4. AiPromptVariable records (SYSTEM source type) for reusable system variables
//
// All upserts are idempotent — safe to re-run.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Prompt Definitions
// ---------------------------------------------------------------------------

const AR_ANALYSIS_SYSTEM_PROMPT = `You are an AR Aging Analysis agent for Nexa ERP. Your goal is to analyse accounts receivable aging data and identify overdue invoices that require attention.

## Instructions

1. Query the AR aging data for the company
2. Identify invoices that are overdue by 30+ days
3. Group findings by customer
4. Calculate total outstanding amounts per aging bucket (current, 30, 60, 90+ days)

## Output Format

Return a JSON object:
{
  "summary": { "totalOutstanding": number, "totalOverdue": number, "customerCount": number },
  "agingBuckets": { "current": number, "days30": number, "days60": number, "days90Plus": number },
  "flaggedInvoices": [{ "invoiceNumber": string, "customerName": string, "amount": number, "daysOverdue": number }],
  "analysedAt": "ISO date string"
}

## Guardrails

- NEVER modify any financial records
- Report factual data only — do not fabricate numbers
- Use British English`;

const AR_ANALYSIS_USER_TEMPLATE = `Analyse the accounts receivable aging for {{company.name}} as of {{today}}.

Focus on invoices overdue by more than 30 days. Base currency: {{company.baseCurrency}}.`;

const SUMMARY_WRITER_SYSTEM_PROMPT = `You are a Summary Writer agent for Nexa ERP. Your goal is to take structured analysis data and produce a concise, human-readable executive summary suitable for email or dashboard display.

## Instructions

1. Read the analysis input data (JSON from a previous step)
2. Write a clear executive summary in British English
3. Highlight the most critical items that need attention
4. Include actionable recommendations

## Output Format

Return a JSON object:
{
  "subject": "string — email subject line",
  "summary": "string — 2-3 paragraph executive summary in markdown",
  "criticalItems": ["string — top 3 action items"],
  "generatedAt": "ISO date string"
}

## Guardrails

- Be factual — do not invent data not present in the input
- Keep the summary under 300 words
- Use British English`;

const SUMMARY_WRITER_USER_TEMPLATE = `Write an executive summary of the following analysis for {{company.name}}:

{{step1.output}}`;

// ---------------------------------------------------------------------------
// System Variables (reusable across prompts)
// ---------------------------------------------------------------------------

interface SystemVariableDef {
  variableName: string;
  displayName: string;
  description: string;
  sourceType: 'SYSTEM';
  sourceConfig: Record<string, string>;
  defaultValue: string | null;
  isRequired: boolean;
}

const SYSTEM_VARIABLES: SystemVariableDef[] = [
  {
    variableName: 'today',
    displayName: 'Today (ISO Date)',
    description: 'Current date in ISO 8601 format (YYYY-MM-DD)',
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'today' },
    defaultValue: null,
    isRequired: true,
  },
  {
    variableName: 'currentUser.name',
    displayName: 'Current User Name',
    description: 'Full name of the currently authenticated user',
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'currentUser.name' },
    defaultValue: 'System',
    isRequired: false,
  },
  {
    variableName: 'currentUser.role',
    displayName: 'Current User Role',
    description: 'Role of the currently authenticated user (e.g., ADMIN, USER)',
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'currentUser.role' },
    defaultValue: 'SYSTEM',
    isRequired: false,
  },
  {
    variableName: 'company.name',
    displayName: 'Company Name',
    description: 'Name of the current company/tenant',
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'company.name' },
    defaultValue: null,
    isRequired: true,
  },
  {
    variableName: 'company.baseCurrency',
    displayName: 'Base Currency',
    description: 'Base currency code for the current company (e.g., GBP)',
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'company.baseCurrency' },
    defaultValue: 'GBP',
    isRequired: false,
  },
  {
    variableName: 'company.defaultCurrency',
    displayName: 'Default Currency',
    description: 'Default transaction currency code for the current company',
    sourceType: 'SYSTEM',
    sourceConfig: { key: 'company.defaultCurrency' },
    defaultValue: 'GBP',
    isRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------

export async function seedAutomationData(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<void> {
  // ── 1. Seed AR Analysis Prompt ──────────────────────────────────────────
  const arAnalysisPrompt = await prisma.aiPrompt.upsert({
    where: { name: 'ar-aging-analysis' },
    update: {
      description: 'Analyses accounts receivable aging data and identifies overdue invoices',
      category: 'automation',
      systemPrompt: AR_ANALYSIS_SYSTEM_PROMPT,
      userTemplate: AR_ANALYSIS_USER_TEMPLATE,
      parameters: {
        'company.name': { type: 'system', key: 'company.name' },
        today: { type: 'system', key: 'today' },
        'company.baseCurrency': { type: 'system', key: 'company.baseCurrency' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          summary: 'object',
          agingBuckets: 'object',
          flaggedInvoices: 'array',
          analysedAt: 'string',
        },
      },
    },
    create: {
      name: 'ar-aging-analysis',
      description: 'Analyses accounts receivable aging data and identifies overdue invoices',
      category: 'automation',
      systemPrompt: AR_ANALYSIS_SYSTEM_PROMPT,
      userTemplate: AR_ANALYSIS_USER_TEMPLATE,
      parameters: {
        'company.name': { type: 'system', key: 'company.name' },
        today: { type: 'system', key: 'today' },
        'company.baseCurrency': { type: 'system', key: 'company.baseCurrency' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          summary: 'object',
          agingBuckets: 'object',
          flaggedInvoices: 'array',
          analysedAt: 'string',
        },
      },
      createdBy: 'system-seed',
    },
  });

  // Seed prompt version 1
  const existingArVersion = await prisma.aiPromptVersion.findUnique({
    where: { promptId_version: { promptId: arAnalysisPrompt.id, version: 1 } },
    select: { id: true },
  });
  if (!existingArVersion) {
    await prisma.aiPromptVersion.create({
      data: {
        promptId: arAnalysisPrompt.id,
        version: 1,
        systemPrompt: AR_ANALYSIS_SYSTEM_PROMPT,
        userTemplate: AR_ANALYSIS_USER_TEMPLATE,
        parameters: {
          'company.name': { type: 'system', key: 'company.name' },
          today: { type: 'system', key: 'today' },
          'company.baseCurrency': { type: 'system', key: 'company.baseCurrency' },
        },
        changeReason: 'Initial version',
        createdBy: 'system-seed',
      },
    });
  }

  console.log('Seeded ar-aging-analysis prompt + version 1');

  // ── 2. Seed Summary Writer Prompt ───────────────────────────────────────
  const summaryWriterPrompt = await prisma.aiPrompt.upsert({
    where: { name: 'summary-writer' },
    update: {
      description: 'Produces executive summaries from structured analysis data',
      category: 'automation',
      systemPrompt: SUMMARY_WRITER_SYSTEM_PROMPT,
      userTemplate: SUMMARY_WRITER_USER_TEMPLATE,
      parameters: {
        'company.name': { type: 'system', key: 'company.name' },
        'step1.output': { type: 'previous_step', stepOrder: 1, path: '.' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          subject: 'string',
          summary: 'string',
          criticalItems: 'string[]',
          generatedAt: 'string',
        },
      },
    },
    create: {
      name: 'summary-writer',
      description: 'Produces executive summaries from structured analysis data',
      category: 'automation',
      systemPrompt: SUMMARY_WRITER_SYSTEM_PROMPT,
      userTemplate: SUMMARY_WRITER_USER_TEMPLATE,
      parameters: {
        'company.name': { type: 'system', key: 'company.name' },
        'step1.output': { type: 'previous_step', stepOrder: 1, path: '.' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          subject: 'string',
          summary: 'string',
          criticalItems: 'string[]',
          generatedAt: 'string',
        },
      },
      createdBy: 'system-seed',
    },
  });

  // Seed prompt version 1
  const existingSummaryVersion = await prisma.aiPromptVersion.findUnique({
    where: { promptId_version: { promptId: summaryWriterPrompt.id, version: 1 } },
    select: { id: true },
  });
  if (!existingSummaryVersion) {
    await prisma.aiPromptVersion.create({
      data: {
        promptId: summaryWriterPrompt.id,
        version: 1,
        systemPrompt: SUMMARY_WRITER_SYSTEM_PROMPT,
        userTemplate: SUMMARY_WRITER_USER_TEMPLATE,
        parameters: {
          'company.name': { type: 'system', key: 'company.name' },
          'step1.output': { type: 'previous_step', stepOrder: 1, path: '.' },
        },
        changeReason: 'Initial version',
        createdBy: 'system-seed',
      },
    });
  }

  console.log('Seeded summary-writer prompt + version 1');

  // ── 3. Seed AR Aging Analysis Agent ─────────────────────────────────────
  const arAgent = await prisma.aiAgent.upsert({
    where: { name: 'ar-aging-analyser' },
    update: {
      displayName: 'AR Aging Analyser',
      description: 'Analyses accounts receivable aging data and flags overdue invoices',
      routingTags: ['standard', 'automation', 'finance'],
      promptId: arAnalysisPrompt.id,
      tools: ['query_data'],
      guardrails: {
        rules: [
          { type: 'no_auto_execute', description: 'Never modify financial records' },
          { type: 'no_data_fabrication', description: 'Report only factual data from queries' },
        ],
      },
      triggerConfig: {
        type: 'automation',
        description: 'Triggered by automation engine for AR aging analysis',
      },
      maxTurns: 5,
      isActive: true,
    },
    create: {
      name: 'ar-aging-analyser',
      displayName: 'AR Aging Analyser',
      description: 'Analyses accounts receivable aging data and flags overdue invoices',
      routingTags: ['standard', 'automation', 'finance'],
      promptId: arAnalysisPrompt.id,
      tools: ['query_data'],
      guardrails: {
        rules: [
          { type: 'no_auto_execute', description: 'Never modify financial records' },
          { type: 'no_data_fabrication', description: 'Report only factual data from queries' },
        ],
      },
      triggerConfig: {
        type: 'automation',
        description: 'Triggered by automation engine for AR aging analysis',
      },
      maxTurns: 5,
      isActive: true,
    },
  });

  console.log('Seeded ar-aging-analyser agent');

  // ── 4. Seed Summary Writer Agent ────────────────────────────────────────
  const summaryAgent = await prisma.aiAgent.upsert({
    where: { name: 'summary-writer' },
    update: {
      displayName: 'Summary Writer',
      description: 'Produces executive summaries from structured analysis data',
      routingTags: ['cheap', 'fast', 'automation'],
      promptId: summaryWriterPrompt.id,
      tools: [],
      guardrails: {
        rules: [
          { type: 'no_data_fabrication', description: 'Summarise only data present in input' },
        ],
      },
      triggerConfig: {
        type: 'automation',
        description: 'Triggered by automation engine as a downstream summary step',
      },
      maxTurns: 3,
      isActive: true,
    },
    create: {
      name: 'summary-writer',
      displayName: 'Summary Writer',
      description: 'Produces executive summaries from structured analysis data',
      routingTags: ['cheap', 'fast', 'automation'],
      promptId: summaryWriterPrompt.id,
      tools: [],
      guardrails: {
        rules: [
          { type: 'no_data_fabrication', description: 'Summarise only data present in input' },
        ],
      },
      triggerConfig: {
        type: 'automation',
        description: 'Triggered by automation engine as a downstream summary step',
      },
      maxTurns: 3,
      isActive: true,
    },
  });

  console.log('Seeded summary-writer agent');

  // ── 5. Seed "Daily AR Aging Summary" Automation ─────────────────────────
  // Use findFirst + create/update pattern since there's no unique on [companyId, name]
  let automation = await prisma.aiAutomation.findFirst({
    where: { companyId, name: 'Daily AR Aging Summary' },
    select: { id: true },
  });

  if (automation) {
    await prisma.aiAutomation.update({
      where: { id: automation.id },
      data: {
        description:
          'Runs every weekday at 7:00 AM — analyses AR aging, identifies overdue invoices, and produces an executive summary.',
        triggerType: 'SCHEDULED',
        maxTokenBudget: 50000,
        maxDurationMs: 300000,
        isActive: true,
        notificationConfig: {
          onComplete: { roles: ['ADMIN', 'FINANCE_MANAGER'] },
          onFailure: { roles: ['ADMIN'] },
        },
      },
    });
  } else {
    automation = await prisma.aiAutomation.create({
      data: {
        companyId,
        name: 'Daily AR Aging Summary',
        description:
          'Runs every weekday at 7:00 AM — analyses AR aging, identifies overdue invoices, and produces an executive summary.',
        triggerType: 'SCHEDULED',
        maxTokenBudget: 50000,
        maxDurationMs: 300000,
        isActive: true,
        createdById: userId,
        notificationConfig: {
          onComplete: { roles: ['ADMIN', 'FINANCE_MANAGER'] },
          onFailure: { roles: ['ADMIN'] },
        },
      },
      select: { id: true },
    });
  }

  console.log('Seeded "Daily AR Aging Summary" automation');

  // ── 6. Seed Automation Steps ────────────────────────────────────────────
  // Step 1: AR Aging Analysis
  const existingStep1 = await prisma.aiAutomationStep.findUnique({
    where: {
      automationId_stepOrder: { automationId: automation.id, stepOrder: 1 },
    },
    select: { id: true },
  });

  if (existingStep1) {
    await prisma.aiAutomationStep.update({
      where: { id: existingStep1.id },
      data: {
        agentId: arAgent.id,
        goal: 'Analyse the accounts receivable aging for the company. Identify all invoices overdue by 30+ days, group by customer, and calculate aging bucket totals.',
        inputConfig: {
          variables: {
            'company.name': { source: 'SYSTEM', key: 'company.name' },
            today: { source: 'SYSTEM', key: 'today' },
            'company.baseCurrency': { source: 'SYSTEM', key: 'company.baseCurrency' },
          },
        },
        outputConfig: {
          capture: ['summary', 'agingBuckets', 'flaggedInvoices', 'analysedAt'],
        },
        maxTurns: 5,
      },
    });
  } else {
    await prisma.aiAutomationStep.create({
      data: {
        automationId: automation.id,
        stepOrder: 1,
        agentId: arAgent.id,
        goal: 'Analyse the accounts receivable aging for the company. Identify all invoices overdue by 30+ days, group by customer, and calculate aging bucket totals.',
        inputConfig: {
          variables: {
            'company.name': { source: 'SYSTEM', key: 'company.name' },
            today: { source: 'SYSTEM', key: 'today' },
            'company.baseCurrency': { source: 'SYSTEM', key: 'company.baseCurrency' },
          },
        },
        outputConfig: {
          capture: ['summary', 'agingBuckets', 'flaggedInvoices', 'analysedAt'],
        },
        maxTurns: 5,
      },
    });
  }

  // Step 2: Summary Writer
  const existingStep2 = await prisma.aiAutomationStep.findUnique({
    where: {
      automationId_stepOrder: { automationId: automation.id, stepOrder: 2 },
    },
    select: { id: true },
  });

  if (existingStep2) {
    await prisma.aiAutomationStep.update({
      where: { id: existingStep2.id },
      data: {
        agentId: summaryAgent.id,
        goal: 'Write a concise executive summary of the AR aging analysis. Highlight critical overdue items and recommend follow-up actions.',
        inputConfig: {
          variables: {
            'company.name': { source: 'SYSTEM', key: 'company.name' },
            'step1.output': { source: 'PREVIOUS_STEP', stepOrder: 1, path: '.' },
          },
        },
        outputConfig: {
          capture: ['subject', 'summary', 'criticalItems', 'generatedAt'],
        },
        maxTurns: 3,
      },
    });
  } else {
    await prisma.aiAutomationStep.create({
      data: {
        automationId: automation.id,
        stepOrder: 2,
        agentId: summaryAgent.id,
        goal: 'Write a concise executive summary of the AR aging analysis. Highlight critical overdue items and recommend follow-up actions.',
        inputConfig: {
          variables: {
            'company.name': { source: 'SYSTEM', key: 'company.name' },
            'step1.output': { source: 'PREVIOUS_STEP', stepOrder: 1, path: '.' },
          },
        },
        outputConfig: {
          capture: ['subject', 'summary', 'criticalItems', 'generatedAt'],
        },
        maxTurns: 3,
      },
    });
  }

  console.log('Seeded 2 automation steps (AR analysis + summary writer)');

  // ── 7. Seed Automation Schedule (weekdays at 7:00 AM) ──────────────────
  await prisma.aiAutomationSchedule.upsert({
    where: { automationId: automation.id },
    update: {
      cronExpression: '0 7 * * 1-5',
      timezone: 'Europe/London',
      isPaused: false,
    },
    create: {
      automationId: automation.id,
      cronExpression: '0 7 * * 1-5',
      timezone: 'Europe/London',
      isPaused: false,
    },
  });

  console.log('Seeded automation schedule (weekdays 07:00 Europe/London)');

  // ── 8. Seed System Prompt Variables ─────────────────────────────────────
  // Attach system variables to both prompts so they're discoverable via the
  // variable registry endpoint (GET /ai/variables)
  const promptIds = [arAnalysisPrompt.id, summaryWriterPrompt.id];

  for (const promptId of promptIds) {
    for (const v of SYSTEM_VARIABLES) {
      await prisma.aiPromptVariable.upsert({
        where: {
          promptId_variableName: { promptId, variableName: v.variableName },
        },
        update: {
          displayName: v.displayName,
          description: v.description,
          sourceType: v.sourceType,
          sourceConfig: v.sourceConfig,
          defaultValue: v.defaultValue,
          isRequired: v.isRequired,
        },
        create: {
          promptId,
          variableName: v.variableName,
          displayName: v.displayName,
          description: v.description,
          sourceType: v.sourceType,
          sourceConfig: v.sourceConfig,
          defaultValue: v.defaultValue,
          isRequired: v.isRequired,
        },
      });
    }
  }

  // Add PREVIOUS_STEP variable to the summary writer prompt
  await prisma.aiPromptVariable.upsert({
    where: {
      promptId_variableName: {
        promptId: summaryWriterPrompt.id,
        variableName: 'step1.output',
      },
    },
    update: {
      displayName: 'Step 1 Output',
      description: 'Full JSON output from the previous AR aging analysis step',
      sourceType: 'PREVIOUS_STEP' as string,
      sourceConfig: { stepOrder: 1, path: '.' },
      defaultValue: null,
      isRequired: true,
    },
    create: {
      promptId: summaryWriterPrompt.id,
      variableName: 'step1.output',
      displayName: 'Step 1 Output',
      description: 'Full JSON output from the previous AR aging analysis step',
      sourceType: 'PREVIOUS_STEP' as string,
      sourceConfig: { stepOrder: 1, path: '.' },
      defaultValue: null,
      isRequired: true,
    },
  });

  const totalVars = promptIds.length * SYSTEM_VARIABLES.length + 1;
  console.log(
    `Seeded ${totalVars} prompt variables (${SYSTEM_VARIABLES.length} system vars × ${promptIds.length} prompts + 1 PREVIOUS_STEP)`,
  );

  // ── 9. Seed AiSkill Records ───────────────────────────────────────────────
  // These give the AI admin skills page something to display.

  const SKILLS = [
    {
      name: 'overdue-invoice-reminder',
      displayName: 'Overdue Invoice Reminder',
      description:
        'Generates personalised reminder emails for overdue invoices, adjusting tone based on aging bucket.',
      category: 'record_action',
      moduleKey: 'sales',
      skillContent: `You are an overdue invoice reminder agent. Given an invoice record with customer details and aging data, draft a polite but firm reminder email.\n\n## Tone Guidance\n- 30 days: friendly nudge\n- 60 days: firm professional reminder\n- 90+ days: escalation notice with payment terms\n\nReturn JSON: { "subject": string, "body": string, "urgency": "low"|"medium"|"high" }`,
      triggerPhrases: [
        'remind customer about overdue invoice',
        'send payment reminder',
        'chase overdue payment',
      ],
      negativeTriggers: ['create invoice', 'void invoice', 'credit note'],
      orchestrationPattern: 'single_shot',
      outputType: 'json',
      inputSchema: { invoiceId: 'string', customerId: 'string', daysOverdue: 'number' },
      requiredTools: ['query_data'],
      priority: 80,
    },
    {
      name: 'customer-credit-check',
      displayName: 'Customer Credit Check',
      description:
        'Analyses a customer account to assess credit risk based on payment history, outstanding balances, and credit limit.',
      category: 'analysis',
      moduleKey: 'sales',
      skillContent: `You are a credit risk analyst. Review the customer's payment history, outstanding invoices, and credit limit.\n\nReturn JSON: { "riskLevel": "low"|"medium"|"high", "creditScore": number, "recommendation": string, "factors": string[] }`,
      triggerPhrases: [
        'check customer credit',
        'credit risk assessment',
        'evaluate creditworthiness',
      ],
      negativeTriggers: ['update credit limit', 'approve credit'],
      orchestrationPattern: 'single_shot',
      outputType: 'json',
      inputSchema: { customerId: 'string' },
      requiredTools: ['query_data'],
      priority: 90,
    },
    {
      name: 'stock-reorder-suggestion',
      displayName: 'Stock Reorder Suggestion',
      description:
        'Analyses inventory levels and suggests reorder quantities based on lead times and demand patterns.',
      category: 'analysis',
      moduleKey: 'inventory',
      skillContent: `You are an inventory optimisation agent. Analyse stock levels, lead times, and recent demand to suggest reorder quantities.\n\nReturn JSON: { "items": [{ "itemCode": string, "currentStock": number, "suggestedOrder": number, "reason": string }] }`,
      triggerPhrases: [
        'suggest reorder quantities',
        'stock reorder analysis',
        'what should we reorder',
      ],
      negativeTriggers: ['create purchase order', 'adjust stock'],
      orchestrationPattern: 'single_shot',
      outputType: 'json',
      inputSchema: { warehouseId: 'string' },
      requiredTools: ['query_data'],
      priority: 85,
    },
    {
      name: 'payment-allocation',
      displayName: 'Payment Allocation',
      description:
        'Suggests optimal allocation of a received payment across outstanding invoices using FIFO or best-match strategy.',
      category: 'record_action',
      moduleKey: 'finance',
      skillContent: `You are a payment allocation agent. Given a payment amount and list of outstanding invoices, suggest the optimal allocation strategy.\n\nStrategies: FIFO (oldest first), best-match (closest to payment amount), partial (spread across all).\n\nReturn JSON: { "strategy": string, "allocations": [{ "invoiceId": string, "amount": number }], "unallocated": number }`,
      triggerPhrases: [
        'allocate payment',
        'match payment to invoices',
        'payment allocation suggestion',
      ],
      negativeTriggers: ['create payment', 'void payment'],
      orchestrationPattern: 'single_shot',
      outputType: 'json',
      inputSchema: { paymentAmount: 'number', currency: 'string' },
      requiredTools: ['query_data'],
      priority: 75,
    },
    {
      name: 'ar-aging-summary',
      displayName: 'AR Aging Summary',
      description:
        'Produces an executive summary of accounts receivable aging with key metrics and action items.',
      category: 'reporting',
      moduleKey: 'finance',
      skillContent: `You are an AR reporting agent. Analyse the accounts receivable aging data and produce a concise executive summary.\n\nReturn JSON: { "totalOutstanding": number, "overdue": number, "agingBuckets": { "current": number, "days30": number, "days60": number, "days90Plus": number }, "topDebtors": [{ "name": string, "amount": number }], "actionItems": string[] }`,
      triggerPhrases: ['ar aging summary', 'accounts receivable report', 'who owes us money'],
      negativeTriggers: ['create invoice', 'record payment'],
      orchestrationPattern: 'single_shot',
      outputType: 'json',
      inputSchema: {},
      requiredTools: ['query_data'],
      priority: 70,
    },
  ];

  for (const skill of SKILLS) {
    await prisma.aiSkill.upsert({
      where: { name: skill.name },
      update: {
        displayName: skill.displayName,
        description: skill.description,
        category: skill.category,
        moduleKey: skill.moduleKey,
        skillContent: skill.skillContent,
        triggerPhrases: skill.triggerPhrases,
        negativeTriggers: skill.negativeTriggers,
        orchestrationPattern: skill.orchestrationPattern,
        outputType: skill.outputType,
        inputSchema: skill.inputSchema,
        requiredTools: skill.requiredTools,
        priority: skill.priority,
        isActive: true,
      },
      create: {
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        category: skill.category,
        moduleKey: skill.moduleKey,
        skillContent: skill.skillContent,
        triggerPhrases: skill.triggerPhrases,
        negativeTriggers: skill.negativeTriggers,
        orchestrationPattern: skill.orchestrationPattern,
        outputType: skill.outputType,
        inputSchema: skill.inputSchema,
        requiredTools: skill.requiredTools,
        priority: skill.priority,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${SKILLS.length} AI skills`);

  // ── 10. Seed AiAutomationRun + StepRun Records ────────────────────────────
  // These give the automation runs page data to display: 1 completed, 1 failed, 1 running.

  // First, fetch the automation steps (need their IDs for step runs)
  const steps = await prisma.aiAutomationStep.findMany({
    where: { automationId: automation.id },
    orderBy: { stepOrder: 'asc' },
    select: { id: true, stepOrder: true, agentId: true },
  });

  // Only seed runs if none exist yet (idempotent — safe to re-run)
  const existingRunCount = await prisma.aiAutomationRun.count({
    where: { automationId: automation.id },
  });

  if (steps.length >= 2 && existingRunCount === 0) {
    const step1 = steps[0]!;
    const step2 = steps[1]!;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // ── Run 1: COMPLETED (yesterday) ────────────────────────────────────
    const completedStarted = new Date(yesterday);
    completedStarted.setHours(7, 0, 0, 0);
    const completedFinished = new Date(yesterday);
    completedFinished.setHours(7, 2, 15, 0);

    const completedRun = await prisma.aiAutomationRun.create({
      data: {
        automationId: automation.id,
        triggeredBy: 'scheduler',
        status: 'COMPLETED',
        startedAt: completedStarted,
        completedAt: completedFinished,
        totalTokens: 12500,
        totalCost: 0.19,
        result: {
          subject: 'AR Aging Summary — 3 Mar 2026',
          summary:
            'Total outstanding: £147,230. 12 invoices overdue by 30+ days totalling £42,100.',
          criticalItems: [
            'Acme Ltd: £18,500 overdue 90+ days — escalate to collections',
            'TechCorp: £12,300 overdue 60 days — send formal reminder',
            'GlobalTrade: £11,300 overdue 45 days — phone follow-up recommended',
          ],
        },
      },
    });

    // Step runs for completed run
    await prisma.aiAutomationStepRun.createMany({
      data: [
        {
          runId: completedRun.id,
          stepId: step1.id,
          status: 'COMPLETED',
          agentId: step1.agentId,
          input: {
            'company.name': 'Nexa Demo Ltd',
            today: yesterday.toISOString().split('T')[0],
            'company.baseCurrency': 'GBP',
          },
          output: {
            summary: { totalOutstanding: 147230, totalOverdue: 42100, customerCount: 12 },
            agingBuckets: { current: 105130, days30: 22400, days60: 12300, days90Plus: 7400 },
          },
          inputTokens: 4200,
          outputTokens: 3100,
          latencyMs: 45000,
          turns: 3,
          startedAt: completedStarted,
          completedAt: new Date(completedStarted.getTime() + 90 * 1000),
        },
        {
          runId: completedRun.id,
          stepId: step2.id,
          status: 'COMPLETED',
          agentId: step2.agentId,
          input: { 'company.name': 'Nexa Demo Ltd', 'step1.output': '{ "summary": ... }' },
          output: {
            subject: 'AR Aging Summary — 3 Mar 2026',
            summary: 'Executive summary text...',
            criticalItems: ['Escalate Acme Ltd'],
          },
          inputTokens: 3200,
          outputTokens: 2000,
          latencyMs: 28000,
          turns: 2,
          startedAt: new Date(completedStarted.getTime() + 92 * 1000),
          completedAt: completedFinished,
        },
      ],
    });

    console.log('Seeded COMPLETED automation run with 2 step runs');

    // ── Run 2: FAILED (2 days ago) ──────────────────────────────────────
    const failedStarted = new Date(twoDaysAgo);
    failedStarted.setHours(7, 0, 0, 0);

    const failedRun = await prisma.aiAutomationRun.create({
      data: {
        automationId: automation.id,
        triggeredBy: 'scheduler',
        status: 'FAILED',
        startedAt: failedStarted,
        totalTokens: 4200,
        totalCost: 0.06,
        error: 'Step 2 failed: Rate limit exceeded — provider returned HTTP 429. Retry after 60s.',
      },
    });

    await prisma.aiAutomationStepRun.createMany({
      data: [
        {
          runId: failedRun.id,
          stepId: step1.id,
          status: 'COMPLETED',
          agentId: step1.agentId,
          input: { 'company.name': 'Nexa Demo Ltd', today: twoDaysAgo.toISOString().split('T')[0] },
          output: { summary: { totalOutstanding: 145800, totalOverdue: 41200 } },
          inputTokens: 4200,
          outputTokens: 3000,
          latencyMs: 42000,
          turns: 3,
          startedAt: failedStarted,
          completedAt: new Date(failedStarted.getTime() + 85 * 1000),
        },
        {
          runId: failedRun.id,
          stepId: step2.id,
          status: 'FAILED',
          agentId: step2.agentId,
          input: { 'company.name': 'Nexa Demo Ltd', 'step1.output': '...' },
          error: 'Rate limit exceeded — provider returned HTTP 429. Retry after 60s.',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 1200,
          turns: 0,
          startedAt: new Date(failedStarted.getTime() + 87 * 1000),
          completedAt: new Date(failedStarted.getTime() + 88 * 1000),
        },
      ],
    });

    console.log('Seeded FAILED automation run with 2 step runs');

    // ── Run 3: RUNNING (now) ────────────────────────────────────────────
    const runningStarted = new Date(now.getTime() - 30 * 1000);

    const runningRun = await prisma.aiAutomationRun.create({
      data: {
        automationId: automation.id,
        triggeredBy: `manual:${userId}`,
        status: 'RUNNING',
        startedAt: runningStarted,
        totalTokens: 4100,
        totalCost: 0.06,
      },
    });

    await prisma.aiAutomationStepRun.createMany({
      data: [
        {
          runId: runningRun.id,
          stepId: step1.id,
          status: 'COMPLETED',
          agentId: step1.agentId,
          input: { 'company.name': 'Nexa Demo Ltd', today: now.toISOString().split('T')[0] },
          output: { summary: { totalOutstanding: 148500, totalOverdue: 43200 } },
          inputTokens: 4100,
          outputTokens: 3000,
          latencyMs: 25000,
          turns: 2,
          startedAt: runningStarted,
          completedAt: new Date(runningStarted.getTime() + 25 * 1000),
        },
        {
          runId: runningRun.id,
          stepId: step2.id,
          status: 'PENDING',
          agentId: step2.agentId,
          inputTokens: 0,
          outputTokens: 0,
          turns: 0,
        },
      ],
    });

    console.log('Seeded RUNNING automation run with 2 step runs');
  } else if (existingRunCount > 0) {
    console.log(`Skipping automation runs — ${existingRunCount} already exist`);
  } else {
    console.log('WARN: Could not seed automation runs — automation steps not found');
  }
}
