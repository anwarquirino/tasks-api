import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { loadOpenApiDocument } from '../../docs/openapi.js';

/** Serves the raw OpenAPI spec at /openapi.yaml and Swagger UI at /docs. */
export function createDocsRouter(): Router {
  const { raw, document } = loadOpenApiDocument();
  const router = Router();

  router.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(raw);
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Tasks API - Documentação',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  return router;
}
