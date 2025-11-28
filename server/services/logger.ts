import winston from 'winston';

const isDevelopment = process.env.NODE_ENV === 'development';

// Winston logger configuration with structured JSON logging
export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hexad-ai' },
  transports: [
    // Console output with formatting
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
    // File logging (production)
    ...(isDevelopment ? [] : [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ]),
  ],
});

// Export helpers for structured logging
export const logRequest = (method: string, path: string, duration: number, status: number) => {
  logger.info('HTTP Request', { method, path, duration_ms: duration, status });
};

export const logError = (message: string, error: Error, context?: Record<string, unknown>) => {
  logger.error(message, { error: error.message, stack: error.stack, ...context });
};

export const logDatabase = (query: string, duration: number, rows?: number) => {
  logger.debug('Database Query', { query, duration_ms: duration, rows_affected: rows });
};

export const logJob = (jobName: string, status: 'started' | 'completed' | 'failed', duration?: number, error?: Error) => {
  const level = status === 'failed' ? 'error' : 'info';
  logger[level as 'info' | 'error'](`Job ${jobName}`, { status, duration_ms: duration, error: error?.message });
};
