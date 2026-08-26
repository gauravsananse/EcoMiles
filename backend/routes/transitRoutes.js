const express = require('express');
const router = express.Router();
const { getTransitContext, getBeacons } = require('../controllers/transitController');

// Get transit context for location
router.get('/context', getTransitContext);

// Get registered transit beacons
router.get('/beacons', getBeacons);

module.exports = router;
