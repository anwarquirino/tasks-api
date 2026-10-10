import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadOpenApiDocument } from '../src/docs/openapi.js';
import { createTestContext, type TestContext } from './helpers.js';

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';
const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'patch', 'put', 'delete'];

interface OpenApiPaths {
  paths: Record<string, Partial<Record<HttpMethod, { responses: Record<string, unknown> }>>>;
}

describe('documentação', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /openapi.yaml devolve o spec em YAML', async () => {
    const res = await request(ctx.app).get('/openapi.yaml').expect(200);

    expect(res.headers['content-type']).toContain('application/yaml');
    expect(res.text).toContain('openapi: 3.0.3');
  });

  it('GET /docs serve o Swagger UI', async () => {
    const res = await request(ctx.app).get('/docs/').expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('swagger-ui');
  });

  it('toda operação documentada existe e responde com um status previsto no spec', async () => {
    const { paths } = loadOpenApiDocument().document as unknown as OpenApiPaths;
    const operations = Object.entries(paths).flatMap(([path, item]) =>
      HTTP_METHODS.filter((method) => item[method]).map((method) => ({
        method,
        path: path.replace('{id}', '00000000-0000-4000-8000-000000000000'),
        documented: Object.keys(item[method]?.responses ?? {}),
      })),
    );

    expect(operations.length).toBeGreaterThanOrEqual(9);

    // Without body or token every route must still answer with a documented status
    // (200 for health, 400 for validation, 401 for protected routes), never 404/500.
    for (const op of operations) {
      const res = await request(ctx.app)[op.method](op.path);
      expect(op.documented, `${op.method.toUpperCase()} ${op.path} -> ${res.status}`).toContain(
        String(res.status),
      );
    }
  });
});
