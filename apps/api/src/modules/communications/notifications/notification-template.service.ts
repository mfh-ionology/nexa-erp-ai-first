import type { PrismaClient } from '@nexa/db';

import type { RequestContext } from '../../../core/types/request-context.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateListQuery,
} from './notification-template.schema.js';

// ---------------------------------------------------------------------------
// createTemplate (AC: #1)
// ---------------------------------------------------------------------------

export async function createTemplate(
  _ctx: RequestContext,
  prisma: PrismaClient,
  input: CreateTemplateInput,
) {
  // Validate code uniqueness
  const existing = await prisma.notificationTemplate.findUnique({
    where: { code: input.code },
    select: { id: true },
  });

  if (existing) {
    throw new ValidationError(
      `A notification template with code "${input.code}" already exists`,
      undefined,
      'errors.notificationTemplate.duplicateCode',
    );
  }

  return prisma.notificationTemplate.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      eventName: input.eventName,
      titleTemplate: input.titleTemplate,
      bodyTemplate: input.bodyTemplate,
      defaultChannels: input.defaultChannels,
      defaultPriority: input.defaultPriority ?? 'NORMAL',
      actionUrl: input.actionUrl ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------

export async function updateTemplate(
  _ctx: RequestContext,
  prisma: PrismaClient,
  id: string,
  input: UpdateTemplateInput,
) {
  const template = await prisma.notificationTemplate.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!template) {
    throw new NotFoundError(
      'TEMPLATE_NOT_FOUND',
      'Notification template not found',
      'errors.notificationTemplate.notFound',
    );
  }

  // If code is being changed, validate uniqueness
  if (input.code !== undefined) {
    const existing = await prisma.notificationTemplate.findUnique({
      where: { code: input.code },
      select: { id: true },
    });

    if (existing && existing.id !== id) {
      throw new ValidationError(
        `A notification template with code "${input.code}" already exists`,
        undefined,
        'errors.notificationTemplate.duplicateCode',
      );
    }
  }

  return prisma.notificationTemplate.update({
    where: { id },
    data: {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.eventName !== undefined ? { eventName: input.eventName } : {}),
      ...(input.titleTemplate !== undefined ? { titleTemplate: input.titleTemplate } : {}),
      ...(input.bodyTemplate !== undefined ? { bodyTemplate: input.bodyTemplate } : {}),
      ...(input.defaultChannels !== undefined ? { defaultChannels: input.defaultChannels } : {}),
      ...(input.defaultPriority !== undefined ? { defaultPriority: input.defaultPriority } : {}),
      ...(input.actionUrl !== undefined ? { actionUrl: input.actionUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// deleteTemplate (soft delete — set isActive = false)
// ---------------------------------------------------------------------------

export async function deleteTemplate(_ctx: RequestContext, prisma: PrismaClient, id: string) {
  const template = await prisma.notificationTemplate.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!template) {
    throw new NotFoundError(
      'TEMPLATE_NOT_FOUND',
      'Notification template not found',
      'errors.notificationTemplate.notFound',
    );
  }

  return prisma.notificationTemplate.update({
    where: { id },
    data: { isActive: false },
  });
}

// ---------------------------------------------------------------------------
// listTemplates
// ---------------------------------------------------------------------------

export async function listTemplates(
  _ctx: RequestContext,
  prisma: PrismaClient,
  query: TemplateListQuery,
) {
  const where: Record<string, unknown> = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [items, total] = await Promise.all([
    prisma.notificationTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.notificationTemplate.count({ where }),
  ]);

  return { items, meta: { total, limit, offset } };
}

// ---------------------------------------------------------------------------
// getTemplateById
// ---------------------------------------------------------------------------

export async function getTemplateById(_ctx: RequestContext, prisma: PrismaClient, id: string) {
  const template = await prisma.notificationTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    throw new NotFoundError(
      'TEMPLATE_NOT_FOUND',
      'Notification template not found',
      'errors.notificationTemplate.notFound',
    );
  }

  return template;
}
