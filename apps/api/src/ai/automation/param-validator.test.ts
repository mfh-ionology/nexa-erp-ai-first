import { beforeEach, describe, expect, it } from 'vitest';
import { ToolParamValidator } from './param-validator.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToolCall(input: Record<string, unknown>) {
  return { name: 'testTool', input } as any;
}

function makeToolDef(schema: Record<string, unknown>) {
  return {
    name: 'testTool',
    description: 'A test tool',
    inputSchema: schema,
  } as any;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ToolParamValidator', () => {
  let validator: ToolParamValidator;

  beforeEach(() => {
    validator = new ToolParamValidator();
  });

  // =========================================================================
  // Top-level required field validation (AC-12)
  // =========================================================================

  describe('top-level required fields', () => {
    it('returns valid when all required fields are present', () => {
      const toolCall = makeToolCall({ amount: 100, currency: 'GBP' });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount to charge' },
          currency: { type: 'string', description: 'Currency code' },
        },
        required: ['amount', 'currency'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(true);
      expect(result.missingParams).toHaveLength(0);
    });

    it('returns invalid when required fields are missing', () => {
      const toolCall = makeToolCall({ amount: 100 });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount to charge' },
          currency: { type: 'string', description: 'Currency code' },
        },
        required: ['amount', 'currency'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(1);
      expect(result.missingParams[0]).toEqual({
        path: 'currency',
        description: 'Currency code',
      });
    });

    it('returns invalid when required field is null', () => {
      const toolCall = makeToolCall({ amount: null, currency: 'GBP' });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount to charge' },
          currency: { type: 'string', description: 'Currency code' },
        },
        required: ['amount', 'currency'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(1);
      expect(result.missingParams[0]!.path).toBe('amount');
    });

    it('reports all missing fields at once (batch — AC-16)', () => {
      const toolCall = makeToolCall({});
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer name' },
          email: { type: 'string', description: 'Customer email' },
          phone: { type: 'string', description: 'Phone number' },
        },
        required: ['name', 'email', 'phone'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(3);

      const paths = result.missingParams.map((p) => p.path);
      expect(paths).toContain('name');
      expect(paths).toContain('email');
      expect(paths).toContain('phone');
    });
  });

  // =========================================================================
  // Optional field passthrough (AC-13)
  // =========================================================================

  describe('optional field passthrough', () => {
    it('passes validation when optional fields are omitted', () => {
      const toolCall = makeToolCall({ name: 'Test' });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name' },
          notes: { type: 'string', description: 'Optional notes' },
          priority: { type: 'number', description: 'Optional priority' },
        },
        required: ['name'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(true);
      expect(result.missingParams).toHaveLength(0);
    });

    it('validates when no required array exists', () => {
      const toolCall = makeToolCall({ anything: 'goes' });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          anything: { type: 'string', description: 'Anything' },
        },
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Nested required field validation (AC-14)
  // =========================================================================

  describe('nested required field validation', () => {
    it('validates nested object required fields', () => {
      const toolCall = makeToolCall({
        name: 'Test',
        address: { city: 'London' },
      });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name' },
          address: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City' },
              postcode: { type: 'string', description: 'Postal code' },
            },
            required: ['city', 'postcode'],
          },
        },
        required: ['name', 'address'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(1);
      expect(result.missingParams[0]).toEqual({
        path: 'address.postcode',
        description: 'Postal code',
      });
    });

    it('validates array items with required fields (conditions[].operator)', () => {
      const toolCall = makeToolCall({
        conditions: [
          { field: 'amount', operator: 'gt', value: 100 },
          { field: 'status' }, // missing operator and value
        ],
      });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          conditions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', description: 'Field name' },
                operator: { type: 'string', description: 'Comparison operator' },
                value: { type: 'number', description: 'Comparison value' },
              },
              required: ['field', 'operator', 'value'],
            },
          },
        },
        required: ['conditions'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(2);

      const paths = result.missingParams.map((p) => p.path);
      expect(paths).toContain('conditions[1].operator');
      expect(paths).toContain('conditions[1].value');
    });

    it('validates lines[].quantity nested required fields', () => {
      const toolCall = makeToolCall({
        lines: [
          { productId: 'P-001', quantity: 5 },
          { productId: 'P-002' }, // missing quantity
        ],
      });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'Product ID' },
                quantity: { type: 'number', description: 'Quantity ordered' },
              },
              required: ['productId', 'quantity'],
            },
          },
        },
        required: ['lines'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(1);
      expect(result.missingParams[0]).toEqual({
        path: 'lines[1].quantity',
        description: 'Quantity ordered',
      });
    });
  });

  // =========================================================================
  // 2-level nesting validation
  // =========================================================================

  describe('2-level nesting validation', () => {
    it('validates 2 levels of nested required fields', () => {
      const toolCall = makeToolCall({
        order: {
          lines: [
            { product: { id: 'P-001' } }, // product.name missing
          ],
        },
      });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          order: {
            type: 'object',
            properties: {
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Product ID' },
                        name: { type: 'string', description: 'Product name' },
                      },
                      required: ['id', 'name'],
                    },
                  },
                  required: ['product'],
                },
              },
            },
            required: ['lines'],
          },
        },
        required: ['order'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(1);
      expect(result.missingParams[0]!.path).toBe('order.lines[0].product.name');
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles null input gracefully', () => {
      const toolCall = makeToolCall(null as any);
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name' },
        },
        required: ['name'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(false);
      expect(result.missingParams).toHaveLength(1);
    });

    it('handles empty array input', () => {
      const toolCall = makeToolCall({ items: [] });
      const toolDef = makeToolDef({
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Item name' },
              },
              required: ['name'],
            },
          },
        },
        required: ['items'],
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(true); // empty array is valid
    });

    it('handles schema without properties gracefully', () => {
      const toolCall = makeToolCall({ anything: 'test' });
      const toolDef = makeToolDef({
        type: 'object',
      });

      const result = validator.validate(toolCall, toolDef);
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // buildClarificationMessage
  // =========================================================================

  describe('buildClarificationMessage()', () => {
    it('formats batch clarification prompt with all missing fields', () => {
      const message = validator.buildClarificationMessage('createInvoice', [
        { path: 'customerId', description: 'Customer ID' },
        { path: 'amount', description: 'Invoice amount' },
        { path: 'dueDate', description: 'Payment due date' },
      ]);

      expect(message).toContain('createInvoice');
      expect(message).toContain('customerId');
      expect(message).toContain('amount');
      expect(message).toContain('dueDate');
      expect(message).toContain('Please provide all of the above values.');
    });

    it('uses default description when field description is empty', () => {
      const message = validator.buildClarificationMessage('testTool', [
        { path: 'field1', description: '' },
      ]);

      expect(message).toContain('Required parameter');
    });
  });

  // =========================================================================
  // buildAutonomousError
  // =========================================================================

  describe('buildAutonomousError()', () => {
    it('returns UNRESOLVABLE_REQUIRED_PARAM with all param names', () => {
      const error = validator.buildAutonomousError([
        { path: 'customerId', description: 'Customer ID' },
        { path: 'amount', description: 'Amount' },
      ]);

      expect(error).toBe('UNRESOLVABLE_REQUIRED_PARAM: customerId, amount');
    });

    it('handles single missing param', () => {
      const error = validator.buildAutonomousError([
        { path: 'invoiceId', description: 'Invoice ID' },
      ]);

      expect(error).toBe('UNRESOLVABLE_REQUIRED_PARAM: invoiceId');
    });
  });
});
