'use strict';

const cron = require('node-cron');
const inventoryRepo = require('../repositories/inventory.repository');
const otpRepo = require('../repositories/otp.repository');
const orgRepo = require('../repositories/organization.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { query } = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Background Jobs Module.
 *
 * Initialises and registers all scheduled jobs.
 * Jobs are designed to be safe to run multiple times (idempotent).
 */

let jobsRegistered = false;

/**
 * Job: Mark expired blood inventory units.
 * Runs every hour.
 */
async function processExpiredInventory() {
  logger.info('[JOB] Processing expired blood inventory...');
  try {
    const expired = await inventoryRepo.markExpired();
    if (expired.length > 0) {
      logger.info(`[JOB] Marked ${expired.length} inventory unit(s) as expired`);
    }
  } catch (err) {
    logger.error('[JOB] Error processing expired inventory', { error: err.message });
  }
}

/**
 * Job: Check for low-stock conditions across all organisations.
 * Sends alerts when blood inventory drops below an org's threshold.
 * Runs every 30 minutes.
 */
async function checkLowStock() {
  logger.info('[JOB] Checking low stock levels...');
  try {
    const lowStockItems = await inventoryRepo.findLowStock();

    if (lowStockItems.length === 0) {
      logger.info('[JOB] No low stock conditions found');
      return;
    }

    logger.info(`[JOB] Found ${lowStockItems.length} low stock item(s)`);

    for (const item of lowStockItems) {
      const orgId = item.organization_id;
      const bloodType = item.blood_type;

      // Dedup: Check if an unresolved alert already exists for this org+bloodType
      const existingAlert = await query(
        `SELECT id FROM low_stock_alerts
         WHERE organization_id = $1 AND blood_type = $2 AND is_resolved = false`,
        [orgId, bloodType]
      );

      if (existingAlert.rows.length > 0) {
        // Alert already active — do not spam
        continue;
      }

      // Create new alert record
      await query(
        `INSERT INTO low_stock_alerts
         (organization_id, blood_type, current_quantity, threshold, notification_sent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [orgId, bloodType, item.units_available, item.low_stock_threshold, false]
      );

      // Fetch org to get user_id for notification
      const org = await orgRepo.findById(orgId);
      if (!org) continue;

      // Send notification via central service
      await notificationService.notifyLowStock({
        userId: org.user_id,
        bloodType,
        currentQuantity: item.units_available,
        threshold: item.low_stock_threshold,
        orgName: org.name,
      });

      // Mark alert notification as sent
      await query(
        `UPDATE low_stock_alerts SET notification_sent = true
         WHERE organization_id = $1 AND blood_type = $2 AND is_resolved = false`,
        [orgId, bloodType]
      );

      logger.info('[JOB] Low stock alert sent', { orgId, bloodType, quantity: item.units_available });
    }

    // Resolve alerts where stock is back above threshold
    await query(`
      UPDATE low_stock_alerts lsa
      SET is_resolved = true, resolved_at = NOW()
      FROM blood_inventory bi
      WHERE lsa.organization_id = bi.organization_id
        AND lsa.blood_type = bi.blood_type
        AND lsa.is_resolved = false
        AND bi.units_available > (
          SELECT low_stock_threshold FROM organizations WHERE id = lsa.organization_id
        )
    `);
  } catch (err) {
    logger.error('[JOB] Error checking low stock', { error: err.message });
  }
}

/**
 * Job: Clean up expired OTPs.
 * Runs every 15 minutes.
 */
async function cleanExpiredOTPs() {
  logger.info('[JOB] Cleaning expired OTPs...');
  try {
    const deleted = await otpRepo.deleteExpired();
    if (deleted > 0) {
      logger.info(`[JOB] Deleted ${deleted} expired OTP(s)`);
    }
  } catch (err) {
    logger.error('[JOB] Error cleaning expired OTPs', { error: err.message });
  }
}

/**
 * Job: Retry failed notifications.
 * Runs every 5 minutes.
 */
async function retryNotifications() {
  try {
    await notificationService.retryFailedNotifications();
  } catch (err) {
    logger.error('[JOB] Error retrying notifications', { error: err.message });
  }
}

/**
 * Job: Clean up expired sessions.
 * Runs every day at 2am.
 */
async function cleanExpiredSessions() {
  logger.info('[JOB] Cleaning expired sessions...');
  try {
    const result = await query(
      `DELETE FROM sessions WHERE expires_at < NOW() RETURNING id`
    );
    if (result.rowCount > 0) {
      logger.info(`[JOB] Deleted ${result.rowCount} expired session(s)`);
    }
  } catch (err) {
    logger.error('[JOB] Error cleaning expired sessions', { error: err.message });
  }
}

/**
 * Job: Clean up expired password reset tokens.
 * Runs every hour.
 */
async function cleanExpiredResetTokens() {
  try {
    await query(
      `DELETE FROM password_reset_tokens WHERE expires_at < NOW()`
    );
  } catch (err) {
    logger.error('[JOB] Error cleaning password reset tokens', { error: err.message });
  }
}

/**
 * Job: Check for expired subscriptions and mark them.
 * Runs daily at 1am.
 */
async function processExpiredSubscriptions() {
  logger.info('[JOB] Processing expired subscriptions...');
  try {
    const result = await query(`
      UPDATE subscriptions
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE status IN ('ACTIVE', 'TRIAL')
        AND ends_at < NOW()
      RETURNING id, organization_id
    `);

    if (result.rowCount > 0) {
      logger.info(`[JOB] Marked ${result.rowCount} subscription(s) as expired`);
    }
  } catch (err) {
    logger.error('[JOB] Error processing expired subscriptions', { error: err.message });
  }
}

/**
 * Initialise and start all background jobs.
 * Safe to call only once.
 */
function initJobs() {
  if (jobsRegistered) {
    logger.warn('Background jobs already registered. Skipping.');
    return;
  }

  // Don't run jobs in test environment
  if (config.env === 'test') {
    logger.info('Skipping background jobs in test environment.');
    return;
  }

  logger.info('Initialising background jobs...');

  // Every 5 minutes: retry failed notifications
  cron.schedule('*/5 * * * *', retryNotifications, {
    name: 'retry-notifications',
  });

  // Every 15 minutes: clean expired OTPs
  cron.schedule('*/15 * * * *', cleanExpiredOTPs, {
    name: 'clean-expired-otps',
  });

  // Every 30 minutes: check low stock
  const intervalMinutes = config.lowStock.checkIntervalMinutes || 30;
  cron.schedule(`*/${intervalMinutes} * * * *`, checkLowStock, {
    name: 'check-low-stock',
  });

  // Every hour: mark expired inventory + clean reset tokens
  cron.schedule('0 * * * *', async () => {
    await processExpiredInventory();
    await cleanExpiredResetTokens();
  }, {
    name: 'hourly-cleanup',
  });

  // Daily at 1am: process expired subscriptions
  cron.schedule('0 1 * * *', processExpiredSubscriptions, {
    name: 'process-expired-subscriptions',
  });

  // Daily at 2am: clean expired sessions
  cron.schedule('0 2 * * *', cleanExpiredSessions, {
    name: 'clean-expired-sessions',
  });

  jobsRegistered = true;
  logger.info('Background jobs registered successfully.');
}

module.exports = {
  initJobs,
  // Export individual functions for testing/manual trigger
  processExpiredInventory,
  checkLowStock,
  cleanExpiredOTPs,
  retryNotifications,
  cleanExpiredSessions,
  processExpiredSubscriptions,
};
