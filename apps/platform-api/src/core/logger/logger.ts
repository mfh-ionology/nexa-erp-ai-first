import type { LoggerOptions } from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

export const loggerOptions: LoggerOptions = {
  level: LOG_LEVEL,
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
};
