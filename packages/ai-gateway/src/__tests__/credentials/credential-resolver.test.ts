import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { CredentialResolver } from '../../credentials/credential-resolver.js';
import type { ByokCredentialSource, ByokCredential } from '../../credentials/credential-resolver.js';
import { CredentialError } from '../../errors/index.js';
import { encrypt } from '../../credentials/encryption.js';

const MASTER_KEY = randomBytes(32).toString('hex');

/** Creates a mock ByokCredentialSource. */
function createMockSource(
  result: ByokCredential | null = null,
): ByokCredentialSource & { getCredential: ReturnType<typeof vi.fn> } {
  return {
    getCredential: vi.fn().mockResolvedValue(result),
  };
}

/** Encrypts a plaintext key with the test master key. */
function encryptKey(plain: string): string {
  return encrypt(plain, MASTER_KEY);
}

describe('CredentialResolver', () => {
  // ─── BYOK found and active ────────────────────────────────────────────

  describe('when tenant has an active BYOK credential', () => {
    const tenantId = 'tenant-001';
    const providerId = 'anthropic';
    const rawApiKey = 'sk-ant-api03-real-key-12345';

    let resolver: CredentialResolver;
    let source: ReturnType<typeof createMockSource>;

    beforeEach(() => {
      source = createMockSource({
        id: 'cred-001',
        tenantId,
        providerId,
        encryptedKey: encryptKey(rawApiKey),
        isActive: true,
      });
      resolver = new CredentialResolver(source, MASTER_KEY);
    });

    it('returns the decrypted BYOK key with isByok: true', async () => {
      const result = await resolver.resolve(tenantId, providerId);
      expect(result).toEqual({ apiKey: rawApiKey, isByok: true });
    });

    it('queries the source with correct tenantId and providerId', async () => {
      await resolver.resolve(tenantId, providerId);
      expect(source.getCredential).toHaveBeenCalledWith(tenantId, providerId);
    });
  });

  // ─── BYOK found but inactive → falls back to vendor ───────────────────

  describe('when tenant BYOK credential is inactive', () => {
    it('falls back to vendor key from env', async () => {
      const source = createMockSource({
        id: 'cred-002',
        tenantId: 'tenant-002',
        providerId: 'openai',
        encryptedKey: encryptKey('sk-inactive'),
        isActive: false,
      });
      const envLookup = vi.fn().mockReturnValue('sk-vendor-openai-key');
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      const result = await resolver.resolve('tenant-002', 'openai');
      expect(result).toEqual({ apiKey: 'sk-vendor-openai-key', isByok: false });
      expect(envLookup).toHaveBeenCalledWith('OPENAI_API_KEY');
    });
  });

  // ─── No BYOK → vendor key from env ────────────────────────────────────

  describe('when no BYOK credential exists', () => {
    it('returns vendor key for anthropic', async () => {
      const source = createMockSource(null);
      const envLookup = vi.fn().mockReturnValue('sk-ant-vendor');
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      const result = await resolver.resolve('tenant-003', 'anthropic');
      expect(result).toEqual({ apiKey: 'sk-ant-vendor', isByok: false });
      expect(envLookup).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    });

    it('returns vendor key for openai', async () => {
      const source = createMockSource(null);
      const envLookup = vi.fn().mockReturnValue('sk-openai-vendor');
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      const result = await resolver.resolve('tenant-004', 'openai');
      expect(result).toEqual({ apiKey: 'sk-openai-vendor', isByok: false });
      expect(envLookup).toHaveBeenCalledWith('OPENAI_API_KEY');
    });
  });

  // ─── No credentials at all → CredentialError ──────────────────────────

  describe('when no credentials are available', () => {
    it('throws CredentialError when no BYOK and no vendor key', async () => {
      const source = createMockSource(null);
      const envLookup = vi.fn().mockReturnValue(undefined);
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      await expect(resolver.resolve('tenant-005', 'anthropic')).rejects.toThrow(CredentialError);
    });

    it('includes provider name in error message', async () => {
      const source = createMockSource(null);
      const envLookup = vi.fn().mockReturnValue(undefined);
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      await expect(resolver.resolve('tenant-005', 'openai')).rejects.toThrow(
        /No credentials available.*openai/,
      );
    });

    it('throws CredentialError for unknown provider with no BYOK', async () => {
      const source = createMockSource(null);
      const envLookup = vi.fn().mockReturnValue(undefined);
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      await expect(resolver.resolve('tenant-006', 'unknown-provider')).rejects.toThrow(
        CredentialError,
      );
    });
  });

  // ─── BYOK decryption failure → CredentialError ────────────────────────

  describe('when BYOK key decryption fails', () => {
    it('throws CredentialError with decryption details', async () => {
      const source = createMockSource({
        id: 'cred-bad',
        tenantId: 'tenant-007',
        providerId: 'anthropic',
        encryptedKey: 'not-valid-base64-encrypted-data!!!',
        isActive: true,
      });
      const resolver = new CredentialResolver(source, MASTER_KEY);

      await expect(resolver.resolve('tenant-007', 'anthropic')).rejects.toThrow(CredentialError);
      await expect(resolver.resolve('tenant-007', 'anthropic')).rejects.toThrow(
        /Failed to decrypt BYOK key/,
      );
    });

    it('throws CredentialError when encrypted with different master key', async () => {
      const differentMasterKey = randomBytes(32).toString('hex');
      const source = createMockSource({
        id: 'cred-wrong-key',
        tenantId: 'tenant-008',
        providerId: 'anthropic',
        encryptedKey: encrypt('sk-real-key', differentMasterKey),
        isActive: true,
      });
      const resolver = new CredentialResolver(source, MASTER_KEY);

      await expect(resolver.resolve('tenant-008', 'anthropic')).rejects.toThrow(CredentialError);
    });
  });

  // ─── BYOK preferred over vendor ───────────────────────────────────────

  describe('credential priority', () => {
    it('uses BYOK key even when vendor key is available', async () => {
      const byokKey = 'sk-byok-preferred';
      const source = createMockSource({
        id: 'cred-priority',
        tenantId: 'tenant-009',
        providerId: 'anthropic',
        encryptedKey: encryptKey(byokKey),
        isActive: true,
      });
      const envLookup = vi.fn().mockReturnValue('sk-vendor-also-available');
      const resolver = new CredentialResolver(source, MASTER_KEY, envLookup);

      const result = await resolver.resolve('tenant-009', 'anthropic');
      expect(result).toEqual({ apiKey: byokKey, isByok: true });
      // Vendor env lookup should NOT have been called
      expect(envLookup).not.toHaveBeenCalled();
    });
  });
});
