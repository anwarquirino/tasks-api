import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and normalizes request data with zod. The parsed output replaces
 * the raw input so downstream handlers get defaults and coercions applied.
 * ZodError is thrown synchronously and turned into a 400 by the error handler.
 */
export function validate({ body, query, params }: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    if (body) {
      req.body = body.parse(req.body);
    }
    if (params) {
      req.params = params.parse(req.params) as typeof req.params;
    }
    if (query) {
      // In Express 5 `req.query` is a getter, so it has to be redefined instead of assigned.
      Object.defineProperty(req, 'query', {
        value: query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}
