import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@nexa/db';
import type { FieldOverrides } from './permission.types.js';

// ---------------------------------------------------------------------------
// filterFieldsByPermission — onSend hook factory for field-level visibility
// ---------------------------------------------------------------------------

/**
 * Factory that returns a Fastify `onSend` hook handler. The hook inspects the
 * serialized response payload, strips HIDDEN fields, annotates READ_ONLY fields
 * with `_fieldMeta`, and returns the modified payload.
 *
 * @param resourceCode - The resource code to look up field overrides for
 */
export function filterFieldsByPermission(resourceCode: string) {
  return async (
    request: FastifyRequest,
    _reply: FastifyReply,
    payload: unknown,
  ): Promise<unknown> => {
    // SUPER_ADMIN bypass (BR-RBAC-002)
    if (request.userRole === UserRole.SUPER_ADMIN) {
      return payload;
    }

    // No permissions resolved (e.g., unauthenticated routes) — pass through
    const overrides = request.permissions?.fieldOverrides[resourceCode];
    if (!overrides || Object.keys(overrides).length === 0) {
      return payload;
    }

    // Only process string payloads (JSON)
    if (typeof payload !== 'string') {
      return payload;
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return payload; // Non-JSON, pass through
    }

    // Only filter success responses with data
    if (body.success !== true || !body.data) {
      return payload;
    }

    const fieldMeta: Record<string, string> = {};

    // Apply field overrides
    if (Array.isArray(body.data)) {
      // List response — filter each item
      for (const item of body.data) {
        applyFieldOverrides(item as Record<string, unknown>, overrides, fieldMeta);
      }
    } else {
      // Single object response
      applyFieldOverrides(body.data as Record<string, unknown>, overrides, fieldMeta);
    }

    // Add _fieldMeta only if there are READ_ONLY annotations
    if (Object.keys(fieldMeta).length > 0) {
      body._fieldMeta = fieldMeta;
    }

    return JSON.stringify(body);
  };
}

function applyFieldOverrides(
  data: Record<string, unknown>,
  overrides: FieldOverrides,
  fieldMeta: Record<string, string>,
): void {
  for (const [fieldPath, visibility] of Object.entries(overrides)) {
    if (visibility === 'HIDDEN') {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- field paths are dynamic by design
      delete data[fieldPath];
    } else if (visibility === 'READ_ONLY') {
      if (fieldPath in data) {
        fieldMeta[fieldPath] = 'readOnly';
      }
    }
    // VISIBLE — no action needed (default)
  }
}
