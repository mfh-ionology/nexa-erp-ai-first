import type { FastifyReply } from 'fastify';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  cursor?: string | null;
  hasMore?: boolean;
  total?: number;
}

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  meta?: PaginationMeta,
  statusCode = 200,
): FastifyReply {
  const envelope: SuccessEnvelope<T> = { success: true, data };
  if (meta) {
    envelope.meta = meta;
  }
  return reply.status(statusCode).send(envelope);
}
