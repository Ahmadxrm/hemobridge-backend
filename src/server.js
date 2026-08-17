'use strict';

require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/database');
const { runMigrations } = require('./database/migrate');
const { seedDefaultPlans } = require('./database/seeds/index');
const { initJobs } = require('./jobs');
const config = require('./config');
const logger = require('./utils/logger');

const PORT = config.port;

async function start() {
  logger.info(`Starting HemoBridge Backend (${config.env})...`);

  // ── 1. Database connection ─────────────────────────────────────────────
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // ── 2. Run pending migrations ─────────────────────────────────────────
  try {
    await runMigrations();
  } catch (err) {
    logger.error('Migration failed. Exiting.', { error: err.message });
    process.exit(1);
  }

  // ── 3. Seed default data ──────────────────────────────────────────────
  try {
    await seedDefaultPlans();
  } catch (err) {
    logger.warn('Default data seeding failed (non-fatal)', { error: err.message });
  }

  // ── 4. Start background jobs ──────────────────────────────────────────
  initJobs();

  // ── 5. Start HTTP server ──────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    logger.info(`HemoBridge API running on port ${PORT}`, {
      url: `http://localhost:${PORT}`,
      apiBase: `http://localhost:${PORT}/api/v1`,
    });
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      const { pool } = require('./config/database');
      await pool.end();
      logger.info('Database pool closed. Goodbye.');
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

start();
