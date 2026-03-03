/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E7 Views Module — Entity Trigger Seed
//
// Registers AI entity triggers for the Views module. These triggers enable
// chat autocomplete to suggest views/saved views when the user types
// trigger words like "view" or "saved view".
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../../generated/prisma/client';
import { seedEntityTriggers, type EntityTriggerSeed } from './_template.js';

// ---------------------------------------------------------------------------
// Views Entity Triggers
// ---------------------------------------------------------------------------

export const VIEWS_TRIGGERS: EntityTriggerSeed = {
  moduleKey: 'views',
  triggers: [
    {
      triggerWord: 'view',
      entityType: 'DataView',
      searchEndpoint: '/api/v1/views/data-views',
      displayField: 'viewName',
      subtitleField: 'entityTable',
      icon: 'LayoutList',
      priority: 100,
    },
    {
      triggerWord: 'saved view',
      entityType: 'SavedView',
      searchEndpoint: '/api/v1/views/saved',
      displayField: 'name',
      subtitleField: 'groupName',
      icon: 'Bookmark',
      priority: 100,
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed runner — called from main seed.ts
// ---------------------------------------------------------------------------

export async function seedViewsEntityTriggers(prisma: PrismaClient): Promise<void> {
  await seedEntityTriggers(prisma, VIEWS_TRIGGERS);
}
