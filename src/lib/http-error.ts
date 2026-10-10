export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * Error that maps directly to an HTTP response. Anything thrown as HttpError
 * is serialized by the error handler as `{ error: { code, message, details? } }`.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: ErrorDetail[], code = 'BAD_REQUEST'): HttpError {
    return new HttpError(400, code, message, details);
  }

  static unauthorized(message = 'Não autenticado', code = 'UNAUTHORIZED'): HttpError {
    return new HttpError(401, code, message);
  }

  static notFound(message = 'Recurso não encontrado', code = 'NOT_FOUND'): HttpError {
    return new HttpError(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT'): HttpError {
    return new HttpError(409, code, message);
  }

  static tooManyRequests(message: string, code = 'TOO_MANY_REQUESTS'): HttpError {
    return new HttpError(429, code, message);
  }
}
