import { PrismaClient, UserRole, VatType } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, scryptSync } from 'crypto';
import {
  loadDefaultResources,
  loadDefaultAccessGroups,
  assignFullAccessGroup,
} from '../src/services/default-data-loader.service.js';
import { seedDataViews } from './seeds/data-views.seed.js';
import { seedViewsSkillPack } from './seeds/skill-packs/views.js';
import { seedViewsModuleKnowledge } from './seeds/module-knowledge/views.js';
import { seedViewsEntityTriggers } from './seeds/entity-triggers/views.js';
import { seedAutomationData } from './seeds/automation-seed.js';

// Seed uses DIRECT_URL (bypasses PgBouncer) for reliable transactional seeding.
// Runtime client (src/client.ts) uses DATABASE_URL via PgBouncer instead.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Neither DIRECT_URL nor DATABASE_URL is set — cannot seed');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

// Well-known deterministic UUID for the default company (used as upsert key)
const DEFAULT_COMPANY_ID = '00000000-0000-4000-a000-000000000001';

// Well-known deterministic UUID for the default admin user (used as upsert key)
const DEFAULT_USER_ID = '00000000-0000-4000-a000-000000000002';

const currencies = [
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', minorUnit: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', minorUnit: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnit: 2 },
];

const countries = [
  {
    code: 'GB',
    iso3Code: 'GBR',
    name: 'United Kingdom',
    defaultCurrencyCode: 'GBP',
    region: 'UK',
    vatPrefix: 'GB',
  },
];

const vatCodes = [
  { code: 'S', name: 'Standard Rate', rate: 20, type: VatType.STANDARD, isDefault: true },
  { code: 'R', name: 'Reduced Rate', rate: 5, type: VatType.REDUCED, isDefault: false },
  { code: 'Z', name: 'Zero Rate', rate: 0, type: VatType.ZERO, isDefault: false },
  { code: 'E', name: 'Exempt', rate: 0, type: VatType.EXEMPT, isDefault: false },
  { code: 'RC', name: 'Reverse Charge', rate: 0, type: VatType.REVERSE_CHARGE, isDefault: false },
];

const paymentTerms = [
  { code: 'NET30', name: 'Net 30', dueDays: 30, isDefault: true },
  { code: 'NET60', name: 'Net 60', dueDays: 60, isDefault: false },
  { code: 'DOR', name: 'Due on Receipt', dueDays: 0, isDefault: false },
  { code: 'NET14', name: 'Net 14', dueDays: 14, isDefault: false },
];

const numberSeries = [
  { entityType: 'INVOICE', prefix: 'INV-', padding: 5 },
  { entityType: 'CREDIT_NOTE', prefix: 'CN-', padding: 5 },
  { entityType: 'SALES_ORDER', prefix: 'SO-', padding: 5 },
  { entityType: 'SALES_QUOTE', prefix: 'QT-', padding: 5 },
  { entityType: 'PURCHASE_ORDER', prefix: 'PO-', padding: 5 },
  { entityType: 'BILL', prefix: 'BIL-', padding: 5 },
  { entityType: 'JOURNAL', prefix: 'JE-', padding: 5 },
  { entityType: 'PAYMENT', prefix: 'PAY-', padding: 5 },
  { entityType: 'SHIPMENT', prefix: 'SHP-', padding: 5 },
  { entityType: 'GOODS_RECEIPT', prefix: 'GRN-', padding: 5 },
  { entityType: 'EMPLOYEE', prefix: 'EMP-', padding: 4 },
  { entityType: 'CUSTOMER', prefix: 'CUS-', padding: 5 },
  { entityType: 'SUPPLIER', prefix: 'SUP-', padding: 5 },
];

// ---------------------------------------------------------------------------
// Seed Functions (idempotent upsert pattern)
// ---------------------------------------------------------------------------

async function seedCurrencies() {
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol, minorUnit: c.minorUnit },
      create: c,
    });
  }
  console.log(`Seeded ${currencies.length} currencies`);
}

async function seedCountries() {
  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: {
        iso3Code: c.iso3Code,
        name: c.name,
        defaultCurrencyCode: c.defaultCurrencyCode,
        region: c.region,
        vatPrefix: c.vatPrefix,
      },
      create: c,
    });
  }
  console.log(`Seeded ${countries.length} countries`);
}

async function seedDefaultCompany() {
  await prisma.companyProfile.upsert({
    where: { id: DEFAULT_COMPANY_ID },
    update: {
      name: 'Default Company',
      baseCurrencyCode: 'GBP',
      countryCode: 'GB',
      isDefault: true,
      updatedBy: 'system-seed',
    },
    create: {
      id: DEFAULT_COMPANY_ID,
      name: 'Default Company',
      baseCurrencyCode: 'GBP',
      countryCode: 'GB',
      isDefault: true,
      createdBy: 'system-seed',
      updatedBy: 'system-seed',
    },
  });
  console.log('Seeded default company');
}

async function seedVatCodes() {
  for (const v of vatCodes) {
    await prisma.vatCode.upsert({
      where: {
        companyId_code: { companyId: DEFAULT_COMPANY_ID, code: v.code },
      },
      update: { name: v.name, rate: v.rate, type: v.type, isDefault: v.isDefault },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: v.code,
        name: v.name,
        rate: v.rate,
        type: v.type,
        isDefault: v.isDefault,
      },
    });
  }
  console.log(`Seeded ${vatCodes.length} VAT codes`);
}

async function seedPaymentTerms() {
  for (const pt of paymentTerms) {
    await prisma.paymentTerms.upsert({
      where: {
        companyId_code: { companyId: DEFAULT_COMPANY_ID, code: pt.code },
      },
      update: { name: pt.name, dueDays: pt.dueDays, isDefault: pt.isDefault },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        code: pt.code,
        name: pt.name,
        dueDays: pt.dueDays,
        isDefault: pt.isDefault,
      },
    });
  }
  console.log(`Seeded ${paymentTerms.length} payment terms`);
}

async function seedNumberSeries() {
  for (const ns of numberSeries) {
    await prisma.numberSeries.upsert({
      where: {
        companyId_entityType: {
          companyId: DEFAULT_COMPANY_ID,
          entityType: ns.entityType,
        },
      },
      update: { prefix: ns.prefix, padding: ns.padding },
      create: {
        companyId: DEFAULT_COMPANY_ID,
        entityType: ns.entityType,
        prefix: ns.prefix,
        padding: ns.padding,
      },
    });
  }
  console.log(`Seeded ${numberSeries.length} number series`);
}

async function seedDefaultUser() {
  // DEV ONLY — seed password is not a secret.
  // Uses Node.js built-in scrypt (no native addon needed).
  // The API auth layer will use argon2 for production password hashing.
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('NexaDev2026!', salt, 64).toString('hex');
  const passwordHash = `scrypt:${salt}:${hash}`;

  await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {
      email: 'admin@nexa-erp.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      companyId: DEFAULT_COMPANY_ID,
      locale: 'en',
      updatedBy: 'system-seed',
    },
    create: {
      id: DEFAULT_USER_ID,
      email: 'admin@nexa-erp.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      companyId: DEFAULT_COMPANY_ID,
      isActive: true,
      enabledModules: [],
      locale: 'en',
      createdBy: 'system-seed',
      updatedBy: 'system-seed',
    },
  });

  // Global SUPER_ADMIN role (companyId = null)
  // Cannot use upsert on the compound unique [userId, companyId] when companyId is null
  // (PostgreSQL treats NULLs as distinct in unique constraints). Use findFirst + create/update instead.
  const existingGlobalRole = await prisma.userCompanyRole.findFirst({
    where: { userId: DEFAULT_USER_ID, companyId: null },
  });
  if (existingGlobalRole) {
    await prisma.userCompanyRole.update({
      where: { id: existingGlobalRole.id },
      data: { role: UserRole.SUPER_ADMIN },
    });
  } else {
    await prisma.userCompanyRole.create({
      data: {
        userId: DEFAULT_USER_ID,
        companyId: null,
        role: UserRole.SUPER_ADMIN,
      },
    });
  }

  console.log('Seeded default admin user + global SUPER_ADMIN role');
}

// ---------------------------------------------------------------------------
// AI Seed Data — E5.1 Task 9
// ---------------------------------------------------------------------------

// Well-known deterministic UUIDs for AI entities (used as upsert keys via name)
const AI_MODELS = [
  {
    name: 'claude-opus-4-6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    maxInputTokens: 200000,
    maxOutputTokens: 16384,
    costPerMInput: 15.0,
    costPerMOutput: 75.0,
    capabilities: ['completion', 'streaming', 'tool_use', 'vision', 'structured_output'],
    isActive: true,
    isDefault: false,
    config: { timeout: 60000, maxTokens: 16384 },
    routingTags: ['reasoning', 'complex'],
    fallbackModelName: 'claude-sonnet-4-5',
  },
  {
    name: 'claude-sonnet-4-5',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    costPerMInput: 3.0,
    costPerMOutput: 15.0,
    capabilities: ['completion', 'streaming', 'tool_use', 'vision', 'structured_output'],
    isActive: true,
    isDefault: true,
    config: { timeout: 30000, maxTokens: 8192 },
    routingTags: ['standard', 'chat', 'briefing', 'vision'],
    fallbackModelName: null,
  },
  {
    name: 'claude-haiku-4-5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    costPerMInput: 0.8,
    costPerMOutput: 4.0,
    capabilities: ['completion', 'streaming', 'tool_use', 'structured_output'],
    isActive: true,
    isDefault: false,
    config: { timeout: 15000, maxTokens: 4096 },
    routingTags: ['cheap', 'fast'],
    fallbackModelName: null,
  },
];

const CHAT_ROUTER_SYSTEM_PROMPT = `You are Nexa, an AI assistant for Nexa ERP — an AI-first ERP system for UK SMEs.

Your role is to understand the user's intent and route their request to the appropriate specialist agent or respond directly for simple queries.

## Intent Classification

Analyse the user's message and classify it into one of these intents:
- **create_invoice** — User wants to create a customer invoice
- **create_order** — User wants to create a sales order or purchase order
- **query** — User is asking a question about data (customers, invoices, stock levels, etc.)
- **briefing** — User wants a summary or briefing (daily, financial, etc.)
- **chat** — General conversation or help request
- **navigate** — User wants to go to a specific page or record

## Response Format

Always respond in JSON:
{
  "intent": "<classified intent>",
  "confidence": <0.0-1.0>,
  "answer": "<direct response if you can answer immediately>",
  "followUp": "<clarifying question if intent is ambiguous>"
}

## Context Awareness

You have access to the user's current page, recent entities, and company context. Use this to provide contextually relevant responses. For example, if the user is viewing a customer record and says "create an invoice", you should infer they want to invoice that customer.

## Guardrails

- NEVER execute financial transactions directly — always propose actions for user confirmation
- NEVER fabricate data — if you don't know, say so
- Always be concise and professional
- Use British English spelling conventions`;

const CHAT_ROUTER_USER_TEMPLATE = `User: {{userMessage}}

Context:
- Current page: {{currentPage}}
- Current entity: {{currentEntityType}} {{currentEntityId}}
- Company: {{companyName}}
- Date: {{currentDate}}`;

async function seedAiModels() {
  // First pass: create all models without fallback relations
  for (const m of AI_MODELS) {
    await prisma.aiModel.upsert({
      where: { name: m.name },
      update: {
        provider: m.provider,
        modelId: m.modelId,
        displayName: m.displayName,
        maxInputTokens: m.maxInputTokens,
        maxOutputTokens: m.maxOutputTokens,
        costPerMInput: m.costPerMInput,
        costPerMOutput: m.costPerMOutput,
        capabilities: m.capabilities,
        isActive: m.isActive,
        isDefault: m.isDefault,
        config: m.config,
        routingTags: m.routingTags,
      },
      create: {
        name: m.name,
        provider: m.provider,
        modelId: m.modelId,
        displayName: m.displayName,
        maxInputTokens: m.maxInputTokens,
        maxOutputTokens: m.maxOutputTokens,
        costPerMInput: m.costPerMInput,
        costPerMOutput: m.costPerMOutput,
        capabilities: m.capabilities,
        isActive: m.isActive,
        isDefault: m.isDefault,
        config: m.config,
        routingTags: m.routingTags,
      },
    });
  }

  // Second pass: set fallback relations
  for (const m of AI_MODELS) {
    if (m.fallbackModelName) {
      const fallback = await prisma.aiModel.findUnique({
        where: { name: m.fallbackModelName },
        select: { id: true },
      });
      if (fallback) {
        await prisma.aiModel.update({
          where: { name: m.name },
          data: { fallbackModelId: fallback.id },
        });
      }
    }
  }

  console.log(`Seeded ${AI_MODELS.length} AI models`);
}

async function seedAiPromptAndAgent() {
  // Seed chat-router prompt
  const prompt = await prisma.aiPrompt.upsert({
    where: { name: 'chat-router' },
    update: {
      description: 'System prompt for the default chat-router intent recognition agent',
      category: 'system',
      systemPrompt: CHAT_ROUTER_SYSTEM_PROMPT,
      userTemplate: CHAT_ROUTER_USER_TEMPLATE,
      parameters: {
        userMessage: { type: 'userInput' },
        currentPage: { type: 'userInput' },
        currentEntityType: { type: 'userInput' },
        currentEntityId: { type: 'userInput' },
        companyName: { type: 'context', path: 'tenant.companyName' },
        currentDate: { type: 'computed', fn: 'currentDate' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          intent: 'string',
          confidence: 'number',
          answer: 'string?',
          followUp: 'string?',
        },
      },
    },
    create: {
      name: 'chat-router',
      description: 'System prompt for the default chat-router intent recognition agent',
      category: 'system',
      systemPrompt: CHAT_ROUTER_SYSTEM_PROMPT,
      userTemplate: CHAT_ROUTER_USER_TEMPLATE,
      parameters: {
        userMessage: { type: 'userInput' },
        currentPage: { type: 'userInput' },
        currentEntityType: { type: 'userInput' },
        currentEntityId: { type: 'userInput' },
        companyName: { type: 'context', path: 'tenant.companyName' },
        currentDate: { type: 'computed', fn: 'currentDate' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          intent: 'string',
          confidence: 'number',
          answer: 'string?',
          followUp: 'string?',
        },
      },
      createdBy: 'system-seed',
    },
  });

  // Seed initial prompt version (version 1)
  const existingVersion = await prisma.aiPromptVersion.findUnique({
    where: {
      promptId_version: { promptId: prompt.id, version: 1 },
    },
    select: { id: true },
  });

  if (!existingVersion) {
    await prisma.aiPromptVersion.create({
      data: {
        promptId: prompt.id,
        version: 1,
        systemPrompt: CHAT_ROUTER_SYSTEM_PROMPT,
        userTemplate: CHAT_ROUTER_USER_TEMPLATE,
        parameters: {
          userMessage: { type: 'userInput' },
          currentPage: { type: 'userInput' },
          currentEntityType: { type: 'userInput' },
          currentEntityId: { type: 'userInput' },
          companyName: { type: 'context', path: 'tenant.companyName' },
          currentDate: { type: 'computed', fn: 'currentDate' },
        },
        changeReason: 'Initial version',
        createdBy: 'system-seed',
      },
    });
  }

  console.log('Seeded chat-router prompt + version 1');

  // Seed chat-router agent — uses the default model (Sonnet) via routingTags
  await prisma.aiAgent.upsert({
    where: { name: 'chat-router' },
    update: {
      displayName: 'Chat Router',
      description:
        'Default intent recognition agent that routes user messages to specialist agents',
      routingTags: ['standard', 'chat'],
      promptId: prompt.id,
      tools: [],
      guardrails: {
        rules: [
          { type: 'no_auto_execute', description: 'Never auto-execute financial transactions' },
          { type: 'no_data_fabrication', description: 'Never fabricate data' },
        ],
      },
      triggerConfig: {
        type: 'default_fallback',
        description: 'Catches all messages that do not match a specific agent trigger',
      },
      maxTurns: 5,
      isActive: true,
    },
    create: {
      name: 'chat-router',
      displayName: 'Chat Router',
      description:
        'Default intent recognition agent that routes user messages to specialist agents',
      routingTags: ['standard', 'chat'],
      promptId: prompt.id,
      tools: [],
      guardrails: {
        rules: [
          { type: 'no_auto_execute', description: 'Never auto-execute financial transactions' },
          { type: 'no_data_fabrication', description: 'Never fabricate data' },
        ],
      },
      triggerConfig: {
        type: 'default_fallback',
        description: 'Catches all messages that do not match a specific agent trigger',
      },
      maxTurns: 5,
      isActive: true,
    },
  });

  console.log('Seeded chat-router agent');

  // ── Seed conversation-summariser prompt (E5b-1 Task 3.2) ──────────────
  const SUMMARISATION_SYSTEM_PROMPT = `You are a conversation summariser for Nexa ERP. Summarise this conversation into key decisions, actions taken, and context. Be concise. Focus on facts the user would want remembered.

Return a JSON object with this exact structure:
{
  "summary": "A concise paragraph summarising the key points of the conversation.",
  "topics": ["topic1", "topic2"],
  "decisionsCount": 0,
  "actionsCount": 0
}

Rules:
- "summary" must be under 500 words
- "topics" should be 1-5 short tags (e.g., "invoicing", "customer setup", "payment terms")
- "decisionsCount" is the number of decisions made during the conversation
- "actionsCount" is the number of actions taken (records created, settings changed, etc.)
- Return ONLY valid JSON, no markdown fences or extra text`;

  const SUMMARISATION_USER_TEMPLATE = `Summarise the following conversation:\n\n{{conversationTranscript}}`;

  const summaryPrompt = await prisma.aiPrompt.upsert({
    where: { name: 'conversation-summariser' },
    update: {
      description: 'Summarises completed AI conversations into key decisions, actions, and context',
      category: 'memory_management',
      systemPrompt: SUMMARISATION_SYSTEM_PROMPT,
      userTemplate: SUMMARISATION_USER_TEMPLATE,
      parameters: {
        conversationTranscript: { type: 'userInput' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          summary: 'string',
          topics: 'string[]',
          decisionsCount: 'number',
          actionsCount: 'number',
        },
      },
    },
    create: {
      name: 'conversation-summariser',
      description: 'Summarises completed AI conversations into key decisions, actions, and context',
      category: 'memory_management',
      systemPrompt: SUMMARISATION_SYSTEM_PROMPT,
      userTemplate: SUMMARISATION_USER_TEMPLATE,
      parameters: {
        conversationTranscript: { type: 'userInput' },
      },
      outputFormat: {
        type: 'json',
        schema: {
          summary: 'string',
          topics: 'string[]',
          decisionsCount: 'number',
          actionsCount: 'number',
        },
      },
      createdBy: 'system-seed',
    },
  });

  // Seed initial prompt version (version 1) for conversation-summariser
  const existingSummaryVersion = await prisma.aiPromptVersion.findUnique({
    where: {
      promptId_version: { promptId: summaryPrompt.id, version: 1 },
    },
    select: { id: true },
  });

  if (!existingSummaryVersion) {
    await prisma.aiPromptVersion.create({
      data: {
        promptId: summaryPrompt.id,
        version: 1,
        systemPrompt: SUMMARISATION_SYSTEM_PROMPT,
        userTemplate: SUMMARISATION_USER_TEMPLATE,
        parameters: {
          conversationTranscript: { type: 'userInput' },
        },
        changeReason: 'Initial version',
        createdBy: 'system-seed',
      },
    });
  }

  console.log('Seeded conversation-summariser prompt + version 1');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding database...');
  await seedCurrencies();
  await seedCountries();
  await seedDefaultCompany();
  await seedNumberSeries();
  await seedVatCodes();
  await seedPaymentTerms();
  await seedDefaultUser();
  await loadDefaultResources(prisma);
  await loadDefaultAccessGroups(prisma, DEFAULT_COMPANY_ID, DEFAULT_USER_ID);
  await assignFullAccessGroup(prisma, DEFAULT_COMPANY_ID, DEFAULT_USER_ID);
  await seedAiModels();
  await seedAiPromptAndAgent();
  await seedDataViews(prisma, DEFAULT_COMPANY_ID);

  // ── AI Skill Pack, Module Knowledge & Entity Triggers — E5b-6 ────────
  try {
    await seedViewsSkillPack(prisma);
  } catch (e) {
    console.error('Failed to seed views skill pack:', e);
  }
  try {
    await seedViewsModuleKnowledge(prisma);
  } catch (e) {
    console.error('Failed to seed views module knowledge:', e);
  }
  try {
    await seedViewsEntityTriggers(prisma);
  } catch (e) {
    console.error('Failed to seed views entity triggers:', e);
  }

  // ── AI Automation Engine Seed Data — E5c.1 Task 12 ────────────────────
  try {
    await seedAutomationData(prisma, DEFAULT_COMPANY_ID, DEFAULT_USER_ID);
  } catch (e) {
    console.error('Failed to seed automation data:', e);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
