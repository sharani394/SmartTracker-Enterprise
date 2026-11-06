const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const Organisation = require('../models/Organisation');
const Session = require('../models/Session');
const { AppError } = require('./errorHandler');

async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw new AppError('Authentication is required.', 401, 'UNAUTHENTICATED');

    const claims = jwt.verify(match[1], config.jwtSecret, { algorithms: ['HS256'] });
    if (!claims.sub || !claims.sid) throw new Error('Token is missing required claims.');

    const session = await Session.findOne({
      _id: claims.sid,
      userId: claims.sub,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!session) throw new AppError('Session is no longer active.', 401, 'SESSION_REVOKED');

    const user = await User.findById(session.userId);
    if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt) {
      throw new AppError('This account cannot access the service.', 403, 'ACCOUNT_INACTIVE');
    }

    if (String(user.organisationId) !== String(session.organisationId)) {
      throw new AppError('Session organisation no longer matches the account.', 401, 'INVALID_SESSION');
    }

    const organisation = await Organisation.findById(user.organisationId);
    if (!organisation || organisation.status !== 'ACTIVE') {
      throw new AppError('This organisation is not active.', 403, 'ORGANISATION_INACTIVE');
    }

    req.auth = {
      user,
      role: user.role,
      organisationId: user.organisationId,
      sessionId: session._id,
    };
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('A valid bearer token is required.', 401, 'INVALID_TOKEN'));
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) return next(new AppError('Authentication is required.', 401, 'UNAUTHENTICATED'));
    if (!roles.includes(req.auth.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { authenticate, requireRoles };
