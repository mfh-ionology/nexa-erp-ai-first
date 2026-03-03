/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// Skill Pack Seed Template
//
// Pattern for future module epics (E14 Finance, E17 AR, etc.) to register
// their AI skill packs. Copy this template and fill in module-specific skills.
//
// Usage:
//   import { seedSkillPack, type SkillPackSeed } from './_template';
//   const FINANCE_PACK: SkillPackSeed = { moduleKey: 'finance', packKey: 'core', skills: [...] };
//   await seedSkillPack(prisma, FINANCE_PACK);
// ---------------------------------------------------------------------------

import type { Prisma, PrismaClient } from '../../../generated/prisma/client';

// ---------------------------------------------------------------------------
// SkillPackSeed — typed shape for a module's AI skill pack
// ---------------------------------------------------------------------------

export interface SkillPackSeed {
  moduleKey: string;
  packKey: string;
  skills: Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    skillContent: string;
    triggerPhrases: string[];
    negativeTriggers: string[];
    orchestrationPattern: string;
    requiredTools: string[];
    contextRequired: string[];
    priority: number;
    inputSchema: Prisma.InputJsonValue;
    outputType: string;
    parameters?: Prisma.InputJsonValue;
    examples?: Prisma.InputJsonValue;
  }>;
}

// ---------------------------------------------------------------------------
// seedSkillPack — upserts skills by unique `name`, making seeds idempotent
// ---------------------------------------------------------------------------

export async function seedSkillPack(prisma: PrismaClient, pack: SkillPackSeed): Promise<void> {
  for (const skill of pack.skills) {
    await prisma.aiSkill.upsert({
      where: { name: skill.name },
      update: {
        displayName: skill.displayName,
        description: skill.description,
        category: skill.category,
        skillContent: skill.skillContent,
        triggerPhrases: skill.triggerPhrases,
        negativeTriggers: skill.negativeTriggers,
        orchestrationPattern: skill.orchestrationPattern,
        requiredTools: skill.requiredTools,
        contextRequired: skill.contextRequired,
        priority: skill.priority,
        inputSchema: skill.inputSchema,
        outputType: skill.outputType,
        parameters: skill.parameters,
        examples: skill.examples,
        moduleKey: pack.moduleKey,
        packKey: pack.packKey,
        isActive: true,
      },
      create: {
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        category: skill.category,
        skillContent: skill.skillContent,
        triggerPhrases: skill.triggerPhrases,
        negativeTriggers: skill.negativeTriggers,
        orchestrationPattern: skill.orchestrationPattern,
        requiredTools: skill.requiredTools,
        contextRequired: skill.contextRequired,
        priority: skill.priority,
        inputSchema: skill.inputSchema,
        outputType: skill.outputType,
        parameters: skill.parameters,
        examples: skill.examples,
        moduleKey: pack.moduleKey,
        packKey: pack.packKey,
      },
    });
  }
  console.log(
    `Seeded skill pack [${pack.moduleKey}/${pack.packKey}]: ${String(pack.skills.length)} skills`,
  );
}
