/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// Module Knowledge Seed Template
//
// Pattern for future module epics (E14 Finance, E17 AR, etc.) to register
// their AI module knowledge entries. Copy this template and populate with
// module-specific domain knowledge, workflows, and terminology.
//
// Usage:
//   import { seedModuleKnowledge, type ModuleKnowledgeSeed } from './_template';
//   const FINANCE_KNOWLEDGE: ModuleKnowledgeSeed = { moduleKey: 'finance', entries: [...] };
//   await seedModuleKnowledge(prisma, FINANCE_KNOWLEDGE);
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../../generated/prisma/client';

// ---------------------------------------------------------------------------
// ModuleKnowledgeSeed — typed shape for a module's AI knowledge entries
// ---------------------------------------------------------------------------

export interface ModuleKnowledgeSeed {
  moduleKey: string;
  entries: Array<{
    knowledgeType: string;
    title: string;
    content: string;
    priority: number;
  }>;
}

// ---------------------------------------------------------------------------
// seedModuleKnowledge — replaces all knowledge for a module (idempotent)
//
// AiModuleKnowledge has no unique constraint suitable for upsert, so we
// delete existing entries for the moduleKey and re-create them. This is
// safe because seed data is the authoritative source for module knowledge.
// ---------------------------------------------------------------------------

export async function seedModuleKnowledge(
  prisma: PrismaClient,
  seed: ModuleKnowledgeSeed,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Remove existing seed entries for this module
    await tx.aiModuleKnowledge.deleteMany({
      where: { moduleKey: seed.moduleKey },
    });

    // Re-create all entries
    await tx.aiModuleKnowledge.createMany({
      data: seed.entries.map((entry) => ({
        moduleKey: seed.moduleKey,
        knowledgeType: entry.knowledgeType,
        title: entry.title,
        content: entry.content,
        priority: entry.priority,
      })),
    });
  });

  console.log(
    `Seeded module knowledge [${seed.moduleKey}]: ${String(seed.entries.length)} entries`,
  );
}
