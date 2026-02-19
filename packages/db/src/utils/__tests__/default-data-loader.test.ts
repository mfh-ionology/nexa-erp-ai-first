import { describe, expect, it } from 'vitest';
import { loadDefaultData } from '../default-data-loader.js';

describe('loadDefaultData', () => {
  it('loads and parses company-defaults.json', () => {
    const data = loadDefaultData();
    expect(data.version).toBe('1.0.0');
    expect(data.resources.length).toBeGreaterThan(0);
    expect(data.accessGroups.length).toBeGreaterThan(0);
    expect(data.vatCodes.length).toBeGreaterThan(0);
    expect(data.paymentTerms.length).toBeGreaterThan(0);
    expect(data.numberSeries.length).toBeGreaterThan(0);
    expect(data.currencies.length).toBeGreaterThan(0);
  });

  it('validates resource codes are unique', () => {
    const data = loadDefaultData();
    const codes = data.resources.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('validates access group codes are unique', () => {
    const data = loadDefaultData();
    const codes = data.accessGroups.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('validates all permission resourceCodes reference existing resources', () => {
    const data = loadDefaultData();
    const resourceCodes = new Set(data.resources.map((r) => r.code));
    for (const group of data.accessGroups) {
      for (const perm of group.permissions) {
        expect(
          resourceCodes.has(perm.resourceCode),
          `Missing resource: ${perm.resourceCode} in group ${group.code}`,
        ).toBe(true);
      }
    }
  });

  it('validates all field override resourceCodes reference existing resources', () => {
    const data = loadDefaultData();
    const resourceCodes = new Set(data.resources.map((r) => r.code));
    for (const group of data.accessGroups) {
      for (const fo of group.fieldOverrides) {
        expect(
          resourceCodes.has(fo.resourceCode),
          `Missing resource: ${fo.resourceCode} in group ${group.code} field override`,
        ).toBe(true);
      }
    }
  });

  it('validates parentCode references existing resource codes', () => {
    const data = loadDefaultData();
    const resourceCodes = new Set(data.resources.map((r) => r.code));
    for (const r of data.resources) {
      if (r.parentCode) {
        expect(
          resourceCodes.has(r.parentCode),
          `Resource ${r.code} has invalid parentCode: ${r.parentCode}`,
        ).toBe(true);
      }
    }
  });
});
