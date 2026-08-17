'use strict';

const { query } = require('../config/database');

const create = async ({ requestingOrgId, bloodType, unitsNeeded, urgency, patientInfo, notes, fulfillingOrgId }) => {
  const result = await query(`
    INSERT INTO emergency_requests (
      requesting_org_id, blood_type, units_needed, urgency,
      patient_info, notes, fulfilling_org_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    ) RETURNING *
  `, [requestingOrgId, bloodType, unitsNeeded, urgency, patientInfo, notes, fulfillingOrgId]);
  return result.rows[0];
};

const findById = async (id) => {
  const result = await query(`
    SELECT er.*,
           req_org.name as requesting_org_name,
           ful_org.name as fulfilling_org_name
    FROM emergency_requests er
    JOIN organizations req_org ON er.requesting_org_id = req_org.id
    LEFT JOIN organizations ful_org ON er.fulfilling_org_id = ful_org.id
    WHERE er.id = $1
  `, [id]);
  return result.rows[0] || null;
};

const findAll = async ({ orgId, role, status, bloodType, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let whereClauses = [];
  let params = [];
  
  if (role !== 'ADMIN') {
    params.push(orgId);
    whereClauses.push(`(requesting_org_id = $${params.length} OR fulfilling_org_id = $${params.length})`);
  }
  
  if (status) {
    params.push(status);
    whereClauses.push(`status = $${params.length}`);
  }
  
  if (bloodType) {
    params.push(bloodType);
    whereClauses.push(`blood_type = $${params.length}`);
  }
  
  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const countResult = await query(`SELECT COUNT(*) FROM emergency_requests ${whereStr}`, params);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const pLimit = params.length + 1;
  const pOffset = params.length + 2;
  const dataResult = await query(`
    SELECT * FROM emergency_requests
    ${whereStr}
    ORDER BY created_at DESC
    LIMIT $${pLimit} OFFSET $${pOffset}
  `, [...params, limit, offset]);
  
  return { data: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const updateStatus = async (id, status, { respondedBy, responseNotes, rejectionReason } = {}) => {
  let extraUpdates = '';
  let params = [id, status];
  
  if (status === 'ACCEPTED') {
    params.push(respondedBy, responseNotes);
    extraUpdates = `, responded_by = $3, response_notes = $4, responded_at = NOW()`;
  } else if (status === 'REJECTED') {
    params.push(respondedBy, rejectionReason);
    extraUpdates = `, responded_by = $3, rejection_reason = $4, responded_at = NOW()`;
  } else if (status === 'COMPLETED') {
    extraUpdates = `, completed_at = NOW()`;
  }
  
  const result = await query(`
    UPDATE emergency_requests
    SET status = $2, updated_at = NOW() ${extraUpdates}
    WHERE id = $1
    RETURNING *
  `, params);
  
  return result.rows[0];
};

const addTransferDetails = async (requestId, { courierName, courierPhone, vehicleNumber, trackingReference, dispatchedBy, estimatedArrival, notes }) => {
  const result = await query(`
    INSERT INTO request_transfers (
      request_id, courier_name, courier_phone, vehicle_number,
      tracking_reference, dispatched_by, estimated_arrival, notes
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    ) RETURNING *
  `, [requestId, courierName, courierPhone, vehicleNumber, trackingReference, dispatchedBy, estimatedArrival, notes]);
  return result.rows[0];
};

const getTransferDetails = async (requestId) => {
  const result = await query('SELECT * FROM request_transfers WHERE request_id = $1', [requestId]);
  return result.rows[0] || null;
};

const confirmReceived = async (requestId, userId, notes) => {
  await query(`
    UPDATE request_transfers
    SET received_by = $2, received_at = NOW(), receive_notes = $3
    WHERE request_id = $1
  `, [requestId, userId, notes]);
  
  const result = await query(`
    UPDATE emergency_requests
    SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [requestId]);
  
  return result.rows[0];
};

module.exports = {
  create,
  findById,
  findAll,
  updateStatus,
  addTransferDetails,
  getTransferDetails,
  confirmReceived
};
