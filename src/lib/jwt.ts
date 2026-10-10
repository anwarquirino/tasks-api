import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import type { Env } from '../config/env.js';

const ALGORITHM = 'HS256';
const ISSUER = 'tasks-api';

export type TokenVerification =
  { ok: true; userId: string } | { ok: false; reason: 'expired' | 'invalid' };

export interface JwtService {
  sign(userId: string): Promise<string>;
  verify(token: string): Promise<TokenVerification>;
}

export function createJwtService(env: Pick<Env, 'JWT_SECRET' | 'JWT_EXPIRES_IN'>): JwtService {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  return {
    sign(userId) {
      return new SignJWT({})
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(env.JWT_EXPIRES_IN)
        .sign(secret);
    },

    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: [ALGORITHM],
          issuer: ISSUER,
        });
        if (!payload.sub) return { ok: false, reason: 'invalid' };
        return { ok: true, userId: payload.sub };
      } catch (err) {
        if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: 'expired' };
        return { ok: false, reason: 'invalid' };
      }
    },
  };
}
