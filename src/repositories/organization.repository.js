'use strict';

const { query } = require('../config/database');

const findById = async (id) => {
  const result = await query(`
    SELECT o.*, u.email as user_email, u.phone as user_phone, u.status as user_status, u.role as user_role
    FROM organizations o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = $1
  `, [id]);
  return result.rows[0] || null;
};

const findByUserId = async (userId) => {
  const result = await query('SELECT * FROM organizations WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
};

const findByEmail = async (email) => {
  const result = await query('SELECT * FROM organizations WHERE email = $1', [email]);
  return result.rows[0] || null;
};

const create = async ({ userId, name, email, phone, address, city, state, lga, organizationType, registrationNumber, hospitalType, ownershipType, representativeName, representativeEmail, representativePhone, operatingStatus, licenceDocumentUrl, latitude, longitude }) => {
  const hasLocation = latitude != null && longitude != null;
  const locationStr = hasLocation ? 'ST_MakePoint($18, $19)::geography' : 'NULL';
  const params = [
    userId, name, email, phone, address, city, state, lga,
    organizationType, registrationNumber, hospitalType, ownershipType,
    representativeName, representativeEmail, representativePhone,
    operatingStatus, licenceDocumentUrl
  ];
  if (hasLocation) {
    params.push(longitude, latitude);
  }
  
  const queryStr = `
    INSERT INTO organizations (
      user_id, name, email, phone, address, city, state, lga,
      organization_type, registration_number, hospital_type, ownership_type,
      representative_name, representative_email, representative_phone,
      operating_status, licence_document_url, location
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, ${locationStr}
    ) RETURNING *
  `;
  
  const result = await query(queryStr, params);
  return result.rows[0];
};

const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return await findById(id);
  
  const setString = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const params = [id, ...Object.values(fields)];
  
  const result = await query(`
    UPDATE organizations SET ${setString}, updated_at = NOW() WHERE id = $1 RETURNING *
  `, params);
  return result.rows[0];
};

const updateStatus = async (id, status, { verifiedBy, verificationNotes, rejectionReason, suspendedReason } = {}) => {
  const result = await query(`
    UPDATE organizations
    SET status = $2, verified_by = $3, verification_notes = $4,
        rejection_reason = $5, suspended_reason = $6, updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [id, status, verifiedBy, verificationNotes, rejectionReason, suspendedReason]);
  return result.rows[0];
};

const findAll = async ({ status, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let whereStr = '';
  const params = [limit, offset];
  if (status) {
    whereStr = 'WHERE status = $3';
    params.push(status);
  }
  
  const countResult = await query(`SELECT COUNT(*) FROM organizations ${whereStr}`, status ? [status] : []);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const result = await query(`
    SELECT * FROM organizations ${whereStr}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `, params);
  
  return { data: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const findNearby = async ({ bloodType, lat, lng, radiusMeters, status = 'VERIFIED' }) => {
  const result = await query(`
    SELECT o.*, ST_Distance(o.location, ST_MakePoint($2, $3)::geography) AS distance_meters
    FROM organizations o
    JOIN blood_inventory bi ON bi.organization_id = o.id
    WHERE o.status = $1
      AND bi.blood_type = $4
      AND bi.is_available = true
      AND bi.is_expired = false
      AND bi.expiry_date > NOW()
      AND ST_DWithin(o.location, ST_MakePoint($2, $3)::geography, $5)
    ORDER BY distance_meters ASC
  `, [status, lng, lat, bloodType, radiusMeters]);
  
  return result.rows;
};

module.exports = {
  findById,
  findByUserId,
  findByEmail,
  create,
  update,
  updateStatus,
  findAll,
  findNearby
};
