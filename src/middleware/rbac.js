'use strict';

const { AuthorizationError } = require('../utils/errors');

/**
 * RBAC middleware factory.
 * Returns a middleware that checks the authenticated user has one of the allowed roles.
 * Must be used AFTER the authenticate middleware.
 *
 * @param {...string} roles - Allowed roles (e.g., 'ADMIN', 'HOSPITAL', 'BLOOD_BANK')
 * @returns {function} Express middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AuthorizationError(
          `This action requires one of the following roles: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
}

/**
 * Require the ADMIN role.
 */
const requireAdmin = requireRole('ADMIN');

/**
 * Require an organisation role (HOSPITAL or BLOOD_BANK).
 */
const requireOrganization = requireRole('HOSPITAL', 'BLOOD_BANK');

/**
 * Require the DONOR role.
 */
const requireDonor = requireRole('DONOR');

/**
 * Require any authenticated user (all roles).
 * Use this when the route is role-agnostic but still requires login.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }
  next();
}

/**
 * Check that the authenticated user owns the resource or is an admin.
 * Usage: requireOwnerOrAdmin('userId') where 'userId' is the req.params key.
 */
function requireOwnerOrAdmin(paramKey = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    const resourceId = req.params[paramKey];
    const isOwner = req.user.id === resourceId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return next(
        new AuthorizationError('You do not have permission to access this resource')
      );
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin,
  requireOrganization,
  requireDonor,
  requireAuth,
  requireOwnerOrAdmin,
};
