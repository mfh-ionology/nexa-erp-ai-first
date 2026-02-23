import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  Tool,
  ProviderCapability,
} from '../../types/index.js';
import { ProviderError } from '../../errors/index.js';
import type { LLMProvider } from '../llm-provider.interface.js';
import {
  toAnthropicMessages,
  fromAnthropicResponse,
  mapAnthropicStopReason,
} from '../converters/message-converter.js';
import { toAnthropicTools } from '../converters/tool-converter.js';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Known Anthropic model ID prefixes for validation. */
const ANTHROPIC_MODEL_PREFIXES = [
  'claude-opus',
  'claude-sonnet',
  'claude-haiku',
  'claude-3',
  'claude-4',
];

export class AnthropicAdapter implements LLMProvider {
  readonly providerId = 'anthropic' as const;
  private readonly clientCache = new Map<string, Anthropic>();

  complete(request: LLMRequest, apiKey: string): Promise<LLMResponse> {
    return this.executeCompletion(request, apiKey);
  }

  async *stream(
    request: LLMRequest,
    apiKey: string,
  ): AsyncIterable<LLMStreamChunk> {
    const client = this.getOrCreateClient(apiKey, request);
    const { system, messages } = toAnthropicMessages(request.messages);

    const params = this.buildParams(request, system, messages);

    try {
      const streamObj = client.messages.stream(params);

      for await (const event of streamObj) {
        const chunk = this.mapStreamEvent(event);
        if (chunk) yield chunk;
      }

      // Emit final usage and actual finish reason from the accumulated message
      const finalMessage = await streamObj.finalMessage();
      yield {
        type: 'usage',
        usage: {
          promptTokens: finalMessage.usage.input_tokens,
          completionTokens: finalMessage.usage.output_tokens,
        },
      };
      yield {
        type: 'done',
        finishReason: mapAnthropicStopReason(finalMessage.stop_reason),
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  capabilities(): ProviderCapability[] {
    return [
      'completion',
      'streaming',
      'tool_use',
      'vision',
      'extended_thinking',
      'long_context',
    ];
  }

  validateModel(modelId: string): boolean {
    return ANTHROPIC_MODEL_PREFIXES.some((prefix) =>
      modelId.startsWith(prefix),
    );
  }

  async estimateTokens(messages: Message[], tools?: Tool[]): Promise<number> {
    // Heuristic: ~4 characters per token for text content
    let charCount = 0;

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        charCount += msg.content.length;
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') charCount += block.text.length;
          // ISSUE #21 FIX: Account for image and tool_use blocks in token estimation
          else if (block.type === 'image') {
            // Images cost ~765 tokens (low detail) to ~1590 tokens (high detail).
            // Use conservative estimate of 1000 tokens per image.
            charCount += 4000; // 1000 tokens * 4 chars/token
          } else if (block.type === 'tool_use') {
            charCount += JSON.stringify(block.input).length;
          } else if (block.type === 'tool_result') {
            if (typeof block.content === 'string') {
              charCount += block.content.length;
            } else if (Array.isArray(block.content)) {
              for (const sub of block.content) {
                if (sub.type === 'text') charCount += sub.text.length;
                else if (sub.type === 'image') charCount += 4000;
              }
            }
          }
        }
      }
    }

    if (tools) {
      charCount += JSON.stringify(tools).length;
    }

    return Math.ceil(charCount / 4);
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private getOrCreateClient(
    apiKey: string,
    request: LLMRequest,
  ): Anthropic {
    const timeoutMs =
      (request.providerOptions?.timeout as number | undefined) ??
      DEFAULT_TIMEOUT_MS;

    // ISSUE #5 FIX: Hash the API key so raw credentials are not stored as Map keys
    const keyHash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    const cacheKey = `${keyHash}:${timeoutMs}`;
    let client = this.clientCache.get(cacheKey);
    if (!client) {
      client = new Anthropic({
        apiKey,
        timeout: timeoutMs,
      });
      this.clientCache.set(cacheKey, client);
    }
    return client;
  }

  private buildParams(
    request: LLMRequest,
    system: string | undefined,
    messages: Array<{ role: 'user' | 'assistant'; content: unknown }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      model: request.model,
      max_tokens: request.maxOutputTokens ?? 4096,
      messages,
    };

    if (system) params.system = system;
    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.stopSequences?.length) params.stop_sequences = request.stopSequences;
    if (request.tools?.length) params.tools = toAnthropicTools(request.tools);

    // Pass through Anthropic-specific options (e.g., extended thinking, cache control)
    // ISSUE #22 FIX: Filter out core parameters to prevent callers from overriding them
    if (request.providerOptions) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timeout: _to, model: _m, messages: _msg, max_tokens: _mt, system: _sys, tools: _t, stream: _s, ...safeOptions } = request.providerOptions;
      Object.assign(params, safeOptions);
    }

    return params;
  }

  private async executeCompletion(
    request: LLMRequest,
    apiKey: string,
  ): Promise<LLMResponse> {
    const client = this.getOrCreateClient(apiKey, request);
    const { system, messages } = toAnthropicMessages(request.messages);
    const params = this.buildParams(request, system, messages);

    try {
      const response = await client.messages.create(params);
      return fromAnthropicResponse(response);
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapStreamEvent(event: any): LLMStreamChunk | null {
    switch (event.type) {
      case 'content_block_delta':
        if (event.delta?.type === 'text_delta') {
          return { type: 'content_delta', content: event.delta.text };
        }
        if (event.delta?.type === 'input_json_delta') {
          return {
            type: 'tool_use_delta',
            toolCall: { input: event.delta.partial_json },
          };
        }
        return null;

      case 'content_block_start':
        if (event.content_block?.type === 'tool_use') {
          return {
            type: 'tool_use_delta',
            toolCall: {
              id: event.content_block.id,
              name: event.content_block.name,
            },
          };
        }
        return null;

      default:
        return null;
    }
  }

  private wrapError(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;

    const error = err as Error & { status?: number; error?: { type?: string } };
    const statusCode = error.status;
    const isRetryable =
      statusCode === 429 ||
      (statusCode !== undefined && statusCode >= 500) ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT');

    return new ProviderError('anthropic', error.message ?? 'Unknown error', {
      statusCode,
      isRetryable,
      cause: error,
    });
  }
}
