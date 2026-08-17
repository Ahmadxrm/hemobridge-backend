'use strict';

const winston = require('winston');
const config = require('../config');

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

// Development format: colourized, readable
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}]: ${stack || message}${metaStr}`;
  })
);

// Production format: structured JSON
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: config.env === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'hemobridge-backend' },
  transports: [
    new winston.transports.Console({
      silent: config.env === 'test',
    }),
  ],
});

// Add file transport in production
if (config.env === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
}

module.exports = logger;
