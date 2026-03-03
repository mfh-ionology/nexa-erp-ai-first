/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E7 Views Module — Skill Pack Seed
//
// Registers 5 skills for the Saved Views module:
//   open_entity_list, search_views, apply_filter, list_saved_views, create_saved_view
//
// Follows the 4-artifact pattern: skill pack + module knowledge + entity triggers + tool definitions
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../../generated/prisma/client';
import { seedSkillPack, type SkillPackSeed } from './_template.js';

// ---------------------------------------------------------------------------
// Skill Pack Definition
// ---------------------------------------------------------------------------

export const VIEWS_SKILL_PACK: SkillPackSeed = {
  moduleKey: 'views',
  packKey: 'views-core',
  skills: [
    // -----------------------------------------------------------------------
    // 1. open_entity_list — Navigate to an entity list page
    // -----------------------------------------------------------------------
    {
      name: 'open_entity_list',
      displayName: 'Open Entity List',
      description: 'Navigate to an entity list view, optionally applying a saved view',
      category: 'navigation',
      skillContent: `You can open entity list pages for the user. Available view keys include INVOICES, CUSTOMERS, USERS, CONTACTS, and others matching the UPPERCASE_PLURAL convention of the entity table name.

When the user asks to "show", "open", or "go to" an entity list, determine the correct viewKey from their request. If they mention a specific saved view by name, include the savedViewName parameter so the saved view's filters, sort, and columns are applied automatically.

If the viewKey is ambiguous, ask the user to clarify which entity list they mean. Always use the UPPERCASE_PLURAL form for viewKey values.`,
      triggerPhrases: [
        'show me',
        'open',
        'go to',
        'navigate to',
        'display',
        'view all',
        'show all',
        'list all',
        'show invoices',
        'show customers',
        'show contacts',
        'show users',
        'open invoices',
        'open customers',
      ],
      negativeTriggers: [
        'create an invoice',
        'create a customer',
        'create a contact',
        'delete',
        'edit',
        'update',
        'modify',
      ],
      orchestrationPattern: 'CONTEXT_AWARE',
      requiredTools: ['open_entity_list'],
      contextRequired: [],
      priority: 100,
      inputSchema: {
        type: 'object',
        properties: {
          viewKey: {
            type: 'string',
            description: 'The view key to open (e.g., INVOICES, CUSTOMERS, USERS)',
          },
          savedViewName: {
            type: 'string',
            description: 'Optional saved view name to apply',
          },
        },
        required: ['viewKey'],
      },
      outputType: 'navigation',
      parameters: {
        viewKey: {
          type: 'string',
          required: true,
          description: 'Entity list view key',
        },
        savedViewName: {
          type: 'string',
          required: false,
          description: 'Name of saved view to apply',
        },
      },
      examples: [
        {
          input: 'show me all invoices',
          output: "open_entity_list(viewKey: 'INVOICES')",
        },
        {
          input: 'open the customers list',
          output: "open_entity_list(viewKey: 'CUSTOMERS')",
        },
        {
          input: 'go to invoices with the Overdue view',
          output: "open_entity_list(viewKey: 'INVOICES', savedViewName: 'Overdue')",
        },
      ],
    },

    // -----------------------------------------------------------------------
    // 2. search_views — Search for a saved view by name
    // -----------------------------------------------------------------------
    {
      name: 'search_views',
      displayName: 'Search Saved Views',
      description: 'Search for a saved view by name using fuzzy matching',
      category: 'search',
      skillContent: `You can search for saved views by name. Use this when the user asks to find a specific saved view or mentions a view by name without specifying the exact entity list.

Perform a fuzzy search using the query parameter. Results include the view name, associated viewKey, scope (PERSONAL/ROLE/GLOBAL), and filter count. If a match is found, you can then use open_entity_list to navigate to that view.`,
      triggerPhrases: [
        'find view',
        'search view',
        'look for view',
        'which view',
        'find the view',
        'where is the view',
        'overdue view',
        'show me the view',
      ],
      negativeTriggers: ['create a view', 'make a view', 'new view', 'delete view'],
      orchestrationPattern: 'SEQUENTIAL',
      requiredTools: ['search_views', 'open_entity_list'],
      contextRequired: [],
      priority: 90,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for finding saved views',
          },
        },
        required: ['query'],
      },
      outputType: 'data',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Fuzzy search term for view name',
        },
      },
      examples: [
        {
          input: 'show me the overdue view',
          output: "search_views(query: 'overdue')",
        },
        {
          input: 'find the Big Invoices view',
          output: "search_views(query: 'Big Invoices')",
        },
      ],
    },

    // -----------------------------------------------------------------------
    // 3. apply_filter — Apply filter conditions to a list view
    // -----------------------------------------------------------------------
    {
      name: 'apply_filter',
      displayName: 'Apply Filter',
      description: 'Apply a filter condition to the current entity list view',
      category: 'filter',
      skillContent: `You can apply filter conditions to the currently active entity list view. Use this when the user asks to filter, narrow down, or show only certain records.

Available filter operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY.

Date presets available: today, yesterday, tomorrow, last3days, last7days, last30days, next7days, next30days, thisweek, lastweek, nextweek, thismonth, lastmonth, nextmonth, thisyear, lastyear, nextyear, mtd, ytd.

When the user says "this month", use the datePreset "thismonth" rather than computing dates. When they say "overdue", determine the appropriate field and operator (e.g., dueDate LT today). Build conditions based on the available fields for the entity list.`,
      triggerPhrases: [
        'filter by',
        'filter',
        'show only',
        'where',
        'narrow down',
        'just show',
        'only show',
        'this month',
        'this week',
        'overdue',
        'outstanding',
      ],
      negativeTriggers: ['create a filter', 'save filter', 'delete filter'],
      orchestrationPattern: 'ITERATIVE',
      requiredTools: ['apply_filter'],
      contextRequired: ['screen:entity-list'],
      priority: 80,
      inputSchema: {
        type: 'object',
        properties: {
          viewKey: {
            type: 'string',
            description: 'The view key of the entity list to filter',
          },
          conditions: {
            type: 'array',
            description: 'Array of filter conditions to apply',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Field key to filter on',
                },
                operator: {
                  type: 'string',
                  description: 'Filter operator (EQUALS, CONTAINS, GT, LT, BETWEEN, etc.)',
                },
                value: {
                  type: 'string',
                  description: 'Filter value (for non-date-preset filters)',
                },
                datePreset: {
                  type: 'string',
                  description: 'Date preset identifier (thismonth, thisweek, etc.)',
                },
              },
              required: ['field', 'operator'],
            },
          },
        },
        required: ['viewKey', 'conditions'],
      },
      outputType: 'action',
      parameters: {
        viewKey: {
          type: 'string',
          required: true,
          description: 'Entity list view key',
        },
        conditions: {
          type: 'array',
          required: true,
          description: 'Filter conditions to apply',
        },
      },
      examples: [
        {
          input: 'filter invoices by this month',
          output:
            "apply_filter(viewKey: 'INVOICES', conditions: [{ field: 'invoiceDate', operator: 'EQUALS', datePreset: 'thismonth' }])",
        },
        {
          input: 'show only overdue invoices',
          output:
            "apply_filter(viewKey: 'INVOICES', conditions: [{ field: 'dueDate', operator: 'LT', value: 'today' }])",
        },
      ],
    },

    // -----------------------------------------------------------------------
    // 4. list_saved_views — List available saved views
    // -----------------------------------------------------------------------
    {
      name: 'list_saved_views',
      displayName: 'List Saved Views',
      description: 'List all available saved views for a given entity list',
      category: 'search',
      skillContent: `You can list all saved views available to the user. Views are scoped: PERSONAL views are visible only to the creator, ROLE views to users with the matching role, and GLOBAL views to all users.

Optionally filter by viewKey to show only views for a specific entity list. Results include the view name, scope, whether it's a default or favourite, and the associated entity list.`,
      triggerPhrases: [
        'list views',
        'what views',
        'available views',
        'my views',
        'saved views',
        'show views',
      ],
      negativeTriggers: ['create a view', 'delete a view'],
      orchestrationPattern: 'SEQUENTIAL',
      requiredTools: ['list_saved_views'],
      contextRequired: [],
      priority: 70,
      inputSchema: {
        type: 'object',
        properties: {
          viewKey: {
            type: 'string',
            description: 'Optional view key to filter saved views for a specific entity list',
          },
        },
      },
      outputType: 'data',
      parameters: {
        viewKey: {
          type: 'string',
          required: false,
          description: 'Entity list view key to filter by',
        },
      },
      examples: [
        {
          input: 'what views do I have for invoices?',
          output: "list_saved_views(viewKey: 'INVOICES')",
        },
        {
          input: 'show me my saved views',
          output: 'list_saved_views()',
        },
      ],
    },

    // -----------------------------------------------------------------------
    // 5. create_saved_view — Create a new saved view
    // -----------------------------------------------------------------------
    {
      name: 'create_saved_view',
      displayName: 'Create Saved View',
      description: 'Create a new saved view with specified filter conditions and name',
      category: 'create',
      skillContent: `You can create new saved views for entity lists. A saved view stores a named combination of filter conditions, sort configuration, and column visibility.

Ask the user for: the view name, which entity list (viewKey), and what filter conditions to apply. Optionally, a sort configuration can be specified. The view is created with PERSONAL scope by default.

Filter operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY.
Date presets: today, thisweek, thismonth, thisyear, last7days, last30days, mtd, ytd, and more.`,
      triggerPhrases: [
        'create a view',
        'save this view',
        'new view',
        'make a view',
        'save view as',
        'create view called',
      ],
      negativeTriggers: [
        'create an invoice',
        'create a customer',
        'create a contact',
        'delete view',
      ],
      orchestrationPattern: 'SEQUENTIAL',
      requiredTools: ['create_saved_view'],
      contextRequired: [],
      priority: 60,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the new saved view',
          },
          viewKey: {
            type: 'string',
            description: 'Entity list view key',
          },
          conditions: {
            type: 'array',
            description: 'Filter conditions for the view',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Field key to filter on',
                },
                operator: {
                  type: 'string',
                  description: 'Filter operator',
                },
                value: {
                  type: 'string',
                  description: 'Filter value',
                },
                datePreset: {
                  type: 'string',
                  description: 'Date preset identifier',
                },
              },
              required: ['field', 'operator'],
            },
          },
          sortConfig: {
            type: 'array',
            description: 'Optional sort configuration',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Field to sort by',
                },
                direction: {
                  type: 'string',
                  enum: ['asc', 'desc'],
                  description: 'Sort direction',
                },
              },
              required: ['field', 'direction'],
            },
          },
        },
        required: ['name', 'viewKey', 'conditions'],
      },
      outputType: 'action',
      parameters: {
        name: {
          type: 'string',
          required: true,
          description: 'Name for the new saved view',
        },
        viewKey: {
          type: 'string',
          required: true,
          description: 'Entity list view key',
        },
        conditions: {
          type: 'array',
          required: true,
          description: 'Filter conditions for the view',
        },
        sortConfig: {
          type: 'array',
          required: false,
          description: 'Optional sort rules',
        },
      },
      examples: [
        {
          input: 'create a view called Big Invoices for amounts over 10000',
          output:
            "create_saved_view(name: 'Big Invoices', viewKey: 'INVOICES', conditions: [{ field: 'totalAmount', operator: 'GT', value: '10000' }])",
        },
        {
          input: 'save this view as Monthly Review',
          output:
            "create_saved_view(name: 'Monthly Review', viewKey: 'INVOICES', conditions: [{ field: 'invoiceDate', operator: 'EQUALS', datePreset: 'thismonth' }])",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Seed entry point
// ---------------------------------------------------------------------------

export async function seedViewsSkillPack(prisma: PrismaClient): Promise<void> {
  await seedSkillPack(prisma, VIEWS_SKILL_PACK);
}
