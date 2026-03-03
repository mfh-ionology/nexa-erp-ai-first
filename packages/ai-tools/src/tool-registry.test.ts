import { beforeEach, describe, expect, it } from 'vitest';
import { ToolRegistry } from './tool-registry.js';
import type { ToolDefinition, ToolRegistration } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDef(
  name: string,
  moduleKey: string,
  type: 'query' | 'action' = 'query',
): ToolDefinition {
  return {
    name,
    description: `${name} tool`,
    moduleKey,
    inputSchema: { type: 'object', properties: {} },
    type,
  };
}

function makeRegistration(name: string, moduleKey: string): ToolRegistration {
  return {
    definition: makeDef(name, moduleKey) as ToolDefinition & { type: 'query' },
    handler: async () => ({ data: [], rowCount: 0 }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ─── registerTool + getDefinition ──────────────────────────────────────

  describe('registerTool() + getDefinition()', () => {
    it('registers a query tool and retrieves its definition', () => {
      registry.registerTool(makeRegistration('get_invoices', 'ar'));

      const def = registry.getDefinition('get_invoices');
      expect(def).toBeDefined();
      expect(def!.name).toBe('get_invoices');
      expect(def!.moduleKey).toBe('ar');
      expect(def!.type).toBe('query');
    });

    it('normalises tool names to lowercase on registration and lookup', () => {
      registry.registerTool(makeRegistration('Get_Aging_Report', 'ar'));

      expect(registry.getDefinition('get_aging_report')).toBeDefined();
      expect(registry.getDefinition('GET_AGING_REPORT')).toBeDefined();
    });

    it('returns undefined for unregistered tool', () => {
      expect(registry.getDefinition('nonexistent')).toBeUndefined();
    });
  });

  // ─── getDefinitions — module filtering ────────────────────────────────

  describe('getDefinitions()', () => {
    it('returns all definitions when no module filter is provided', () => {
      registry.registerTool(makeRegistration('get_invoices', 'ar'));
      registry.registerTool(makeRegistration('get_accounts', 'finance'));
      registry.registerTool(makeRegistration('get_customers', 'crm'));

      const all = registry.getDefinitions();
      expect(all).toHaveLength(3);
    });

    it('filters definitions by moduleKey', () => {
      registry.registerTool(makeRegistration('get_invoices', 'ar'));
      registry.registerTool(makeRegistration('get_aging_report', 'ar'));
      registry.registerTool(makeRegistration('get_accounts', 'finance'));

      const arTools = registry.getDefinitions('ar');
      expect(arTools).toHaveLength(2);
      expect(arTools.every((d) => d.moduleKey === 'ar')).toBe(true);
    });

    it('returns empty array when no tools match the module', () => {
      registry.registerTool(makeRegistration('get_invoices', 'ar'));

      const result = registry.getDefinitions('hr');
      expect(result).toEqual([]);
    });
  });

  // ─── getQueryHandler ──────────────────────────────────────────────────

  describe('getQueryHandler()', () => {
    it('returns handler for a registered query tool', () => {
      const reg = makeRegistration('get_invoices', 'ar');
      registry.registerTool(reg);

      const handler = registry.getQueryHandler('get_invoices');
      expect(handler).toBe(reg.handler);
    });

    it('does not register handler for action tools', () => {
      const actionReg: ToolRegistration = {
        definition: makeDef('create_invoice', 'ar', 'action') as ToolDefinition & {
          type: 'action';
        },
      };
      registry.registerTool(actionReg);

      expect(registry.getQueryHandler('create_invoice')).toBeUndefined();
      expect(registry.getDefinition('create_invoice')).toBeDefined();
    });

    it('returns undefined for unregistered handler', () => {
      expect(registry.getQueryHandler('nonexistent')).toBeUndefined();
    });
  });

  // ─── resolveTools ─────────────────────────────────────────────────────

  describe('resolveTools()', () => {
    it('resolves multiple tools by name list', () => {
      registry.registerTool(makeRegistration('get_invoices', 'ar'));
      registry.registerTool(makeRegistration('get_accounts', 'finance'));
      registry.registerTool(makeRegistration('get_customers', 'crm'));

      const resolved = registry.resolveTools(['get_invoices', 'get_customers']);
      expect(resolved).toHaveLength(2);
      expect(resolved.map((d) => d.name)).toEqual(['get_invoices', 'get_customers']);
    });

    it('skips tools that are not registered (no error)', () => {
      registry.registerTool(makeRegistration('get_invoices', 'ar'));

      const resolved = registry.resolveTools(['get_invoices', 'nonexistent_tool']);
      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.name).toBe('get_invoices');
    });

    it('returns empty array when no tools match', () => {
      const resolved = registry.resolveTools(['foo', 'bar']);
      expect(resolved).toEqual([]);
    });

    it('is case-insensitive', () => {
      registry.registerTool(makeRegistration('Get_Invoices', 'ar'));

      const resolved = registry.resolveTools(['GET_INVOICES']);
      expect(resolved).toHaveLength(1);
    });
  });
});
