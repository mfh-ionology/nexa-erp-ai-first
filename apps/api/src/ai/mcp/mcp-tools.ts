// ---------------------------------------------------------------------------
// MCP Tools — system-level AI tools for navigation and cross-cutting concerns
// The `navigate_to_page` tool is detected by the orchestrator, which emits
// a WebSocket navigate message to the frontend instead of rendering text.
// ---------------------------------------------------------------------------

import type { ToolDefinition, QueryToolHandler } from '@nexa/ai-tools';
import type { ToolRegistry } from '@nexa/ai-tools';
import type { QueryExecutor } from '../query-executor.js';
import { getPage, buildPageRoute, PAGE_REGISTRY } from './page-registry.js';

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

export const MCP_TOOLS: ToolDefinition[] = [
  {
    name: 'navigate_to_page',
    description:
      'Navigates the user to a specific ERP page. For report pages, the provided params ' +
      'auto-populate the report filters and run the report immediately. Use this when the ' +
      'user asks to open, go to, show, or view a particular screen or report.',
    moduleKey: '_system',
    type: 'query',
    inputSchema: {
      type: 'object',
      properties: {
        pageKey: {
          type: 'string',
          description:
            'The page key to navigate to (e.g. "finance/profit-and-loss", "system/users"). ' +
            'Use the available_pages context to find the correct key.',
        },
        params: {
          type: 'object',
          description:
            'Optional parameters for the page. For report pages these populate filters ' +
            'and trigger an auto-run. Keys must match the page param names.',
        },
      },
      required: ['pageKey'],
    },
  },
];

// ---------------------------------------------------------------------------
// Query Handler
// ---------------------------------------------------------------------------

const navigateToPageHandler: QueryToolHandler = async ({ input }) => {
  const pageKey = input.pageKey as string;
  const params = (input.params as Record<string, unknown>) ?? {};

  // 1. Look up page
  const page = getPage(pageKey);
  if (!page) {
    const availableKeys = PAGE_REGISTRY.map((p) => `"${p.key}"`).join(', ');
    return {
      data: {
        error: `Unknown page key "${pageKey}". Available pages: ${availableKeys}`,
      },
      rowCount: 0,
    };
  }

  // 2. Validate required params
  const missingRequired = page.params
    .filter((p) => p.required && (params[p.name] === undefined || params[p.name] === null))
    .map((p) => p.name);

  if (missingRequired.length > 0) {
    const paramSchema = page.params.map((p) => ({
      name: p.name,
      type: p.type,
      required: p.required,
      description: p.description,
    }));

    return {
      data: {
        error: `Missing required params for page "${pageKey}": ${missingRequired.join(', ')}`,
        paramSchema,
      },
      rowCount: 0,
    };
  }

  // 3. Build route
  const route = buildPageRoute(page, params);

  // 4. Return navigation instruction (orchestrator detects _navigateTo)
  return {
    data: {
      _navigateTo: route,
      description: `Opening ${page.description}`,
    },
    rowCount: 1,
  };
};

// ---------------------------------------------------------------------------
// Registration Functions
// ---------------------------------------------------------------------------

/**
 * Register all MCP tool definitions in the ToolRegistry.
 * Query tools get sentinel handlers replaced by real handlers via
 * registerMcpQueryHandlers().
 */
export function registerMcpTools(registry: ToolRegistry): void {
  for (const definition of MCP_TOOLS) {
    registry.registerTool({
      definition: definition as ToolDefinition & { type: 'query' },
      handler: async () => {
        throw new Error(
          `Query handler for "${definition.name}" not initialized. ` +
            `Ensure registerMcpQueryHandlers() is called after registerMcpTools().`,
        );
      },
    });
  }
}

/**
 * Register MCP query handlers with the QueryExecutor.
 * These handle cross-cutting tools such as navigation.
 */
export function registerMcpQueryHandlers(queryExecutor: QueryExecutor): void {
  queryExecutor.registerHandler('navigate_to_page', navigateToPageHandler);
}
