const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const vehicleController = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');

// Rate limiting on verification endpoint: 15 requests per 5 minutes per IP
const verifyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorState: 'RATE_LIMITED',
    error: 'Too many vehicle verification attempts. Please wait a few minutes before trying again.',
  },
});

// Verification route (supports both anonymous and authenticated lookups)
router.post('/verify', verifyRateLimiter, vehicleController.verifyVehicle);

// Protected vehicle management routes
router.post('/register', protect, vehicleController.registerVehicle);
router.get('/my-vehicle', protect, vehicleController.getMyVehicle);
router.post('/qr/verify', protect, vehicleController.verifyQR);
router.post('/qr/regenerate', protect, vehicleController.regenerateQR);
router.delete('/:vehicleId', protect, vehicleController.unlinkVehicle);

module.exports = router;
