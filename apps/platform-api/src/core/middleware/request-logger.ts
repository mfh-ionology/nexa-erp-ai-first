import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const requestLoggerPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook('onRequest', (request, _reply, done) => {
    request.log = request.log.child({
      correlationId: request.correlationId,
    });
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'request completed',
    );
    done();
  });
};

export const requestLoggerPlugin = fp(requestLoggerPluginFn, {
  name: 'request-logger',
  dependencies: ['correlation-id'],
});
