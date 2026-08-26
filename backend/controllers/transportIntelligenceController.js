const transportIntelligenceService = require('../services/transportIntelligenceService');

// @desc    Get aggregate transport network intelligence, demand heatmaps, and recommendations
// @route   GET /api/city/transport-intelligence
// @access  Public / Private
exports.getCityIntelligence = async (req, res) => {
  try {
    const analytics = transportIntelligenceService.getCityNetworkAnalytics();
    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('[TransportIntelligenceController.getCityIntelligence] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch transport network intelligence.',
    });
  }
};
