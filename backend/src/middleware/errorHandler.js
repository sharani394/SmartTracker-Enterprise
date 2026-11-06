class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = error.statusCode || 500;
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected error occurred.';

  if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON.';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request data failed validation.';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_VALUE';
    message = 'A request value has an invalid format.';
  } else if (error.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A resource with one of these unique values already exists.';
  }

  if (statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred.';
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
