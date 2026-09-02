const express = require('express');
const router = express.Router();
const transitController = require('../controllers/transitController');

// Transit context (beacons, stops, corridors)
router.get('/context', transitController.getTransitContext);

// Nearby stops
router.get('/stops/nearby', transitController.getNearbyStops);

// Multimodal route search
router.get('/routes/search', transitController.searchRoutes);

// Upcoming arrivals for a stop
router.get('/arrivals/:stopId', transitController.getUpcomingArrivals);

// Route details
router.get('/routes/:routeId', transitController.getRouteDetails);

// Stop details
router.get('/stops/:stopId', transitController.getStopDetails);

// Beacons list
router.get('/beacons', transitController.getBeacons);

module.exports = router;
