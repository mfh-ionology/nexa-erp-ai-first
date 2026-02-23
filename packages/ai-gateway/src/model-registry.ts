import { ModelNotFoundError } from './errors/index.js';
import type { AiModelConfig } from './types/index.js';

// Static model config loaded at module init (MVP — future E5 will use DB-backed registry)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import modelsJson from './config/models.json';

/**
 * Resolves AiModel records for the AI Gateway.
 *
 * MVP implementation uses a static JSON configuration file.
 * Future E5 story will migrate to a DB-backed AiModel registry.
 *
 * Models are cached in memory with a configurable TTL (for future
 * DB-backed version). Static config is loaded once at construction.
 */
export class ModelRegistry {
  private models: AiModelConfig[];
  private lastLoadedAt: number;
  private readonly cacheTtlMs: number;

  constructor(opts?: { cacheTtlMs?: number; models?: AiModelConfig[] }) {
    this.cacheTtlMs = opts?.cacheTtlMs ?? 5 * 60 * 1000; // 5-minute TTL
    this.models = opts?.models ?? (modelsJson as AiModelConfig[]);
    this.lastLoadedAt = Date.now();
  }

  /** Resolve a model by exact name. */
  resolveByName(name: string): AiModelConfig {
    this.refreshIfStale();
    const model = this.models.find((m) => m.name === name);
    if (!model) {
      throw new ModelNotFoundError({ modelName: name });
    }
    return model;
  }

  /** Resolve the best active model matching the requested routing tags. */
  resolveByTags(tags: string[]): AiModelConfig {
    this.refreshIfStale();
    // Score each model by how many requested tags it matches.
    // On tie, prefer the model whose first matching tag appears earliest
    // in the requested tags array (deterministic tie-breaking).
    let bestModel: AiModelConfig | undefined;
    let bestScore = 0;
    let bestFirstMatchIdx = Infinity;

    for (const model of this.models) {
      const matchingTags = tags.filter((t) => model.routingTags.includes(t));
      const score = matchingTags.length;
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
        bestFirstMatchIdx = tags.indexOf(matchingTags[0]!);
      } else if (score === bestScore && score > 0) {
        // Tie-break: prefer the model whose first matching tag was requested first
        const firstMatchIdx = tags.indexOf(matchingTags[0]!);
        if (firstMatchIdx < bestFirstMatchIdx) {
          bestModel = model;
          bestFirstMatchIdx = firstMatchIdx;
        }
      }
    }

    if (!bestModel || bestScore === 0) {
      throw new ModelNotFoundError({ routingTags: tags });
    }
    return bestModel;
  }

  /** Resolve the default model (where isDefault = true). */
  resolveDefault(): AiModelConfig {
    this.refreshIfStale();
    const model = this.models.find((m) => m.isDefault);
    if (!model) {
      // Fallback: return the first model if none marked as default
      const first = this.models[0];
      if (first) {
        return first;
      }
      throw new ModelNotFoundError({ modelName: 'default' });
    }
    return model;
  }

  /** List all registered models. */
  listModels(): AiModelConfig[] {
    this.refreshIfStale();
    return [...this.models];
  }

  /**
   * Refresh the model list if the cache TTL has expired.
   * For MVP (static JSON), this is a no-op since models don't change.
   * Future DB-backed version will re-query here.
   */
  private refreshIfStale(): void {
    const elapsed = Date.now() - this.lastLoadedAt;
    if (elapsed > this.cacheTtlMs) {
      // MVP: reload from static config (no-op effectively, but resets timer)
      this.lastLoadedAt = Date.now();
    }
  }
}
