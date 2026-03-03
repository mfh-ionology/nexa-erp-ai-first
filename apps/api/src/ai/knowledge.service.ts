// ---------------------------------------------------------------------------
// KnowledgeService — CRUD for AI module knowledge entries
// E5b-2 Task 11.1
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateKnowledgeInput {
  moduleKey: string;
  knowledgeType: string;
  title: string;
  content: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateKnowledgeInput {
  moduleKey?: string;
  knowledgeType?: string;
  title?: string;
  content?: string;
  priority?: number;
  isActive?: boolean;
}

export interface KnowledgeRecord {
  id: string;
  moduleKey: string;
  knowledgeType: string;
  title: string;
  content: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── KnowledgeService ─────────────────────────────────────────────────────

export class KnowledgeService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List ─────────────────────────────────────────────────────────────

  async listKnowledge(
    filters: { moduleKey?: string; type?: string; isActive?: boolean } = {},
  ): Promise<KnowledgeRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};
    if (filters.moduleKey) {
      where.moduleKey = filters.moduleKey;
    }
    if (filters.type) {
      where.knowledgeType = filters.type;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const entries = await this.db.aiModuleKnowledge.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { title: 'asc' }],
    });

    return entries.map((e) => this.toRecord(e));
  }

  // ─── Get ──────────────────────────────────────────────────────────────

  async getKnowledge(id: string): Promise<KnowledgeRecord | null> {
    const entry = await this.db.aiModuleKnowledge.findUnique({ where: { id } });
    if (!entry) return null;
    return this.toRecord(entry);
  }

  // ─── Create ───────────────────────────────────────────────────────────

  async createKnowledge(input: CreateKnowledgeInput): Promise<KnowledgeRecord> {
    const entry = await this.db.aiModuleKnowledge.create({
      data: {
        moduleKey: input.moduleKey,
        knowledgeType: input.knowledgeType,
        title: input.title,
        content: input.content,
        priority: input.priority ?? 100,
        isActive: input.isActive ?? true,
      },
    });

    this.logger.info({ knowledgeId: entry.id, title: entry.title }, 'Module knowledge created');

    return this.toRecord(entry);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  async updateKnowledge(id: string, input: UpdateKnowledgeInput): Promise<KnowledgeRecord | null> {
    const existing = await this.db.aiModuleKnowledge.findUnique({ where: { id } });
    if (!existing) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic update data
    const data: any = {};
    if (input.moduleKey !== undefined) data.moduleKey = input.moduleKey;
    if (input.knowledgeType !== undefined) data.knowledgeType = input.knowledgeType;
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const entry = await this.db.aiModuleKnowledge.update({
      where: { id },
      data,
    });

    this.logger.info({ knowledgeId: entry.id, title: entry.title }, 'Module knowledge updated');

    return this.toRecord(entry);
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  async deleteKnowledge(id: string): Promise<boolean> {
    const existing = await this.db.aiModuleKnowledge.findUnique({ where: { id } });
    if (!existing) return false;

    await this.db.aiModuleKnowledge.delete({ where: { id } });

    this.logger.info({ knowledgeId: id, title: existing.title }, 'Module knowledge deleted');

    return true;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return type
  private toRecord(entry: any): KnowledgeRecord {
    return {
      id: entry.id,
      moduleKey: entry.moduleKey,
      knowledgeType: entry.knowledgeType,
      title: entry.title,
      content: entry.content,
      priority: entry.priority,
      isActive: entry.isActive,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
