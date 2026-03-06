// ---------------------------------------------------------------------------
// AI Variables REST endpoint
// Returns the global list of available prompt variables for autocomplete.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createRbacGuard } from '../core/rbac/index.js';
import { sendSuccess } from '../core/utils/response.js';
import { successEnvelope } from '../core/schemas/envelope.js';
import { UserRole } from '@nexa/db';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

const variableItemSchema = z.object({
  variableName: z.string(),
  displayName: z.string(),
  sourceType: z.string(),
});

const variableListResponseSchema = z.array(variableItemSchema);

// ---------------------------------------------------------------------------
// Hardcoded variable definitions
// These are the standard variables available in all AI prompts.
// When variables are stored per-prompt in AiPromptVariable, this endpoint
// returns the deduplicated union. For now, return a curated global list.
// ---------------------------------------------------------------------------

interface VariableItem {
  variableName: string;
  displayName: string;
  sourceType: string;
}

const GLOBAL_VARIABLES: VariableItem[] = [
  // System variables
  { variableName: 'today', displayName: 'Today (ISO Date)', sourceType: 'system' },
  { variableName: 'currentUser.name', displayName: 'Current User Name', sourceType: 'system' },
  { variableName: 'currentUser.email', displayName: 'Current User Email', sourceType: 'system' },
  { variableName: 'currentUser.role', displayName: 'Current User Role', sourceType: 'system' },
  { variableName: 'company.name', displayName: 'Company Name', sourceType: 'system' },
  { variableName: 'company.baseCurrency', displayName: 'Base Currency', sourceType: 'system' },
  {
    variableName: 'company.defaultCurrency',
    displayName: 'Default Currency',
    sourceType: 'system',
  },
  { variableName: 'locale', displayName: 'User Locale', sourceType: 'system' },
  { variableName: 'timezone', displayName: 'Company Timezone', sourceType: 'system' },

  // DB field variables
  { variableName: 'entity.id', displayName: 'Entity ID', sourceType: 'db_field' },
  { variableName: 'entity.type', displayName: 'Entity Type', sourceType: 'db_field' },
  { variableName: 'entity.name', displayName: 'Entity Name', sourceType: 'db_field' },
  { variableName: 'entity.status', displayName: 'Entity Status', sourceType: 'db_field' },
  { variableName: 'entity.createdAt', displayName: 'Entity Created At', sourceType: 'db_field' },
  { variableName: 'entity.updatedAt', displayName: 'Entity Updated At', sourceType: 'db_field' },

  // Page field variables
  { variableName: 'page.title', displayName: 'Page Title', sourceType: 'page_field' },
  { variableName: 'page.module', displayName: 'Current Module', sourceType: 'page_field' },
  {
    variableName: 'page.selectedRows',
    displayName: 'Selected Row Count',
    sourceType: 'page_field',
  },
  { variableName: 'page.filters', displayName: 'Active Filters', sourceType: 'page_field' },

  // Constants
  { variableName: 'app.name', displayName: 'Application Name', sourceType: 'constant' },
  { variableName: 'app.version', displayName: 'Application Version', sourceType: 'constant' },

  // Expressions
  {
    variableName: 'memory.recentContext',
    displayName: 'Recent Memory Context',
    sourceType: 'expression',
  },
  {
    variableName: 'conversation.summary',
    displayName: 'Conversation Summary',
    sourceType: 'expression',
  },
  {
    variableName: 'conversation.turnCount',
    displayName: 'Conversation Turn Count',
    sourceType: 'expression',
  },
];

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function variablesRoutes(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /ai/variables — List all available prompt variables
  // -----------------------------------------------------------------------
  fastify.get(
    '/variables',
    {
      schema: {
        response: { 200: successEnvelope(variableListResponseSchema) },
      },
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
    },
    async (_request, reply) => {
      // If DB has prompt variables, merge with globals (deduplicated).
      // For now, return the curated global list.
      try {
        const dbVariables = await fastify.aiDb.$queryRaw<
          Array<{ variable_name: string; display_name: string; source_type: string }>
        >`
          SELECT DISTINCT ON (variable_name)
            variable_name, display_name, source_type
          FROM ai_prompt_variables
          ORDER BY variable_name, created_at DESC
        `;

        if (dbVariables.length > 0) {
          // Merge DB variables with globals, DB takes precedence
          const dbMap = new Map(
            dbVariables.map((v) => [
              v.variable_name,
              {
                variableName: v.variable_name,
                displayName: v.display_name,
                sourceType: v.source_type.toLowerCase(),
              },
            ]),
          );

          // Start with DB variables, then add globals that aren't in DB
          const merged: VariableItem[] = [...dbMap.values()];
          for (const g of GLOBAL_VARIABLES) {
            if (!dbMap.has(g.variableName)) {
              merged.push(g);
            }
          }

          return sendSuccess(reply, merged);
        }
      } catch {
        // Table might not exist yet or query fails — fall through to globals
      }

      return sendSuccess(reply, GLOBAL_VARIABLES);
    },
  );
}

export const variablesRoutesPlugin = variablesRoutes;
