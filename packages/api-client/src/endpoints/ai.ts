/**
 * AI endpoint methods (API Contracts §2.6).
 */

import type { ApiClient } from '../client';
import type { ApiMeta } from '../types';

// --- Response types ---

export interface BriefingItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  metric?: string;
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  severity: 'info' | 'warning' | 'critical';
  actionLabel?: string;
  actionRoute?: string;
  generatedAt: string; // ISO 8601
}

export interface BriefingResponse {
  date: string; // ISO 8601
  items: BriefingItem[];
}

export interface ChatSession {
  id: string;
  title?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  action?: {
    id: string;
    type: string;
    description: string;
    entityType: string;
    previewData: Record<string, unknown>;
    confidence: number; // 0.0–1.0
  };
  record?: {
    entityType: string;
    entityId: string;
    displayRef: string;
  };
  createdAt: string; // ISO 8601
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  meta?: ApiMeta;
}

// --- Endpoint interface ---

export interface AiEndpoints {
  fetchBriefing(): Promise<BriefingResponse>;
  fetchChatHistory(
    sessionId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ChatHistoryResponse>;
  createChatSession(title?: string): Promise<ChatSession>;
  sendChatMessage(sessionId: string, content: string): Promise<ChatMessage>;
}

// --- Factory ---

export function createAiEndpoints(client: ApiClient): AiEndpoints {
  return {
    async fetchBriefing() {
      const { data } = await client.get<BriefingResponse>('/ai/briefing');
      return data;
    },

    async fetchChatHistory(sessionId, cursor?, limit?) {
      const params = new URLSearchParams({ sessionId });
      if (cursor) params.set('cursor', cursor);
      if (limit != null) params.set('limit', String(limit));
      const { data } = await client.get<ChatHistoryResponse>(
        `/ai/chat/history?${params.toString()}`,
      );
      return data;
    },

    async createChatSession(title?) {
      const { data } = await client.post<ChatSession>(
        '/ai/chat/sessions',
        title ? { title } : undefined,
      );
      return data;
    },

    async sendChatMessage(sessionId, content) {
      const { data } = await client.post<ChatMessage>('/ai/chat/message', {
        sessionId,
        content,
      });
      return data;
    },
  };
}
