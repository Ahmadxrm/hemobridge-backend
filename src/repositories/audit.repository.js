'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

const log = async ({ actorId, actorRole, action, entityType, entityId, metadata, ipAddress, userAgent }) => {
  try {
    const result = await query(`
      INSERT INTO audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        metadata, ip_address, user_agent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [actorId, actorRole, action, entityType, entityId, metadata, ipAddress, userAgent]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to write audit log', { error: error.message, action, actorId });
    // Intentionally not throwing error to prevent audit logging from breaking main flow
    return null;
  }
};

const findAll = async ({ action, actorId, entityType, from, to, page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  let whereClauses = [];
  let params = [];
  
  if (action) {
    params.push(action);
    whereClauses.push(`action = $${params.length}`);
  }
  
  if (actorId) {
    params.push(actorId);
    whereClauses.push(`actor_id = $${params.length}`);
  }
  
  if (entityType) {
    params.push(entityType);
    whereClauses.push(`entity_type = $${params.length}`);
  }
  
  if (from) {
    params.push(from);
    whereClauses.push(`created_at >= $${params.length}`);
  }
  
  if (to) {
    params.push(to);
    whereClauses.push(`created_at <= $${params.length}`);
  }
  
  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const countResult = await query(`SELECT COUNT(*) FROM audit_logs ${whereStr}`, params);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const pLimit = params.length + 1;
  const pOffset = params.length + 2;
  const dataResult = await query(`
    SELECT * FROM audit_logs
    ${whereStr}
    ORDER BY created_at DESC
    LIMIT $${pLimit} OFFSET $${pOffset}
  `, [...params, limit, offset]);
  
  return { data: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

module.exports = {
  log,
  findAll
};
