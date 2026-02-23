import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from 'fastify';
import { filterFieldsByPermission } from './field-filter.hook.js';
import type { EffectivePermissions } from './permission.types.js';
import type { FieldVisibility } from '@nexa/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    userRole: 'STAFF',
    permissions: null as EffectivePermissions | null,
    ...overrides,
  } as FastifyRequest;
}

function makeReply(): FastifyReply {
  return {} as FastifyReply;
}

function makePermissions(
  fieldOverrides: Record<string, Record<string, FieldVisibility>> = {},
): EffectivePermissions {
  return {
    permissions: {},
    fieldOverrides,
    accessGroups: [],
    role: 'STAFF',
    isSuperAdmin: false,
    enabledModules: [],
  };
}

function makePayload(data: unknown): string {
  return JSON.stringify({ success: true, data });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('filterFieldsByPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC1 — HIDDEN fields stripped
  // =========================================================================

  it('strips HIDDEN fields from single-object response (AC1)', async () => {
    const hook = filterFieldsByPermission('sales.orders.detail');
    const request = makeRequest({
      permissions: makePermissions({
        'sales.orders.detail': { costPrice: 'HIDDEN' as FieldVisibility },
      }),
    });

    const payload = makePayload({
      id: '1',
      orderNumber: 'SO-00001',
      costPrice: 750,
      totalExVat: 1500,
    });

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data.costPrice).toBeUndefined();
    expect(body.data.orderNumber).toBe('SO-00001');
    expect(body.data.totalExVat).toBe(1500);
  });

  // =========================================================================
  // AC2 — READ_ONLY fields annotated
  // =========================================================================

  it('annotates READ_ONLY fields in _fieldMeta (AC2)', async () => {
    const hook = filterFieldsByPermission('sales.orders.detail');
    const request = makeRequest({
      permissions: makePermissions({
        'sales.orders.detail': { totalExVat: 'READ_ONLY' as FieldVisibility },
      }),
    });

    const payload = makePayload({
      id: '1',
      totalExVat: 1500,
    });

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data.totalExVat).toBe(1500); // still present
    expect(body._fieldMeta).toEqual({ totalExVat: 'readOnly' });
  });

  // =========================================================================
  // AC4 — Default VISIBLE
  // =========================================================================

  it('leaves VISIBLE fields untouched, no _fieldMeta (AC4)', async () => {
    const hook = filterFieldsByPermission('sales.orders.detail');
    const request = makeRequest({
      permissions: makePermissions({
        'sales.orders.detail': { totalExVat: 'VISIBLE' as FieldVisibility },
      }),
    });

    const payload = makePayload({
      id: '1',
      totalExVat: 1500,
    });

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data.totalExVat).toBe(1500);
    expect(body._fieldMeta).toBeUndefined();
  });

  // =========================================================================
  // AC5 — SUPER_ADMIN bypass
  // =========================================================================

  it('bypasses filtering for SUPER_ADMIN (AC5)', async () => {
    const hook = filterFieldsByPermission('sales.orders.detail');
    const request = makeRequest({
      userRole: 'SUPER_ADMIN',
      permissions: makePermissions({
        'sales.orders.detail': { costPrice: 'HIDDEN' as FieldVisibility },
      }),
    });

    const payload = makePayload({
      id: '1',
      costPrice: 750,
    });

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data.costPrice).toBe(750); // not stripped
    expect(body._fieldMeta).toBeUndefined();
  });

  // =========================================================================
  // AC6 — List response filtering
  // =========================================================================

  it('strips HIDDEN fields from every item in array response (AC6)', async () => {
    const hook = filterFieldsByPermission('sales.orders.detail');
    const request = makeRequest({
      permissions: makePermissions({
        'sales.orders.detail': {
          costPrice: 'HIDDEN' as FieldVisibility,
          totalExVat: 'READ_ONLY' as FieldVisibility,
        },
      }),
    });

    const payload = makePayload([
      { id: '1', orderNumber: 'SO-00001', costPrice: 750, totalExVat: 1500 },
      { id: '2', orderNumber: 'SO-00002', costPrice: 800, totalExVat: 2000 },
    ]);

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    // HIDDEN fields stripped from each item
    expect(body.data[0].costPrice).toBeUndefined();
    expect(body.data[1].costPrice).toBeUndefined();
    // READ_ONLY fields present in data
    expect(body.data[0].totalExVat).toBe(1500);
    expect(body.data[1].totalExVat).toBe(2000);
    // _fieldMeta at envelope level
    expect(body._fieldMeta).toEqual({ totalExVat: 'readOnly' });
  });

  // =========================================================================
  // Mixed overrides
  // =========================================================================

  it('handles mixed HIDDEN, READ_ONLY, VISIBLE overrides', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({
        resource: {
          secret: 'HIDDEN' as FieldVisibility,
          price: 'READ_ONLY' as FieldVisibility,
          name: 'VISIBLE' as FieldVisibility,
        },
      }),
    });

    const payload = makePayload({ id: '1', name: 'Item', price: 100, secret: 'xyz' });
    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data.secret).toBeUndefined();
    expect(body.data.price).toBe(100);
    expect(body.data.name).toBe('Item');
    expect(body._fieldMeta).toEqual({ price: 'readOnly' });
  });

  // =========================================================================
  // Edge cases — pass through
  // =========================================================================

  it('returns payload unmodified when no permissions on request', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({ permissions: null });
    const payload = makePayload({ id: '1', secret: 'xyz' });

    const result = await hook(request, makeReply(), payload);
    expect(result).toBe(payload);
  });

  it('returns payload unmodified when no field overrides for this resource', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ 'other.resource': { secret: 'HIDDEN' as FieldVisibility } }),
    });
    const payload = makePayload({ id: '1', secret: 'xyz' });

    const result = await hook(request, makeReply(), payload);
    expect(result).toBe(payload);
  });

  it('returns payload unmodified for error responses (success: false)', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { secret: 'HIDDEN' as FieldVisibility } }),
    });
    const payload = JSON.stringify({ success: false, error: 'Not found' });

    const result = await hook(request, makeReply(), payload);
    expect(result).toBe(payload);
  });

  it('returns null payload unmodified', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { secret: 'HIDDEN' as FieldVisibility } }),
    });

    const result = await hook(request, makeReply(), null);
    expect(result).toBeNull();
  });

  it('returns non-JSON string payload unmodified', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { secret: 'HIDDEN' as FieldVisibility } }),
    });

    const result = await hook(request, makeReply(), 'not json');
    expect(result).toBe('not json');
  });

  it('skips silently when field path not present in data', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { nonexistent: 'HIDDEN' as FieldVisibility } }),
    });
    const payload = makePayload({ id: '1', name: 'Item' });

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data).toEqual({ id: '1', name: 'Item' });
    expect(body._fieldMeta).toBeUndefined();
  });

  it('returns Buffer payload unmodified', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { secret: 'HIDDEN' as FieldVisibility } }),
    });
    const buffer = Buffer.from('binary data');

    const result = await hook(request, makeReply(), buffer);
    expect(result).toBe(buffer);
  });

  // =========================================================================
  // AC3 — Most-permissive-wins (pre-merged by PermissionService)
  // =========================================================================

  it('applies pre-merged most-permissive-wins visibility from PermissionService (AC3)', async () => {
    const hook = filterFieldsByPermission('sales.orders.detail');
    // PermissionService already resolved Group A (HIDDEN) + Group B (READ_ONLY) → READ_ONLY
    const request = makeRequest({
      permissions: makePermissions({
        'sales.orders.detail': { costPrice: 'READ_ONLY' as FieldVisibility },
      }),
    });

    const payload = makePayload({ id: '1', costPrice: 750, totalExVat: 1500 });
    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    // costPrice is READ_ONLY (not HIDDEN) — field present, annotated in _fieldMeta
    expect(body.data.costPrice).toBe(750);
    expect(body._fieldMeta).toEqual({ costPrice: 'readOnly' });
  });

  // =========================================================================
  // AC6 — _fieldMeta NOT added per-item in list responses
  // =========================================================================

  it('does not add _fieldMeta per-item in list responses (AC6)', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({
        resource: { price: 'READ_ONLY' as FieldVisibility },
      }),
    });

    const payload = makePayload([
      { id: '1', price: 100 },
      { id: '2', price: 200 },
    ]);

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    // _fieldMeta at envelope level only
    expect(body._fieldMeta).toEqual({ price: 'readOnly' });
    // NOT on individual items
    expect(body.data[0]._fieldMeta).toBeUndefined();
    expect(body.data[1]._fieldMeta).toBeUndefined();
  });

  // =========================================================================
  // Edge case — data: null in success response
  // =========================================================================

  it('returns payload unmodified when data is null in success response', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { secret: 'HIDDEN' as FieldVisibility } }),
    });
    const payload = JSON.stringify({ success: true, data: null });

    const result = await hook(request, makeReply(), payload);
    expect(result).toBe(payload);
  });

  // =========================================================================
  // Edge case — empty array in success response
  // =========================================================================

  it('returns payload unmodified when data is empty array', async () => {
    const hook = filterFieldsByPermission('resource');
    const request = makeRequest({
      permissions: makePermissions({ resource: { secret: 'HIDDEN' as FieldVisibility } }),
    });
    const payload = makePayload([]);

    const result = await hook(request, makeReply(), payload);
    const body = JSON.parse(result as string);

    expect(body.data).toEqual([]);
    expect(body._fieldMeta).toBeUndefined();
  });
});
