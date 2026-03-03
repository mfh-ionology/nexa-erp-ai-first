// @nexa/ai-tools — Views module tool definitions (E7 Saved Views skill pack)

import type { ToolDefinition } from '../types.js';
import type { ToolRegistry } from '../tool-registry.js';

/**
 * Filter operators supported by E7 DataTable system.
 * Matches the FilterOperator enum in the Prisma schema.
 */
const FILTER_OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'BETWEEN',
  'IN',
  'NOT_IN',
  'IS_EMPTY',
  'IS_NOT_EMPTY',
] as const;

/**
 * Date presets supported by E7 filter conditions.
 */
const DATE_PRESETS = [
  'CUSTOM',
  'today',
  'yesterday',
  'tomorrow',
  'last3days',
  'last7days',
  'last30days',
  'next7days',
  'next30days',
  'thisweek',
  'lastweek',
  'nextweek',
  'thismonth',
  'lastmonth',
  'nextmonth',
  'thisyear',
  'lastyear',
  'nextyear',
  'mtd',
  'ytd',
] as const;

export const VIEWS_TOOLS: ToolDefinition[] = [
  // 5.1 — open_entity_list (query)
  // Type: 'query' is intentional even though this tool triggers navigation.
  // The handler only READS DataView/SavedView metadata and returns it to the AI.
  // Actual page navigation is performed client-side by the frontend when it
  // receives the response — the backend handler has no side effects.
  // The skill seed's outputType='navigation' describes the UI outcome, not the
  // backend operation type.
  {
    name: 'open_entity_list',
    description: 'Open an entity list view page, optionally applying a saved view',
    moduleKey: 'views',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        viewKey: {
          type: 'string',
          description: 'View key (e.g., INVOICES, CUSTOMERS, USERS)',
        },
        savedViewName: {
          type: 'string',
          description: 'Optional saved view name to apply',
        },
      },
      required: ['viewKey'],
    },
  },

  // 5.2 — search_views (query)
  {
    name: 'search_views',
    description: 'Search for a saved view by name using fuzzy matching',
    moduleKey: 'views',
    type: 'query',
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
  },

  // 5.3 — apply_filter (action)
  {
    name: 'apply_filter',
    description: 'Apply a filter condition to the current entity list view',
    moduleKey: 'views',
    type: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        viewKey: {
          type: 'string',
          description: 'View key to apply filters to (e.g., INVOICES)',
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
                description: 'Filter operator',
                enum: [...FILTER_OPERATORS],
              },
              value: {
                type: 'string',
                description: 'Filter value (omit for IS_EMPTY/IS_NOT_EMPTY)',
              },
              datePreset: {
                type: 'string',
                description: 'Date preset shortcut (e.g., thismonth, last7days)',
                enum: [...DATE_PRESETS],
              },
            },
            required: ['field', 'operator'],
          },
        },
      },
      required: ['viewKey', 'conditions'],
    },
  },

  // 5.4 — list_saved_views (query)
  {
    name: 'list_saved_views',
    description: 'List all available saved views for a given entity list',
    moduleKey: 'views',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        viewKey: {
          type: 'string',
          description: 'Optional view key to filter saved views by (e.g., INVOICES)',
        },
      },
    },
  },

  // 5.5 — create_saved_view (action)
  {
    name: 'create_saved_view',
    description: 'Create a new saved view with specified filter conditions and name',
    moduleKey: 'views',
    type: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the new saved view',
        },
        viewKey: {
          type: 'string',
          description: 'View key to create the saved view for (e.g., INVOICES)',
        },
        conditions: {
          type: 'array',
          description: 'Array of filter conditions for the saved view',
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
                enum: [...FILTER_OPERATORS],
              },
              value: {
                type: 'string',
                description: 'Filter value',
              },
              datePreset: {
                type: 'string',
                description: 'Date preset shortcut',
                enum: [...DATE_PRESETS],
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
                description: 'Field key to sort by',
              },
              direction: {
                type: 'string',
                description: 'Sort direction',
                enum: ['asc', 'desc'],
              },
            },
            required: ['field', 'direction'],
          },
        },
      },
      required: ['name', 'viewKey', 'conditions'],
    },
  },
];

// 5.6 — Convenience function to register all views tools
export function registerViewsTools(registry: ToolRegistry): void {
  for (const definition of VIEWS_TOOLS) {
    if (definition.type === 'action') {
      registry.registerTool({ definition: definition as ToolDefinition & { type: 'action' } });
    } else {
      // Query tools registered with a sentinel handler that throws if invoked before
      // the real handler is wired via registerViewsQueryHandlers() in the API layer.
      // This prevents silent empty results if handler wiring is missed at startup.
      const toolName = definition.name;
      registry.registerTool({
        definition: definition as ToolDefinition & { type: 'query' },
        handler: async () => {
          throw new Error(
            `Query handler for "${toolName}" not initialized. ` +
              `Ensure registerViewsQueryHandlers() is called after registerViewsTools().`,
          );
        },
      });
    }
  }
}
