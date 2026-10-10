import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { createDb, type DatabaseHandle } from '../src/db/index.js';
import type { Task } from '../src/db/schema.js';
import type { AuthResult } from '../src/modules/auth/auth.service.js';

export const TEST_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DB_DRIVER: 'pglite',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres',
  JWT_EXPIRES_IN: '1h',
  // High enough that normal test traffic never trips the limiter.
  AUTH_RATE_LIMIT_MAX: '1000',
};

export interface TestContext {
  app: Express;
  env: Env;
  database: DatabaseHandle;
  close(): Promise<void>;
}

/** Boots a fresh in-memory PGlite database with migrations applied and an app on top of it. */
export async function createTestContext(overrides: NodeJS.ProcessEnv = {}): Promise<TestContext> {
  const env = loadEnv({ ...TEST_ENV, ...overrides });
  const database = await createDb(env);
  await database.migrate();
  const app = createApp({ env, db: database.db });

  return { app, env, database, close: () => database.close() };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
}

let userCounter = 0;

export async function registerUser(
  app: Express,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<TestUser> {
  userCounter += 1;
  const payload = {
    name: `Usuário ${userCounter}`,
    email: `user${userCounter}@example.com`,
    password: 'senha-forte-123',
    ...overrides,
  };

  const res = await request(app).post('/auth/register').send(payload).expect(201);
  const body = res.body as AuthResult;

  return { id: body.user.id, email: payload.email, password: payload.password, token: body.token };
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function createTask(
  app: Express,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Task> {
  const res = await request(app)
    .post('/tasks')
    .set(bearer(token))
    .send({ title: 'Tarefa de teste', ...overrides })
    .expect(201);
  return res.body as Task;
}
