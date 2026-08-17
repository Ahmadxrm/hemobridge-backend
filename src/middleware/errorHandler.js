'use strict';

const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Central error handling middleware.
 * Must be registered LAST in the Express app (after all routes).
 * Transforms errors into consistent API responses.
 * Never exposes stack traces or internal details to clients.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Log the error
  const logContext = {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    error: err.message,
    code: err.code,
  };

  if (err.isOperational) {
    // Expected application error — log at warn level
    logger.warn('Operational error', logContext);
  } else {
    // Programming/unexpected error — log full stack
    logger.error('Unhandled error', { ...logContext, stack: err.stack });
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    return sendError(res, {
      statusCode: err.statusCode,
      type: err.type,
      message: err.message,
      details: err.details,
    });
  }

  // Handle Joi validation errors (thrown directly, not wrapped)
  if (err.isJoi) {
    return sendError(res, {
      statusCode: 400,
      type: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.details?.map((d) => ({
        field: d.path?.join('.'),
        message: d.message,
      })),
    });
  }

  // Handle PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return sendError(res, {
          statusCode: 409,
          type: 'CONFLICT_ERROR',
          message: 'A record with this information already exists.',
        });
      case '23503': // foreign_key_violation
        return sendError(res, {
          statusCode: 400,
          type: 'REFERENCE_ERROR',
          message: 'Referenced resource does not exist.',
        });
      case '23514': // check_violation
        return sendError(res, {
          statusCode: 400,
          type: 'CONSTRAINT_ERROR',
          message: 'Data violates a business constraint.',
        });
      case '22P02': // invalid_text_representation
        return sendError(res, {
          statusCode: 400,
          type: 'VALIDATION_ERROR',
          message: 'Invalid data format.',
        });
      default:
        break;
    }
  }

  // Unknown / unexpected errors
  return sendError(res, {
    statusCode: 500,
    type: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  });
}

/**
 * Handle 404 — route not found.
 */
function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: 404,
    type: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

module.exports = { errorHandler, notFoundHandler };
