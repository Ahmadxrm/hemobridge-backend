'use strict';

const { query } = require('../config/database');

const findById = async (id) => {
  const result = await query('SELECT * FROM blood_inventory WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findByOrganization = async (orgId, { bloodType, includeExpired, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let whereClauses = ['organization_id = $1'];
  let params = [orgId];
  
  if (bloodType) {
    params.push(bloodType);
    whereClauses.push(`blood_type = $${params.length}`);
  }
  
  if (includeExpired === false || includeExpired === 'false') {
    whereClauses.push('is_expired = false AND expiry_date > NOW()');
  }
  
  const whereStr = `WHERE ${whereClauses.join(' AND ')}`;
  
  const countResult = await query(`SELECT COUNT(*) FROM blood_inventory ${whereStr}`, params);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const pLimit = params.length + 1;
  const pOffset = params.length + 2;
  const dataResult = await query(`
    SELECT * FROM blood_inventory
    ${whereStr}
    ORDER BY expiry_date ASC
    LIMIT $${pLimit} OFFSET $${pOffset}
  `, [...params, limit, offset]);
  
  return { data: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const create = async (orgId, { bloodType, quantity, expiryDate, collectionDate, componentType, batchNumber, storageLocation, notes }) => {
  const result = await query(`
    INSERT INTO blood_inventory (
      organization_id, blood_type, quantity, units_available,
      expiry_date, collection_date, component_type, batch_number,
      storage_location, notes
    ) VALUES (
      $1, $2, $3, $3, $4, $5, $6, $7, $8, $9
    ) RETURNING *
  `, [orgId, bloodType, quantity, expiryDate, collectionDate, componentType, batchNumber, storageLocation, notes]);
  return result.rows[0];
};

const update = async (id, orgId, fields, expectedVersion) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return await findById(id);
  
  const setString = keys.map((key, i) => `${key} = $${i + 4}`).join(', ');
  const params = [id, orgId, expectedVersion, ...Object.values(fields)];
  
  const result = await query(`
    UPDATE blood_inventory
    SET ${setString}, version = version + 1, updated_at = NOW()
    WHERE id = $1 AND organization_id = $2 AND version = $3
    RETURNING *
  `, params);
  
  if (result.rowCount === 0) {
    throw new Error('Optimistic locking failure or record not found');
  }
  
  return result.rows[0];
};

const remove = async (id, orgId) => {
  const result = await query(`
    DELETE FROM blood_inventory WHERE id = $1 AND organization_id = $2 RETURNING *
  `, [id, orgId]);
  return result.rows[0];
};

const getDashboard = async (orgId) => {
  const result = await query(`
    SELECT blood_type,
           SUM(units_available) as total_available,
           SUM(quantity) as total_quantity,
           COUNT(*) as batch_count,
           MIN(expiry_date) as earliest_expiry
    FROM blood_inventory
    WHERE organization_id = $1 AND is_expired = false
    GROUP BY blood_type
  `, [orgId]);
  return result.rows;
};

const markExpired = async () => {
  const result = await query(`
    UPDATE blood_inventory
    SET is_expired = true, is_available = false, updated_at = NOW()
    WHERE expiry_date <= NOW() AND is_expired = false
    RETURNING id
  `);
  return result.rows;
};

const findLowStock = async () => {
  const result = await query(`
    SELECT bi.*, o.low_stock_threshold, o.id as org_id
    FROM blood_inventory bi
    JOIN organizations o ON o.id = bi.organization_id
    WHERE bi.units_available <= o.low_stock_threshold
      AND bi.is_expired = false
      AND bi.is_available = true
  `);
  return result.rows;
};

module.exports = {
  findById,
  findByOrganization,
  create,
  update,
  delete: remove,
  getDashboard,
  markExpired,
  findLowStock
};
