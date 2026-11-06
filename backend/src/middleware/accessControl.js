const { AppError } = require('./errorHandler');

const DELEGABLE_PERMISSIONS = Object.freeze([
  'users:read',
  'users:manage',
  'agents:read',
  'agents:manage',
  'departments:read',
  'departments:manage',
  'settings:read',
  'settings:manage',
  'audit:read',
  'tickets:read',
  'tickets:manage',
  'knowledge:read',
  'knowledge:manage',
  'reports:read',
]);

const ROLE_PERMISSIONS = Object.freeze({
  OWNER: DELEGABLE_PERMISSIONS,
  PRIMARY_ADMIN: [
    'users:read', 'users:manage', 'agents:read', 'agents:manage',
    'departments:read', 'departments:manage', 'settings:read', 'audit:read', 'internalAdmins:manage',
    'tickets:read', 'tickets:manage',
    'knowledge:read', 'knowledge:manage', 'reports:read',
  ],
  INTERNAL_ADMIN: [],
  EMPLOYEE: [],
  SUPPORT_AGENT: [],
});

function hasPermission(auth, permission) {
  if (!auth) return false;
  if (auth.role === 'OWNER') return true;
  if (ROLE_PERMISSIONS[auth.role]?.includes(permission)) return true;
  return auth.role === 'INTERNAL_ADMIN' && Array.isArray(auth.user.permissions)
    && auth.user.permissions.includes(permission);
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth) return next(new AppError('Authentication is required.', 401, 'UNAUTHENTICATED'));
    if (!hasPermission(req.auth, permission)) {
      return next(new AppError('This action is not included in your delegated permissions.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (!req.auth) return next(new AppError('Authentication is required.', 401, 'UNAUTHENTICATED'));
    if (!permissions.some((permission) => hasPermission(req.auth, permission))) {
      return next(new AppError('This action is not included in your delegated permissions.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { DELEGABLE_PERMISSIONS, ROLE_PERMISSIONS, hasPermission, requirePermission, requireAnyPermission };
