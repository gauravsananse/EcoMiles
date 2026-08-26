const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this resource. Please log in.',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'green_credits_ev_secret_key_2026';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'The user belonging to this token no longer exists.',
        code: 'USER_NOT_FOUND',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token. Please log in again.',
      code: 'INVALID_TOKEN',
    });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'green_credits_ev_secret_key_2026';
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Ignore invalid token in optional auth
  }
  next();
};

module.exports = { protect, optionalAuth };
