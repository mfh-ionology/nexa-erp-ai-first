import { CredentialError } from '../errors/index.js';
import type { CredentialResult } from '../types/index.js';
import { decrypt } from './encryption.js';

/** Shape of the BYOK credential record returned from the Platform API. */
export interface ByokCredential {
  id: string;
  tenantId: string;
  providerId: string;
  encryptedKey: string;
  isActive: boolean;
}

/** Fetches tenant BYOK credentials from the Platform API (or cache). */
export interface ByokCredentialSource {
  getCredential(tenantId: string, providerId: string): Promise<ByokCredential | null>;
}

/** Mapping from provider ID to env-var name for vendor API keys. */
const VENDOR_KEY_ENV_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

/**
 * Resolves API credentials for a given tenant and provider.
 *
 * Resolution order:
 * 1. Tenant BYOK key from `TenantProviderCredential` (via Platform API or cache)
 * 2. Vendor platform key from environment variables
 *
 * Throws `CredentialError` if neither source has a key.
 */
export class CredentialResolver {
  constructor(
    private readonly byokSource: ByokCredentialSource,
    private readonly masterKeyHex: string,
    private readonly envLookup: (key: string) => string | undefined = (k) => process.env[k],
  ) {}

  async resolve(tenantId: string, providerId: string): Promise<CredentialResult> {
    // 1. Try tenant BYOK key
    const byok = await this.byokSource.getCredential(tenantId, providerId);
    if (byok && byok.isActive) {
      try {
        const apiKey = decrypt(byok.encryptedKey, this.masterKeyHex);
        return { apiKey, isByok: true };
      } catch (err) {
        throw new CredentialError(
          providerId,
          `Failed to decrypt BYOK key for tenant "${tenantId}": ${(err as Error).message}`,
        );
      }
    }

    // 2. Fall back to vendor platform key from env
    const envVarName = VENDOR_KEY_ENV_MAP[providerId];
    if (envVarName) {
      const apiKey = this.envLookup(envVarName);
      if (apiKey) {
        return { apiKey, isByok: false };
      }
    }

    // 3. No credentials available
    throw new CredentialError(
      providerId,
      `No credentials available for provider "${providerId}" (tenant "${tenantId}"). ` +
        `No active BYOK key found and ${VENDOR_KEY_ENV_MAP[providerId] ?? `no env var mapped for "${providerId}"`} is not set.`,
    );
  }
}
