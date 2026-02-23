import type { Tool, ToolCall } from '../../types/index.js';

// ─── Anthropic Tool Conversions ─────────────────────────────────────────────

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Converts Nexa Tool[] to Anthropic's tool format.
 * Anthropic uses `input_schema` (snake_case).
 */
export function toAnthropicTools(tools: Tool[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

// ─── OpenAI Tool Conversions ────────────────────────────────────────────────

export interface OpenAIFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Converts Nexa Tool[] to OpenAI's function calling format.
 * OpenAI wraps each tool in `{ type: 'function', function: { ... } }`.
 */
export function toOpenAITools(tools: Tool[]): OpenAIFunction[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

// ─── Normalise Tool Calls ───────────────────────────────────────────────────

/**
 * Normalises tool calls from provider-specific response formats
 * into unified Nexa ToolCall[].
 *
 * Anthropic returns tool_use content blocks within the message content array.
 * OpenAI returns tool_calls on the message object.
 */
export function normalizeToolCalls(
  rawToolCalls: RawToolCallSource[],
  provider: 'anthropic' | 'openai',
): ToolCall[] {
  return rawToolCalls.map((tc) => {
    if (provider === 'anthropic') {
      // Anthropic: { type: 'tool_use', id, name, input }
      return {
        id: tc.id,
        name: tc.name!,
        input: (tc.input ?? {}) as Record<string, unknown>,
      };
    }

    // OpenAI: { id, type: 'function', function: { name, arguments } }
    return {
      id: tc.id,
      name: tc.function?.name ?? '',
      input: JSON.parse(tc.function?.arguments || '{}') as Record<string, unknown>,
    };
  });
}

/** Union of raw tool call shapes from Anthropic and OpenAI responses. */
export interface RawToolCallSource {
  id: string;
  type?: string;
  name?: string;
  input?: Record<string, unknown>;
  function?: {
    name: string;
    arguments: string;
  };
}
