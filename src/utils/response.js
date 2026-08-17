'use strict';

/**
 * Standard API response formatter.
 * All responses follow a consistent shape to simplify frontend integration.
 *
 * Supports both named options and positional arguments:
 *   sendSuccess(res, { statusCode, message, data, meta })
 *   sendSuccess(res, statusCode, message, data, meta)
 */

function sendSuccess(res, optionsOrStatusCode = {}, messageArg, dataArg, metaArg) {
  let statusCode, message, data, meta;

  if (typeof optionsOrStatusCode === 'object' && !Array.isArray(optionsOrStatusCode)) {
    // Named options style: sendSuccess(res, { statusCode, message, data, meta })
    ({ statusCode = 200, message = 'Success', data = {}, meta = {} } = optionsOrStatusCode);
  } else {
    // Positional style: sendSuccess(res, statusCode, message, data, meta)
    statusCode = optionsOrStatusCode || 200;
    message = messageArg || 'Success';
    data = dataArg !== undefined ? dataArg : {};
    meta = metaArg || {};
  }

  return res.status(statusCode).json({
    status: 'success',
    code: statusCode,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Send a paginated success response.
 * Supports both named options and positional arguments:
 *   sendPaginated(res, { statusCode, message, data, pagination })
 *   sendPaginated(res, statusCode, message, data, pagination)
 */
function sendPaginated(res, optionsOrStatusCode = {}, messageArg, dataArg, paginationArg) {
  let statusCode, message, data, pagination;

  if (typeof optionsOrStatusCode === 'object' && !Array.isArray(optionsOrStatusCode)) {
    ({ statusCode = 200, message = 'Success', data = [], pagination = {} } = optionsOrStatusCode);
  } else {
    statusCode = optionsOrStatusCode || 200;
    message = messageArg || 'Success';
    data = dataArg || [];
    pagination = paginationArg || {};
  }

  return res.status(statusCode).json({
    status: 'success',
    code: statusCode,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination,
    },
  });
}

/**
 * Send an error response.
 */
function sendError(res, { statusCode = 500, type = 'INTERNAL_ERROR', message = 'An error occurred', details } = {}) {
  const body = {
    status: 'error',
    code: statusCode,
    error: {
      type,
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    body.error.details = details;
  }

  return res.status(statusCode).json(body);
}

/**
 * Build a pagination meta object.
 */
function buildPagination({ page, limit, total }) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = { sendSuccess, sendPaginated, sendError, buildPagination };
