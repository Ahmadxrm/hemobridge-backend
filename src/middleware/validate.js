'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Validation middleware factory.
 * Validates request body, query, or params against a Joi schema.
 *
 * @param {import('joi').Schema} schema - Joi schema
 * @param {'body'|'query'|'params'} source - Which part of the request to validate
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, "'"),
      }));

      return next(
        new ValidationError(
          `Validation failed: ${details.map((d) => d.message).join('; ')}`,
          details
        )
      );
    }

    // Replace with sanitised/converted value
    req[source] = value;
    next();
  };
}

module.exports = { validate };
