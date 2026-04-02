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
import { toOpenAIMessages, fromOpenAIResponse } from '../converters/message-converter.js';
import { toOpenAITools } from '../converters/tool-converter.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL_PREFIXES = ['deepseek-'];

/**
 * DeepSeek adapter — uses OpenAI-compatible API with DeepSeek's base URL.
 * Supports deepseek-chat (V3) and deepseek-reasoner (R1) models.
 */
export class DeepSeekAdapter implements LLMProvider {
  readonly providerId = 'deepseek' as const;
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

  async *stream(request: LLMRequest, apiKey: string): AsyncIterable<LLMStreamChunk> {
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

      let pendingDone: LLMStreamChunk | undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of streamResponse as any) {
        for (const mapped of this.mapStreamChunk(chunk)) {
          if (mapped.type === 'done') {
            pendingDone = mapped;
            continue;
          }
          if (mapped.type === 'usage' && pendingDone) {
            yield mapped;
            yield pendingDone;
            pendingDone = undefined;
            continue;
          }
          yield mapped;
        }
      }

      if (pendingDone) yield pendingDone;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  capabilities(): ProviderCapability[] {
    return ['completion', 'streaming', 'tool_use'];
  }

  validateModel(modelId: string): boolean {
    return DEEPSEEK_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
  }

  async estimateTokens(messages: Message[], tools?: Tool[]): Promise<number> {
    let charCount = 0;

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        charCount += msg.content.length;
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') charCount += block.text.length;
          else if (block.type === 'tool_use') {
            charCount += JSON.stringify(block.input).length;
          } else if (block.type === 'tool_result') {
            if (typeof block.content === 'string') {
              charCount += block.content.length;
            } else if (Array.isArray(block.content)) {
              for (const sub of block.content) {
                if (sub.type === 'text') charCount += sub.text.length;
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
      (request.providerOptions?.timeout as number | undefined) ?? DEFAULT_TIMEOUT_MS;

    const keyHash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    const cacheKey = `${keyHash}:${timeoutMs}`;
    let client = this.clientCache.get(cacheKey);
    if (!client) {
      client = new OpenAI({
        apiKey,
        baseURL: DEEPSEEK_BASE_URL,
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

    if (request.providerOptions) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {
        timeout: _to,
        model: _m,
        messages: _msg,
        max_tokens: _mt,
        tools: _t,
        stream: _s,
        stream_options: _so,
        ...safeOptions
      } = request.providerOptions;
      Object.assign(params, safeOptions);
    }

    return params;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private *mapStreamChunk(chunk: any): Generator<LLMStreamChunk> {
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

    if (delta.content) {
      yield { type: 'content_delta', content: delta.content };
    }

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

    return new ProviderError('deepseek', error.message ?? 'Unknown error', {
      statusCode,
      isRetryable,
      cause: error,
    });
  }
}
