import type {
  Message,
  ContentBlock,
  TextBlock,
  ToolResultBlock,
  LLMResponse,
  ToolCall,
  FinishReason,
} from '../../types/index.js';

// ─── Anthropic Conversions ──────────────────────────────────────────────────

/**
 * Converts Nexa messages to Anthropic's format.
 *
 * - System messages are extracted to a separate `system` param (Anthropic requires this).
 * - Remaining messages are converted to Anthropic MessageParam format.
 *
 * Returns `{ system, messages }` — caller passes `system` at top level.
 */
export function toAnthropicMessages(messages: Message[]): {
  system: string | undefined;
  messages: AnthropicMessageParam[];
} {
  // ISSUE #24 FIX: Collect ALL system messages and concatenate them
  // instead of silently dropping all but the last one
  const systemParts: string[] = [];
  const converted: AnthropicMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Anthropic takes system as a top-level param, not a message
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content
            .filter((b): b is TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
      systemParts.push(text);
      continue;
    }

    converted.push({
      role: msg.role as 'user' | 'assistant',
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(toAnthropicContentBlock),
    });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: converted,
  };
}

function toAnthropicContentBlock(block: ContentBlock): AnthropicContentBlock {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'image':
      // Anthropic uses different source formats for base64 vs URL images
      if (block.source.type === 'url') {
        return {
          type: 'image',
          source: {
            type: 'url',
            url: block.source.data,
          },
        };
      }
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.source.mediaType,
          data: block.source.data,
        },
      };
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: typeof block.content === 'string'
          ? block.content
          : (block.content as ContentBlock[]).map(toAnthropicContentBlock),
        is_error: block.isError,
      };
  }
}

/**
 * Converts an Anthropic API response to a normalised LLMResponse.
 */
export function fromAnthropicResponse(response: AnthropicMessageResponse): LLMResponse {
  let textContent = '';
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textContent += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id!,
        name: block.name!,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  return {
    content: textContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
    model: response.model,
    provider: 'anthropic',
    finishReason: mapAnthropicStopReason(response.stop_reason),
  };
}

export function mapAnthropicStopReason(
  reason: string | null | undefined,
): FinishReason {
  switch (reason) {
    case 'end_turn':
      return 'stop';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    default:
      return 'stop';
  }
}

// ─── OpenAI Conversions ─────────────────────────────────────────────────────

/**
 * Converts Nexa messages to OpenAI ChatCompletionMessageParam format.
 *
 * - System messages become role 'system'.
 * - tool_result blocks become separate 'tool' role messages.
 * - tool_use blocks in assistant messages become tool_calls.
 */
export function toOpenAIMessages(messages: Message[]): OpenAIMessageParam[] {
  const converted: OpenAIMessageParam[] = [];

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      converted.push({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      });
      continue;
    }

    // Complex content blocks
    if (msg.role === 'assistant') {
      // Assistant messages may contain tool_use blocks → OpenAI tool_calls
      const textParts: string[] = [];
      const toolCalls: OpenAIToolCall[] = [];

      for (const block of msg.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function' as const,
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      converted.push({
        role: 'assistant',
        content: textParts.join('') || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    } else if (msg.role === 'user') {
      // User messages may contain tool_result blocks → separate 'tool' messages
      // or mixed text/image content
      const toolResults: ToolResultBlock[] = [];
      const contentParts: OpenAIContentPart[] = [];

      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          toolResults.push(block);
        } else if (block.type === 'text') {
          contentParts.push({ type: 'text', text: block.text });
        } else if (block.type === 'image') {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url:
                block.source.type === 'url'
                  ? block.source.data
                  : `data:${block.source.mediaType};base64,${block.source.data}`,
            },
          });
        }
      }

      // Emit tool result messages first (they must follow the assistant tool_calls message)
      for (const tr of toolResults) {
        converted.push({
          role: 'tool',
          tool_call_id: tr.toolUseId,
          content:
            typeof tr.content === 'string'
              ? tr.content
              : (tr.content as ContentBlock[])
                  .filter((b): b is TextBlock => b.type === 'text')
                  .map((b) => b.text)
                  .join('\n'),
        });
      }

      // Emit user content parts if any
      if (contentParts.length > 0) {
        const first = contentParts[0];
        converted.push({
          role: 'user',
          content:
            contentParts.length === 1 && first?.type === 'text'
              ? first.text
              : contentParts,
        });
      }
    } else if (msg.role === 'system') {
      // System with content blocks — extract text only
      const text = msg.content
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      converted.push({ role: 'system', content: text });
    }
  }

  return converted;
}

/**
 * Converts an OpenAI ChatCompletion response to a normalised LLMResponse.
 */
export function fromOpenAIResponse(response: OpenAIChatCompletionResponse): LLMResponse {
  const choice = response.choices[0];
  if (!choice) {
    return {
      content: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: response.model,
      provider: 'openai',
      finishReason: 'stop',
    };
  }

  const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map(
    (tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
    }),
  );

  return {
    content: choice.message.content ?? '',
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
    model: response.model,
    provider: 'openai',
    finishReason: mapOpenAIFinishReason(choice.finish_reason),
  };
}

function mapOpenAIFinishReason(
  reason: string | null | undefined,
): FinishReason {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'tool_calls':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'content_filter':
      return 'error';
    default:
      return 'stop';
  }
}

// ─── Lightweight type definitions for SDK shapes ────────────────────────────
// These mirror the provider SDK types without importing them, keeping
// converters usable in tests without real SDK dependencies.

export interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  source?: { type: string; media_type?: string; data?: string; url?: string };
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  is_error?: boolean;
}

export interface AnthropicMessageParam {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicMessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface OpenAIMessageParam {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
