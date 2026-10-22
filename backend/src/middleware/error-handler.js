import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'The requested endpoint was not found.'));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let status = error instanceof HttpError ? error.status : 500;
  let code = error instanceof HttpError ? error.code : 'INTERNAL_SERVER_ERROR';
  let message = error instanceof HttpError ? error.message : 'An unexpected error occurred.';

  if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contains invalid data.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
    message = 'The request body exceeds the allowed size.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body must contain valid JSON.';
  } else if (error.message === 'Origin not allowed') {
    status = 403;
    code = 'CORS_ORIGIN_DENIED';
    message = 'This origin is not allowed to access the API.';
  }

  if (status >= 500) {
    req.log?.error({ err: error }, 'Request failed');
  }

  return res.status(status).json({
    success: false,
    error: { code, message }
  });
}
