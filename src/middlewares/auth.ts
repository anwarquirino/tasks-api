import { eq } from 'drizzle-orm';
import type { Request, RequestHandler } from 'express';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { HttpError } from '../lib/http-error.js';
import type { JwtService } from '../lib/jwt.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token.trim();
}

/**
 * Validates the `Authorization: Bearer <token>` header and loads the user.
 * Looking the user up on every request means deleted accounts lose access
 * immediately, even if their token has not expired yet.
 */
export function createAuthMiddleware(jwt: JwtService, db: Database): RequestHandler {
  return async (req, _res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw HttpError.unauthorized('Token de acesso ausente');
    }

    const verification = await jwt.verify(token);
    if (!verification.ok) {
      throw verification.reason === 'expired'
        ? HttpError.unauthorized('Token expirado', 'TOKEN_EXPIRED')
        : HttpError.unauthorized('Token inválido', 'INVALID_TOKEN');
    }

    const user = await db.query.users.findFirst({
      columns: { id: true, name: true, email: true },
      where: eq(users.id, verification.userId),
    });
    if (!user) {
      throw HttpError.unauthorized('Token inválido', 'INVALID_TOKEN');
    }

    req.user = user;
    next();
  };
}

/** Returns the authenticated user; only call from routes behind the auth middleware. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw HttpError.unauthorized();
  }
  return req.user;
}
