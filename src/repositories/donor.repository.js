'use strict';

const { query } = require('../config/database');

const findById = async (id) => {
  const result = await query('SELECT * FROM donors WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findByUserId = async (userId) => {
  const result = await query(`
    SELECT d.*, u.email as user_email, u.phone as user_phone, u.status as user_status
    FROM donors d
    JOIN users u ON d.user_id = u.id
    WHERE d.user_id = $1
  `, [userId]);
  return result.rows[0] || null;
};

const create = async ({ userId, fullName, dateOfBirth, gender, bloodType, address, lga, state, preferredChannel, consentGiven, dataSharingConsent, healthInformation, latitude, longitude }) => {
  const hasLocation = latitude != null && longitude != null;
  const locationStr = hasLocation ? 'ST_MakePoint($13, $14)::geography' : 'NULL';
  const params = [
    userId, fullName, dateOfBirth, gender, bloodType, address, lga, state,
    preferredChannel, consentGiven, dataSharingConsent, healthInformation
  ];
  if (hasLocation) {
    params.push(longitude, latitude);
  }
  
  const result = await query(`
    INSERT INTO donors (
      user_id, full_name, date_of_birth, gender, blood_type, address, lga, state,
      preferred_channel, consent_given, data_sharing_consent, health_information, location
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${locationStr}
    ) RETURNING *
  `, params);
  
  return result.rows[0];
};

const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return await findById(id);
  
  const setString = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const params = [id, ...Object.values(fields)];
  
  const result = await query(`
    UPDATE donors SET ${setString}, updated_at = NOW() WHERE id = $1 RETURNING *
  `, params);
  return result.rows[0];
};

const updateAvailability = async (id, isAvailable) => {
  const result = await query(`
    UPDATE donors SET is_available = $2, updated_at = NOW() WHERE id = $1 RETURNING *
  `, [id, isAvailable]);
  return result.rows[0];
};

const findMatchingDonors = async ({ bloodType, lat, lng, radiusMeters, limit = 50 }) => {
  const result = await query(`
    SELECT d.*, ST_Distance(d.location, ST_MakePoint($2, $3)::geography) AS distance_meters
    FROM donors d
    WHERE d.blood_type = $1
      AND d.is_available = true
      AND d.consent_given = true
      AND d.location IS NOT NULL
      AND ST_DWithin(d.location, ST_MakePoint($2, $3)::geography, $4)
    ORDER BY distance_meters ASC
    LIMIT $5
  `, [bloodType, lng, lat, radiusMeters, limit]);
  return result.rows;
};

const getDonationHistory = async (donorId, { page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const countResult = await query(`SELECT COUNT(*) FROM donor_responses WHERE donor_id = $1`, [donorId]);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const result = await query(`
    SELECT drs.*, dr.blood_type, dr.units_needed, dr.urgency, o.name as organization_name
    FROM donor_responses drs
    JOIN donation_requests dr ON drs.donation_request_id = dr.id
    JOIN organizations o ON dr.organization_id = o.id
    WHERE drs.donor_id = $1
    ORDER BY drs.created_at DESC
    LIMIT $2 OFFSET $3
  `, [donorId, limit, offset]);
  
  return { data: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

module.exports = {
  findById,
  findByUserId,
  create,
  update,
  updateAvailability,
  findMatchingDonors,
  getDonationHistory
};
