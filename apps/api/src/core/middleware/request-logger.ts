import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const requestLoggerPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  // onRequest: rebind request.log to a child logger with correlationId
  // so every log emitted during the request lifecycle includes it.
  fastify.addHook('onRequest', (request, _reply, done) => {
    request.log = request.log.child({
      correlationId: request.correlationId,
    });
    done();
  });

  // onResponse: log request completion with method, url, statusCode, responseTime.
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
