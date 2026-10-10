import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Database } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import { HttpError } from '../../lib/http-error.js';
import type { JwtService } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  getProfile(userId: string): Promise<PublicUser>;
}

/** Columns safe to expose: the password hash never leaves the service. */
const publicUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
};

export function createAuthService(db: Database, jwt: JwtService): AuthService {
  // Hash compared when the e-mail does not exist, so a failed login takes
  // roughly the same time either way and does not reveal registered e-mails.
  const dummyHash = hashPassword(randomBytes(16).toString('hex'));

  return {
    async register(input) {
      const passwordHash = await hashPassword(input.password);

      let user: PublicUser | undefined;
      try {
        [user] = await db
          .insert(users)
          .values({ name: input.name, email: input.email, passwordHash })
          .returning(publicUserColumns);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw HttpError.conflict('Já existe um usuário com este e-mail', 'EMAIL_ALREADY_IN_USE');
        }
        throw err;
      }

      if (!user) {
        throw new Error('O banco não retornou o usuário criado');
      }

      return { user, token: await jwt.sign(user.id) };
    },

    async login(input) {
      const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
      const passwordMatches = await verifyPassword(
        input.password,
        user?.passwordHash ?? (await dummyHash),
      );

      if (!user || !passwordMatches) {
        throw HttpError.unauthorized('E-mail ou senha incorretos', 'INVALID_CREDENTIALS');
      }

      const { id, name, email, createdAt } = user;
      return { user: { id, name, email, createdAt }, token: await jwt.sign(user.id) };
    },

    async getProfile(userId) {
      const user = await db.query.users.findFirst({
        columns: { id: true, name: true, email: true, createdAt: true },
        where: eq(users.id, userId),
      });
      if (!user) {
        throw HttpError.notFound('Usuário não encontrado', 'USER_NOT_FOUND');
      }
      return user;
    },
  };
}
