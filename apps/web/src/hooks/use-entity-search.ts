/**
 * Shared re-export of the entity search hook.
 *
 * The implementation lives in the AI feature module, but this hook is used
 * by cross-cutting components (e.g., AddLinkForm) that should not depend
 * directly on the AI feature's internal structure.
 *
 * If the AI module is refactored, only this file needs updating.
 */

export { useEntitySearch } from '@/features/ai/entity-mentions/use-entity-search';
