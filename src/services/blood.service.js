'use strict';

const orgRepo = require('../repositories/organization.repository');
const { ValidationError } = require('../utils/errors');
const { BLOOD_TYPES } = require('../utils/constants');
const { query } = require('../config/database');

async function searchBlood({ bloodType, lat, lng, radiusKm }) {
    if (!BLOOD_TYPES.includes(bloodType)) {
        throw new ValidationError('Invalid blood type');
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
        throw new ValidationError('Invalid coordinates');
    }

    const radiusMeters = radiusKm * 1000;
    const orgs = await orgRepo.findNearby({ bloodType, lat: latitude, lng: longitude, radiusMeters, status: 'VERIFIED' });

    const results = [];
    for (const org of orgs) {
        const result = await query(
            `SELECT SUM(units_available) as available
             FROM blood_inventory
             WHERE organization_id = $1 AND blood_type = $2 AND is_expired = false AND is_available = true AND expiry_date > NOW()`,
            [org.id, bloodType]
        );
        const availableUnits = parseInt(result.rows[0].available || 0, 10);
        
        if (availableUnits > 0) {
            results.push({
                organizationId: org.id,
                facilityName: org.name,
                address: org.address,
                state: org.state,
                bloodType,
                availableUnits,
                distanceKm: Math.round((org.distance_meters || 0) / 100) / 10,
                lastUpdated: new Date()
            });
        }
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

module.exports = {
    searchBlood
};
