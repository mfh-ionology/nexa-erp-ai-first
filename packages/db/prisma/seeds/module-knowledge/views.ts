/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E7 Views Module — Module Knowledge Seed
//
// Registers AI knowledge entries for the Saved Views module:
//   OVERVIEW — what the module does
//   ENTITIES — core data model entities
//   WORKFLOWS — key user workflows and available operations
//
// Follows the 4-artifact pattern: skill pack + module knowledge + entity triggers + tool definitions
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../../generated/prisma/client';
import { seedModuleKnowledge, type ModuleKnowledgeSeed } from './_template.js';

// ---------------------------------------------------------------------------
// Module Knowledge Definition
// ---------------------------------------------------------------------------

export const VIEWS_KNOWLEDGE: ModuleKnowledgeSeed = {
  moduleKey: 'views',
  entries: [
    // -----------------------------------------------------------------------
    // OVERVIEW — What the Saved Views module does
    // -----------------------------------------------------------------------
    {
      knowledgeType: 'OVERVIEW',
      title: 'Views Module Overview',
      content: `The Saved Views module provides a metadata-driven DataTable system for entity list pages. It enables users to browse entity records (invoices, customers, users, etc.) through configurable list views with filtering, sorting, and column customisation. Users can create named saved views that store filter conditions, sort order, and visible columns. Views are scoped as PERSONAL (visible only to creator), ROLE (visible to users with matching role), or GLOBAL (visible to all). Users can mark views as favourites and set defaults per entity list. The system supports date presets (thismonth, thisweek, etc.) and a comprehensive set of filter operators.`,
      priority: 100,
    },

    // -----------------------------------------------------------------------
    // ENTITIES — Core data model entities
    // -----------------------------------------------------------------------
    {
      knowledgeType: 'ENTITIES',
      title: 'Views Module Entities',
      content: `Core entities in the Views module:

**DataView** — The list page registry. Fields: viewKey (unique identifier like INVOICES, CUSTOMERS), viewName (display name), entityTable (database table name). Each DataView represents one entity list page.

**DataViewField** — Column and filter metadata for each DataView. Fields: fieldKey (column identifier), fieldLabel (display text), fieldType (STRING, NUMBER, DATE, BOOLEAN, ENUM), filterable (can be used as filter), sortable (can be sorted), defaultVisible (shown by default), lovEndpoint/lovLabelField/lovValueField (List of Values config for dropdowns).

**SavedView** — A named view definition. Fields: name (display name), scope (PERSONAL, ROLE, GLOBAL), filterLogic (AND/OR), sortConfig (JSON array of sort rules), columnConfig (JSON array of visible columns), isDefault (auto-applied when opening the list), groupName (for organising views).

**SavedViewCondition** — An individual filter condition within a SavedView. Fields: fieldKey (which field to filter), operator (EQUALS, CONTAINS, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY, etc.), value (filter value), datePreset (today, thismonth, thisweek, etc. for date fields).`,
      priority: 90,
    },

    // -----------------------------------------------------------------------
    // WORKFLOWS — Key user workflows and operations
    // -----------------------------------------------------------------------
    {
      knowledgeType: 'WORKFLOWS',
      title: 'Views Module Workflows',
      content: `Key workflows in the Views module:

1. **Open entity list** — Navigate to /entity-list/:viewKey to browse records. The viewKey follows the UPPERCASE_PLURAL convention (INVOICES, CUSTOMERS, USERS).

2. **Apply saved view** — Load a pre-configured saved view to apply its stored filters, sort order, and column visibility. Personal, role-based, and global views are available depending on scope.

3. **Apply ad-hoc filter** — Add filter conditions without saving. Conditions use operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY.

4. **Create saved view** — Give a name, select scope (PERSONAL/ROLE/GLOBAL), define filter conditions and optional sort order. The view is persisted for future use.

5. **Date presets** — For date fields, use presets instead of computing dates: today, yesterday, tomorrow, last3days, last7days, last30days, next7days, next30days, thisweek, lastweek, nextweek, thismonth, lastmonth, nextmonth, thisyear, lastyear, nextyear, mtd (month-to-date), ytd (year-to-date).

6. **Column customisation** — Show/hide columns and reorder them. Column configuration is stored per saved view.`,
      priority: 80,
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed entry point
// ---------------------------------------------------------------------------

export async function seedViewsModuleKnowledge(prisma: PrismaClient): Promise<void> {
  await seedModuleKnowledge(prisma, VIEWS_KNOWLEDGE);
}
