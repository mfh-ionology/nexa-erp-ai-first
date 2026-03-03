// @nexa/ai-tools — AI tool definitions, types, and registry

export type {
  ToolDefinition,
  JsonSchema,
  JsonSchemaProperty,
  QueryToolHandler,
  QueryToolResult,
  ToolRegistration,
} from './types.js';

export { ToolRegistry } from './tool-registry.js';

// Module tool definitions
export { VIEWS_TOOLS, registerViewsTools } from './modules/views.js';
