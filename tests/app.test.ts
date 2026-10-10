import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';

describe('aplicação', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /health responde ok com o banco acessível', async () => {
    const res = await request(ctx.app).get('/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('rota desconhecida responde 404 no formato padrão de erro', async () => {
    const res = await request(ctx.app).get('/nao-existe').expect(404);

    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota GET /nao-existe não encontrada' },
    });
  });

  it('JSON malformado responde 400 INVALID_JSON', async () => {
    const res = await request(ctx.app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);

    expect(res.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
  });

  it('aplica cabeçalhos de segurança e oculta o X-Powered-By', async () => {
    const res = await request(ctx.app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
