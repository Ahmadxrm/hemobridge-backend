'use strict';

const { query } = require('../config/database');

const findPlans = async () => {
  const result = await query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY display_order ASC');
  return result.rows;
};

const findPlanById = async (id) => {
  const result = await query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findPlanBySlug = async (slug) => {
  const result = await query('SELECT * FROM subscription_plans WHERE slug = $1', [slug]);
  return result.rows[0] || null;
};

const findActiveSubscription = async (orgId) => {
  const result = await query(`
    SELECT s.*, p.name as plan_name, p.slug as plan_slug
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = $1
      AND s.status IN ('TRIAL', 'ACTIVE')
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [orgId]);
  return result.rows[0] || null;
};

const create = async ({ organizationId, planId, status, trialStartsAt, trialEndsAt, startsAt, endsAt }) => {
  const result = await query(`
    INSERT INTO subscriptions (
      organization_id, plan_id, status, trial_starts_at, trial_ends_at, starts_at, ends_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    ) RETURNING *
  `, [organizationId, planId, status, trialStartsAt, trialEndsAt, startsAt, endsAt]);
  return result.rows[0];
};

const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    const result = await query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  
  const setString = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const params = [id, ...Object.values(fields)];
  
  const result = await query(`
    UPDATE subscriptions SET ${setString}, updated_at = NOW() WHERE id = $1 RETURNING *
  `, params);
  return result.rows[0];
};

const findPayments = async (orgId, { page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const countResult = await query(`SELECT COUNT(*) FROM payments WHERE organization_id = $1`, [orgId]);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const result = await query(`
    SELECT * FROM payments
    WHERE organization_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [orgId, limit, offset]);
  
  return { data: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const createPayment = async ({ organizationId, subscriptionId, planId, amountKobo, currency, provider, providerRef }) => {
  const result = await query(`
    INSERT INTO payments (
      organization_id, subscription_id, plan_id, amount_kobo, currency,
      provider, provider_ref, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, 'PENDING'
    ) RETURNING *
  `, [organizationId, subscriptionId, planId, amountKobo, currency, provider, providerRef]);
  return result.rows[0];
};

const findPaymentByProviderRef = async (providerRef) => {
  const result = await query('SELECT * FROM payments WHERE provider_ref = $1', [providerRef]);
  return result.rows[0] || null;
};

const updatePayment = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    const result = await query('SELECT * FROM payments WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  
  const setString = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const params = [id, ...Object.values(fields)];
  
  const result = await query(`
    UPDATE payments SET ${setString}, updated_at = NOW() WHERE id = $1 RETURNING *
  `, params);
  return result.rows[0];
};

const recordWebhookEvent = async ({ provider, eventType, providerRef, payload }) => {
  const result = await query(`
    INSERT INTO payment_events (provider, event_type, provider_ref, payload)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (provider, provider_ref, event_type) DO NOTHING
    RETURNING *
  `, [provider, eventType, providerRef, payload]);
  
  return {
    inserted: result.rowCount > 0,
    row: result.rows[0] || null
  };
};

const markWebhookProcessed = async (id) => {
  const result = await query(`
    UPDATE payment_events SET processed = true, updated_at = NOW() WHERE id = $1 RETURNING *
  `, [id]);
  return result.rows[0];
};

const seedDefaultPlans = async () => {
  const result = await query(`SELECT COUNT(*) FROM subscription_plans`);
  if (parseInt(result.rows[0].count, 10) === 0) {
    await query(`
      INSERT INTO subscription_plans (
        name, slug, description, price_kobo, trial_days, features, is_active, display_order
      ) VALUES (
        'Basic', 'basic', 'Basic organization plan', 1000000, 14,
        '["Request Blood", "Inventory Management", "Find Donors"]'::jsonb, true, 1
      )
    `);
  }
};

module.exports = {
  findPlans,
  findPlanById,
  findPlanBySlug,
  findActiveSubscription,
  create,
  update,
  findPayments,
  createPayment,
  findPaymentByProviderRef,
  updatePayment,
  recordWebhookEvent,
  markWebhookProcessed,
  seedDefaultPlans
};
