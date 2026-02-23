import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock crypto.randomUUID for deterministic messageIds in tests
let uuidCounter = 0;
vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ResponseParser, classifyConfidence } from './response-parser.js';
import type { LLMResponse, ToolCall } from '@nexa/ai-gateway';
import type { AiStructuredOutput } from './ai.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createParser() {
  return new ResponseParser(mockLogger as any);
}

function makeLLMResponse(overrides: Partial<LLMResponse> = {}): LLMResponse {
  return {
    content: 'Hello, how can I help you?',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    finishReason: 'stop',
    ...overrides,
  };
}

function makeStructuredOutput(overrides: Partial<AiStructuredOutput> = {}): AiStructuredOutput {
  return {
    intent: 'create_invoice',
    action: {
      type: 'create_invoice',
      entityType: 'CustomerInvoice',
      fields: { customerId: 'cust-1', amount: 500 },
      confidence: { customerId: 0.95, amount: 0.88 },
    },
    answer: 'I will create an invoice for customer cust-1 with amount 500.',
    ...overrides,
  };
}

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: 'tool-call-1',
    name: 'create_invoice',
    input: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResponseParser', () => {
  let parser: ResponseParser;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    parser = createParser();
  });

  // ─── classifyConfidence helper ─────────────────────────────────────────────

  describe('classifyConfidence', () => {
    it('returns high for scores >= 0.90', () => {
      expect(classifyConfidence(0.9)).toBe('high');
      expect(classifyConfidence(0.95)).toBe('high');
      expect(classifyConfidence(1.0)).toBe('high');
    });

    it('returns medium for scores 0.70–0.89', () => {
      expect(classifyConfidence(0.7)).toBe('medium');
      expect(classifyConfidence(0.75)).toBe('medium');
      expect(classifyConfidence(0.89)).toBe('medium');
    });

    it('returns low for scores < 0.70', () => {
      expect(classifyConfidence(0.69)).toBe('low');
      expect(classifyConfidence(0.5)).toBe('low');
      expect(classifyConfidence(0.0)).toBe('low');
    });
  });

  // ─── Structured JSON response parsing ──────────────────────────────────────

  describe('parse structured JSON response', () => {
    it('parses structured JSON with action into action_proposal', () => {
      const structured = makeStructuredOutput();
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.type).toBe('action_proposal');
      expect(result.messageId).toMatch(/^test-uuid-/);
      expect(result.action).toBeDefined();
      expect(result.action!.type).toBe('CREATE_INVOICE');
      expect(result.action!.entityType).toBe('CustomerInvoice');
      expect(result.action!.previewData).toEqual({
        customerId: 'cust-1',
        amount: 500,
      });
      expect(result.content).toBe(
        'I will create an invoice for customer cust-1 with amount 500.',
      );
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 0,
      });
    });

    it('calculates average confidence from per-field scores', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { customerId: 'cust-1', amount: 500 },
          confidence: { customerId: 0.90, amount: 0.80 },
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      // Average of 0.90 and 0.80 = 0.85
      expect(result.confidence).toBeCloseTo(0.85);
      expect(result.action!.confidence).toBeCloseTo(0.85);
    });

    it('parses structured JSON without action as text response', () => {
      const structured: AiStructuredOutput = {
        intent: 'query',
        answer: 'You have 5 overdue invoices totalling £2,350.',
      };
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'query');

      expect(result.type).toBe('text');
      expect(result.content).toBe(
        'You have 5 overdue invoices totalling £2,350.',
      );
      expect(result.confidence).toBe(0.5); // default when no action confidence
    });

    it('uses followUp as content when answer is absent', () => {
      const structured: AiStructuredOutput = {
        intent: 'query',
        followUp: 'Would you like me to list them?',
      };
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'query');

      expect(result.type).toBe('text');
      expect(result.content).toBe('Would you like me to list them?');
    });

    it('extracts JSON from markdown code blocks', () => {
      const structured = makeStructuredOutput();
      const wrappedContent = '```json\n' + JSON.stringify(structured) + '\n```';
      const llmResponse = makeLLMResponse({ content: wrappedContent });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.type).toBe('action_proposal');
      expect(result.action!.type).toBe('CREATE_INVOICE');
    });
  });

  // ─── Tool call response parsing ────────────────────────────────────────────

  describe('parse tool_use response', () => {
    it('parses tool call into ActionProposal', () => {
      const toolCall = makeToolCall();
      const llmResponse = makeLLMResponse({
        content: 'I will create an invoice.',
        toolCalls: [toolCall],
        finishReason: 'tool_use',
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.type).toBe('action_proposal');
      expect(result.action).toBeDefined();
      expect(result.action!.id).toBe('tool-call-1');
      expect(result.action!.type).toBe('CREATE_INVOICE');
      expect(result.action!.entityType).toBe('Invoice');
      expect(result.action!.previewData).toEqual({
        customerId: 'cust-1',
        amount: 500,
        currency: 'GBP',
      });
      expect(result.action!.confidence).toBe(0.85);
      expect(result.content).toBe('I will create an invoice.');
    });

    it('infers entity type from tool name with multiple underscores', () => {
      const toolCall = makeToolCall({
        id: 'tc-2',
        name: 'update_bank_transaction',
        input: { status: 'matched' },
      });
      const llmResponse = makeLLMResponse({
        toolCalls: [toolCall],
        finishReason: 'tool_use',
      });

      const result = parser.parse(llmResponse, 'update');

      expect(result.action!.entityType).toBe('BankTransaction');
      expect(result.action!.type).toBe('UPDATE_BANK_TRANSACTION');
    });

    it('uses first tool call as primary action when multiple present', () => {
      const toolCalls = [
        makeToolCall({ id: 'tc-1', name: 'create_invoice', input: { amount: 100 } }),
        makeToolCall({ id: 'tc-2', name: 'send_email', input: { to: 'bob@example.com' } }),
      ];
      const llmResponse = makeLLMResponse({
        toolCalls,
        finishReason: 'tool_use',
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.action!.id).toBe('tc-1');
      expect(result.action!.type).toBe('CREATE_INVOICE');
    });

    it('tool calls take priority over structured JSON in content', () => {
      const structured = makeStructuredOutput();
      const toolCall = makeToolCall({ name: 'send_email' });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
        toolCalls: [toolCall],
        finishReason: 'tool_use',
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      // Tool call wins over structured content
      expect(result.action!.type).toBe('SEND_EMAIL');
    });

    it('ignores tool calls with missing name', () => {
      const toolCall = { id: 'tc-1', name: '', input: {} } as ToolCall;
      const llmResponse = makeLLMResponse({
        content: 'Just a text response.',
        toolCalls: [toolCall],
      });

      const result = parser.parse(llmResponse, 'chat');

      // Falls through to text since tool call is invalid
      expect(result.type).toBe('text');
      expect(result.content).toBe('Just a text response.');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ toolCall }),
        'Invalid tool call — missing name or id',
      );
    });
  });

  // ─── Plain text response parsing ───────────────────────────────────────────

  describe('parse plain text response', () => {
    it('returns text response for non-JSON content', () => {
      const llmResponse = makeLLMResponse({
        content: 'Sure, I can help you with that. Your overdue balance is £1,200.',
      });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('text');
      expect(result.messageId).toBe('test-uuid-1');
      expect(result.content).toBe(
        'Sure, I can help you with that. Your overdue balance is £1,200.',
      );
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 0,
      });
    });

    it('handles empty content gracefully', () => {
      const llmResponse = makeLLMResponse({ content: '' });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('text');
      expect(result.content).toBeUndefined();
    });

    it('handles whitespace-only content as text', () => {
      const llmResponse = makeLLMResponse({ content: '   \n\t  ' });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('text');
    });
  });

  // ─── Malformed JSON handling ───────────────────────────────────────────────

  describe('malformed JSON handling', () => {
    it('falls back to text response for malformed JSON', () => {
      const llmResponse = makeLLMResponse({
        content: '{ "intent": "create_invoice", broken json here }',
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.type).toBe('text');
      expect(result.content).toBe(
        '{ "intent": "create_invoice", broken json here }',
      );
    });

    it('falls back to text for JSON that does not match AiStructuredOutput schema', () => {
      const llmResponse = makeLLMResponse({
        content: JSON.stringify({ foo: 'bar', baz: 123 }),
      });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('text');
      // The raw content is preserved since it's valid JSON but not an AiStructuredOutput
      expect(result.content).toBe('{"foo":"bar","baz":123}');
    });

    it('falls back to text for malformed JSON inside code block', () => {
      const llmResponse = makeLLMResponse({
        content: '```json\n{ broken }\n```',
      });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('text');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to parse JSON from code block in LLM response',
      );
    });

    it('handles JSON array (not an object) as text response', () => {
      const llmResponse = makeLLMResponse({
        content: '[1, 2, 3]',
      });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('text');
    });
  });

  // ─── Confidence score extraction ───────────────────────────────────────────

  describe('confidence score extraction', () => {
    it('returns 0.5 default when no action confidence', () => {
      const structured: AiStructuredOutput = {
        intent: 'query',
        answer: 'some answer',
      };
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'query');

      expect(result.confidence).toBe(0.5);
    });

    it('returns 0.5 when confidence map is empty', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { customerId: 'cust-1' },
          confidence: {},
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.confidence).toBe(0.5);
    });

    it('averages multiple field confidence scores', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { a: 1, b: 2, c: 3 },
          confidence: { a: 0.9, b: 0.8, c: 0.7 },
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      // (0.9 + 0.8 + 0.7) / 3 = 0.8
      expect(result.confidence).toBeCloseTo(0.8);
    });

    it('clamps out-of-range confidence values', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { a: 1 },
          confidence: { a: 1.5 },
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.confidence).toBe(1.0);
    });

    it('classifies high-confidence action proposals (>=0.90)', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { amount: 500 },
          confidence: { amount: 0.95 },
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.confidence).toBe(0.95);
      expect(classifyConfidence(result.confidence!)).toBe('high');
    });

    it('classifies medium-confidence action proposals (0.70–0.89)', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { amount: 500 },
          confidence: { amount: 0.78 },
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.confidence).toBe(0.78);
      expect(classifyConfidence(result.confidence!)).toBe('medium');
    });

    it('classifies low-confidence action proposals (<0.70)', () => {
      const structured = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { amount: 500 },
          confidence: { amount: 0.45 },
        },
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.confidence).toBe(0.45);
      expect(classifyConfidence(result.confidence!)).toBe('low');
    });
  });

  // ─── Null/empty content edge cases ─────────────────────────────────────────

  describe('edge cases', () => {
    it('handles tool calls with empty input', () => {
      const toolCall = makeToolCall({ input: {} });
      const llmResponse = makeLLMResponse({
        toolCalls: [toolCall],
        finishReason: 'tool_use',
      });

      const result = parser.parse(llmResponse, 'chat');

      expect(result.type).toBe('action_proposal');
      expect(result.action!.previewData).toEqual({});
    });

    it('description for action from structured output uses answer when available', () => {
      const structured = makeStructuredOutput({
        answer: 'Creating invoice for Acme Ltd',
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.action!.description).toBe('Creating invoice for Acme Ltd');
    });

    it('description for action from structured output uses fallback when no answer', () => {
      const structured = makeStructuredOutput({
        answer: undefined,
      });
      const llmResponse = makeLLMResponse({
        content: JSON.stringify(structured),
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.action!.description).toBe('create_invoice CustomerInvoice');
    });

    it('tool call description humanizes the tool name', () => {
      const toolCall = makeToolCall({ name: 'create_customer_invoice' });
      const llmResponse = makeLLMResponse({
        toolCalls: [toolCall],
        finishReason: 'tool_use',
      });

      const result = parser.parse(llmResponse, 'create_invoice');

      expect(result.action!.description).toBe('Execute create customer invoice');
    });
  });
});
