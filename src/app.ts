import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import './config/zod-locale.js';
import type { Database } from './db/index.js';
import { createJwtService } from './lib/jwt.js';
import { createLogger, type Logger } from './lib/logger.js';
import { createAuthMiddleware } from './middlewares/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createTasksRouter } from './modules/tasks/tasks.routes.js';

export interface AppDeps {
  env: Env;
  db: Database;
  logger?: Logger;
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({ env, db, logger = createLogger(env) }: AppDeps): Express {
  const app = express();
  const jwt = createJwtService(env);
  const authenticate = createAuthMiddleware(jwt, db);

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', createHealthRouter(db));
  app.use('/auth', createAuthRouter({ db, env, jwt, authenticate }));
  app.use('/tasks', authenticate, createTasksRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
