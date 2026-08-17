'use strict';

const { withTransaction } = require('../../config/database');
const { hashPassword } = require('../../utils/crypto');
const logger = require('../../utils/logger');

const seedDonors = async () => {
  try {
    await withTransaction(async (client) => {
      const donors = [
        {
          email: 'donor1@demo.hemobridge.com',
          fullName: 'Emeka Okonkwo Demo',
          bloodType: 'O+',
          state: 'Lagos',
          lga: 'Lagos Island',
          isAvailable: true,
          consentGiven: true,
          dataSharingConsent: true,
          lat: 6.4500,
          lon: 3.3800
        },
        {
          email: 'donor2@demo.hemobridge.com',
          fullName: 'Amina Hassan Demo',
          bloodType: 'A+',
          state: 'Lagos',
          lga: null,
          isAvailable: true,
          consentGiven: true,
          dataSharingConsent: true,
          lat: null,
          lon: null
        },
        {
          email: 'donor3@demo.hemobridge.com',
          fullName: 'Chidi Nwachukwu Demo',
          bloodType: 'B-',
          state: 'Lagos',
          lga: null,
          isAvailable: true,
          consentGiven: true,
          dataSharingConsent: true,
          lat: null,
          lon: null
        }
      ];

      for (const donor of donors) {
        let userResult = await client.query('SELECT id FROM users WHERE email = $1', [donor.email]);
        if (userResult.rows.length === 0) {
          const hashedPassword = await hashPassword('Donor@Demo2025!');
          const userInsert = await client.query(
            `INSERT INTO users (email, password_hash, role, status, email_verified)
             VALUES ($1, $2, 'DONOR', 'ACTIVE', true) RETURNING id`,
            [donor.email, hashedPassword]
          );
          const userId = userInsert.rows[0].id;

          let locationStr = 'NULL';
          if (donor.lat !== null && donor.lon !== null) {
            locationStr = `ST_MakePoint(${donor.lon}, ${donor.lat})::geography`;
          }

          await client.query(
            `INSERT INTO donors (
              user_id, full_name, blood_type, state, lga, is_available, 
              consent_given, data_sharing_consent, location
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${locationStr})`,
            [
              userId, donor.fullName, donor.bloodType, donor.state, donor.lga,
              donor.isAvailable, donor.consentGiven, donor.dataSharingConsent
            ]
          );
          logger.info(`DEV ONLY: Donor created. Email: ${donor.email} / Password: Donor@Demo2025! - NEVER USE IN PRODUCTION`);
        } else {
          logger.info(`Donor ${donor.email} already exists.`);
        }
      }
    });
  } catch (error) {
    logger.error('Error seeding donors:', error);
    throw error;
  }
};

module.exports = seedDonors;
