import type { PrismaClient } from '@nexa/db';
import { UserRole } from '@nexa/db';

import type { RequestContext } from '../../../core/types/request-context.js';
import { ValidationError } from '../../../core/errors/index.js';
import type {
  UpdatePreferencesInput,
  PreferenceItemResponse,
  GetRoleDefaultsQuery,
  UpdateRoleDefaultsInput,
  RoleDefaultItemResponse,
} from './notification-preference.schema.js';

// ---------------------------------------------------------------------------
// getPreferences (BR-COM-014 cascade: user → role default → template default)
//
// Returns the user's preferences merged with all active templates.
// Resolution order: user preference → role default → template default.
// Each item includes a `source` field indicating where the values come from.
// ---------------------------------------------------------------------------

export async function getPreferences(
  ctx: RequestContext,
  prisma: PrismaClient,
): Promise<{
  items: (PreferenceItemResponse & { source: 'USER' | 'ROLE_DEFAULT' | 'TEMPLATE_DEFAULT' })[];
}> {
  // Fetch all active templates
  const templates = await prisma.notificationTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (templates.length === 0) {
    return { items: [] };
  }

  const templateIds = templates.map((t) => t.id);

  // Fetch user preferences and role defaults in parallel
  const [preferences, roleDefaults] = await Promise.all([
    prisma.notificationPreference.findMany({
      where: {
        userId: ctx.userId,
        notificationTemplateId: { in: templateIds },
      },
    }),
    prisma.notificationRoleDefault.findMany({
      where: {
        role: ctx.role as UserRole,
        notificationTemplateId: { in: templateIds },
      },
    }),
  ]);

  // Index by templateId for O(1) lookup
  const prefByTemplateId = new Map(preferences.map((p) => [p.notificationTemplateId, p]));
  const roleDefaultByTemplateId = new Map(
    roleDefaults.map((rd) => [rd.notificationTemplateId, rd]),
  );

  // Merge: user preference → role default → template default (BR-COM-014)
  const items = templates.map((template) => {
    const pref = prefByTemplateId.get(template.id);
    const roleDef = roleDefaultByTemplateId.get(template.id);

    const base = {
      templateId: template.id,
      templateCode: template.code,
      templateName: template.name,
      eventName: template.eventName,
      defaultChannels: template.defaultChannels,
      defaultPriority: template.defaultPriority,
    };

    if (pref) {
      return {
        ...base,
        enableInApp: pref.enableInApp,
        enableEmail: pref.enableEmail,
        enablePush: pref.enablePush,
        priorityOverride: pref.priorityOverride,
        isMuted: pref.isMuted,
        muteUntil: pref.muteUntil ? pref.muteUntil.toISOString() : null,
        hasUserPreference: true,
        source: 'USER' as const,
      };
    }

    if (roleDef) {
      return {
        ...base,
        enableInApp: roleDef.enableInApp,
        enableEmail: roleDef.enableEmail,
        enablePush: roleDef.enablePush,
        priorityOverride: null,
        isMuted: false,
        muteUntil: null,
        hasUserPreference: false,
        source: 'ROLE_DEFAULT' as const,
      };
    }

    // Template default fallback
    return {
      ...base,
      enableInApp: template.defaultChannels.includes('IN_APP'),
      enableEmail: template.defaultChannels.includes('EMAIL'),
      enablePush: template.defaultChannels.includes('PUSH'),
      priorityOverride: null,
      isMuted: false,
      muteUntil: null,
      hasUserPreference: false,
      source: 'TEMPLATE_DEFAULT' as const,
    };
  });

  return { items };
}

// ---------------------------------------------------------------------------
// updatePreferences (upsert)
//
// Bulk upsert NotificationPreference records for the authenticated user.
// ---------------------------------------------------------------------------

export async function updatePreferences(
  ctx: RequestContext,
  prisma: PrismaClient,
  input: UpdatePreferencesInput,
): Promise<{ updated: number }> {
  // Validate all templateIds reference existing, active templates
  const templateIds = input.preferences.map((p) => p.notificationTemplateId);
  const validTemplates = await prisma.notificationTemplate.findMany({
    where: { id: { in: templateIds }, isActive: true },
    select: { id: true },
  });
  const validIds = new Set(validTemplates.map((t) => t.id));
  const invalidIds = templateIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    throw new ValidationError(
      `Invalid or inactive notification template IDs: ${invalidIds.join(', ')}`,
      undefined,
      'errors.notificationPreference.invalidTemplateIds',
    );
  }

  // Wrap all upserts in a transaction for atomicity — either all preferences
  // update or none do (prevents inconsistent partial-update state)
  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;

    for (const pref of input.preferences) {
      await tx.notificationPreference.upsert({
        where: {
          userId_notificationTemplateId: {
            userId: ctx.userId,
            notificationTemplateId: pref.notificationTemplateId,
          },
        },
        create: {
          userId: ctx.userId,
          notificationTemplateId: pref.notificationTemplateId,
          enableInApp: pref.enableInApp ?? true,
          enableEmail: pref.enableEmail ?? true,
          enablePush: pref.enablePush ?? true,
          priorityOverride: pref.priorityOverride ?? null,
          isMuted: pref.isMuted ?? false,
          muteUntil: pref.muteUntil ? new Date(pref.muteUntil) : null,
        },
        update: {
          ...(pref.enableInApp !== undefined ? { enableInApp: pref.enableInApp } : {}),
          ...(pref.enableEmail !== undefined ? { enableEmail: pref.enableEmail } : {}),
          ...(pref.enablePush !== undefined ? { enablePush: pref.enablePush } : {}),
          ...(pref.priorityOverride !== undefined
            ? { priorityOverride: pref.priorityOverride }
            : {}),
          ...(pref.isMuted !== undefined ? { isMuted: pref.isMuted } : {}),
          ...(pref.muteUntil !== undefined
            ? { muteUntil: pref.muteUntil ? new Date(pref.muteUntil) : null }
            : {}),
        },
      });
      count++;
    }

    return count;
  });

  return { updated };
}

// ---------------------------------------------------------------------------
// resetPreferences
//
// Deletes all NotificationPreference records for the authenticated user,
// causing getPreferences to fall back to role/template defaults.
// ---------------------------------------------------------------------------

export async function resetPreferences(
  ctx: RequestContext,
  prisma: PrismaClient,
): Promise<{ deleted: number }> {
  const result = await prisma.notificationPreference.deleteMany({
    where: { userId: ctx.userId },
  });
  return { deleted: result.count };
}

// ---------------------------------------------------------------------------
// getRoleDefaults (ADMIN only)
//
// Returns role-based default preferences for all active templates.
// If no role default exists, falls back to template defaults.
// ---------------------------------------------------------------------------

export async function getRoleDefaults(
  _ctx: RequestContext,
  prisma: PrismaClient,
  query: GetRoleDefaultsQuery,
): Promise<{ role: string; items: RoleDefaultItemResponse[] }> {
  const { role } = query;

  // Fetch all active templates
  const templates = await prisma.notificationTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (templates.length === 0) {
    return { role, items: [] };
  }

  // Fetch existing role defaults
  const roleDefaults = await prisma.notificationRoleDefault.findMany({
    where: {
      role: role as UserRole,
      notificationTemplateId: { in: templates.map((t) => t.id) },
    },
  });

  const roleDefaultByTemplateId = new Map(
    roleDefaults.map((rd) => [rd.notificationTemplateId, rd]),
  );

  const items: RoleDefaultItemResponse[] = templates.map((template) => {
    const rd = roleDefaultByTemplateId.get(template.id);

    if (rd) {
      return {
        templateId: template.id,
        templateCode: template.code,
        templateName: template.name,
        eventName: template.eventName,
        defaultChannels: template.defaultChannels,
        enableInApp: rd.enableInApp,
        enableEmail: rd.enableEmail,
        enablePush: rd.enablePush,
        hasRoleDefault: true,
      };
    }

    // No role default — fall back to template defaults
    return {
      templateId: template.id,
      templateCode: template.code,
      templateName: template.name,
      eventName: template.eventName,
      defaultChannels: template.defaultChannels,
      enableInApp: template.defaultChannels.includes('IN_APP'),
      enableEmail: template.defaultChannels.includes('EMAIL'),
      enablePush: template.defaultChannels.includes('PUSH'),
      hasRoleDefault: false,
    };
  });

  return { role, items };
}

// ---------------------------------------------------------------------------
// updateRoleDefaults (ADMIN only)
//
// Bulk upsert NotificationRoleDefault records for the specified role.
// ---------------------------------------------------------------------------

export async function updateRoleDefaults(
  _ctx: RequestContext,
  prisma: PrismaClient,
  input: UpdateRoleDefaultsInput,
): Promise<{ updated: number }> {
  const { role, preferences } = input;

  // Validate all templateIds reference existing, active templates
  const templateIds = preferences.map((p) => p.notificationTemplateId);
  const validTemplates = await prisma.notificationTemplate.findMany({
    where: { id: { in: templateIds }, isActive: true },
    select: { id: true },
  });
  const validIds = new Set(validTemplates.map((t) => t.id));
  const invalidIds = templateIds.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    throw new ValidationError(
      `Invalid or inactive notification template IDs: ${invalidIds.join(', ')}`,
      undefined,
      'errors.notificationPreference.invalidTemplateIds',
    );
  }

  // Validate role is a known UserRole
  const validRoles = Object.values(UserRole);
  if (!validRoles.includes(role as UserRole)) {
    throw new ValidationError(
      `Invalid role: ${role}`,
      undefined,
      'errors.notificationPreference.invalidRole',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;

    for (const pref of preferences) {
      await tx.notificationRoleDefault.upsert({
        where: {
          role_notificationTemplateId: {
            role: role as UserRole,
            notificationTemplateId: pref.notificationTemplateId,
          },
        },
        create: {
          role: role as UserRole,
          notificationTemplateId: pref.notificationTemplateId,
          enableInApp: pref.enableInApp,
          enableEmail: pref.enableEmail,
          enablePush: pref.enablePush,
        },
        update: {
          enableInApp: pref.enableInApp,
          enableEmail: pref.enableEmail,
          enablePush: pref.enablePush,
        },
      });
      count++;
    }

    return count;
  });

  return { updated };
}
