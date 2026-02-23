import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AnthropicAdapter } from '../../providers/adapters/anthropic.adapter.js';
import { ProviderError } from '../../errors/index.js';
import type { LLMRequest } from '../../types/index.js';

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
        stream: mockStream,
      },
    })),
  };
});

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AnthropicAdapter();
  });

  // ─── providerId ───────────────────────────────────────────────────────

  it('has providerId "anthropic"', () => {
    expect(adapter.providerId).toBe('anthropic');
  });

  // ─── capabilities ─────────────────────────────────────────────────────

  it('reports expected capabilities', () => {
    const caps = adapter.capabilities();
    expect(caps).toContain('completion');
    expect(caps).toContain('streaming');
    expect(caps).toContain('tool_use');
    expect(caps).toContain('vision');
    expect(caps).toContain('extended_thinking');
    expect(caps).toContain('long_context');
  });

  // ─── validateModel ────────────────────────────────────────────────────

  it('validates known Anthropic model IDs', () => {
    expect(adapter.validateModel('claude-sonnet-4-5-20250929')).toBe(true);
    expect(adapter.validateModel('claude-opus-4-6')).toBe(true);
    expect(adapter.validateModel('claude-haiku-4-5')).toBe(true);
    expect(adapter.validateModel('claude-3-5-sonnet-20241022')).toBe(true);
  });

  it('rejects non-Anthropic model IDs', () => {
    expect(adapter.validateModel('gpt-4o')).toBe(false);
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

  it('includes tool definitions in token estimate', async () => {
    const messages = [{ role: 'user' as const, content: 'Hi' }];
    const tools = [
      { name: 'get_weather', description: 'Gets the weather', inputSchema: { type: 'object' } },
    ];
    const estimate = await adapter.estimateTokens(messages, tools);
    expect(estimate).toBeGreaterThan(1); // includes tool JSON
  });

  // ─── complete — happy path ────────────────────────────────────────────

  it('calls Anthropic API and normalises response', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    const response = await adapter.complete(request, 'test-key');

    expect(response.content).toBe('Hello from Claude!');
    expect(response.provider).toBe('anthropic');
    expect(response.model).toBe('claude-sonnet-4-5-20250929');
    expect(response.finishReason).toBe('stop');
    expect(response.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
    expect(response.toolCalls).toBeUndefined();
  });

  // ─── complete — tool use ──────────────────────────────────────────────

  it('extracts tool calls from response', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_456',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me check that.' },
        {
          type: 'tool_use',
          id: 'toolu_001',
          name: 'get_weather',
          input: { location: 'London' },
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'tool_use',
      usage: { input_tokens: 20, output_tokens: 15 },
    });

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: "What's the weather in London?" }],
      tools: [
        {
          name: 'get_weather',
          description: 'Gets the weather for a location',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
          },
        },
      ],
    };

    const response = await adapter.complete(request, 'test-key');

    expect(response.finishReason).toBe('tool_use');
    expect(response.content).toBe('Let me check that.');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0]).toEqual({
      id: 'toolu_001',
      name: 'get_weather',
      input: { location: 'London' },
    });
  });

  // ─── complete — system messages extracted ─────────────────────────────

  it('extracts system messages to top-level param', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_789',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'OK' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 1 },
    });

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hi' },
      ],
    };

    await adapter.complete(request, 'test-key');

    // Verify the SDK was called with system at top level
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe('You are a helpful assistant.');
    // Messages should not include the system message
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
  });

  // ─── complete — max_tokens mapping ────────────────────────────────────

  it('maps maxOutputTokens to max_tokens', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_abc',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'OK' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'max_tokens',
      usage: { input_tokens: 5, output_tokens: 100 },
    });

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
      maxOutputTokens: 100,
    };

    const response = await adapter.complete(request, 'test-key');

    expect(response.finishReason).toBe('max_tokens');
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(100);
  });

  // ─── complete — error wrapping ────────────────────────────────────────

  it('wraps rate limit (429) errors as retryable ProviderError', async () => {
    const sdkError = new Error('rate_limit_error');
    (sdkError as any).status = 429;
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    try {
      await adapter.complete(request, 'test-key');
      expect.fail('Should have thrown ProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).isRetryable).toBe(true);
      expect((err as ProviderError).statusCode).toBe(429);
      expect((err as ProviderError).provider).toBe('anthropic');
    }
  });

  it('wraps 500 errors as retryable ProviderError', async () => {
    const sdkError = new Error('internal_server_error');
    (sdkError as any).status = 500;
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
    };

    try {
      await adapter.complete(request, 'test-key');
      expect.fail('Should have thrown ProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).isRetryable).toBe(true);
      expect((err as ProviderError).statusCode).toBe(500);
    }
  });

  it('wraps 400 errors as non-retryable ProviderError', async () => {
    const sdkError = new Error('invalid_request_error');
    (sdkError as any).status = 400;
    mockCreate.mockRejectedValueOnce(sdkError);

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
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

  // ─── ISSUE #11 FIX: Streaming tests ─────────────────────────────────

  describe('streaming', () => {
    it('yields content deltas followed by usage then done', async () => {
      const events = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
      ];
      const finalMsg = {
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const e of events) yield e;
        },
        finalMessage: async () => finalMsg,
      });

      const request: LLMRequest = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const chunks = [];
      for await (const chunk of adapter.stream(request, 'test-key')) {
        chunks.push(chunk);
      }

      // Order: content_delta(s) → usage → done
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({ type: 'content_delta', content: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'content_delta', content: ' world' });
      expect(chunks[2]).toEqual({
        type: 'usage',
        usage: { promptTokens: 10, completionTokens: 5 },
      });
      expect(chunks[3]).toEqual({ type: 'done', finishReason: 'stop' });
    });

    it('yields tool_use_delta chunks for tool calls', async () => {
      const events = [
        {
          type: 'content_block_start',
          content_block: { type: 'tool_use', id: 'toolu_001', name: 'get_weather' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: '{"location":"London"}' },
        },
      ];
      const finalMsg = {
        usage: { input_tokens: 15, output_tokens: 8 },
        stop_reason: 'tool_use',
      };

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const e of events) yield e;
        },
        finalMessage: async () => finalMsg,
      });

      const request: LLMRequest = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Weather?' }],
      };

      const chunks = [];
      for await (const chunk of adapter.stream(request, 'test-key')) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({
        type: 'tool_use_delta',
        toolCall: { id: 'toolu_001', name: 'get_weather' },
      });
      expect(chunks[1]).toEqual({
        type: 'tool_use_delta',
        toolCall: { input: '{"location":"London"}' },
      });
      expect(chunks[3]).toEqual({ type: 'done', finishReason: 'tool_use' });
    });

    it('wraps stream errors as ProviderError', async () => {
      const sdkError = new Error('Stream connection failed');
      (sdkError as any).status = 500;

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          throw sdkError;
        },
        finalMessage: async () => { throw sdkError; },
      });

      const request: LLMRequest = {
        model: 'claude-sonnet-4-5-20250929',
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

  // ─── complete — stop_sequences and temperature ────────────────────────

  it('passes temperature and stopSequences to SDK', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_def',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'OK' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 1 },
    });

    const request: LLMRequest = {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.5,
      stopSequences: ['END', 'STOP'],
    };

    await adapter.complete(request, 'test-key');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.stop_sequences).toEqual(['END', 'STOP']);
  });
});
