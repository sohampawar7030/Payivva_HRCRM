export class ApiError extends Error {
  constructor(statusCode, message, errorCode = 'ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (msg = 'Bad request', code = 'BAD_REQUEST', details) =>
    new ApiError(400, msg, code, details),
  unauthorized: (msg = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new ApiError(401, msg, code),
  forbidden: (msg = 'Forbidden', code = 'FORBIDDEN') => new ApiError(403, msg, code),
  notFound: (msg = 'Not found', code = 'NOT_FOUND') => new ApiError(404, msg, code),
  conflict: (msg = 'Conflict', code = 'CONFLICT') => new ApiError(409, msg, code),
  validation: (msg = 'Validation failed', details) => new ApiError(422, msg, 'VALIDATION_ERROR', details),
  internal: (msg = 'Internal server error', code = 'INTERNAL_ERROR') =>
    new ApiError(500, msg, code),
};