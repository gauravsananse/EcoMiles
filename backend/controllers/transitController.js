const TransitBeacon = require('../models/TransitBeacon');
const publicTransportVerification = require('../services/publicTransportVerification');

/**
 * Get transit context for a location (corridors, stops, active beacons)
 * GET /api/transit/context
 */
exports.getTransitContext = async (req, res) => {
  try {
    const lat = Number(req.query.lat) || 28.6139;
    const lng = Number(req.query.lng) || 77.2090;

    // Ensure initial beacons exist
    await publicTransportVerification.seedDefaultBeacons();

    const beacons = await TransitBeacon.find({ status: 'ACTIVE' }).limit(20);

    return res.status(200).json({
      success: true,
      context: {
        center: { lat, lng },
        corridorsCount: publicTransportVerification.transitCorridors.length,
        corridors: publicTransportVerification.transitCorridors,
        activeBeacons: beacons,
      },
    });
  } catch (error) {
    console.error('[TransitController.getTransitContext] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch transit context' });
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
