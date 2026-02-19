import type { FastifyReply, FastifyRequest, onSendHookHandler } from 'fastify';

import { prisma, UserRole } from '@nexa/db';

import { resolvePermissions } from './permission.service.js';

/**
 * Fastify onSend hook that filters response fields based on the user's field visibility overrides.
 *
 * - HIDDEN fields are removed from the response payload
 * - READ_ONLY fields are marked in a `_fieldMeta` object
 * - VISIBLE fields pass through unchanged
 * - SUPER_ADMIN bypasses all filtering
 */
export function filterFieldsByPermission(resourceCode: string): onSendHookHandler {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Fastify onSend accepts async functions
  return async (
    request: FastifyRequest,
    _reply: FastifyReply,
    payload: unknown,
  ): Promise<unknown> => {
    // SUPER_ADMIN bypass
    if (request.userRole === UserRole.SUPER_ADMIN) {
      return payload;
    }

    // Only filter JSON responses
    if (typeof payload !== 'string') {
      return payload;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return payload;
    }

    if (!request.userId || !request.companyId) {
      return payload;
    }

    const resolved = await resolvePermissions(prisma, request.userId, request.companyId);
    const overrides = resolved.fieldOverrides[resourceCode];

    if (!overrides || Object.keys(overrides).length === 0) {
      return payload;
    }

    // Handle both single object and array responses
    const dataObj = (parsed.data ?? parsed) as Record<string, unknown> | Record<string, unknown>[];
    const isArray = Array.isArray(dataObj);
    const items: Record<string, unknown>[] = isArray ? dataObj : [dataObj];
    const fieldMeta: Record<string, string> = {};

    for (const [fieldPath, visibility] of Object.entries(overrides)) {
      if (visibility === 'HIDDEN') {
        for (const item of items) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing fields by dynamic permission config
          delete item[fieldPath];
        }
      } else if (visibility === 'READ_ONLY') {
        fieldMeta[fieldPath] = 'readOnly';
      }
    }

    // Add _fieldMeta if there are any read-only markers
    if (Object.keys(fieldMeta).length > 0) {
      parsed._fieldMeta = fieldMeta;
    }

    return JSON.stringify(parsed);
  };
}
