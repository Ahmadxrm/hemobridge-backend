'use strict';

const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool(config.db);

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a single query against the pool.
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { query: text, duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Database query error', {
      query: text,
      error: err.message,
      code: err.code,
    });
    throw err;
  }
}

/**
 * Get a dedicated client from the pool for transaction use.
 * ALWAYS release the client in a finally block.
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  // Override release to track lingering clients
  let released = false;
  client.release = () => {
    if (released) return;
    released = true;
    release();
  };

  // Wrap query for logging
  client.query = async (text, params) => {
    const start = Date.now();
    try {
      const result = await originalQuery(text, params);
      const duration = Date.now() - start;
      logger.debug('Transaction query', { query: text, duration, rows: result.rowCount });
      return result;
    } catch (err) {
      logger.error('Transaction query error', { query: text, error: err.message });
      throw err;
    }
  };

  return client;
}

/**
 * Execute a function within a database transaction.
 * Automatically commits on success and rolls back on error.
 * @param {function(import('pg').PoolClient): Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Test the database connection.
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() AS now, version() AS version');
    logger.info('Database connection established', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ').slice(0, 2).join(' '),
    });
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    return false;
  }
}

module.exports = { pool, query, getClient, withTransaction, testConnection };
