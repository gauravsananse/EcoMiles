const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');

// Google Places Autocomplete & Details
router.get('/places/autocomplete', routeController.autocompletePlaces);
router.get('/places/details', routeController.getPlaceDetails);
router.get('/places/reverse-geocode', routeController.reverseGeocode);

// Real Route Computation (Walking, Cycling, Driving)
router.post('/smart-plan', routeController.planRoute);
router.post('/plan', routeController.planRoute);

// Real-Time Off-Route Rerouting
router.post('/reroute', routeController.reroute);

module.exports = router;
