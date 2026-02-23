import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  Tool,
  ProviderCapability,
  FinishReason,
} from '../../types/index.js';
import { ProviderError } from '../../errors/index.js';
import type { LLMProvider } from '../llm-provider.interface.js';
import {
  toOpenAIMessages,
  fromOpenAIResponse,
} from '../converters/message-converter.js';
import { toOpenAITools } from '../converters/tool-converter.js';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Known OpenAI model ID prefixes for validation. */
const OPENAI_MODEL_PREFIXES = ['gpt-4', 'gpt-3.5', 'o1', 'o3'];

export class OpenAIAdapter implements LLMProvider {
  readonly providerId = 'openai' as const;
  // ISSUE #5 FIX: Hash the API key for cache key instead of storing in plaintext
  private readonly clientCache = new Map<string, OpenAI>();

  async complete(request: LLMRequest, apiKey: string): Promise<LLMResponse> {
    const client = this.getOrCreateClient(apiKey, request);
    const messages = toOpenAIMessages(request.messages);
    const params = this.buildParams(request, messages);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.chat.completions.create(params as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return fromOpenAIResponse(response as any);
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async *stream(
    request: LLMRequest,
    apiKey: string,
  ): AsyncIterable<LLMStreamChunk> {
    const client = this.getOrCreateClient(apiKey, request);
    const messages = toOpenAIMessages(request.messages);
    const params = this.buildParams(request, messages);

    try {
      const streamResponse = await client.chat.completions.create({
        ...params,
        stream: true,
        stream_options: { include_usage: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // ISSUE #23 FIX: Buffer 'done' so it emits after 'usage', matching Anthropic's
      // order: content_delta(s) → usage → done (not done → usage)
      let pendingDone: LLMStreamChunk | undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of streamResponse as any) {
        // ISSUE #3/#4 FIX: mapStreamChunk now yields multiple chunks (content + done, parallel tool calls)
        for (const mapped of this.mapStreamChunk(chunk)) {
          if (mapped.type === 'done') {
            // Buffer done — will emit after usage chunk
            pendingDone = mapped;
            continue;
          }
          if (mapped.type === 'usage' && pendingDone) {
            // Emit usage before done for consistent ordering
            yield mapped;
            yield pendingDone;
            pendingDone = undefined;
            continue;
          }
          yield mapped;
        }
      }

      // If done was never followed by a usage chunk, emit it now
      if (pendingDone) yield pendingDone;
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
      'structured_output',
    ];
  }

  validateModel(modelId: string): boolean {
    return OPENAI_MODEL_PREFIXES.some((prefix) =>
      modelId.startsWith(prefix),
    );
  }

  async estimateTokens(messages: Message[], tools?: Tool[]): Promise<number> {
    // Heuristic: ~4 characters per token
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
              // tool_result with ContentBlock[] content
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

  private getOrCreateClient(apiKey: string, request: LLMRequest): OpenAI {
    const timeoutMs =
      (request.providerOptions?.timeout as number | undefined) ??
      DEFAULT_TIMEOUT_MS;

    // ISSUE #5 FIX: Hash the API key so raw credentials are not stored as Map keys
    const keyHash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    const cacheKey = `${keyHash}:${timeoutMs}`;
    let client = this.clientCache.get(cacheKey);
    if (!client) {
      client = new OpenAI({
        apiKey,
        timeout: timeoutMs,
      });
      this.clientCache.set(cacheKey, client);
    }
    return client;
  }

  private buildParams(
    request: LLMRequest,
    messages: Array<{ role: string; content?: unknown }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      model: request.model,
      messages,
    };

    if (request.maxOutputTokens !== undefined) params.max_tokens = request.maxOutputTokens;
    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.stopSequences?.length) params.stop = request.stopSequences;
    if (request.tools?.length) params.tools = toOpenAITools(request.tools);

    // Pass through OpenAI-specific options (e.g., response_format for structured output)
    // ISSUE #22 FIX: Filter out core parameters to prevent callers from overriding them
    if (request.providerOptions) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timeout: _to, model: _m, messages: _msg, max_tokens: _mt, tools: _t, stream: _s, stream_options: _so, ...safeOptions } = request.providerOptions;
      Object.assign(params, safeOptions);
    }

    return params;
  }

  /**
   * Map an OpenAI stream chunk to one or more LLMStreamChunks.
   *
   * ISSUE #3 FIX: Returns a generator so content_delta and done can both
   * be emitted from the same chunk (OpenAI sends final token + finish_reason together).
   * ISSUE #4 FIX: Iterates all tool_calls in the delta, not just index 0.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private *mapStreamChunk(chunk: any): Generator<LLMStreamChunk> {
    // Usage-only chunk (sent at stream end with stream_options.include_usage)
    if (chunk.usage && (!chunk.choices || chunk.choices.length === 0)) {
      yield {
        type: 'usage',
        usage: {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
        },
      };
      return;
    }

    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;

    // Emit content_delta BEFORE done — the final token and finish_reason
    // can arrive on the same chunk from OpenAI
    if (delta.content) {
      yield { type: 'content_delta', content: delta.content };
    }

    // Process ALL tool calls in the delta, not just index 0.
    // OpenAI sends parallel tool calls with different indices.
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        yield {
          type: 'tool_use_delta',
          toolCall: {
            id: tc.id,
            name: tc.function?.name,
            input: tc.function?.arguments ?? undefined,
          },
        };
      }
    }

    const finishReason = chunk.choices?.[0]?.finish_reason;
    if (finishReason) {
      yield {
        type: 'done',
        finishReason: this.mapFinishReason(finishReason),
      };
    }
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      default:
        return 'stop';
    }
  }

  private wrapError(err: unknown): ProviderError {
    if (err instanceof ProviderError) return err;

    const error = err as Error & { status?: number; code?: string };
    const statusCode = error.status;
    const isRetryable =
      statusCode === 429 ||
      (statusCode !== undefined && statusCode >= 500) ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT';

    return new ProviderError('openai', error.message ?? 'Unknown error', {
      statusCode,
      isRetryable,
      cause: error,
    });
  }
}
