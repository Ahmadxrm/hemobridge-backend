'use strict';

const notificationRepo = require('../../repositories/notification.repository');
const userRepo = require('../../repositories/user.repository');
const smsAdapter = require('../sms/termii.adapter');
const whatsappAdapter = require('../whatsapp/meta.adapter');
const emailAdapter = require('../email/sendgrid.adapter');
const voiceAdapter = require('../voice/africastalking.adapter');
const { NOTIFICATION_CHANNELS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Central Notification Service.
 *
 * Architecture:
 *   Business Event → NotificationService.dispatch() → Channel Selection
 *   → Provider Adapter → Delivery → Retry/Fallback → Notification Record
 *
 * ALL notification sending in the platform goes through this service.
 * No module should directly call Termii, SendGrid, WhatsApp, etc.
 */

/**
 * Channel adapter map.
 */
const ADAPTERS = {
  [NOTIFICATION_CHANNELS.SMS]: smsAdapter,
  [NOTIFICATION_CHANNELS.WHATSAPP]: whatsappAdapter,
  [NOTIFICATION_CHANNELS.EMAIL]: emailAdapter,
  [NOTIFICATION_CHANNELS.VOICE]: voiceAdapter,
  [NOTIFICATION_CHANNELS.IN_APP]: null, // in-app = DB record only
};

/**
 * Dispatch a notification to a user through one or more channels.
 *
 * @param {object} options
 * @param {string} options.userId - Target user ID
 * @param {string[]} options.channels - Preferred channels to use
 * @param {string} options.subject - Notification subject (for email)
 * @param {string} options.body - Notification body text
 * @param {string} [options.eventType] - Business event type for context
 * @param {string} [options.entityType] - Related entity type
 * @param {string} [options.entityId] - Related entity ID
 * @param {object} [options.templateData] - Template variables
 * @returns {Promise<Array>} Array of notification records
 */
async function dispatch({
  userId,
  channels,
  subject,
  body,
  eventType,
  entityType,
  entityId,
  templateData,
}) {
  // Fetch user to get contact details and preferences
  const user = await userRepo.findById(userId);
  if (!user) {
    logger.warn('Notification dispatch: user not found', { userId });
    return [];
  }

  // Get user's notification preferences
  const prefs = await notificationRepo.getPreferences(userId);

  // Determine effective channels (intersection of requested + enabled)
  const effectiveChannels = channels.filter((ch) => {
    if (!prefs) return true; // no prefs = all channels enabled
    switch (ch) {
      case NOTIFICATION_CHANNELS.SMS: return prefs.sms;
      case NOTIFICATION_CHANNELS.WHATSAPP: return prefs.whatsapp;
      case NOTIFICATION_CHANNELS.EMAIL: return prefs.email;
      case NOTIFICATION_CHANNELS.VOICE: return prefs.voice;
      case NOTIFICATION_CHANNELS.IN_APP: return prefs.in_app;
      default: return false;
    }
  });

  if (effectiveChannels.length === 0) {
    logger.info('No notification channels enabled for user', { userId });
    return [];
  }

  const results = [];

  for (const channel of effectiveChannels) {
    try {
      // Create notification record (initially PENDING)
      const notif = await notificationRepo.create({
        userId,
        channel,
        subject,
        body,
        recipientPhone: user.phone || null,
        recipientEmail: user.email || null,
        eventType,
        entityType,
        entityId,
        templateData,
      });

      // In-app notifications are stored only — no external delivery
      if (channel === NOTIFICATION_CHANNELS.IN_APP) {
        await notificationRepo.updateStatus(notif.id, 'SENT', {});
        results.push({ channel, notificationId: notif.id, success: true });
        continue;
      }

      const adapter = ADAPTERS[channel];
      if (!adapter) {
        logger.warn('No adapter for channel', { channel });
        await notificationRepo.markFailed(notif.id, 'No adapter configured');
        continue;
      }

      // Determine recipient contact for this channel
      const recipient = getRecipientForChannel(channel, user);
      if (!recipient) {
        logger.warn('No contact info for channel', { channel, userId });
        await notificationRepo.markFailed(notif.id, 'No recipient contact info');
        continue;
      }

      // Send via adapter
      const result = await adapter.send({ recipient, subject, body, templateData });

      if (result.success) {
        await notificationRepo.markSent(notif.id, result.providerRef || '', channel);
        logger.info('Notification sent', { channel, userId, notificationId: notif.id });
      } else {
        // Schedule retry if under max_retries
        const retryAt = new Date(Date.now() + 60000); // retry in 1 minute
        await notificationRepo.scheduleRetry(notif.id, retryAt);
        logger.warn('Notification delivery failed, scheduled retry', {
          channel,
          userId,
          error: result.error,
        });
      }

      results.push({
        channel,
        notificationId: notif.id,
        success: result.success,
        providerRef: result.providerRef,
      });
    } catch (err) {
      logger.error('Notification dispatch error', { channel, userId, error: err.message });
    }
  }

  return results;
}

/**
 * Get the appropriate contact field for a notification channel.
 */
function getRecipientForChannel(channel, user) {
  switch (channel) {
    case NOTIFICATION_CHANNELS.SMS:
    case NOTIFICATION_CHANNELS.VOICE:
    case NOTIFICATION_CHANNELS.WHATSAPP:
      return user.phone || null;
    case NOTIFICATION_CHANNELS.EMAIL:
      return user.email || null;
    default:
      return null;
  }
}

/**
 * Retry failed notifications.
 * Called by the background job on a schedule.
 */
async function retryFailedNotifications() {
  const pending = await notificationRepo.findPendingRetries();
  logger.info(`Retrying ${pending.length} failed notifications`);

  for (const notif of pending) {
    if (!notif.user_id) continue;

    const user = await userRepo.findById(notif.user_id);
    if (!user) continue;

    const adapter = ADAPTERS[notif.channel];
    if (!adapter) continue;

    const recipient = getRecipientForChannel(notif.channel, user);
    if (!recipient) continue;

    const result = await adapter.send({
      recipient,
      subject: notif.subject,
      body: notif.body,
    });

    if (result.success) {
      await notificationRepo.markSent(notif.id, result.providerRef || '', notif.channel);
    } else {
      if (notif.retry_count >= notif.max_retries - 1) {
        await notificationRepo.markFailed(notif.id, result.error || 'Max retries exceeded');
      } else {
        const nextRetry = new Date(Date.now() + (notif.retry_count + 1) * 2 * 60000);
        await notificationRepo.scheduleRetry(notif.id, nextRetry);
      }
    }
  }
}

/**
 * Convenience: notify a user that their OTP is ready.
 */
async function sendOTPNotification({ userId, otp, purpose, channel }) {
  const purposeLabels = {
    EMAIL_VERIFICATION: 'email verification',
    PHONE_VERIFICATION: 'phone verification',
    PASSWORD_RESET: 'password reset',
    LOGIN_2FA: 'login verification',
  };

  const label = purposeLabels[purpose] || 'verification';
  const body = `Your HemoBridge ${label} code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message.`;

  return dispatch({
    userId,
    channels: [channel || NOTIFICATION_CHANNELS.EMAIL],
    subject: `HemoBridge Verification Code`,
    body,
    eventType: 'OTP_SENT',
    entityType: 'USER',
    entityId: userId,
  });
}

/**
 * Notify donor of a donation request.
 */
async function notifyDonorOfRequest({ donorUserId, organizationName, bloodType, urgency }) {
  const urgencyText = urgency === 'CRITICAL' ? '🚨 CRITICAL EMERGENCY: ' : '';
  const body = `${urgencyText}${organizationName} urgently needs ${bloodType} blood. Your donation could save a life. Log in to HemoBridge to respond.`;

  return dispatch({
    userId: donorUserId,
    channels: [NOTIFICATION_CHANNELS.SMS, NOTIFICATION_CHANNELS.IN_APP],
    subject: 'Urgent Blood Donation Needed',
    body,
    eventType: 'DONATION_REQUEST_CREATED',
    entityType: 'DONATION_REQUEST',
  });
}

/**
 * Notify organisation of emergency request status change.
 */
async function notifyRequestStatusChange({ userId, requestId, newStatus, orgName }) {
  const messages = {
    APPROVED: `Your emergency blood request has been APPROVED by ${orgName}. The blood is being prepared for dispatch.`,
    REJECTED: `Your emergency blood request could not be fulfilled by ${orgName}. Please search for an alternative source.`,
    IN_TRANSIT: `The blood for your emergency request is now IN TRANSIT. You will be notified upon arrival.`,
    COMPLETED: `Your emergency blood request has been marked as COMPLETED. Thank you for using HemoBridge.`,
  };

  const body = messages[newStatus] || `Your blood request status has been updated to: ${newStatus}`;

  return dispatch({
    userId,
    channels: [NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.IN_APP],
    subject: `Blood Request Update: ${newStatus}`,
    body,
    eventType: 'REQUEST_STATUS_CHANGED',
    entityType: 'EMERGENCY_REQUEST',
    entityId: requestId,
  });
}

/**
 * Notify organisation of low stock.
 */
async function notifyLowStock({ userId, bloodType, currentQuantity, threshold, orgName }) {
  const body = `⚠️ LOW STOCK ALERT: Your ${bloodType} blood inventory at ${orgName} has dropped to ${currentQuantity} unit(s), below your threshold of ${threshold}. Please replenish stock or activate a donor mobilisation request.`;

  return dispatch({
    userId,
    channels: [NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.IN_APP],
    subject: `Low Blood Stock Alert: ${bloodType}`,
    body,
    eventType: 'LOW_STOCK_ALERT',
    entityType: 'BLOOD_INVENTORY',
  });
}

/**
 * Notify user of password reset.
 */
async function sendPasswordResetEmail({ userId, resetToken, frontendUrl }) {
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  const body = `You requested a password reset for your HemoBridge account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link expires in 60 minutes.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`;

  return dispatch({
    userId,
    channels: [NOTIFICATION_CHANNELS.EMAIL],
    subject: 'Reset Your HemoBridge Password',
    body,
    eventType: 'PASSWORD_RESET',
    entityType: 'USER',
    entityId: userId,
  });
}

/**
 * Notify organisation that it has been verified.
 */
async function notifyOrganizationVerified({ userId, orgName }) {
  const body = `Congratulations! Your organization "${orgName}" has been verified on HemoBridge. You now have full access to all platform features. Log in to get started.`;

  return dispatch({
    userId,
    channels: [NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.IN_APP],
    subject: 'Your Organization Has Been Verified',
    body,
    eventType: 'ORG_VERIFIED',
    entityType: 'ORGANIZATION',
  });
}

module.exports = {
  dispatch,
  retryFailedNotifications,
  sendOTPNotification,
  notifyDonorOfRequest,
  notifyRequestStatusChange,
  notifyLowStock,
  sendPasswordResetEmail,
  notifyOrganizationVerified,
};
