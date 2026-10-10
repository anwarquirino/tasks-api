import type { AuthUser } from '../middlewares/auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the auth middleware after validating the bearer token. */
      user?: AuthUser;
    }
  }
}

export {};
