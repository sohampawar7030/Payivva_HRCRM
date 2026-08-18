import { ApiError } from '../utils/ApiError.js';

export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let details = err.details || null;

  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'A record with the same value already exists';
    errorCode = 'DUPLICATE_ENTRY';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 400;
    message = 'Referenced record does not exist';
    errorCode = 'INVALID_REFERENCE';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = `Upload error: ${err.message}`;
    errorCode = 'UPLOAD_ERROR';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Payload too large';
    errorCode = 'PAYLOAD_TOO_LARGE';
  } else if (err instanceof SyntaxError && 'body' in err) {
    status = 400;
    message = 'Invalid JSON payload';
    errorCode = 'INVALID_JSON';
  }

  if (status >= 500) {
    console.error('[error]', err);
  }

  const body = { success: false, message, errorCode };
  if (details && process.env.NODE_ENV !== 'production') body.details = details;
  res.status(status).json(body);
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'NOT_FOUND',
  });
}

export { ApiError };