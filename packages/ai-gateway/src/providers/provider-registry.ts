import { ProviderUnavailableError } from '../errors/index.js';
import type { LLMProvider } from './llm-provider.interface.js';

/**
 * Registry of LLM provider adapters.
 * Adapters are registered at startup by provider ID string and
 * looked up at request time to route AI calls to the correct SDK.
 */
export class ProviderRegistry {
  private readonly adapters = new Map<string, LLMProvider>();

  /** Register a provider adapter. Overwrites if the same providerId already exists. */
  register(adapter: LLMProvider): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  /** Retrieve an adapter by provider ID. Throws if not registered. */
  get(providerId: string): LLMProvider {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new ProviderUnavailableError(
        new Error(`Provider "${providerId}" is not registered`),
      );
    }
    return adapter;
  }

  /** List all registered provider IDs. */
  listProviders(): string[] {
    return [...this.adapters.keys()];
  }

  /** Check whether a provider is registered. */
  has(providerId: string): boolean {
    return this.adapters.has(providerId);
  }
}
