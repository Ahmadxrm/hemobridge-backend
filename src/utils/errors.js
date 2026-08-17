'use strict';

/**
 * Application error classes.
 * Each class maps to a specific HTTP status code and error type.
 * Thrown from services/repositories and caught by the central error handler.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, type = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
    this.details = details;
    this.isOperational = true; // distinguishes app errors from programming bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

class BusinessRuleError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'BUSINESS_RULE_ERROR', details);
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service unavailable') {
    super(message, 503, 'EXTERNAL_SERVICE_ERROR');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BusinessRuleError,
  ExternalServiceError,
};
