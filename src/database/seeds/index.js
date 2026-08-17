'use strict';

const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const seedAdmin = require('./admin.seed');
const seedOrganizations = require('./organizations.seed');
const seedDonors = require('./donors.seed');
const seedInventory = require('./inventory.seed');
const seedRequests = require('./requests.seed');

const seedDefaultPlans = async () => {
  try {
    const plans = [
      {
        name: 'Basic',
        slug: 'basic',
        price_kobo: 1000000,
        billing_cycle: 'monthly',
        trial_days: 14,
        is_active: true,
        features: JSON.stringify([
          "Blood Inventory Management", "Blood Search and Availability", 
          "Emergency Blood Requests", "Donor Matching", "Donor Requests", 
          "Notifications", "Low-Stock Alerts", "Basic Request Tracking", 
          "Organization Profile", "Standard Customer Support"
        ]),
        display_order: 1
      },
      {
        name: 'Professional',
        slug: 'professional',
        price_kobo: 2000000,
        billing_cycle: 'monthly',
        trial_days: 14,
        is_active: false,
        features: JSON.stringify([]),
        display_order: 2
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        price_kobo: 0,
        billing_cycle: 'monthly',
        trial_days: 14,
        is_active: false,
        features: JSON.stringify([]),
        display_order: 3
      }
    ];

    for (const plan of plans) {
      await query(
        `INSERT INTO subscription_plans (
          name, slug, price_kobo, billing_cycle, trial_days, is_active, features, display_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          price_kobo = EXCLUDED.price_kobo,
          billing_cycle = EXCLUDED.billing_cycle,
          trial_days = EXCLUDED.trial_days,
          is_active = EXCLUDED.is_active,
          features = EXCLUDED.features,
          display_order = EXCLUDED.display_order`,
        [plan.name, plan.slug, plan.price_kobo, plan.billing_cycle, plan.trial_days, plan.is_active, plan.features, plan.display_order]
      );
    }
    logger.info('Default plans seeded successfully');
  } catch (error) {
    logger.error('Error seeding default plans:', error);
    throw error;
  }
};

const runDevSeeds = async () => {
  if (process.env.NODE_ENV === 'development') {
    try {
      logger.info('Starting development data seeds...');
      await seedAdmin();
      await seedOrganizations();
      await seedDonors();
      await seedInventory();
      await seedRequests();
      logger.info('Development data seeded successfully');
    } catch (error) {
      logger.error('Error running development seeds:', error);
      throw error;
    }
  } else {
    logger.warn('runDevSeeds called in non-development environment. Ignored.');
  }
};

module.exports = {
  seedDefaultPlans,
  runDevSeeds
};
