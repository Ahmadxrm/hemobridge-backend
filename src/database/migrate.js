'use strict';

const path = require('path');
const fs = require('fs');
const { query, pool } = require('../config/database');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Ensure the migrations tracking table exists.
 */
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Get a list of already-applied migration filenames.
 */
async function getAppliedMigrations() {
  const result = await query(`SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id`);
  return result.rows.map((r) => r.filename);
}

/**
 * Get all migration files from the migrations directory, sorted.
 */
function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Run all pending migrations.
 */
async function runMigrations() {
  logger.info('Running database migrations...');
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();
  const pending = files.filter((f) => !applied.includes(f));

  if (pending.length === 0) {
    logger.info('Database is up to date. No pending migrations.');
    return;
  }

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    logger.info(`Applying migration: ${file}`);

    try {
      // Run entire migration file in a transaction
      await query('BEGIN');
      await query(sql);
      await query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
        [file]
      );
      await query('COMMIT');
      logger.info(`Migration applied: ${file}`);
    } catch (err) {
      await query('ROLLBACK');
      logger.error(`Migration failed: ${file}`, { error: err.message });
      throw err;
    }
  }

  logger.info(`Applied ${pending.length} migration(s) successfully.`);
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process complete.');
      pool.end();
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration process failed', { error: err.message });
      pool.end();
      process.exit(1);
    });
}

module.exports = { runMigrations };
