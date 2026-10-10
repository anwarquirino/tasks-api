import { Router, type RequestHandler } from 'express';
import type { Env } from '../../config/env.js';
import type { Database } from '../../db/index.js';
import type { JwtService } from '../../lib/jwt.js';
import { createAuthRateLimiter } from '../../middlewares/rate-limit.js';
import { validate } from '../../middlewares/validate.js';
import { createAuthController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { createAuthService } from './auth.service.js';

export interface AuthRouterDeps {
  db: Database;
  env: Env;
  jwt: JwtService;
  authenticate: RequestHandler;
}

export function createAuthRouter({ db, env, jwt, authenticate }: AuthRouterDeps): Router {
  const controller = createAuthController(createAuthService(db, jwt));
  const limiter = createAuthRateLimiter(env);
  const router = Router();

  router.post('/register', limiter, validate({ body: registerSchema }), controller.register);
  router.post('/login', limiter, validate({ body: loginSchema }), controller.login);
  router.get('/me', authenticate, controller.me);

  return router;
}
