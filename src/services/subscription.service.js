'use strict';

const subscriptionRepo = require('../repositories/subscription.repository');
const orgRepo = require('../repositories/organization.repository');
const auditRepo = require('../repositories/audit.repository');
const paystackAdapter = require('../integrations/payments/paystack.adapter');
const { query } = require('../config/database');
const { NotFoundError, BusinessRuleError, ConflictError } = require('../utils/errors');
const { AUDIT_EVENTS, SUBSCRIPTION_STATUS } = require('../utils/constants');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Subscription & Payment Service.
 * IMPORTANT: Payments NEVER block emergency requests or blood search.
 * Subscription management is completely isolated.
 */

/**
 * Get all active plans.
 */
async function getPlans() {
  const plans = await subscriptionRepo.findPlans();
  return plans.map(formatPlan);
}

/**
 * Create a subscription for an organisation.
 * For the MVP, initiates a Paystack payment if the plan has a cost.
 */
async function createSubscription(data, actorUser, req) {
  // Find the org
  const org = await orgRepo.findByUserId(actorUser.id);
  if (!org) throw new NotFoundError('Organisation not found');

  const orgId = data.orgId || org.id;
  const planId = data.planId;

  // Only allow orgs to subscribe for themselves
  if (org.id !== orgId && actorUser.role !== 'ADMIN') {
    throw new BusinessRuleError('You can only manage your own subscription');
  }

  // Find the plan
  const plan = await subscriptionRepo.findPlanById(planId);
  if (!plan || !plan.is_active) throw new NotFoundError('Plan not found or unavailable');

  // Check for existing active subscription
  const existing = await subscriptionRepo.findActiveSubscription(orgId);
  if (existing && ['ACTIVE', 'TRIAL'].includes(existing.status)) {
    throw new ConflictError('Organisation already has an active subscription');
  }

  // If plan is free / trial only
  if (plan.price_kobo === 0) {
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);

    const sub = await subscriptionRepo.create({
      organizationId: orgId,
      planId,
      status: SUBSCRIPTION_STATUS.TRIAL,
      trialStartsAt: trialStart,
      trialEndsAt: trialEnd,
    });

    await auditRepo.log({
      actorId: actorUser.id,
      actorRole: actorUser.role,
      action: AUDIT_EVENTS.SUBSCRIPTION_ACTIVATED,
      entityType: 'SUBSCRIPTION',
      entityId: sub.id,
      metadata: { planId, status: 'TRIAL' },
      ipAddress: req?.ip,
    });

    return { subscription: sub, requiresPayment: false };
  }

  // Paid plan — initiate Paystack payment
  const reference = `hb-${orgId.slice(0, 8)}-${uuidv4().slice(0, 8)}`;

  // Create pending payment record
  const payment = await subscriptionRepo.createPayment({
    organizationId: orgId,
    planId,
    amountKobo: plan.price_kobo,
    currency: plan.currency,
    provider: 'paystack',
    providerRef: reference,
  });

  // Create pending subscription
  const sub = await subscriptionRepo.create({
    organizationId: orgId,
    planId,
    status: SUBSCRIPTION_STATUS.TRIAL, // will become ACTIVE on payment success
    trialStartsAt: new Date(),
    trialEndsAt: new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000),
  });

  // Initiate Paystack transaction
  const paystackResult = await paystackAdapter.initiatePayment({
    email: org.email,
    amountKobo: plan.price_kobo,
    reference,
    metadata: {
      orgId,
      planId,
      subscriptionId: sub.id,
      paymentId: payment.id,
    },
  });

  return {
    subscription: sub,
    payment: { id: payment.id, reference },
    requiresPayment: true,
    checkoutUrl: paystackResult.authorizationUrl,
    paymentReference: reference,
  };
}

/**
 * Process an incoming Paystack webhook event.
 * This is the ONLY place we activate subscriptions based on payment.
 * Idempotent: duplicate events are safely ignored.
 */
async function processPaystackWebhook(body, rawBody, signature) {
  // Verify signature
  const isValid = paystackAdapter.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn('Invalid Paystack webhook signature received');
    throw new BusinessRuleError('Invalid webhook signature');
  }

  const event = typeof body === 'string' ? JSON.parse(body) : body;
  const eventType = event.event;
  const data = event.data;
  const reference = data?.reference;

  if (!reference) {
    logger.warn('Webhook event missing reference', { eventType });
    return { processed: false, reason: 'No reference' };
  }

  // Idempotency check — record event, skip if already processed
  const { inserted, row } = await subscriptionRepo.recordWebhookEvent({
    provider: 'paystack',
    eventType,
    providerRef: reference,
    payload: event,
  });

  if (!inserted) {
    logger.info('Duplicate webhook event ignored', { eventType, reference });
    return { processed: false, reason: 'Duplicate event' };
  }

  try {
    logger.info('Processing Paystack webhook', { eventType, reference });

    if (eventType === 'charge.success') {
      await handleChargeSuccess(data, reference);
    } else if (eventType === 'subscription.disable') {
      await handleSubscriptionDisable(data);
    } else {
      logger.info('Unhandled Paystack event type', { eventType });
    }

    await subscriptionRepo.markWebhookProcessed(row.id);
    logger.info('Webhook processed successfully', { eventType, reference });
    return { processed: true };
  } catch (err) {
    logger.error('Webhook processing error', { eventType, reference, error: err.message });
    // Mark as failed but don't re-throw (Paystack will retry)
    await query(
      'UPDATE payment_events SET error_message = $1 WHERE id = $2',
      [err.message, row.id]
    );
    return { processed: false, error: err.message };
  }
}

/**
 * Handle a successful charge from Paystack.
 */
async function handleChargeSuccess(data, reference) {
  const metadata = data.metadata || {};
  const { orgId, planId, subscriptionId, paymentId } = metadata;

  if (!orgId || !planId) {
    logger.warn('Webhook charge.success missing metadata', { reference });
    return;
  }

  // Update payment record
  if (paymentId) {
    await subscriptionRepo.updatePayment(paymentId, {
      status: 'SUCCESS',
      provider_response: data,
      completed_at: new Date(),
    });
  } else {
    // Look up payment by reference
    const payment = await subscriptionRepo.findPaymentByProviderRef(reference);
    if (payment) {
      await subscriptionRepo.updatePayment(payment.id, {
        status: 'SUCCESS',
        provider_response: data,
        completed_at: new Date(),
      });
    }
  }

  // Activate subscription
  if (subscriptionId) {
    const plan = await subscriptionRepo.findPlanById(planId);
    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1); // 1 month

    await subscriptionRepo.update(subscriptionId, {
      status: SUBSCRIPTION_STATUS.ACTIVE,
      starts_at: startsAt,
      ends_at: endsAt,
      provider_ref: reference,
    });

    await auditRepo.log({
      action: AUDIT_EVENTS.SUBSCRIPTION_ACTIVATED,
      entityType: 'SUBSCRIPTION',
      entityId: subscriptionId,
      metadata: { orgId, planId, reference, amountKobo: data.amount },
    });

    logger.info('Subscription activated', { orgId, subscriptionId });
  }
}

/**
 * Handle a subscription disable event.
 */
async function handleSubscriptionDisable(data) {
  const reference = data?.subscription_code;
  if (!reference) return;

  // Find subscription by provider reference
  const result = await query(
    'SELECT id FROM subscriptions WHERE provider_sub_id = $1',
    [reference]
  );
  if (result.rows.length === 0) return;

  const sub = result.rows[0];
  await subscriptionRepo.update(sub.id, { status: SUBSCRIPTION_STATUS.CANCELLED });

  await auditRepo.log({
    action: AUDIT_EVENTS.SUBSCRIPTION_EXPIRED,
    entityType: 'SUBSCRIPTION',
    entityId: sub.id,
    metadata: { reference },
  });
}

/**
 * Renew a subscription.
 */
async function renewSubscription(subscriptionId, { planId }, actorUser, req) {
  const sub = await query(
    'SELECT * FROM subscriptions WHERE id = $1',
    [subscriptionId]
  );
  if (sub.rows.length === 0) throw new NotFoundError('Subscription not found');

  const subscription = sub.rows[0];
  const targetPlanId = planId || subscription.plan_id;

  const plan = await subscriptionRepo.findPlanById(targetPlanId);
  if (!plan) throw new NotFoundError('Plan not found');

  // Re-use createSubscription flow
  return createSubscription({ orgId: subscription.organization_id, planId: targetPlanId }, actorUser, req);
}

/**
 * Get payment history for an organisation.
 */
async function getPayments(orgId, query, actorUser) {
  // Orgs can only see their own payments; admin sees all
  const org = await orgRepo.findByUserId(actorUser.id);
  if (org?.id !== orgId && actorUser.role !== 'ADMIN') {
    throw new BusinessRuleError('Access denied');
  }

  const { page = 1, limit = 20 } = query;
  return subscriptionRepo.findPayments(orgId, { page, limit });
}

/**
 * Format a plan for API response.
 */
function formatPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    price: {
      kobo: plan.price_kobo,
      formatted: `₦${(plan.price_kobo / 100).toLocaleString('en-NG')}`,
    },
    currency: plan.currency,
    billingCycle: plan.billing_cycle,
    trialDays: plan.trial_days,
    features: plan.features || [],
    isActive: plan.is_active,
  };
}

module.exports = {
  getPlans,
  createSubscription,
  renewSubscription,
  getPayments,
  processPaystackWebhook,
};
