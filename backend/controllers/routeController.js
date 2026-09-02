const routeService = require('../services/routeService');

// @desc    Autocomplete place suggestions using Google Places / OpenStreetMap
// @route   GET /api/routes/places/autocomplete
// @access  Public
exports.autocompletePlaces = async (req, res) => {
  try {
    const { input, sessionToken, lat, lng } = req.query;
    if (!input || !input.trim()) {
      return res.status(200).json({ success: true, predictions: [] });
    }

    const predictions = await routeService.autocompletePlaces({
      input: input.trim(),
      sessionToken: sessionToken || '',
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
    });

    return res.status(200).json({
      success: true,
      count: predictions.length,
      predictions,
    });
  } catch (error) {
    console.error('[RouteController.autocompletePlaces] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to search place suggestions.',
    });
  }
};

// @desc    Get exact place coordinates and details by placeId
// @route   GET /api/routes/places/details
// @access  Public
exports.getPlaceDetails = async (req, res) => {
  try {
    const { placeId, sessionToken, fallbackName } = req.query;
    if (!placeId) {
      return res.status(400).json({ success: false, error: 'placeId is required' });
    }

    const placeDetails = await routeService.getPlaceDetails({
      placeId,
      sessionToken: sessionToken || '',
      fallbackName: fallbackName || '',
    });

    return res.status(200).json({
      success: true,
      data: placeDetails,
    });
  } catch (error) {
    console.error('[RouteController.getPlaceDetails] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to get place details.',
    });
  }
};

// @desc    Reverse geocode latitude and longitude to address for "Use my current location"
// @route   GET /api/routes/places/reverse-geocode
// @access  Public
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters are required' });
    }

    const location = await routeService.reverseGeocode({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });

    return res.status(200).json({
      success: true,
      location,
    });
  } catch (error) {
    console.error('[RouteController.reverseGeocode] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to reverse geocode location.',
    });
  }
};

// @desc    Calculate real Google Maps / OSRM routes for Walking, Cycling, and Driving
// @route   POST /api/routes/smart-plan or POST /api/routes/plan
// @access  Public / Private
exports.planRoute = async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'Both origin and destination are required',
      });
    }

    const plan = await routeService.computeAllRoutes({
      origin,
      destination,
    });

    return res.status(200).json({
      success: true,
      data: plan,
      origin: plan.origin,
      destination: plan.destination,
      routes: plan.routes,
    });
  } catch (error) {
    console.error('[RouteController.planRoute] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to plan routes.',
    });
  }
};

// @desc    Recalculate dynamic route on off-route deviation
// @route   POST /api/routes/reroute
// @access  Public / Private
exports.reroute = async (req, res) => {
  try {
    const { currentLocation, destination, mode } = req.body;

    if (!currentLocation || !destination) {
      return res.status(400).json({
        success: false,
        error: 'currentLocation and destination are required for rerouting',
      });
    }

    const result = await routeService.reroute({
      currentLocation,
      destination,
      mode: mode || 'WALKING',
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[RouteController.reroute] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to recalculate route.',
    });
  }
};
