const User = require('../models/User');
const jwt = require('jsonwebtoken');

const signToken = (id) => {
  const secret = process.env.JWT_SECRET || 'green_credits_ev_secret_key_2026';
  return jwt.sign({ id }, secret, {
    expiresIn: '30d',
  });
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  fitnessPoints: user.fitnessPoints ?? 0,
  greenCredits: user.greenCredits ?? 0,
  totalCo2SavedKg: user.totalCo2SavedKg ?? 0,
  totalDistanceKm: user.totalDistanceKm ?? 0,
  totalActiveMinutes: user.totalActiveMinutes ?? 0,
  createdAt: user.createdAt,
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      fitnessPoints: 0,
      greenCredits: 0,
      totalCo2SavedKg: 0,
      totalDistanceKm: 0,
      totalActiveMinutes: 0,
    });

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('[AuthController.register] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Server error during registration.',
    });
  }
};

// @desc    Login existing user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Find user and include passwordHash
    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('[AuthController.login] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Server error during login.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: formatUser(req.user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile.',
    });
  }
};
