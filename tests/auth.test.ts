import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthResult, PublicUser } from '../src/modules/auth/auth.service.js';
import { bearer, createTestContext, registerUser, TEST_ENV, type TestContext } from './helpers.js';

interface ErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

describe('autenticação', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /auth/register', () => {
    it('cria o usuário, normaliza o e-mail e devolve token sem expor a senha', async () => {
      const res = await request(ctx.app)
        .post('/auth/register')
        .send({ name: '  Ana Souza ', email: '  ANA@Example.com ', password: 'senha-forte-123' })
        .expect(201);

      const body = res.body as AuthResult;
      expect(body.user).toMatchObject({ name: 'Ana Souza', email: 'ana@example.com' });
      expect(body.user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof body.token).toBe('string');
      expect(body.user).not.toHaveProperty('password');
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('rejeita e-mail já cadastrado com 409, ignorando maiúsculas', async () => {
      await registerUser(ctx.app, { email: 'repetido@example.com' });

      const res = await request(ctx.app)
        .post('/auth/register')
        .send({ name: 'Outro', email: 'REPETIDO@example.com', password: 'senha-forte-123' })
        .expect(409);

      expect((res.body as ErrorBody).error.code).toBe('EMAIL_ALREADY_IN_USE');
    });

    it('rejeita dados inválidos com 400 e lista os problemas', async () => {
      const res = await request(ctx.app)
        .post('/auth/register')
        .send({ name: 'A', email: 'nao-e-email', password: '123' })
        .expect(400);

      const { error } = res.body as ErrorBody;
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((d) => d.path).sort()).toEqual(['email', 'name', 'password']);
    });
  });

  describe('POST /auth/login', () => {
    it('autentica com credenciais corretas e devolve um token válido', async () => {
      const user = await registerUser(ctx.app);

      const res = await request(ctx.app)
        .post('/auth/login')
        .send({ email: user.email.toUpperCase(), password: user.password })
        .expect(200);

      const body = res.body as AuthResult;
      expect(body.user.id).toBe(user.id);

      const me = await request(ctx.app).get('/auth/me').set(bearer(body.token)).expect(200);
      expect((me.body as PublicUser).email).toBe(user.email);
    });

    it('rejeita senha errada com 401 INVALID_CREDENTIALS', async () => {
      const user = await registerUser(ctx.app);

      const res = await request(ctx.app)
        .post('/auth/login')
        .send({ email: user.email, password: 'senha-errada-999' })
        .expect(401);

      expect((res.body as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejeita e-mail desconhecido com a mesma resposta de senha errada', async () => {
      const res = await request(ctx.app)
        .post('/auth/login')
        .send({ email: 'ninguem@example.com', password: 'qualquer-senha-123' })
        .expect(401);

      expect((res.body as ErrorBody).error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha incorretos',
      });
    });
  });

  describe('GET /auth/me', () => {
    it('responde 401 sem token', async () => {
      const res = await request(ctx.app).get('/auth/me').expect(401);
      expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
    });

    it('responde 401 com token inválido', async () => {
      const res = await request(ctx.app)
        .get('/auth/me')
        .set('Authorization', 'Bearer isso.nao.e.um.jwt')
        .expect(401);

      expect((res.body as ErrorBody).error.code).toBe('INVALID_TOKEN');
    });

    it('responde 401 com token assinado por outro segredo', async () => {
      const user = await registerUser(ctx.app);
      const forged = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuer('tasks-api')
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode('outro-segredo-qualquer-com-32-caracteres!'));

      const res = await request(ctx.app).get('/auth/me').set(bearer(forged)).expect(401);
      expect((res.body as ErrorBody).error.code).toBe('INVALID_TOKEN');
    });

    it('responde 401 TOKEN_EXPIRED com token vencido', async () => {
      const user = await registerUser(ctx.app);
      const expired = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuer('tasks-api')
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(TEST_ENV.JWT_SECRET));

      const res = await request(ctx.app).get('/auth/me').set(bearer(expired)).expect(401);
      expect((res.body as ErrorBody).error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('rate limit', () => {
    it('bloqueia tentativas de login além do limite com 429', async () => {
      const limited = await createTestContext({ AUTH_RATE_LIMIT_MAX: '3' });
      try {
        const attempt = () =>
          request(limited.app)
            .post('/auth/login')
            .send({ email: 'alvo@example.com', password: 'tentativa-123' });

        for (let i = 0; i < 3; i += 1) {
          await attempt().expect(401);
        }

        const res = await attempt().expect(429);
        expect((res.body as ErrorBody).error.code).toBe('TOO_MANY_REQUESTS');
      } finally {
        await limited.close();
      }
    });
  });
});
