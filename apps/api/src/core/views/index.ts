import type { FastifyInstance } from 'fastify';

import { viewRoutesPlugin } from './views.routes.js';

export { applyViewFilters } from './apply-view-filters.js';

// ---------------------------------------------------------------------------
// Views module Fastify plugin
// Registers all views routes under the /views prefix.
//
// Route layout:
//   GET    /views/init                             Bundled init
//   GET    /views/data-views                       List all data views
//   GET    /views/data-views/:viewKey/fields       Get field metadata
//   GET    /views/date-presets                      List date presets
//   GET    /views/saved                             List saved views
//   POST   /views/saved                             Create saved view
//   PATCH  /views/saved/:id                         Update saved view
//   DELETE /views/saved/:id                         Delete saved view
//   GET    /views/favourites                        List favourites
//   POST   /views/saved/:id/set-default             Set as default
//   POST   /views/saved/:id/toggle-favourite        Toggle favourite
//   GET    /views/columns/:viewKey                  Get column preferences
//   PUT    /views/columns/:viewKey                  Bulk upsert column prefs
//   PATCH  /views/columns/:viewKey/:fieldId/width   Update single width
//   POST   /views/lov/batch                         Batch LOV fetch
//   GET    /views/lov/:lovScope                     Single LOV fetch
// ---------------------------------------------------------------------------

async function viewsModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(viewRoutesPlugin);
}

export const viewsModulePlugin = viewsModule;
