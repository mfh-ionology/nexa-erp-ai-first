import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { eventBus, type EventBus } from './event-bus.js';

declare module 'fastify' {
  interface FastifyInstance {
    eventBus: EventBus;
  }
}

const eventBusPluginFn: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('eventBus', eventBus);
  eventBus.setLogger(fastify.log);

  // Graceful shutdown — drain pending handlers before server exits
  fastify.addHook('onClose', async () => {
    await eventBus.drain();
    eventBus.setLogger(null);
  });
};

export const eventBusPlugin = fp(eventBusPluginFn, { name: 'event-bus' });
