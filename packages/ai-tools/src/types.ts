// @nexa/ai-tools — Tool definition types and handler interfaces

export interface ToolDefinition {
  name: string;
  description: string;
  moduleKey: string;
  inputSchema: JsonSchema;
  type: 'query' | 'action';
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  format?: string;
  default?: unknown;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface QueryToolHandler {
  (params: {
    companyId: string;
    userId: string;
    input: Record<string, unknown>;
  }): Promise<QueryToolResult>;
}

export interface QueryToolResult {
  data: unknown;
  rowCount?: number;
  truncated?: boolean;
}

export type ToolRegistration =
  | { definition: ToolDefinition & { type: 'query' }; handler: QueryToolHandler }
  | { definition: ToolDefinition & { type: 'action' }; handler?: undefined };
