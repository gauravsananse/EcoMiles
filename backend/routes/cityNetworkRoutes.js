const express = require('express');
const router = express.Router();
const cityNetworkController = require('../controllers/cityNetworkController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Primary unified endpoint
router.get('/overview', optionalAuth, cityNetworkController.getOverview);
router.get('/dashboard', optionalAuth, cityNetworkController.getOverview);

// Granular section endpoints
router.get('/summary', optionalAuth, cityNetworkController.getSummary);
router.get('/walking', optionalAuth, cityNetworkController.getWalking);
router.get('/cycling', optionalAuth, cityNetworkController.getCycling);
router.get('/ev', optionalAuth, cityNetworkController.getEv);
router.get('/public-transport', optionalAuth, cityNetworkController.getPublicTransport);
router.get('/co2', optionalAuth, cityNetworkController.getCo2);

module.exports = router;
