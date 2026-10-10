import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

/** Limits login/registration attempts per IP to slow down brute force. */
export function createAuthRateLimiter(
  env: Pick<Env, 'AUTH_RATE_LIMIT_WINDOW_MS' | 'AUTH_RATE_LIMIT_MAX'>,
): RequestHandler {
  return rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(HttpError.tooManyRequests('Muitas tentativas. Tente novamente em alguns minutos.'));
    },
  });
}
