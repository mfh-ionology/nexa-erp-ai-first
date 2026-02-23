import { describe, it, expect } from 'vitest';
import {
  toAnthropicTools,
  toOpenAITools,
  normalizeToolCalls,
} from '../../providers/converters/tool-converter.js';
import type { Tool } from '../../types/index.js';

const sampleTools: Tool[] = [
  {
    name: 'get_weather',
    description: 'Gets the current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location'],
    },
  },
  {
    name: 'search_database',
    description: 'Searches the product database',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// toAnthropicTools
// ═════════════════════════════════════════════════════════════════════════════

describe('toAnthropicTools', () => {
  it('converts tools to Anthropic format with input_schema', () => {
    const result = toAnthropicTools(sampleTools);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'get_weather',
      description: 'Gets the current weather for a location',
      input_schema: sampleTools[0].inputSchema,
    });
  });

  it('preserves all tool properties', () => {
    const result = toAnthropicTools(sampleTools);

    expect(result[1]).toEqual({
      name: 'search_database',
      description: 'Searches the product database',
      input_schema: sampleTools[1].inputSchema,
    });
  });

  it('handles empty tools array', () => {
    const result = toAnthropicTools([]);
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// toOpenAITools
// ═════════════════════════════════════════════════════════════════════════════

describe('toOpenAITools', () => {
  it('wraps tools in function format', () => {
    const result = toOpenAITools(sampleTools);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Gets the current weather for a location',
        parameters: sampleTools[0].inputSchema,
      },
    });
  });

  it('uses "parameters" instead of "input_schema"', () => {
    const result = toOpenAITools(sampleTools);

    // OpenAI uses "parameters" not "input_schema"
    expect(result[0].function.parameters).toBe(sampleTools[0].inputSchema);
    expect((result[0] as any).function.input_schema).toBeUndefined();
  });

  it('handles empty tools array', () => {
    const result = toOpenAITools([]);
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// normalizeToolCalls
// ═════════════════════════════════════════════════════════════════════════════

describe('normalizeToolCalls', () => {
  describe('Anthropic format', () => {
    it('normalises Anthropic tool_use blocks', () => {
      const raw = [
        {
          id: 'toolu_001',
          type: 'tool_use',
          name: 'get_weather',
          input: { location: 'London' },
        },
      ];

      const result = normalizeToolCalls(raw, 'anthropic');

      expect(result).toEqual([
        { id: 'toolu_001', name: 'get_weather', input: { location: 'London' } },
      ]);
    });

    it('handles multiple Anthropic tool calls', () => {
      const raw = [
        { id: 'toolu_001', name: 'tool_a', input: { x: 1 } },
        { id: 'toolu_002', name: 'tool_b', input: { y: 2 } },
      ];

      const result = normalizeToolCalls(raw, 'anthropic');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('tool_a');
      expect(result[1].name).toBe('tool_b');
    });

    it('defaults input to empty object when undefined', () => {
      const raw = [{ id: 'toolu_003', name: 'no_args' }];

      const result = normalizeToolCalls(raw, 'anthropic');

      expect(result[0].input).toEqual({});
    });
  });

  describe('OpenAI format', () => {
    it('normalises OpenAI function tool calls', () => {
      const raw = [
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"London"}',
          },
        },
      ];

      const result = normalizeToolCalls(raw, 'openai');

      expect(result).toEqual([
        { id: 'call_abc', name: 'get_weather', input: { location: 'London' } },
      ]);
    });

    it('handles multiple OpenAI tool calls', () => {
      const raw = [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'func_a', arguments: '{"a":1}' },
        },
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'func_b', arguments: '{"b":2}' },
        },
      ];

      const result = normalizeToolCalls(raw, 'openai');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('func_a');
      expect(result[1].name).toBe('func_b');
    });

    it('defaults to empty object for empty arguments', () => {
      const raw = [
        {
          id: 'call_empty',
          type: 'function',
          function: { name: 'no_args', arguments: '' },
        },
      ];

      const result = normalizeToolCalls(raw, 'openai');

      expect(result[0].input).toEqual({});
    });
  });
});
