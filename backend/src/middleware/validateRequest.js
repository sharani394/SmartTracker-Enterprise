const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request data failed validation.',
      details: result.array().map(({ type, path, msg, location }) => ({
        type,
        field: path,
        message: msg,
        location,
      })),
    },
  });
}

module.exports = validateRequest;
