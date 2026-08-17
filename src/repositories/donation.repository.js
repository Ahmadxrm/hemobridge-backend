'use strict';

const { query } = require('../config/database');

const create = async ({ organizationId, bloodType, unitsNeeded, urgency, message, searchRadiusKm, latitude, longitude, expiresAt }) => {
  const hasLocation = latitude != null && longitude != null;
  const locationStr = hasLocation ? 'ST_MakePoint($8, $7)::geography' : 'NULL';
  const params = [organizationId, bloodType, unitsNeeded, urgency, message, searchRadiusKm];
  
  if (hasLocation) {
    params.push(latitude, longitude);
  }
  params.push(expiresAt);
  
  const expireIdx = hasLocation ? 9 : 7;
  
  const result = await query(`
    INSERT INTO donation_requests (
      organization_id, blood_type, units_needed, urgency, message,
      search_radius_km, location, expires_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, ${locationStr}, $${expireIdx}
    ) RETURNING *
  `, params);
  return result.rows[0];
};

const findById = async (id) => {
  const result = await query('SELECT * FROM donation_requests WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findMatches = async (id) => {
  const result = await query(`
    SELECT d.*, ST_Distance(d.location, dr.location) as distance_meters
    FROM donors d
    CROSS JOIN donation_requests dr
    WHERE dr.id = $1
      AND d.blood_type = dr.blood_type
      AND d.is_available = true
      AND d.consent_given = true
      AND d.location IS NOT NULL
      AND ST_DWithin(d.location, dr.location, dr.search_radius_km * 1000)
    ORDER BY distance_meters
    LIMIT 100
  `, [id]);
  return result.rows;
};

const createResponse = async ({ donationRequestId, donorId, status, message, declineReason, availableDate, availableTime }) => {
  const result = await query(`
    INSERT INTO donor_responses (
      donation_request_id, donor_id, status, message, decline_reason,
      available_date, available_time
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    ) RETURNING *
  `, [donationRequestId, donorId, status, message, declineReason, availableDate, availableTime]);
  return result.rows[0];
};

const getResponse = async (donationRequestId, donorId) => {
  const result = await query(`
    SELECT * FROM donor_responses
    WHERE donation_request_id = $1 AND donor_id = $2
  `, [donationRequestId, donorId]);
  return result.rows[0] || null;
};

const getProgress = async (id) => {
  const result = await query(`
    SELECT status, COUNT(*) as count
    FROM donor_responses
    WHERE donation_request_id = $1
    GROUP BY status
  `, [id]);
  return result.rows;
};

const close = async (id, userId) => {
  const result = await query(`
    UPDATE donation_requests
    SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);
  return result.rows[0];
};

const getNotifiedDonors = async (id) => {
  const result = await query(`
    SELECT donor_id
    FROM donor_responses
    WHERE donation_request_id = $1
  `, [id]);
  return result.rows.map(r => r.donor_id);
};

const findByOrganization = async (orgId, { status, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let whereClauses = ['organization_id = $1'];
  let params = [orgId];
  
  if (status) {
    params.push(status);
    whereClauses.push(`status = $${params.length}`);
  }
  
  const whereStr = `WHERE ${whereClauses.join(' AND ')}`;
  
  const countResult = await query(`SELECT COUNT(*) FROM donation_requests ${whereStr}`, params);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const pLimit = params.length + 1;
  const pOffset = params.length + 2;
  const dataResult = await query(`
    SELECT * FROM donation_requests
    ${whereStr}
    ORDER BY created_at DESC
    LIMIT $${pLimit} OFFSET $${pOffset}
  `, [...params, limit, offset]);
  
  return { data: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const updateResponse = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return getResponse(id, null);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const result = await query(`
    UPDATE donor_responses SET ${sets}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, ...Object.values(fields)]);
  return result.rows[0];
};

module.exports = {
  create,
  findById,
  findMatches,
  createResponse,
  updateResponse,
  getResponse,
  getProgress,
  close,
  getNotifiedDonors,
  findByOrganization
};

