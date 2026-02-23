import { describe, it, expect } from 'vitest';
import {
  toAnthropicMessages,
  fromAnthropicResponse,
  toOpenAIMessages,
  fromOpenAIResponse,
} from '../../providers/converters/message-converter.js';
import type { Message } from '../../types/index.js';

// ═════════════════════════════════════════════════════════════════════════════
// Anthropic Conversions
// ═════════════════════════════════════════════════════════════════════════════

describe('toAnthropicMessages', () => {
  it('converts simple string messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const result = toAnthropicMessages(messages);

    expect(result.system).toBeUndefined();
    expect(result.messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);
  });

  it('extracts system message to top-level system param', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ];

    const result = toAnthropicMessages(messages);

    expect(result.system).toBe('You are helpful.');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
  });

  it('extracts system message with content blocks', () => {
    const messages: Message[] = [
      {
        role: 'system',
        content: [
          { type: 'text', text: 'Rule 1.' },
          { type: 'text', text: 'Rule 2.' },
        ],
      },
      { role: 'user', content: 'Hi' },
    ];

    const result = toAnthropicMessages(messages);

    expect(result.system).toBe('Rule 1.\nRule 2.');
  });

  it('converts text content blocks', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Look at this' }],
      },
    ];

    const result = toAnthropicMessages(messages);

    expect(result.messages[0].content).toEqual([
      { type: 'text', text: 'Look at this' },
    ]);
  });

  it('converts image content blocks', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: 'image/png',
              data: 'iVBOR...',
            },
          },
        ],
      },
    ];

    const result = toAnthropicMessages(messages);
    const content = result.messages[0].content as any[];

    expect(content).toHaveLength(2);
    expect(content[1]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: 'iVBOR...',
      },
    });
  });

  it('converts tool_use content blocks', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_001',
            name: 'get_weather',
            input: { location: 'London' },
          },
        ],
      },
    ];

    const result = toAnthropicMessages(messages);
    const content = result.messages[0].content as any[];

    expect(content[0]).toEqual({
      type: 'tool_use',
      id: 'toolu_001',
      name: 'get_weather',
      input: { location: 'London' },
    });
  });

  it('converts tool_result content blocks', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'toolu_001',
            content: 'Sunny, 22°C',
          },
        ],
      },
    ];

    const result = toAnthropicMessages(messages);
    const content = result.messages[0].content as any[];

    expect(content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_001',
      content: 'Sunny, 22°C',
      is_error: undefined,
    });
  });

  it('converts tool_result with isError flag', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'toolu_002',
            content: 'Error: not found',
            isError: true,
          },
        ],
      },
    ];

    const result = toAnthropicMessages(messages);
    const content = result.messages[0].content as any[];

    expect(content[0].is_error).toBe(true);
  });
});

describe('fromAnthropicResponse', () => {
  it('extracts text content', () => {
    const response = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const result = fromAnthropicResponse(response);

    expect(result.content).toBe('Hello!');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-5-20250929');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('concatenates multiple text blocks', () => {
    const response = {
      id: 'msg_456',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Part 1. ' },
        { type: 'text', text: 'Part 2.' },
      ],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
    };

    const result = fromAnthropicResponse(response);

    expect(result.content).toBe('Part 1. Part 2.');
  });

  it('extracts tool calls', () => {
    const response = {
      id: 'msg_789',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Checking...' },
        {
          type: 'tool_use',
          id: 'toolu_001',
          name: 'search',
          input: { query: 'test' },
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'tool_use',
      usage: { input_tokens: 15, output_tokens: 20 },
    };

    const result = fromAnthropicResponse(response);

    expect(result.finishReason).toBe('tool_use');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: 'toolu_001',
      name: 'search',
      input: { query: 'test' },
    });
  });

  it('maps max_tokens stop reason', () => {
    const response = {
      id: 'msg_max',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Truncated...' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'max_tokens',
      usage: { input_tokens: 10, output_tokens: 100 },
    };

    const result = fromAnthropicResponse(response);

    expect(result.finishReason).toBe('max_tokens');
  });

  it('returns no toolCalls when none present', () => {
    const response = {
      id: 'msg_simple',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Just text.' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 3 },
    };

    const result = fromAnthropicResponse(response);
    expect(result.toolCalls).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// OpenAI Conversions
// ═════════════════════════════════════════════════════════════════════════════

describe('toOpenAIMessages', () => {
  it('converts simple string messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    const result = toOpenAIMessages(messages);

    expect(result).toEqual([
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]);
  });

  it('keeps system messages in the array (unlike Anthropic)', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ];

    const result = toOpenAIMessages(messages);

    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('You are helpful.');
  });

  it('converts tool_use blocks in assistant messages to tool_calls', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check.' },
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'get_weather',
            input: { location: 'London' },
          },
        ],
      },
    ];

    const result = toOpenAIMessages(messages);

    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'Let me check.',
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"London"}',
          },
        },
      ],
    });
  });

  it('converts tool_result blocks to separate tool messages', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'call_123',
            content: 'Sunny, 22°C',
          },
        ],
      },
    ];

    const result = toOpenAIMessages(messages);

    expect(result[0]).toEqual({
      role: 'tool',
      tool_call_id: 'call_123',
      content: 'Sunny, 22°C',
    });
  });

  it('converts image blocks to OpenAI image_url format', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image',
            source: {
              type: 'base64',
              mediaType: 'image/png',
              data: 'iVBOR...',
            },
          },
        ],
      },
    ];

    const result = toOpenAIMessages(messages);

    expect(result[0].content).toEqual([
      { type: 'text', text: 'What is this?' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBOR...' },
      },
    ]);
  });

  it('converts URL-type images', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              mediaType: 'image/jpeg',
              data: 'https://example.com/img.jpg',
            },
          },
        ],
      },
    ];

    const result = toOpenAIMessages(messages);

    expect((result[0].content as any[])[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/img.jpg' },
    });
  });

  it('handles mixed tool_result and text in user messages', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'call_456',
            content: 'Result data',
          },
          { type: 'text', text: 'Now process this.' },
        ],
      },
    ];

    const result = toOpenAIMessages(messages);

    // tool result comes first, then user text
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('tool');
    expect(result[0].tool_call_id).toBe('call_456');
    expect(result[1].role).toBe('user');
    expect(result[1].content).toBe('Now process this.');
  });

  it('simplifies single text content part to string', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Just text' }],
      },
    ];

    const result = toOpenAIMessages(messages);

    // Single text part should be simplified to a string
    expect(result[0].content).toBe('Just text');
  });
});

describe('fromOpenAIResponse', () => {
  it('extracts text content', () => {
    const response = {
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
    };

    const result = fromOpenAIResponse(response);

    expect(result.content).toBe('Hello!');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({
      promptTokens: 8,
      completionTokens: 3,
      totalTokens: 11,
    });
  });

  it('extracts tool calls', () => {
    const response = {
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
                id: 'call_abc',
                type: 'function' as const,
                function: {
                  name: 'search',
                  arguments: '{"query":"test"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
    };

    const result = fromOpenAIResponse(response);

    expect(result.finishReason).toBe('tool_use');
    expect(result.content).toBe('');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: 'call_abc',
      name: 'search',
      input: { query: 'test' },
    });
  });

  it('maps length finish_reason to max_tokens', () => {
    const response = {
      id: 'chatcmpl-max',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Truncated...' },
          finish_reason: 'length',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 100, total_tokens: 105 },
    };

    const result = fromOpenAIResponse(response);
    expect(result.finishReason).toBe('max_tokens');
  });

  it('handles empty choices array', () => {
    const response = {
      id: 'chatcmpl-empty',
      model: 'gpt-4o',
      choices: [],
    };

    const result = fromOpenAIResponse(response);

    expect(result.content).toBe('');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('handles null content in response', () => {
    const response = {
      id: 'chatcmpl-null',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
    };

    const result = fromOpenAIResponse(response);
    expect(result.content).toBe('');
  });
});
