import type { FastifyInstance } from 'fastify';

import { attachmentRoutesPlugin } from './attachment.routes.js';
import { noteRoutesPlugin } from './note.routes.js';
import { recordLinkRoutesPlugin } from './record-link.routes.js';
import { taskRoutesPlugin } from './task.routes.js';

// ---------------------------------------------------------------------------
// Cross-cutting module plugin
// Registers cross-cutting routes (attachments, notes, record-links).
//
// Route layout:
//   POST   /attachments/presign
//   POST   /attachments/confirm
//   GET    /attachments/:id/download
//   DELETE /attachments/:id
//   GET    /attachments
//
//   POST   /notes
//   GET    /notes
//   PATCH  /notes/:id
//   DELETE /notes/:id
//   PATCH  /notes/:id/pin
//
//   POST   /record-links
//   GET    /record-links
//   DELETE /record-links/:id
//
//   GET    /tasks
//   GET    /tasks/my
//   GET    /tasks/:id
//   POST   /tasks
//   PATCH  /tasks/:id
//   PATCH  /tasks/:id/status
//   POST   /tasks/:id/assignees
//   DELETE /tasks/:id/assignees/:userId
//   DELETE /tasks/:id
// ---------------------------------------------------------------------------

async function crossCuttingModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(attachmentRoutesPlugin);
  await fastify.register(noteRoutesPlugin);
  await fastify.register(recordLinkRoutesPlugin);
  await fastify.register(taskRoutesPlugin);
}

export const crossCuttingModulePlugin = crossCuttingModule;
