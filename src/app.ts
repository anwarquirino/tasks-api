import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import { createLogger, type Logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createHealthRouter } from './modules/health/health.routes.js';

export interface AppDeps {
  env: Env;
  logger?: Logger;
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({ env, logger = createLogger(env) }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', createHealthRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
