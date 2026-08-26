const express = require('express');
const router = express.Router();
const transportIntelligenceController = require('../controllers/transportIntelligenceController');

router.get('/transport-intelligence', transportIntelligenceController.getCityIntelligence);

module.exports = router;
