import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError, type ErrorDetail } from '../lib/http-error.js';

interface ErrorBody {
  error: { code: string; message: string; details?: ErrorDetail[] };
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
): void {
  const body: ErrorBody = { error: { code, message } };
  if (details && details.length > 0) body.error.details = details;
  res.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Rota ${req.method} ${req.path} não encontrada`);
};

/** Shape of the errors thrown by express.json() (body-parser). */
interface BodyParserError extends Error {
  type?: string;
  status?: number;
  expose?: boolean;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return err instanceof Error && typeof (err as BodyParserError).type === 'string';
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof HttpError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Dados inválidos', details);
    return;
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      sendError(res, 400, 'INVALID_JSON', 'O corpo da requisição não é um JSON válido');
      return;
    }
    if (err.type === 'entity.too.large') {
      sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'O corpo da requisição é grande demais');
      return;
    }
    if (err.status && err.status >= 400 && err.status < 500) {
      sendError(res, err.status, 'BAD_REQUEST', 'Requisição malformada');
      return;
    }
  }

  req.log.error({ err }, 'Erro não tratado');
  sendError(res, 500, 'INTERNAL_ERROR', 'Erro interno do servidor');
};
