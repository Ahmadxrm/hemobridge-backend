'use strict';

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const seedInventory = async () => {
  try {
    const bloodBankEmail = 'bloodbank@demo.hemobridge.com';
    const orgResult = await query(
      `SELECT o.id FROM organizations o 
       JOIN users u ON o.user_id = u.id 
       WHERE u.email = $1`, 
      [bloodBankEmail]
    );

    if (orgResult.rows.length === 0) {
      logger.warn('Demo blood bank not found, skipping inventory seed.');
      return;
    }

    const orgId = orgResult.rows[0].id;
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    const existingInventory = await query(
      'SELECT id FROM blood_inventory WHERE organization_id = $1 LIMIT 1',
      [orgId]
    );

    if (existingInventory.rows.length === 0) {
      for (const bloodType of bloodTypes) {
        await query(
          `INSERT INTO blood_inventory (
            organization_id, blood_type, quantity, units_available, expiry_date, is_available
          ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', true)`,
          [orgId, bloodType, 10, 10]
        );
      }

      // Insert past expiry
      await query(
        `INSERT INTO blood_inventory (
          organization_id, blood_type, quantity, units_available, expiry_date, is_available
        ) VALUES ($1, $2, $3, $4, NOW() - INTERVAL '5 days', true)`,
        [orgId, 'O+', 2, 2]
      );
      
      logger.info('DEV ONLY - NEVER USE IN PRODUCTION: Blood inventory seeded for demo blood bank.');
    } else {
      logger.info('Inventory already seeded for demo blood bank.');
    }
  } catch (error) {
    logger.error('Error seeding inventory:', error);
    throw error;
  }
};

module.exports = seedInventory;
