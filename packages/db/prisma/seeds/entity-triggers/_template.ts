/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// Entity Trigger Seed Template
//
// Pattern for future module epics (E14 Finance, E17 AR, etc.) to register
// their AI entity triggers (@ mentions). Copy this template and populate
// with module-specific entity types and their search configuration.
//
// Usage:
//   import { seedEntityTriggers, type EntityTriggerSeed } from './_template';
//   const FINANCE_TRIGGERS: EntityTriggerSeed = { moduleKey: 'finance', triggers: [...] };
//   await seedEntityTriggers(prisma, FINANCE_TRIGGERS);
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../../generated/prisma/client';

// ---------------------------------------------------------------------------
// EntityTriggerSeed — typed shape for a module's AI entity triggers
// ---------------------------------------------------------------------------

export interface EntityTriggerSeed {
  moduleKey: string;
  triggers: Array<{
    triggerWord: string;
    entityType: string;
    searchEndpoint: string;
    displayField: string;
    subtitleField?: string;
    scopeBy?: string;
    icon?: string;
    priority: number;
  }>;
}

// ---------------------------------------------------------------------------
// seedEntityTriggers — upserts triggers by [moduleKey, triggerWord] (idempotent)
// ---------------------------------------------------------------------------

export async function seedEntityTriggers(
  prisma: PrismaClient,
  seed: EntityTriggerSeed,
): Promise<void> {
  for (const trigger of seed.triggers) {
    await prisma.aiEntityTrigger.upsert({
      where: {
        moduleKey_triggerWord: {
          moduleKey: seed.moduleKey,
          triggerWord: trigger.triggerWord,
        },
      },
      update: {
        entityType: trigger.entityType,
        searchEndpoint: trigger.searchEndpoint,
        displayField: trigger.displayField,
        subtitleField: trigger.subtitleField ?? null,
        scopeBy: trigger.scopeBy ?? null,
        icon: trigger.icon ?? null,
        priority: trigger.priority,
        isActive: true,
      },
      create: {
        moduleKey: seed.moduleKey,
        triggerWord: trigger.triggerWord,
        entityType: trigger.entityType,
        searchEndpoint: trigger.searchEndpoint,
        displayField: trigger.displayField,
        subtitleField: trigger.subtitleField ?? null,
        scopeBy: trigger.scopeBy ?? null,
        icon: trigger.icon ?? null,
        priority: trigger.priority,
      },
    });
  }
  console.log(
    `Seeded entity triggers [${seed.moduleKey}]: ${String(seed.triggers.length)} triggers`,
  );
}
