'use strict';

const { withTransaction } = require('../../config/database');
const { hashPassword } = require('../../utils/crypto');
const logger = require('../../utils/logger');

const seedOrganizations = async () => {
  try {
    await withTransaction(async (client) => {
      // 1. Hospital
      const hospitalEmail = 'hospital@demo.hemobridge.com';
      let hospitalUserResult = await client.query('SELECT id FROM users WHERE email = $1', [hospitalEmail]);
      if (hospitalUserResult.rows.length === 0) {
        const hashedHospitalPassword = await hashPassword('Hospital@Demo2025!');
        const userInsert = await client.query(
          `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
           VALUES ($1, $2, $3, 'HOSPITAL', 'ACTIVE', true) RETURNING id`,
          [hospitalEmail, '+2348012345678', hashedHospitalPassword]
        );
        const hospitalUserId = userInsert.rows[0].id;

        await client.query(
          `INSERT INTO organizations (
            user_id, name, address, city, state, lga, organization_type, 
            hospital_type, ownership_type, phone, email, status, location, registration_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ST_MakePoint($13, $14)::geography, $15)`,
          [
            hospitalUserId, 'Lagos General Hospital Demo', '1 Hospital Road, Lagos Island', 
            'Lagos', 'Lagos', 'Lagos Island', 'HOSPITAL', 'GENERAL', 'GOVERNMENT', 
            '+2348012345678', hospitalEmail, 'VERIFIED', 3.3958, 6.4698, 'LGH-DEMO-001'
          ]
        );
        logger.info('DEV ONLY: Hospital org created. Email: hospital@demo.hemobridge.com / Password: Hospital@Demo2025! - NEVER USE IN PRODUCTION');
      } else {
        logger.info('Hospital demo org already exists.');
      }

      // 2. Blood Bank
      const bloodBankEmail = 'bloodbank@demo.hemobridge.com';
      let bbUserResult = await client.query('SELECT id FROM users WHERE email = $1', [bloodBankEmail]);
      if (bbUserResult.rows.length === 0) {
        const hashedBBPassword = await hashPassword('BloodBank@Demo2025!');
        const userInsert = await client.query(
          `INSERT INTO users (email, phone, password_hash, role, status, email_verified)
           VALUES ($1, $2, $3, 'BLOOD_BANK', 'ACTIVE', true) RETURNING id`,
          [bloodBankEmail, '+2348023456789', hashedBBPassword]
        );
        const bbUserId = userInsert.rows[0].id;

        await client.query(
          `INSERT INTO organizations (
            user_id, name, address, city, state, organization_type, 
            phone, email, status, location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_MakePoint($10, $11)::geography)`,
          [
            bbUserId, 'Lagos Blood Centre Demo', '5 Blood Centre Avenue, Victoria Island', 
            'Lagos', 'Lagos', 'BLOOD_BANK', '+2348023456789', bloodBankEmail, 'VERIFIED', 
            3.4200, 6.4320
          ]
        );
        logger.info('DEV ONLY: Blood Bank org created. Email: bloodbank@demo.hemobridge.com / Password: BloodBank@Demo2025! - NEVER USE IN PRODUCTION');
      } else {
        logger.info('Blood bank demo org already exists.');
      }
    });
  } catch (error) {
    logger.error('Error seeding organizations:', error);
    throw error;
  }
};

module.exports = seedOrganizations;
