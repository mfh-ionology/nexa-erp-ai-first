// @nexa/ai-tools — In-memory registry for tool definitions and query handlers

import type { ToolDefinition, ToolRegistration, QueryToolHandler } from './types.js';

export class ToolRegistry {
  private definitions = new Map<string, ToolDefinition>();
  private queryHandlers = new Map<string, QueryToolHandler>();

  registerTool(registration: ToolRegistration): void {
    const key = registration.definition.name.toLowerCase();

    // Guard against silent overwrites — tool names must be unique
    if (this.definitions.has(key)) {
      throw new Error(
        `ToolRegistry: tool "${registration.definition.name}" is already registered. ` +
          `Each tool name must be unique across all modules.`,
      );
    }

    this.definitions.set(key, registration.definition);
    if (registration.definition.type === 'query' && registration.handler) {
      this.queryHandlers.set(key, registration.handler);
    }
  }

  getDefinition(toolName: string): ToolDefinition | undefined {
    return this.definitions.get(toolName.toLowerCase());
  }

  getDefinitions(moduleKey?: string): ToolDefinition[] {
    const all = Array.from(this.definitions.values());
    if (moduleKey) {
      return all.filter((d) => d.moduleKey === moduleKey);
    }
    return all;
  }

  getQueryHandler(toolName: string): QueryToolHandler | undefined {
    return this.queryHandlers.get(toolName.toLowerCase());
  }

  /** Set or replace a query handler for an already-registered tool. */
  setQueryHandler(toolName: string, handler: QueryToolHandler): void {
    this.queryHandlers.set(toolName.toLowerCase(), handler);
  }

  resolveTools(toolNames: string[]): ToolDefinition[] {
    const resolved: ToolDefinition[] = [];
    for (const name of toolNames) {
      const def = this.definitions.get(name.toLowerCase());
      if (def) {
        resolved.push(def);
      }
    }
    return resolved;
  }
}
