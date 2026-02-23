import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OpenAIAdapter } from '../../providers/adapters/openai.adapter.js';
import { ProviderError } from '../../errors/index.js';
import type { LLMRequest } from '../../types/index.js';

// ─── Mock OpenAI SDK ────────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIAdapter();
  });

  // ─── providerId ───────────────────────────────────────────────────────

  it('has providerId "openai"', () => {
    expect(adapter.providerId).toBe('openai');
  });

  // ─── capabilities ─────────────────────────────────────────────────────

  it('reports expected capabilities', () => {
    const caps = adapter.capabilities();
    expect(caps).toContain('completion');
    expect(caps).toContain('streaming');
    expect(caps).toContain('tool_use');
    expect(caps).toContain('vision');
    expect(caps).toContain('structured_output');
  });

  // ─── validateModel ────────────────────────────────────────────────────

  it('validates known OpenAI model IDs', () => {
    expect(adapter.validateModel('gpt-4o')).toBe(true);
    expect(adapter.validateModel('gpt-4o-mini')).toBe(true);
    expect(adapter.validateModel('gpt-3.5-turbo')).toBe(true);
    expect(adapter.validateModel('o1-preview')).toBe(true);
  });

  it('rejects non-OpenAI model IDs', () => {
    expect(adapter.validateModel('claude-sonnet-4-5')).toBe(false);
    expect(adapter.validateModel('gemini-pro')).toBe(false);
  });

  // ─── estimateTokens ──────────────────────────────────────────────────

  it('estimates tokens based on character count / 4', async () => {
    const messages = [
      { role: 'user' as const, content: 'Hello world!' }, // 12 chars => 3 tokens
    ];
    const estimate = await adapter.estimateTokens(messages);
    expect(estimate).toBe(3);
  });

  // ─── complete — happy path ────────────────────────────────────────────

  it('calls OpenAI API and normalises response', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello from GPT!',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 8,
        completion_tokens: 4,
        total_tokens: 12,
      },
    });

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.complete(request, 'test-key');

    expect(response.content).toBe('Hello from GPT!');
    expect(response.provider).toBe('openai');
    expect(response.model).toBe('gpt-4o');
    expect(response.finishReason).toBe('stop');
    expect(response.usage).toEqual({
      promptTokens: 8,
      completionTokens: 4,
      totalTokens: 12,
    });
    expect(response.toolCalls).toBeUndefined();
  });

  // ─── complete — tool calls ────────────────────────────────────────────

  it('extracts tool calls from response', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-456',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_abc123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location":"London"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 10,
        total_tokens: 25,
      },
    });

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: "What's the weather in London?" }],
      tools: [
        {
          name: 'get_weather',
          description: 'Gets weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
          },
        },
      ],
    };

    const response = await adapter.complete(request, 'test-key');

    expect(response.finishReason).toBe('tool_use');
    expect(response.content).toBe('');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0]).toEqual({
      id: 'call_abc123',
      name: 'get_weather',
      input: { location: 'London' },
    });
  });

  // ─── complete — system messages preserved ─────────────────────────────

  it('preserves system messages in message array', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-789',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'OK' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
    });

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hi' },
      ],
    };

    await adapter.complete(request, 'test-key');

    const callArgs = mockCreate.mock.calls[0][0];
    // OpenAI keeps system messages in the array (unlike Anthropic)
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toBe('You are a helpful assistant.');
  });

  // ─── complete — max_tokens and temperature ────────────────────────────

  it('passes maxOutputTokens and temperature to SDK', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-abc',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'OK' },
          finish_reason: 'length',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 50, total_tokens: 55 },
    });

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      maxOutputTokens: 50,
      temperature: 0.7,
      stopSequences: ['END'],
    };

    const response = await adapter.complete(request, 'test-key');

    expect(response.finishReason).toBe('max_tokens');
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(50);
    expect(callArgs.temperature).toBe(0.7);
    expect(callArgs.stop).toEqual(['END']);
  });

  // ─── complete — error wrapping ────────────────────────────────────────

  it('wraps rate limit (429) errors as retryable ProviderError', async () => {
    const sdkError = new Error('Rate limit exceeded');
    (sdkError as any).status = 429;
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    try {
      await adapter.complete(request, 'test-key');
      expect.fail('Should have thrown ProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).isRetryable).toBe(true);
      expect((err as ProviderError).statusCode).toBe(429);
      expect((err as ProviderError).provider).toBe('openai');
    }
  });

  it('wraps 500 errors as retryable ProviderError', async () => {
    const sdkError = new Error('Internal server error');
    (sdkError as any).status = 500;
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    try {
      await adapter.complete(request, 'test-key');
      expect.fail('Should have thrown ProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).isRetryable).toBe(true);
    }
  });

  it('wraps 400 errors as non-retryable ProviderError', async () => {
    const sdkError = new Error('Invalid request');
    (sdkError as any).status = 400;
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    try {
      await adapter.complete(request, 'test-key');
      expect.fail('Should have thrown ProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).isRetryable).toBe(false);
      expect((err as ProviderError).statusCode).toBe(400);
    }
  });

  it('wraps timeout errors as retryable ProviderError', async () => {
    const sdkError = new Error('Request timeout');
    (sdkError as any).code = 'ETIMEDOUT';
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    try {
      await adapter.complete(request, 'test-key');
      expect.fail('Should have thrown ProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).isRetryable).toBe(true);
    }
  });

  // ─── complete — empty choices ─────────────────────────────────────────

  it('handles empty choices array gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-empty',
      model: 'gpt-4o',
      choices: [],
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
    });

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.complete(request, 'test-key');
    expect(response.content).toBe('');
    expect(response.finishReason).toBe('stop');
  });

  // ─── ISSUE #11 FIX: Streaming tests ─────────────────────────────────

  describe('streaming', () => {
    it('yields content deltas, usage, then done (consistent ordering with Anthropic)', async () => {
      const streamChunks = [
        { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
        // Final content + finish_reason arrive on same chunk (ISSUE #3 scenario)
        { choices: [{ delta: { content: ' world' }, finish_reason: 'stop' }] },
        // Usage-only chunk (sent at end with stream_options.include_usage)
        { usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const c of streamChunks) yield c;
        },
      });

      const request: LLMRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const chunks = [];
      for await (const chunk of adapter.stream(request, 'test-key')) {
        chunks.push(chunk);
      }

      // ISSUE #23: Order should be content → content → usage → done
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({ type: 'content_delta', content: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'content_delta', content: ' world' });
      expect(chunks[2]).toEqual({
        type: 'usage',
        usage: { promptTokens: 10, completionTokens: 5 },
      });
      expect(chunks[3]).toEqual({ type: 'done', finishReason: 'stop' });
    });

    it('handles parallel tool calls (ISSUE #4)', async () => {
      const streamChunks = [
        {
          choices: [{
            delta: {
              tool_calls: [
                { id: 'call_1', function: { name: 'get_weather', arguments: '{"loc":"London"}' } },
                { id: 'call_2', function: { name: 'get_time', arguments: '{"tz":"UTC"}' } },
              ],
            },
            finish_reason: 'tool_calls',
          }],
        },
        { usage: { prompt_tokens: 20, completion_tokens: 10 }, choices: [] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const c of streamChunks) yield c;
        },
      });

      const request: LLMRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Weather and time?' }],
      };

      const chunks = [];
      for await (const chunk of adapter.stream(request, 'test-key')) {
        chunks.push(chunk);
      }

      // Should have 2 tool_use_deltas + usage + done = 4 chunks
      const toolChunks = chunks.filter(c => c.type === 'tool_use_delta');
      expect(toolChunks).toHaveLength(2);
      expect(toolChunks[0].toolCall.name).toBe('get_weather');
      expect(toolChunks[1].toolCall.name).toBe('get_time');
    });

    it('wraps stream errors as ProviderError', async () => {
      const sdkError = new Error('Stream failed');
      (sdkError as any).status = 500;

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          throw sdkError;
        },
      });

      const request: LLMRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
      };

      try {
        for await (const _chunk of adapter.stream(request, 'test-key')) {
          // consume
        }
        expect.fail('Should have thrown ProviderError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        expect((err as ProviderError).isRetryable).toBe(true);
      }
    });
  });

  // ─── complete — providerOptions passthrough ───────────────────────────

  it('passes through providerOptions (e.g., response_format)', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'chatcmpl-structured',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: '{"result": true}' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
    });

    const request: LLMRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Respond in JSON' }],
      providerOptions: {
        response_format: { type: 'json_object' },
      },
    };

    await adapter.complete(request, 'test-key');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.response_format).toEqual({ type: 'json_object' });
  });
});
