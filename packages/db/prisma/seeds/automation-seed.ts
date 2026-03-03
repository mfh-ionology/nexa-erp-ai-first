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
}
