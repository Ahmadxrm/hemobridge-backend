'use strict';

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const seedRequests = async () => {
  try {
    const hospitalEmail = 'hospital@demo.hemobridge.com';
    const bloodBankEmail = 'bloodbank@demo.hemobridge.com';

    const hospitalOrgResult = await query(
      `SELECT o.id FROM organizations o 
       JOIN users u ON o.user_id = u.id 
       WHERE u.email = $1`, 
      [hospitalEmail]
    );

    const bbOrgResult = await query(
      `SELECT o.id FROM organizations o 
       JOIN users u ON o.user_id = u.id 
       WHERE u.email = $1`, 
      [bloodBankEmail]
    );

    if (hospitalOrgResult.rows.length === 0 || bbOrgResult.rows.length === 0) {
      logger.warn('Demo hospital or blood bank not found, skipping requests seed.');
      return;
    }

    const hospitalId = hospitalOrgResult.rows[0].id;
    const bbId = bbOrgResult.rows[0].id;

    const existingRequests = await query(
      'SELECT id FROM blood_requests WHERE requesting_organization_id = $1 AND responding_organization_id = $2 LIMIT 1',
      [hospitalId, bbId]
    );

    if (existingRequests.rows.length === 0) {
      await query(
        `INSERT INTO blood_requests (
          requesting_organization_id, responding_organization_id, blood_type, 
          units_needed, status, urgency, request_date
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [hospitalId, bbId, 'O+', 3, 'PENDING', 'URGENT']
      );

      await query(
        `INSERT INTO blood_requests (
          requesting_organization_id, responding_organization_id, blood_type, 
          units_needed, status, urgency, request_date
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 day')`,
        [hospitalId, bbId, 'A+', 2, 'COMPLETED', 'ROUTINE']
      );

      logger.info('DEV ONLY - NEVER USE IN PRODUCTION: Blood requests seeded.');
    } else {
      logger.info('Blood requests already seeded.');
    }
  } catch (error) {
    logger.error('Error seeding blood requests:', error);
    throw error;
  }
};

module.exports = seedRequests;
