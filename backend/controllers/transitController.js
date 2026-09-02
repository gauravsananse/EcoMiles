const TransitBeacon = require('../models/TransitBeacon');
const TransitStop = require('../models/TransitStop');
const PublicTransportRoute = require('../models/PublicTransportRoute');
const publicTransportVerification = require('../services/publicTransportVerification');
const publicTransportRouteService = require('../services/publicTransportRouteService');
const transitService = require('../services/transitService');

/**
 * Get transit context for a location (corridors, stops, active beacons)
 * GET /api/transit/context
 */
exports.getTransitContext = async (req, res) => {
  try {
    const lat = Number(req.query.lat) || 18.5284;
    const lng = Number(req.query.lng) || 73.8744;

    await publicTransportVerification.seedDefaultBeacons();
    await transitService.ensureTransitStopsSeeded();
    await publicTransportRouteService.ensureSampleRoutesSeeded();

    const beacons = await TransitBeacon.find({ status: 'ACTIVE' }).limit(20);
    const nearbyStops = await transitService.getNearbyStops(lat, lng, 3000);
    const nearbyRoutes = await publicTransportRouteService.findNearbyCandidateRoutes(lat, lng, 3000);

    return res.status(200).json({
      success: true,
      context: {
        center: { lat, lng },
        activeBeacons: beacons,
        nearbyStops,
        nearbyRoutes,
      },
    });
  } catch (error) {
    console.error('[TransitController.getTransitContext] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch transit context' });
  }
};

/**
 * Get nearby stops
 * GET /api/transit/stops/nearby
 */
exports.getNearbyStops = async (req, res) => {
  try {
    const lat = Number(req.query.lat) || 18.5284;
    const lng = Number(req.query.lng) || 73.8744;
    const radius = Number(req.query.radius) || 3000;

    const stops = await transitService.getNearbyStops(lat, lng, radius);
    return res.status(200).json({ success: true, count: stops.length, stops });
  } catch (error) {
    console.error('[TransitController.getNearbyStops] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch nearby stops' });
  }
};

/**
 * Get upcoming bus/metro arrivals for a stop
 * GET /api/transit/arrivals/:stopId
 */
exports.getUpcomingArrivals = async (req, res) => {
  try {
    const { stopId } = req.params;
    const arrivals = await transitService.getUpcomingArrivals(stopId);
    return res.status(200).json({ success: true, count: arrivals.length, arrivals });
  } catch (error) {
    console.error('[TransitController.getUpcomingArrivals] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch arrivals' });
  }
};

/**
 * Multimodal Transit Itinerary Search
 * GET /api/transit/routes/search
 */
exports.searchRoutes = async (req, res) => {
  try {
    const { origin = 'Current Location', destination = 'Hinjewadi Phase 1', lat, lng } = req.query;
    const userLat = Number(lat) || 18.5284;
    const userLng = Number(lng) || 73.8744;

    const itineraries = await transitService.searchRoutes(origin, destination, userLat, userLng);
    return res.status(200).json({ success: true, count: itineraries.length, itineraries });
  } catch (error) {
    console.error('[TransitController.searchRoutes] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to search transit routes' });
  }
};

/**
 * Get registered transit beacons
 * GET /api/transit/beacons
 */
exports.getBeacons = async (req, res) => {
  try {
    const beacons = await TransitBeacon.find({ status: 'ACTIVE' });
    return res.status(200).json({ success: true, count: beacons.length, beacons });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch transit beacons' });
  }
};

/**
 * Get route details
 * GET /api/transit/routes/:routeId
 */
exports.getRouteDetails = async (req, res) => {
  try {
    const route = await PublicTransportRoute.findOne({ routeId: req.params.routeId, isActive: true });
    if (!route) {
      return res.status(404).json({ success: false, error: 'Transit route not found' });
    }
    return res.status(200).json({ success: true, route });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch route details' });
  }
};

/**
 * Get stop details
 * GET /api/transit/stops/:stopId
 */
exports.getStopDetails = async (req, res) => {
  try {
    const stop = await TransitStop.findOne({ stopId: req.params.stopId, isActive: true });
    if (!stop) {
      return res.status(404).json({ success: false, error: 'Transit stop not found' });
    }
    return res.status(200).json({ success: true, stop });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch stop details' });
  }
};
