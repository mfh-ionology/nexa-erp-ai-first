import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { LLMResponse, ToolCall } from '@nexa/ai-gateway';
import type { AiResponse, AiStructuredOutput, ActionProposal } from './ai.types.js';

/**
 * Confidence thresholds for action proposals.
 * >=0.90 → green / auto-suggest
 * 0.70–0.89 → amber / review
 * <0.70 → red / manual
 */
export const CONFIDENCE_HIGH = 0.9;
export const CONFIDENCE_MEDIUM = 0.7;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_HIGH) return 'high';
  if (score >= CONFIDENCE_MEDIUM) return 'medium';
  return 'low';
}

export class ResponseParser {
  constructor(private logger: Logger) {}

  /**
   * Parse an LLM response into a typed AiResponse.
   * Tries structured JSON first, then tool calls, then falls back to plain text.
   */
  parse(llmResponse: LLMResponse, _intent: string): AiResponse {
    const baseUsage = {
      inputTokens: llmResponse.usage.promptTokens,
      outputTokens: llmResponse.usage.completionTokens,
      latencyMs: 0, // latency is set by the orchestrator from gateway response
    };

    // 1. If tool calls present, parse those as action proposals
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      const action = this.parseToolCalls(llmResponse.toolCalls);
      if (action) {
        return {
          type: 'action_proposal',
          messageId: randomUUID(),
          content: llmResponse.content || undefined,
          action,
          confidence: action.confidence,
          usage: baseUsage,
        };
      }
    }

    // 2. Try to parse structured JSON from content
    const structured = this.parseStructuredOutput(llmResponse.content);
    if (structured) {
      // If there's an action in the structured output, return as action_proposal
      const action = this.extractActionProposal(structured);
      if (action) {
        return {
          type: 'action_proposal',
          messageId: randomUUID(),
          content: structured.answer || structured.followUp || undefined,
          action,
          confidence: action.confidence,
          fieldConfidences: structured.action?.confidence ?? {},
          usage: baseUsage,
        };
      }

      // Structured response without an action — return as text with answer
      return {
        type: 'text',
        messageId: randomUUID(),
        content: structured.answer || structured.followUp || llmResponse.content,
        confidence: this.extractConfidence(structured),
        usage: baseUsage,
      };
    }

    // 3. Fallback: plain text response
    return this.parseTextResponse(llmResponse.content, baseUsage);
  }

  /**
   * Try to extract structured JSON from the LLM response content.
   * Handles both raw JSON strings and JSON embedded in markdown code blocks.
   */
  private parseStructuredOutput(content: string): AiStructuredOutput | null {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const trimmed = content.trim();

    // Try direct JSON parse first
    try {
      const parsed = JSON.parse(trimmed);
      if (this.isStructuredOutput(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      // Not direct JSON — try extracting from markdown code blocks
    }

    // Try extracting JSON from ```json ... ``` blocks
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]!.trim());
        if (this.isStructuredOutput(parsed)) {
          return parsed;
        }
      } catch {
        this.logger.warn('Failed to parse JSON from code block in LLM response');
      }
    }

    return null;
  }

  /** Type guard: check if parsed JSON matches AiStructuredOutput shape */
  private isStructuredOutput(obj: unknown): obj is AiStructuredOutput {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'intent' in obj &&
      typeof (obj as AiStructuredOutput).intent === 'string'
    );
  }

  /**
   * Extract an ActionProposal from structured output.
   * Only returns an ActionProposal if the structured output has an action field.
   */
  private extractActionProposal(structured: AiStructuredOutput): ActionProposal | null {
    if (!structured.action) {
      return null;
    }

    const { action } = structured;
    const overallConfidence = this.extractConfidence(structured);

    return {
      id: randomUUID(),
      type: action.type.toUpperCase(),
      description: structured.answer || `${action.type} ${action.entityType}`,
      entityType: action.entityType,
      previewData: action.fields,
      confidence: overallConfidence,
    };
  }

  /**
   * Extract overall confidence score from structured output.
   * Averages per-field confidence scores if present, otherwise defaults to 0.5.
   */
  private extractConfidence(structured: AiStructuredOutput): number {
    if (!structured.action?.confidence) {
      return 0.5;
    }

    const scores = Object.values(structured.action.confidence);
    if (scores.length === 0) {
      return 0.5;
    }

    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, avg));
  }

  /**
   * Parse tool calls into an ActionProposal.
   * Maps tool call name → action type (uppercase), input → previewData.
   * Returns the first tool call as the primary action.
   */
  private parseToolCalls(toolCalls: ToolCall[]): ActionProposal | null {
    if (!toolCalls || toolCalls.length === 0) {
      return null;
    }

    const toolCall = toolCalls[0]!; // primary tool call
    if (!toolCall.name || !toolCall.id) {
      this.logger.warn({ toolCall }, 'Invalid tool call — missing name or id');
      return null;
    }

    // Infer entity type from tool call name (e.g., 'create_invoice' → 'Invoice')
    const entityType = this.inferEntityTypeFromToolName(toolCall.name);

    return {
      id: toolCall.id,
      type: toolCall.name.toUpperCase(),
      description: `Execute ${toolCall.name.replace(/_/g, ' ')}`,
      entityType,
      previewData: toolCall.input ?? {},
      confidence: 0.85, // default tool call confidence (amber / review)
    };
  }

  /** Infer entity type from a tool call name like 'create_bank_transaction' → 'BankTransaction' */
  private inferEntityTypeFromToolName(toolName: string): string {
    const parts = toolName.split('_');
    if (parts.length >= 2) {
      // e.g., 'create_bank_transaction' → ['bank', 'transaction'] → 'BankTransaction'
      return parts
        .slice(1)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
    }
    return toolName.charAt(0).toUpperCase() + toolName.slice(1);
  }

  /** Handle natural language (non-structured) responses */
  private parseTextResponse(
    content: string,
    usage: { inputTokens: number; outputTokens: number; latencyMs: number },
  ): AiResponse {
    return {
      type: 'text',
      messageId: randomUUID(),
      content: content || undefined,
      usage,
    };
  }
}
